import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { paymentPay, getCardCompanyName } from "@/lib/payment/mainpay";
import { validatePaymentSession, completePaymentSession } from "@/lib/payment/session";
import { cancelPgPayment } from "@/lib/payment/cancel";
import { BCRYPT_SALT_ROUNDS, TEMP_PW_EXPIRY_MINUTES, generateTempPassword } from "@/lib/constants";
import { sendSmsSync, buildPurchaseMessage } from "@/lib/sms";

// Rate limit: 분당 최대 10건
const PAYMENT_PAY_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

// 주문번호 충돌 시 최대 재시도 횟수
const MAX_ORDER_RETRY = 3;

// 입력 검증 스키마
const paymentPaySchema = z.object({
  aid: z.string().min(1, "aid가 필요합니다.").max(40),
  authToken: z.string().min(1, "authToken이 필요합니다.").max(40),
  mbrRefNo: z.string().min(1, "mbrRefNo가 필요합니다.").max(20),
  amount: z
    .number()
    .int("결제 금액은 정수여야 합니다.")
    .positive("결제 금액은 0보다 커야 합니다.")
    .max(100_000_000, "결제 금액이 비정상적으로 큽니다."),
  receiverPhone: z
    .string()
    .regex(
      /^01[016789]\d{7,8}$/,
      "올바른 휴대폰 번호 형식이 아닙니다. (예: 01012345678)"
    ),
});

/**
 * 주문번호 생성 (crypto.randomInt 사용)
 * 형식: TM-YYYYMMDD-XXXX (XXXX = 4자리 랜덤 영숫자 대문자)
 */
function generateOrderNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[randomInt(chars.length)];
  }

  return `TM-${yyyy}${mm}${dd}-${suffix}`;
}

/**
 * POST /api/payment/pay
 *
 * 결제 승인 + 주문 생성 통합 API (원자성 보장)
 * 1. 인증 확인
 * 2. 결제 세션 검증 (금액 조작 방지)
 * 3. MainPay PG 결제 승인
 * 4. 주문 생성 (create_order_with_voucher RPC)
 * 5. 주문 생성 실패 시 PG 망취소
 * 6. SMS 발송 (after API)
 */
