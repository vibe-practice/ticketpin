/**
 * 결제 세션 관리 모듈
 *
 * 결제 준비(ready) 시 서버에서 계산한 금액을 세션에 저장하고,
 * 결제 승인(pay) 시 세션의 금액과 비교하여 클라이언트의 금액 조작을 방지한다.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ── 타입 정의 ──────────────────────────────────────────

export interface CreatePaymentSessionParams {
  mbrRefNo: string;
  userId: string;
  productId?: string;
  amount: number;
  feeType?: "included" | "separate" | null;
  quantity?: number;
  sessionType: "order" | "fee";
  voucherCode?: string;
}

export interface PaymentSession {
  id: string;
  mbr_ref_no: string;
  user_id: string;
  product_id: string | null;
  amount: number;
  fee_type: string | null;
  quantity: number | null;
  session_type: string;
  status: string;
  voucher_code: string | null;
  created_at: string;
  expires_at: string;
}

export interface ValidateSessionResult {
  valid: boolean;
  session?: PaymentSession;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
}

// ── 세션 TTL (30분) ────────────────────────────────────

const SESSION_TTL_MINUTES = 30;

// ── 세션 생성 ──────────────────────────────────────────

/**
 * 결제 세션을 생성한다.
 * PG 결제 준비(ready) 성공 후 호출한다.
 *
 * @throws 세션 생성 실패 시 에러
 */
export async function createPaymentSession(
  params: CreatePaymentSessionParams
): Promise<PaymentSession> {
  const adminClient = createAdminClient();

  const expiresAt = new Date(
    Date.now() + SESSION_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await adminClient
    .from("payment_sessions")
    .insert({
      mbr_ref_no: params.mbrRefNo,
      user_id: params.userId,
      product_id: params.productId ?? null,
      amount: params.amount,
      fee_type: params.feeType ?? null,
      quantity: params.quantity ?? null,
      session_type: params.sessionType,
      status: "pending",
      voucher_code: params.voucherCode ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[createPaymentSession] Insert failed:", error?.message);
    throw new Error(`결제 세션 생성 실패: ${error?.message ?? "unknown"}`);
  }

  return data as PaymentSession;
}

// ── 세션 조회 + 검증 ──────────────────────────────────

/**
 * mbrRefNo로 결제 세션을 조회하고 유효성을 검증한다.
 *
 * 검증 항목:
 * 1. 세션 존재 여부
 * 2. 만료 여부 (expires_at < now)
 * 3. 이미 사용된 세션 여부 (status !== 'pending')
 * 4. 금액 일치 여부
 * 5. 사용자 일치 여부
 */
export async function validatePaymentSession(
  mbrRefNo: string,
  expectedAmount: number,
  userId: string
): Promise<ValidateSessionResult> {
  const adminClient = createAdminClient();

  const { data: session, error } = await adminClient
    .from("payment_sessions")
    .select("*")
    .eq("mbr_ref_no", mbrRefNo)
    .single();

  if (error || !session) {
    return {
      valid: false,
      errorCode: "INVALID_SESSION",
      errorMessage: "유효하지 않은 결제 세션입니다. 다시 결제를 진행해 주세요.",
      httpStatus: 400,
    };
  }

  const typedSession = session as PaymentSession;

  // 만료 체크
  if (new Date(typedSession.expires_at) < new Date()) {
    // 만료된 세션은 상태 업데이트
    await adminClient
      .from("payment_sessions")
      .update({ status: "expired" })
      .eq("id", typedSession.id)
      .eq("status", "pending");

    return {
      valid: false,
      errorCode: "SESSION_EXPIRED",
      errorMessage: "결제 세션이 만료되었습니다. 다시 결제를 진행해 주세요.",
      httpStatus: 400,
    };
  }

  // 이미 사용된 세션
  if (typedSession.status !== "pending") {
    return {
      valid: false,
      errorCode: "SESSION_ALREADY_USED",
      errorMessage: "이미 처리된 결제 세션입니다.",
      httpStatus: 400,
    };
  }

  // 사용자 일치 확인
  if (typedSession.user_id !== userId) {
    return {
      valid: false,
      errorCode: "SESSION_USER_MISMATCH",
      errorMessage: "결제 세션의 사용자 정보가 일치하지 않습니다.",
      httpStatus: 403,
    };
  }

  // 금액 일치 확인 (핵심 보안 검증)
  if (typedSession.amount !== expectedAmount) {
    console.error(
      `[validatePaymentSession] Amount mismatch: session=${typedSession.amount}, expected=${expectedAmount}, mbrRefNo=${mbrRefNo}`
    );
    return {
      valid: false,
      errorCode: "AMOUNT_MISMATCH",
      errorMessage: "결제 금액이 일치하지 않습니다. 결제를 다시 진행해 주세요.",
      httpStatus: 400,
    };
  }

  return { valid: true, session: typedSession };
}

// ── 세션 완료 처리 ─────────────────────────────────────

/**
 * 결제 승인 성공 후 세션을 완료 처리한다.
 */
export async function completePaymentSession(
  sessionId: string
): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("payment_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
    .eq("status", "pending");

  if (error) {
    // 세션 완료 실패는 결제 자체에 영향을 주지 않으므로 경고만 로그
    console.error(
      `[completePaymentSession] Failed to complete session ${sessionId}:`,
      error.message
    );
  }
}

// ── 세션 조회 (검증 없이) ──────────────────────────────

/**
 * mbrRefNo로 결제 세션을 조회한다 (수수료 결제 등 userId 없이 조회 필요 시).
 * 기본 유효성 검증(만료, 상태)만 수행하고 금액/사용자 검증은 호출자가 한다.
 */
export async function getPaymentSession(
  mbrRefNo: string
): Promise<ValidateSessionResult> {
  const adminClient = createAdminClient();

  const { data: session, error } = await adminClient
    .from("payment_sessions")
    .select("*")
    .eq("mbr_ref_no", mbrRefNo)
    .single();

  if (error || !session) {
    return {
      valid: false,
      errorCode: "INVALID_SESSION",
      errorMessage: "유효하지 않은 결제 세션입니다. 다시 결제를 진행해 주세요.",
      httpStatus: 400,
    };
  }

  const typedSession = session as PaymentSession;

  // 만료 체크
  if (new Date(typedSession.expires_at) < new Date()) {
    await adminClient
      .from("payment_sessions")
      .update({ status: "expired" })
      .eq("id", typedSession.id)
      .eq("status", "pending");

    return {
      valid: false,
      errorCode: "SESSION_EXPIRED",
      errorMessage: "결제 세션이 만료되었습니다. 다시 결제를 진행해 주세요.",
      httpStatus: 400,
    };
  }

  // 이미 사용된 세션
  if (typedSession.status !== "pending") {
    return {
      valid: false,
      errorCode: "SESSION_ALREADY_USED",
      errorMessage: "이미 처리된 결제 세션입니다.",
      httpStatus: 400,
    };
  }

  return { valid: true, session: typedSession };
}
