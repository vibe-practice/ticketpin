import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { voucherCodeSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { prepareFeePayment } from "@/lib/payment/fee";
import { createPaymentSession } from "@/lib/payment/session";

// Rate limit: IP당 분당 10회
const FEE_PREPARE_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

/**
 * POST /api/vouchers/[code]/fee-payment/prepare
 *
 * 수수료 결제 준비 API
 * - 바우처 조회 + 주문/상품 정보로 수수료 금액 계산
 * - PG 결제 준비 호출 (MainPay paymentReady)
 * - 결제 키(aid) + 결제창 URL + 금액 반환
 *
 * 보안 검증:
 * - Supabase Auth 세션이 있으면 owner_id 일치 확인
 * - 비인증 접근도 허용 (SMS 링크 기반 접근 지원)
 *
 * 조건:
 * - 바우처 상태: password_set
 * - fee_paid: false (수수료 미결제)
 * - fee_type: separate (수수료 별도 방식)
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
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rateLimitResult = await checkRateLimit(`fee-prepare:${ip}`, FEE_PREPARE_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        },
        { status: 429 }
      );
    }

    // ── 인증 사용자 확인 (선택적) ──
    let authenticatedUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const adminClientForAuth = createAdminClient();
        const { data: userData } = await adminClientForAuth
          .from("users")
          .select("id")
          .eq("auth_id", authUser.id)
          .single();
        if (userData) {
          authenticatedUserId = userData.id as string;
        }
      }
    } catch {
      // 인증 실패는 무시 (SMS 링크 접근 허용)
    }

    // ── 바우처 조회 (주문 정보 JOIN) ──
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
        orders!inner (
          id,
          order_number,
          product_id,
          quantity,
          fee_type,
          fee_amount,
          product_price,
          total_amount,
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

    // ── 상태 검증 ──
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

    if (voucher.fee_paid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FEE_ALREADY_PAID", message: "수수료가 이미 결제되었습니다." },
        },
        { status: 400 }
      );
    }

    // Supabase JOIN 결과 타입 캐스팅 + 런타임 가드
    const order = voucher.orders as unknown as Record<string, unknown>;
    if (
      !order ||
      typeof order.fee_type !== "string" ||
      typeof order.fee_amount !== "number" ||
      typeof order.quantity !== "number" ||
      typeof order.order_number !== "string" ||
      typeof order.product_id !== "string" ||
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
    const orderNumber = order.order_number;
    const productId = order.product_id;
    const userId = order.user_id;

    // ── 인증 사용자 owner 검증 (인증된 경우에만) ──
    if (authenticatedUserId && authenticatedUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OWNER_MISMATCH",
            message: "바우처 소유자만 수수료 결제를 진행할 수 있습니다.",
          },
        },
        { status: 403 }
      );
    }

    if (feeType !== "separate") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FEE_INCLUDED", message: "수수료 포함 방식의 주문입니다. 별도 결제가 필요하지 않습니다." },
        },
        { status: 400 }
      );
    }

    // ── 수수료 총액 계산: 건당 수수료 x 수량 ──
    const totalFeeAmount = feeAmountPerUnit * quantity;

    if (totalFeeAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ZERO_FEE", message: "수수료가 0원입니다. 별도 결제가 필요하지 않습니다." },
        },
        { status: 400 }
      );
    }

    // ── 상품명 조회 (PG 결제창 표시용) ──
    const { data: product } = await adminClient
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    const productName = product?.name ?? "상품권";

    // ── PG 결제 준비 (MainPay paymentReady) ──
    const pgResult = await prepareFeePayment({
      orderNumber,
      feeAmount: totalFeeAmount,
      productName: `${productName} 수수료`,
    });

    if (!pgResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_PREPARE_FAILED",
            message: pgResult.errorMessage ?? "결제 준비 중 오류가 발생했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // ── 결제 세션 생성 (금액 조작 방지) ──
    if (pgResult.mbrRefNo) {
      try {
        await createPaymentSession({
          mbrRefNo: pgResult.mbrRefNo,
          userId,
          productId,
          amount: totalFeeAmount,
          feeType: null,
          quantity,
          sessionType: "fee",
          voucherCode: code,
        });
      } catch (sessionError) {
        console.error("[fee-payment/prepare] Session creation failed:", sessionError);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SESSION_CREATE_FAILED",
              message: "결제 세션 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
            },
          },
          { status: 500 }
        );
      }
    }

    // ── 성공 응답 ──
    return NextResponse.json({
      success: true,
      data: {
        payment_key: pgResult.paymentKey,
        amount: pgResult.amount,
        fee_per_unit: feeAmountPerUnit,
        quantity,
        product_name: productName,
        order_number: orderNumber,
        next_pc_url: pgResult.nextPcUrl,
        next_mobile_url: pgResult.nextMobileUrl,
        mbr_ref_no: pgResult.mbrRefNo,
      },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/fee-payment/prepare] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
