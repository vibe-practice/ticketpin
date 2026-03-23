import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { paymentReady, generateMbrRefNo } from "@/lib/payment/mainpay";
import { createPaymentSession } from "@/lib/payment/session";

// Rate limit: 분당 최대 10건
const PAYMENT_READY_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

// 입력 검증 스키마
const paymentReadySchema = z.object({
  productId: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "유효하지 않은 상품 ID입니다."
  ),
  quantity: z
    .number()
    .int()
    .min(1, "최소 1개 이상이어야 합니다.")
    .max(30, "최대 30개까지 가능합니다."),
  feeType: z.enum(["included", "separate"]),
  goodsName: z.string().max(30, "상품명은 30자 이내여야 합니다."),
});


/**
 * POST /api/payment/ready
 *
 * 결제 준비 API
 * - 인증 확인
 * - 서버에서 상품 가격 재계산 (금액 조작 방지)
 * - MainPay paymentReady 호출
 * - aid, nextPcUrl, nextMobileUrl 반환
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
      .select("id, name, phone, email, status")
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
      `payment-ready:${userData.id}`,
      PAYMENT_READY_RATE_LIMIT
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

    const parsed = paymentReadySchema.safeParse(body);
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

    const { productId, quantity, feeType, goodsName } = parsed.data;

    // ── 상품 가격 서버 측 재계산 (금액 조작 방지) ──
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, price, fee_rate, fee_unit, status")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "상품을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    if (product.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_INACTIVE", message: "현재 판매 중지된 상품입니다." },
        },
        { status: 400 }
      );
    }

    // ── 재고 확인 ──
    const { count: availableStock } = await adminClient
      .from("pins")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("status", "waiting");

    if (availableStock == null || availableStock < quantity) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OUT_OF_STOCK",
            message: `재고가 부족합니다. (현재 ${availableStock ?? 0}개 남음)`,
          },
        },
        { status: 400 }
      );
    }

    // 수수료 계산
    const feeAmount =
      product.fee_unit === "percent"
        ? Math.round((product.price * product.fee_rate) / 100)
        : product.fee_rate;

    // 결제 금액 계산
    const unitPrice =
      feeType === "included" ? product.price + feeAmount : product.price;
    const totalAmount = unitPrice * quantity;

    if (totalAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_AMOUNT", message: "결제 금액이 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    // ── mbrRefNo 생성 ──
    const mbrRefNo = generateMbrRefNo("TM");

    // ── approvalUrl, closeUrl 설정 ──
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpin24.com";
    const approvalUrl = `${appUrl}/payment/approval`;
    const closeUrl = `${appUrl}/payment/close`;

    // ── MainPay 결제 준비 호출 ──
    const pgResult = await paymentReady({
      mbrRefNo,
      amount: totalAmount,
      goodsName: goodsName.slice(0, 30),
      approvalUrl,
      closeUrl,
      customerTelNo: userData.phone ?? undefined,
      customerName: userData.name ?? undefined,
      customerEmail: userData.email ?? undefined,
    });

    if (pgResult.resultCode !== "200" || !pgResult.data) {
      console.error("[POST /api/payment/ready] MainPay error:", pgResult);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_READY_FAILED",
            message: "결제 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 502 }
      );
    }

    // ── 결제 세션 생성 (금액 조작 방지) ──
    try {
      await createPaymentSession({
        mbrRefNo,
        userId: userData.id,
        productId,
        amount: totalAmount,
        feeType: feeType as "included" | "separate",
        quantity,
        sessionType: "order",
      });
    } catch (sessionError) {
      console.error("[POST /api/payment/ready] Session creation failed:", sessionError);
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

    console.log(`[payment/ready] 결제 세션 생성: productId=${productId}, amount=${totalAmount}, userId=${userData.id}`);

    // ── 성공 응답 ──
    return NextResponse.json({
      success: true,
      data: {
        aid: pgResult.data.aid,
        nextPcUrl: pgResult.data.nextPcUrl,
        nextMobileUrl: pgResult.data.nextMobileUrl,
        mbrRefNo,
        amount: totalAmount,
      },
    });
  } catch (error) {
    console.error("[POST /api/payment/ready] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
