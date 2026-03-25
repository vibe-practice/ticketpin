// ============================================================
// 본인인증 세션 관리 (Supabase DB 기반)
// - TID와 인증 결과를 Supabase DB에 저장
// - 일회성 사용: result 조회 후 삭제
// - TTL: identity_sessions 10분, reset_tokens 5분
// - service_role 키로 접근 (RLS 우회)
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { IdentitySession } from "./types";

const RESET_TOKEN_TTL_MS = 5 * 60 * 1000; // 5분

/** 랜덤 세션/토큰 ID 생성 (crypto 기반) */
function generateId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 세션 생성: TID 저장 후 sessionId 반환 */
export async function createIdentitySession(tid: string): Promise<string> {
  const sessionId = generateId();
  const adminClient = createAdminClient();

  const { error } = await adminClient.from("identity_sessions").insert({
    session_id: sessionId,
    tid,
    confirmed: false,
  });

  if (error) {
    console.error("[session] createIdentitySession DB error:", error.message);
    throw new Error("세션 생성에 실패했습니다.");
  }

  return sessionId;
}

/** TID로 세션 찾기 (콜백에서 사용) */
export async function findSessionByTid(
  tid: string
): Promise<{ sessionId: string; session: IdentitySession } | null> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("identity_sessions")
    .select("session_id, tid, confirmed, result_name, result_phone, created_at, expires_at")
    .eq("tid", tid)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[session] findSessionByTid DB error:", error.message);
    return null;
  }

  if (!data) return null;

  const session: IdentitySession = {
    tid: data.tid,
    createdAt: new Date(data.created_at).getTime(),
    confirmed: data.confirmed,
    ...(data.result_name && data.result_phone
      ? { result: { name: data.result_name, phone: data.result_phone } }
      : {}),
  };

  return { sessionId: data.session_id, session };
}

/** sessionId로 세션 조회 */
export async function getIdentitySession(
  sessionId: string
): Promise<IdentitySession | null> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("identity_sessions")
    .select("tid, confirmed, result_name, result_phone, created_at, expires_at")
    .eq("session_id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("[session] getIdentitySession DB error:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    tid: data.tid,
    createdAt: new Date(data.created_at).getTime(),
    confirmed: data.confirmed,
    ...(data.result_name && data.result_phone
      ? { result: { name: data.result_name, phone: data.result_phone } }
      : {}),
  };
}

/** 세션에 인증 결과 저장 (콜백에서 confirm 후 호출) */
export async function setSessionResult(
  sessionId: string,
  result: { name: string; phone: string }
): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("identity_sessions")
    .update({
      confirmed: true,
      result_name: result.name,
      result_phone: result.phone,
    })
    .eq("session_id", sessionId)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[session] setSessionResult DB error:", error.message);
  }
}

/** 세션 삭제 (result 조회 후 일회성 사용) */
export async function deleteIdentitySession(sessionId: string): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("identity_sessions")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    console.error("[session] deleteIdentitySession DB error:", error.message);
  }
}

// ============================================================
// 비밀번호 재설정 일회용 토큰 관리
// - 본인인증 완료 후 발급, reset-password API에서 검증
// ============================================================

/** 비밀번호 재설정 토큰 생성 */
export async function createResetToken(
  username: string,
  phone: string
): Promise<string> {
  const tokenId = generateId();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  const adminClient = createAdminClient();

  const { error } = await adminClient.from("reset_tokens").insert({
    token_id: tokenId,
    username,
    phone,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[session] createResetToken DB error:", error.message);
    throw new Error("토큰 생성에 실패했습니다.");
  }

  return tokenId;
}

/** 비밀번호 재설정 토큰 검증 (일회용: 검증 후 삭제) */
export async function validateAndConsumeResetToken(
  tokenId: string
): Promise<{ username: string; phone: string } | null> {
  const adminClient = createAdminClient();

  // 조회 + 만료 체크
  const { data, error } = await adminClient
    .from("reset_tokens")
    .select("id, username, phone, expires_at")
    .eq("token_id", tokenId)
    .maybeSingle();

  if (error) {
    console.error("[session] validateAndConsumeResetToken DB error:", error.message);
    return null;
  }

  if (!data) return null;

  // 일회용: 즉시 삭제 (성공/만료 모두)
  await adminClient.from("reset_tokens").delete().eq("id", data.id);

  // 만료 체크
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return { username: data.username, phone: data.phone };
}