export async function POST(request: NextRequest) {
  try {
    // ── 인증 확인 ──
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        },
        { status: 401 }
      );
    }

    // ── users 테이블에서 user_id 조회 ──
    const adminClient = createAdminClient();
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("id, status")
      .eq("auth_id", authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "USER_NOT_FOUND", message: "사용자 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    if (userData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "USER_INACTIVE", message: "비활성화된 계정입니다." },
        },
        { status: 403 }
      );
    }

    // ── Rate Limiting ──
    const rateLimitResult = await checkRateLimit(
      `payment-pay:${userData.id}`,
      PAYMENT_PAY_RATE_LIMIT
    );
    if (!rateLimitResult.success) {
      const retryAfterSec = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.`,
          },
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

    const parsed = paymentPaySchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: firstError?.message ?? "입력값이 올바르지 않습니다." },
        },
        { status: 422 }
      );
    }

    const { aid, authToken, mbrRefNo, amount, receiverPhone } = parsed.data;

    // ── 결제 세션 검증 (금액 조작 방지) ──
    const sessionResult = await validatePaymentSession(
      mbrRefNo,
      amount,
      userData.id
    );

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

    // 세션의 금액을 PG에 전달 (클라이언트 전달값 무시)
    if (!sessionResult.session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "SESSION_ERROR", message: "결제 세션 데이터가 없습니다." },
        },
        { status: 500 }
      );
    }
    const session = sessionResult.session;
    const verifiedAmount = session.amount;

    // 세션에서 주문 생성에 필요한 정보 추출
    const productId = session.product_id;
    const sessionQuantity = session.quantity;
    const sessionFeeType = session.fee_type;

    if (!productId || !sessionQuantity || !sessionFeeType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SESSION_DATA",
            message: "결제 세션 데이터가 불완전합니다. 다시 결제를 진행해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    // ── MainPay 결제 승인 호출 ──
    const pgResult = await paymentPay({
      aid,
      mbrRefNo,
      authToken,
      amount: verifiedAmount,
    });

    if (pgResult.resultCode !== "200" || !pgResult.data) {
      console.error("[POST /api/payment/pay] MainPay error:", pgResult);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_PAY_FAILED",
            message: pgResult.resultMessage ?? "결제 승인에 실패했습니다.",
          },
        },
        { status: 502 }
      );
    }

    const pgData = pgResult.data;

    console.log(`[payment/pay] PG 승인 성공: refNo=${pgData.refNo}, amount=${verifiedAmount}, userId=${userData.id}`);

    // ── 주문 생성 (PG 결제 승인 성공 후) ──
    const tempPasswordPlain = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(
      tempPasswordPlain,
      BCRYPT_SALT_ROUNDS
    );

    const tempPasswordExpiresAt = new Date(
      Date.now() + TEMP_PW_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    interface OrderRpcResult {
      success: boolean;
      error_code?: string;
      error_message?: string;
      order_id?: string;
      order_number?: string;
      voucher_id?: string;
      voucher_code?: string;
      total_amount?: number;
      fee_amount?: number;
      product_price?: number;
      pin_count?: number;
    }

    let orderResult: OrderRpcResult | null = null;

    for (let attempt = 0; attempt < MAX_ORDER_RETRY; attempt++) {
      const orderNumber = generateOrderNumber();
      const voucherCode = randomUUID();

      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        "create_order_with_voucher",
        {
          p_user_id: userData.id,
          p_product_id: productId,
          p_quantity: sessionQuantity,
          p_fee_type: sessionFeeType,
          p_receiver_phone: receiverPhone,
          p_order_number: orderNumber,
          p_voucher_code: voucherCode,
          p_temp_password_hash: tempPasswordHash,
          p_temp_password_expires_at: tempPasswordExpiresAt,
          p_payment_method: "CARD",
          p_pg_transaction_id: pgData.refNo,
          p_pg_ref_no: pgData.refNo,
          p_pg_tran_date: pgData.tranDate,
          p_pg_pay_type: pgData.payType,
          p_card_no: pgData.cardNo,
          p_card_company_code: pgData.issueCompanyNo,
          p_card_company_name: getCardCompanyName(pgData.issueCompanyNo),
          p_installment_months: parseInt(pgData.installment || "0", 10),
          p_approval_no: pgData.applNo,
        }
      );

      if (rpcError) {
        console.error("[POST /api/payment/pay] RPC error:", rpcError.message);
        // 주문 생성 실패 — 망취소 실행
        await executePgReversal(pgData, verifiedAmount);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ORDER_FAILED",
              message: "주문 처리 중 오류가 발생했습니다. 결제가 자동 취소됩니다.",
            },
          },
          { status: 500 }
        );
      }

      const result = rpcResult as OrderRpcResult;

      // 주문번호/바우처코드 충돌 시 재시도
      if (!result.success && result.error_code === "UNIQUE_VIOLATION") {
        if (attempt < MAX_ORDER_RETRY - 1) {
          continue;
        }
        // 최대 재시도 초과 — 망취소 실행
        await executePgReversal(pgData, verifiedAmount);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ORDER_NUMBER_CONFLICT",
              message: "주문번호 생성에 실패했습니다. 결제가 자동 취소됩니다.",
            },
          },
          { status: 409 }
        );
      }

      if (!result.success) {
        // 비즈니스 에러 — 망취소 실행
        await executePgReversal(pgData, verifiedAmount);

        const statusMap: Record<string, number> = {
          PRODUCT_NOT_FOUND: 404,
          PRODUCT_INACTIVE: 400,
          INSUFFICIENT_PINS: 409,
          INTERNAL_ERROR: 500,
        };

        const statusCode = statusMap[result.error_code ?? ""] ?? 500;

        return NextResponse.json(
          {
            success: false,
            error: {
              code: result.error_code,
              message: `${result.error_message ?? "주문 처리 실패"} 결제가 자동 취소됩니다.`,
            },
          },
          { status: statusCode }
        );
      }

      orderResult = result;
      break;
    }

    if (orderResult?.success) {
      console.log(`[payment/pay] 주문 생성 완료: orderId=${orderResult.order_id}, orderNumber=${orderResult.order_number}`);
    }

    // 이론상 도달 불가하지만 안전장치
    if (!orderResult?.success) {
      await executePgReversal(pgData, verifiedAmount);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 결제가 자동 취소됩니다." },
        },
        { status: 500 }
      );
    }

    // ── 세션 완료 처리 ──
    await completePaymentSession(session.id);

    // ── SMS 발송 (after API로 응답 후 실행) ──
    const totalAmount = orderResult.total_amount ?? 0;
    const smsVoucherCode = orderResult.voucher_code ?? "";
    const feeAmount = orderResult.fee_amount ?? 0;

    after(async () => {
      try {
      const smsAdminClient = createAdminClient();
      const { data: productData } = await smsAdminClient
        .from("products")
        .select("name")
        .eq("id", productId)
        .single();

      const productName = productData?.name ?? "상품권";

      const feeTotal =
        sessionFeeType === "separate" && feeAmount > 0
          ? feeAmount * sessionQuantity
          : undefined;

      const smsMessage = buildPurchaseMessage({
        productName,
        quantity: sessionQuantity,
        totalAmount,
        voucherCode: smsVoucherCode,
        tempPassword: tempPasswordPlain,
        feeTotal,
      });

      await sendSmsSync({
        recipientPhone: receiverPhone,
        messageContent: smsMessage,
        messageType: "purchase",
        voucherId: orderResult!.voucher_id,
        orderId: orderResult!.order_id,
      });
      } catch (smsError) {
        console.error("[POST /api/payment/pay] SMS 발송 실패:", smsError);
      }
    });

    // ── 성공 응답 (PG 정보 + 주문 정보) ──
    return NextResponse.json(
      {
        success: true,
        data: {
          // PG 결제 정보
          refNo: pgData.refNo,
          tranDate: pgData.tranDate,
          tranTime: pgData.tranTime,
          mbrRefNo: pgData.mbrRefNo,
          amount: parseInt(pgData.amount, 10),
          applNo: pgData.applNo,
          cardNo: pgData.cardNo,
          installment: parseInt(pgData.installment || "0", 10),
          issueCompanyNo: pgData.issueCompanyNo,
          acqCompanyNo: pgData.acqCompanyNo,
          payType: pgData.payType,
          cardCompanyName: getCardCompanyName(pgData.issueCompanyNo),
          // 주문 정보
          order_id: orderResult.order_id,
          order_number: orderResult.order_number,
          voucher_id: orderResult.voucher_id,
          voucher_code: orderResult.voucher_code,
          total_amount: orderResult.total_amount,
          fee_amount: orderResult.fee_amount,
          product_price: orderResult.product_price,
          pin_count: orderResult.pin_count,
          temp_password_expires_at: tempPasswordExpiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/payment/pay] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

/**
 * PG 망취소 실행
 *
 * 결제 승인 성공 후 주문 생성 실패 시 호출하여 결제를 즉시 취소한다.
 * 망취소 실패 시 로그만 남기고 진행한다 (수동 취소 필요).
 */
async function executePgReversal(
  pgData: {
    refNo: string;
    tranDate: string;
    payType: string;
    amount: string;
  },
  cancelAmount: number
): Promise<void> {
  try {
    console.error(
      `[executePgReversal] 망취소 시작: refNo=${pgData.refNo}, amount=${cancelAmount}`
    );

    const cancelResult = await cancelPgPayment({
      refNo: pgData.refNo,
      tranDate: pgData.tranDate,
      payType: pgData.payType,
      cancelAmount,
      cancelReason: "주문 생성 실패로 인한 자동 취소",
    });

    if (!cancelResult.success) {
      // 망취소 실패 — 심각한 상황, 수동 처리 필요
      console.error(
        `[executePgReversal] 망취소 실패! 수동 취소 필요. refNo=${pgData.refNo}, error=${cancelResult.errorMessage}`
      );
    } else {
      console.log(`[payment/pay] 망취소 성공: refNo=${pgData.refNo}, amount=${cancelAmount}`);
    }
  } catch (error) {
    console.error(
      `[executePgReversal] 망취소 중 예외 발생! 수동 취소 필요. refNo=${pgData.refNo}`,
      error
    );
  }
}
