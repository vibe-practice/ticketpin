import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema, feePaymentConfirmSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { confirmFeePayment } from "@/lib/payment/fee";
import { cancelPgPayment } from "@/lib/payment/cancel";
import { decryptPin } from "@/lib/crypto/pin";
import { getPaymentSession, completePaymentSession } from "@/lib/payment/session";
import { VOUCHER_MAX_ATTEMPTS } from "@/lib/constants";

// Rate limit: IP당 분당 5회 (결제 승인은 더 엄격하게)
const FEE_CONFIRM_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

/**
 * POST /api/vouchers/[code]/fee-payment/confirm
 *
 * 수수료 결제 승인 + 핀 일괄 해제 API
 *
 * 보안 검증:
 * 1. 바우처 비밀번호(user_password) 검증 (bcrypt)
 * 2. 결제 세션의 user_id와 바우처 소유자(owner_id) 일치 확인
 * 3. 결제 세션 금액과 서버 계산 금액 일치 확인
 *
 * 처리 순서:
 * 1. 비밀번호 검증
 * 2. PG 결제 승인 (MainPay paymentPay)
 * 3. RPC deliver_fee_pins로 원자적 상태 전이:
 *    - 바우처: fee_paid=true, status=pin_revealed
 *    - 핀: assigned -> consumed
 *    - 주문: password_set -> pin_revealed
 * 4. 핀 복호화 + 반환 (Node.js 측)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // ── 코드 형식 검증 ──
    const codeResult = voucherCodeSchema.safeParse(code);
    if (!codeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CODE", message: "유효하지 않은 바우처 코드입니다." },
        },
        { status: 400 }
      );
    }

    // ── Rate Limiting ──
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(`fee-confirm:${ip}`, FEE_CONFIRM_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        },
        { status: 429 }
      );
    }

    // ── 입력 검증 ──
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        },
        { status: 400 }
      );
    }

    const parsed = feePaymentConfirmSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      console.error("[fee-payment/confirm] Zod validation failed:",
        parsed.error.issues.map((i) => ({ path: i.path, message: i.message })));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstError?.message ?? "입력값이 올바르지 않습니다.",
            field: firstError?.path?.join(".") ?? null,
          },
        },
        { status: 422 }
      );
    }

    const { payment_key, auth_token, mbr_ref_no, password, verification_token } = parsed.data;

    // ── 바우처 조회 (주문 정보 + 비밀번호 해시 JOIN) ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select(
        `
        id,
        code,
        order_id,
        owner_id,
        status,
        fee_paid,
        fee_pg_transaction_id,
        is_password_locked,
        user_password_hash,
        user_password_attempts,
        orders!inner (
          id,
          order_number,
          product_id,
          quantity,
          fee_type,
          fee_amount,
          status,
          user_id
        )
      `
      )
      .eq("code", code)
      .single();

    if (voucherError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_NOT_FOUND", message: "바우처를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 잠금 상태 검증 ──
    if (voucher.is_password_locked) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_LOCKED", message: "바우처가 잠금 처리되었습니다. 고객센터에 문의해주세요." },
        },
        { status: 403 }
      );
    }

    if (voucher.status !== "password_set") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "비밀번호 설정이 완료된 바우처에서만 수수료 결제가 가능합니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 인증 검증: 검증 토큰 또는 비밀번호 ──
    if (verification_token) {
      // 모바일 리다이렉트 경로: 검증 토큰으로 인증
      const { data: tokenData, error: tokenError } = await adminClient
        .from("pin_verification_tokens")
        .select("id, voucher_id, voucher_code, expires_at, used")
        .eq("token", verification_token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_TOKEN", message: "유효하지 않은 검증 토큰입니다." },
          },
          { status: 401 }
        );
      }

      // 만료/사용 여부 + 바우처 일치 확인
      if (new Date(tokenData.expires_at) < new Date()) {
        await adminClient.from("pin_verification_tokens").delete().eq("id", tokenData.id);
        return NextResponse.json(
          {
            success: false,
            error: { code: "TOKEN_EXPIRED", message: "검증 토큰이 만료되었습니다. 비밀번호를 다시 입력해주세요." },
          },
          { status: 401 }
        );
      }

      if (tokenData.used) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "TOKEN_USED", message: "이미 사용된 검증 토큰입니다." },
          },
          { status: 401 }
        );
      }

      if (tokenData.voucher_id !== voucher.id) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "TOKEN_MISMATCH", message: "검증 토큰이 바우처와 일치하지 않습니다." },
          },
          { status: 403 }
        );
      }

      // 토큰 사용 처리 (일회용)
      await adminClient
        .from("pin_verification_tokens")
        .update({ used: true })
        .eq("id", tokenData.id);
    } else if (password) {
      // PC 팝업 경로: 비밀번호로 인증
      if (!voucher.user_password_hash) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NO_PASSWORD", message: "비밀번호가 설정되지 않았습니다." },
          },
          { status: 400 }
        );
      }

      const isPasswordMatch = await bcrypt.compare(password, voucher.user_password_hash);

      if (!isPasswordMatch) {
        // Atomic increment로 경쟁 조건 방지
        const { data: updated } = await adminClient.rpc("increment_voucher_password_attempts", {
          p_voucher_id: voucher.id,
          p_max_attempts: VOUCHER_MAX_ATTEMPTS,
        });

        const result = updated as { new_attempts: number; is_locked: boolean } | null;
        const newAttempts = result?.new_attempts ?? voucher.user_password_attempts + 1;
        const isNowLocked = result?.is_locked ?? newAttempts >= VOUCHER_MAX_ATTEMPTS;

        if (isNowLocked) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VOUCHER_LOCKED",
                message: `비밀번호를 ${VOUCHER_MAX_ATTEMPTS}회 잘못 입력하여 잠금 처리되었습니다. 고객센터에 문의해주세요.`,
              },
              data: { attempts: newAttempts, is_locked: true },
            },
            { status: 403 }
          );
        }

        const remaining = VOUCHER_MAX_ATTEMPTS - newAttempts;
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "WRONG_PASSWORD",
              message: `비밀번호가 올바르지 않습니다. (${remaining}회 남음)`,
            },
            data: { attempts: newAttempts, remaining, is_locked: false },
          },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "비밀번호 또는 검증 토큰이 필요합니다." },
        },
        { status: 401 }
      );
    }

    // Supabase JOIN 결과 타입 캐스팅 + 런타임 가드
    const order = voucher.orders as unknown as Record<string, unknown>;
    if (
      !order ||
      typeof order.fee_type !== "string" ||
      typeof order.fee_amount !== "number" ||
      typeof order.quantity !== "number" ||
      typeof order.id !== "string" ||
      typeof order.user_id !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ORDER_DATA", message: "주문 데이터가 올바르지 않습니다." },
        },
        { status: 500 }
      );
    }

    const feeType = order.fee_type;
    const feeAmountPerUnit = order.fee_amount;
    const quantity = order.quantity;
    const orderId = order.id;
    const orderUserId = order.user_id;

    if (feeType !== "separate") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FEE_INCLUDED", message: "수수료 포함 방식의 주문입니다. 별도 결제가 필요하지 않습니다." },
        },
        { status: 400 }
      );
    }

    // ── 금액 검증: 서버 계산 금액 ──
    const expectedAmount = feeAmountPerUnit * quantity;

    // ── 이전 결제 완료 + 핀 전달 실패 복구 케이스 ──
    // 비밀번호 검증이 위에서 완료되었으므로 안전하게 재시도 가능
    // (status=password_set 체크가 위에서 통과했으므로, fee_paid=true면 복구 케이스)
    if (voucher.fee_paid) {
      return await handlePinDeliveryRetry(adminClient, voucher, orderId, expectedAmount);
    }

    // ── 결제 세션 검증 (금액 조작 방지) ──
    const sessionResult = await getPaymentSession(mbr_ref_no);
    if (!sessionResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: sessionResult.errorCode ?? "SESSION_ERROR",
            message: sessionResult.errorMessage ?? "결제 세션 검증에 실패했습니다.",
          },
        },
        { status: sessionResult.httpStatus ?? 400 }
      );
    }

    // 세션 금액과 서버 계산 금액 일치 확인
    if (!sessionResult.session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "SESSION_ERROR", message: "결제 세션 데이터가 없습니다." },
        },
        { status: 500 }
      );
    }
    const feeSession = sessionResult.session;

    // ── 세션 user_id와 바우처 소유자(owner_id) 일치 확인 ──
    if (feeSession.user_id !== orderUserId) {
      console.error(
        `[fee-payment/confirm] Session user mismatch: session.user_id=${feeSession.user_id}, order.user_id=${orderUserId}, mbrRefNo=${mbr_ref_no}`
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_MISMATCH",
            message: "결제 세션의 사용자 정보가 일치하지 않습니다.",
          },
        },
        { status: 403 }
      );
    }

    if (feeSession.amount !== expectedAmount) {
      console.error(
        `[fee-payment/confirm] Session amount mismatch: session=${feeSession.amount}, expected=${expectedAmount}, mbrRefNo=${mbr_ref_no}`
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AMOUNT_MISMATCH",
            message: "결제 금액이 일치하지 않습니다. 다시 시도해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    // 세션의 금액을 PG에 전달 (클라이언트 전달값 무시)
    const verifiedAmount = feeSession.amount;

    // ── PG 결제 승인 (MainPay paymentPay) ──
    const pgResult = await confirmFeePayment({
      paymentKey: payment_key,
      amount: verifiedAmount,
      authToken: auth_token,
      mbrRefNo: mbr_ref_no,
    });

    if (!pgResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_CONFIRM_FAILED",
            message: pgResult.errorMessage ?? "결제 승인 중 오류가 발생했습니다. 다시 시도해 주세요.",
          },
        },
        { status: 500 }
      );
    }

    // ── 결제 세션 완료 처리 ──
    await completePaymentSession(feeSession.id);

    // ── RPC로 원자적 상태 전이 ──
    const pgTransactionId = pgResult.pgTransactionId ?? null;
    const { data: rpcResult, error: rpcError } = await adminClient.rpc("deliver_fee_pins", {
      p_voucher_id: voucher.id,
      p_order_id: orderId,
      p_pg_transaction_id: pgTransactionId,
      p_pg_ref_no: pgResult.pgRefNo ?? null,
      p_pg_tran_date: pgResult.pgTranDate ?? null,
      p_pg_pay_type: pgResult.pgPayType ?? null,
      p_fee_amount: verifiedAmount,
    });

    if (rpcError) {
      console.error("[fee-payment/confirm] RPC deliver_fee_pins error:", rpcError.message);
      // RPC 실패 시 망취소
      const reversalResult = await executePgReversal(pgResult, verifiedAmount);
      if (!reversalResult.success) {
        await recordReversalFailure({
          adminClient,
          orderId: orderId as string,
          voucherId: voucher.id,
          refundAmount: verifiedAmount,
          pgRefNo: pgResult.pgRefNo,
          pgTranDate: pgResult.pgTranDate,
          pgPayType: pgResult.pgPayType,
          errorMessage: reversalResult.errorMessage ?? "망취소 실패",
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "REVERSAL_FAILED",
              message: "이중결제가 발생했습니다. 고객센터에 문의해 주세요.",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELIVERY_FAILED", message: "핀 전달 처리 중 오류가 발생했습니다. 결제가 취소됩니다." },
        },
        { status: 500 }
      );
    }

    const rpcData = rpcResult as DeliverFeePinsResult;

    // 이미 전달 완료된 경우 (중복 호출) — 방금 승인된 PG 결제를 망취소하고 기존 핀 반환
    if (rpcData.success && rpcData.already_delivered) {
      // PG 결제가 이미 승인되었으므로 망취소 필수 (이중 결제 방지)
      const reversalResult = await executePgReversal(pgResult, verifiedAmount);
      if (!reversalResult.success) {
        await recordReversalFailure({
          adminClient,
          orderId: orderId as string,
          voucherId: voucher.id,
          refundAmount: verifiedAmount,
          pgRefNo: pgResult.pgRefNo,
          pgTranDate: pgResult.pgTranDate,
          pgPayType: pgResult.pgPayType,
          errorMessage: reversalResult.errorMessage ?? "망취소 실패",
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "REVERSAL_FAILED",
              message: "이중결제가 발생했습니다. 고객센터에 문의해 주세요.",
            },
          },
          { status: 500 }
        );
      }

      const decryptResult = await fetchAndDecryptPinsWithRetry(adminClient, voucher.id);
      if (!decryptResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: decryptResult.errorCode ?? "DECRYPT_FAILED",
              message: decryptResult.errorMessage ?? "핀 번호 복호화에 실패했습니다. 다시 시도해주세요.",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          pins: decryptResult.pins,
          pin_count: decryptResult.pins?.length ?? 0,
          fee_paid: true,
          fee_amount: expectedAmount,
          pg_transaction_id: voucher.fee_pg_transaction_id ?? null,
        },
      });
    }

    if (!rpcData.success) {
      console.error(
        `[fee-payment/confirm] RPC deliver_fee_pins failed: ${rpcData.error_code} - ${rpcData.error_message}`
      );
      // RPC 비즈니스 실패 시 망취소
      const reversalResult = await executePgReversal(pgResult, verifiedAmount);
      if (!reversalResult.success) {
        await recordReversalFailure({
          adminClient,
          orderId: orderId as string,
          voucherId: voucher.id,
          refundAmount: verifiedAmount,
          pgRefNo: pgResult.pgRefNo,
          pgTranDate: pgResult.pgTranDate,
          pgPayType: pgResult.pgPayType,
          errorMessage: reversalResult.errorMessage ?? "망취소 실패",
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "REVERSAL_FAILED",
              message: "이중결제가 발생했습니다. 고객센터에 문의해 주세요.",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: rpcData.error_code ?? "DELIVERY_FAILED",
            message: rpcData.error_message ?? "핀 전달 처리 중 오류가 발생했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // ── 핀 조회 + 복호화 (Node.js 측, 1회 재시도 포함) ──
    const decryptResult = await fetchAndDecryptPinsWithRetry(adminClient, voucher.id);
    if (!decryptResult.success) {
      // 상태 전이는 성공했지만 복호화 실패 — 클라이언트에서 재시도 가능
      return NextResponse.json(
        {
          success: false,
          error: {
            code: decryptResult.errorCode ?? "DECRYPT_FAILED",
            message: decryptResult.errorMessage ?? "핀 번호 복호화에 실패했습니다. 다시 시도해주세요.",
          },
        },
        { status: 500 }
      );
    }

    // ── 성공 응답 ──
    return NextResponse.json({
      success: true,
      data: {
        pins: decryptResult.pins,
        pin_count: decryptResult.pins?.length ?? 0,
        fee_paid: true,
        fee_amount: expectedAmount,
        pg_transaction_id: pgTransactionId,
      },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/fee-payment/confirm] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

/** RPC deliver_fee_pins 응답 타입 */
interface DeliverFeePinsResult {
  success: boolean;
  error_code?: string;
  error_message?: string;
  already_delivered?: boolean;
  pin_count?: number;
}

