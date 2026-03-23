// ============================================================
// 본인인증 세션 관리 (인메모리)
// - TID와 인증 결과를 서버 메모리에 저장
// - 일회성 사용: result 조회 후 삭제
// - TTL: 10분 (인증 완료까지의 타임아웃)
// ============================================================
// WARNING: serverless 환경(Vercel 등)에서는 인스턴스마다 별도 Map이 생성됩니다.
// TODO(Production): Upstash Redis 등 외부 저장소로 교체 필요

import type { IdentitySession } from "./types";

const SESSION_TTL_MS = 10 * 60 * 1000; // 10분
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 정리

// globalThis에 저장하여 Next.js 핫 리로드 시에도 세션 유지
const globalKey = "__danal_identity_sessions__" as const;
const globalStore = globalThis as unknown as {
  [globalKey]?: Map<string, IdentitySession>;
  __danal_last_cleanup__?: number;
};

if (!globalStore[globalKey]) {
  globalStore[globalKey] = new Map<string, IdentitySession>();
}

const sessions = globalStore[globalKey];
let lastCleanup = globalStore.__danal_last_cleanup__ ?? Date.now();

/** 만료된 세션 정리 */
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  globalStore.__danal_last_cleanup__ = now;
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

/** 랜덤 세션 ID 생성 (crypto 기반) */
function generateSessionId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 세션 생성: TID 저장 후 sessionId 반환 */
export function createIdentitySession(tid: string): string {
  cleanup();
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    tid,
    createdAt: Date.now(),
    confirmed: false,
  });
  return sessionId;
}

/** TID로 세션 찾기 (콜백에서 사용) */
export function findSessionByTid(
  tid: string
): { sessionId: string; session: IdentitySession } | null {
  cleanup();
  for (const [sessionId, session] of sessions) {
    if (session.tid === tid) {
      return { sessionId, session };
    }
  }
  return null;
}

/** sessionId로 세션 조회 */
export function getIdentitySession(
  sessionId: string
): IdentitySession | null {
  cleanup();
  const session = sessions.get(sessionId);
  if (!session) return null;

  // TTL 만료 체크
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/** 세션에 인증 결과 저장 (콜백에서 confirm 후 호출) */
export function setSessionResult(
  sessionId: string,
  result: { name: string; phone: string }
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.confirmed = true;
  session.result = result;
}

/** 세션 삭제 (result 조회 후 일회성 사용) */
export function deleteIdentitySession(sessionId: string): void {
  sessions.delete(sessionId);
}

// ============================================================
// 비밀번호 재설정 일회용 토큰 관리
// - 본인인증 완료 후 발급, reset-password API에서 검증
// ============================================================

interface ResetToken {
  username: string;
  phone: string;
  expiresAt: number;
}

const resetTokenKey = "__danal_reset_tokens__" as const;
const globalStoreForTokens = globalThis as unknown as {
  [resetTokenKey]?: Map<string, ResetToken>;
};

if (!globalStoreForTokens[resetTokenKey]) {
  globalStoreForTokens[resetTokenKey] = new Map<string, ResetToken>();
}

const resetTokens = globalStoreForTokens[resetTokenKey];

const RESET_TOKEN_TTL_MS = 5 * 60 * 1000; // 5분

/** 비밀번호 재설정 토큰 생성 */
export function createResetToken(username: string, phone: string): string {
  // 만료된 토큰 정리
  const now = Date.now();
  for (const [id, token] of resetTokens) {
    if (now > token.expiresAt) resetTokens.delete(id);
  }

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const tokenId = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  resetTokens.set(tokenId, {
    username,
    phone,
    expiresAt: now + RESET_TOKEN_TTL_MS,
  });

  return tokenId;
}

/** 비밀번호 재설정 토큰 검증 (일회용: 검증 후 삭제) */
export function validateAndConsumeResetToken(
  tokenId: string
): { username: string; phone: string } | null {
  const token = resetTokens.get(tokenId);
  if (!token) return null;

  resetTokens.delete(tokenId); // 일회용

  if (Date.now() > token.expiresAt) return null;

  return { username: token.username, phone: token.phone };
}