/**
 * 핀 조회 + 복호화 (Node.js 측)
 * RPC로 상태 전이가 완료된 후 호출
 */
async function fetchAndDecryptPins(
  adminClient: SupabaseAdminClient,
  voucherId: string
): Promise<{ success: boolean; pins?: string[]; errorCode?: string; errorMessage?: string }> {
  const { data: pins, error: pinsError } = await adminClient
    .from("pins")
    .select("id, pin_number_encrypted")
    .eq("voucher_id", voucherId)
    .order("created_at", { ascending: true });

  if (pinsError || !pins || pins.length === 0) {
    console.error("[fee-payment/confirm] Pins query error:", pinsError?.message);
    return {
      success: false,
      errorCode: "PINS_NOT_FOUND",
      errorMessage: "핀 번호를 찾을 수 없습니다. 다시 시도하거나 고객센터에 문의해주세요.",
    };
  }

  const decryptedPins: string[] = [];
  for (const pin of pins) {
    try {
      const decrypted = decryptPin(pin.pin_number_encrypted);
      decryptedPins.push(decrypted);
    } catch (decryptError) {
      console.error("[fee-payment/confirm] Decrypt error for pin:", pin.id, decryptError);
      return {
        success: false,
        errorCode: "DECRYPT_FAILED",
        errorMessage: "핀 번호 복호화에 실패했습니다. 다시 시도하거나 고객센터에 문의해주세요.",
      };
    }
  }

  return { success: true, pins: decryptedPins };
}

/**
 * 핀 조회 + 복호화 (1회 재시도 포함)
 * 일시적 DB 연결 이슈나 복호화 오류에 대비하여 1회 재시도
 */
async function fetchAndDecryptPinsWithRetry(
  adminClient: SupabaseAdminClient,
  voucherId: string
): Promise<{ success: boolean; pins?: string[]; errorCode?: string; errorMessage?: string }> {
  const firstAttempt = await fetchAndDecryptPins(adminClient, voucherId);
  if (firstAttempt.success) {
    return firstAttempt;
  }

  // 복호화 자체 실패(DECRYPT_FAILED)는 재시도해도 동일 결과이므로 즉시 반환
  // DB 조회 실패(PINS_NOT_FOUND)만 일시적 오류 가능성이 있으므로 재시도
  if (firstAttempt.errorCode === "DECRYPT_FAILED") {
    console.error(
      `[fee-payment/confirm] Pin decrypt failed (non-retryable): ${firstAttempt.errorCode} - ${firstAttempt.errorMessage}`
    );
    return firstAttempt;
  }

  // DB 조회 실패 시 500ms 후 1회 재시도
  console.warn(`[fee-payment/confirm] Pin fetch first attempt failed (${firstAttempt.errorCode}), retrying...`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const retryAttempt = await fetchAndDecryptPins(adminClient, voucherId);
  if (!retryAttempt.success) {
    console.error(
      `[fee-payment/confirm] Pin fetch retry also failed: ${retryAttempt.errorCode} - ${retryAttempt.errorMessage}`
    );
  }
  return retryAttempt;
}

/** 망취소 결과 */
interface PgReversalResult {
  success: boolean;
  pgCancelTransactionId?: string | null;
  errorMessage?: string;
}

/** 재시도 대기 시간 (ms) */
const REVERSAL_RETRY_DELAYS = [500, 1000, 2000];

/**
 * PG 망취소 실행 (최대 3회 재시도)
 *
 * 실패 시 반환값으로 성공 여부를 알려주므로, 호출부에서 실패 기록을 남길 수 있다.
 */
async function executePgReversal(
  pgResult: { pgRefNo: string | null; pgTranDate: string | null; pgPayType: string | null },
  amount: number
): Promise<PgReversalResult> {
  if (!pgResult.pgRefNo || !pgResult.pgTranDate || !pgResult.pgPayType) {
    return {
      success: false,
      errorMessage: "PG 승인 응답에 취소 필수 정보(refNo/tranDate/payType)가 누락되었습니다.",
    };
  }

  console.error(
    `[fee-payment/confirm] 핀 전달 실패, 망취소 시작: refNo=${pgResult.pgRefNo}`
  );

  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= REVERSAL_RETRY_DELAYS.length; attempt++) {
    // 첫 시도가 아닌 경우 대기
    if (attempt > 0) {
      const delay = REVERSAL_RETRY_DELAYS[attempt - 1];
      console.warn(
        `[fee-payment/confirm] 망취소 재시도 ${attempt}/${REVERSAL_RETRY_DELAYS.length}: ${delay}ms 후 시도. refNo=${pgResult.pgRefNo}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const cancelResult = await cancelPgPayment({
        refNo: pgResult.pgRefNo,
        tranDate: pgResult.pgTranDate,
        payType: pgResult.pgPayType,
        cancelAmount: amount,
        cancelReason: "핀 전달 실패로 인한 수수료 결제 자동 취소",
      });

      if (cancelResult.success) {
        if (attempt > 0) {
          console.info(
            `[fee-payment/confirm] 망취소 성공 (${attempt + 1}번째 시도). refNo=${pgResult.pgRefNo}`
          );
        }
        return {
          success: true,
          pgCancelTransactionId: cancelResult.pgCancelTransactionId,
        };
      }

      lastErrorMessage =
        cancelResult.errorMessage ?? `PG 취소 실패 (code: ${cancelResult.errorCode})`;
    } catch (cancelError) {
      lastErrorMessage =
        cancelError instanceof Error
          ? cancelError.message
          : "PG 취소 요청 중 예외 발생";
    }
  }

  console.error(
    `[fee-payment/confirm] 망취소 최종 실패! 수동 취소 필요. refNo=${pgResult.pgRefNo}, error=${lastErrorMessage}`
  );

  return {
    success: false,
    errorMessage: lastErrorMessage,
  };
}

/**
 * 망취소 실패 기록
 *
 * cancellations 테이블에 duplicate_payment 사유로 실패 기록을 남긴다.
 * 관리자 retry API에서 pg_ref_no, pg_tran_date, pg_pay_type를 사용해 재시도할 수 있다.
 */
async function recordReversalFailure(params: {
  adminClient: SupabaseAdminClient;
  orderId: string;
  voucherId: string;
  refundAmount: number;
  pgRefNo: string | null;
  pgTranDate: string | null;
  pgPayType: string | null;
  errorMessage: string;
}): Promise<void> {
  try {
    const { error } = await params.adminClient.from("cancellations").insert({
      order_id: params.orderId,
      voucher_id: params.voucherId,
      reason_type: "duplicate_payment",
      reason_detail: `[자동 망취소 실패] ${params.errorMessage}`,
      cancelled_by: "system",
      refund_amount: params.refundAmount,
      refund_status: "failed",
      pg_cancel_transaction_id: null,
      pg_ref_no: params.pgRefNo,
      pg_tran_date: params.pgTranDate,
      pg_pay_type: params.pgPayType,
    });

    if (error) {
      console.error(
        "[fee-payment/confirm] 망취소 실패 기록 INSERT 오류:",
        error.message
      );
    }
  } catch (err) {
    console.error("[fee-payment/confirm] 망취소 실패 기록 중 예외:", err);
  }
}

/**
 * 이전 결제 완료 + 핀 전달 실패 복구
 * 비밀번호 검증이 완료된 상태에서만 호출됨
 */
async function handlePinDeliveryRetry(
  adminClient: SupabaseAdminClient,
  voucher: { id: string; fee_paid: boolean; fee_pg_transaction_id?: string | null },
  orderId: string,
  feeAmount: number
) {
  const pgTxnId = voucher.fee_pg_transaction_id ?? null;

  // RPC로 원자적 상태 전이 재시도
  const { data: rpcResult, error: rpcError } = await adminClient.rpc("deliver_fee_pins", {
    p_voucher_id: voucher.id,
    p_order_id: orderId,
    p_pg_transaction_id: pgTxnId,
  });

  if (rpcError) {
    console.error("[fee-payment/confirm] Retry RPC error:", rpcError.message);
    return NextResponse.json(
      {
        success: false,
        error: { code: "DELIVERY_FAILED", message: "핀 전달 재시도 중 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }

  const rpcData = rpcResult as DeliverFeePinsResult;

  if (!rpcData.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: rpcData.error_code ?? "DELIVERY_FAILED",
          message: rpcData.error_message ?? "핀 전달 재시도 중 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }

  // 핀 조회 + 복호화 (1회 재시도 포함)
  // already_delivered=true든 false든 핀 복호화 동일하게 수행
  const decryptResult = await fetchAndDecryptPinsWithRetry(adminClient, voucher.id);
  if (!decryptResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: decryptResult.errorCode ?? "DECRYPT_FAILED",
          message: decryptResult.errorMessage ?? "핀 번호 복호화에 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      pins: decryptResult.pins,
      pin_count: decryptResult.pins?.length ?? 0,
      fee_paid: true,
      fee_amount: feeAmount,
      pg_transaction_id: pgTxnId,
    },
  });
}
