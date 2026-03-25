import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

// Rate limit: IP당 분당 30회 조회
const VOUCHER_VIEW_RATE_LIMIT = { maxAttempts: 30, windowMs: 60 * 1000 };

/**
 * GET /api/vouchers/[code]
 *
 * 바우처 코드로 바우처 상세 정보 조회
 * - 인증 불필요 (SMS 링크를 통한 접근)
 * - 주문/상품 정보 JOIN
 * - 민감 정보(hash) 제외
 */
export async function GET(
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
          error: {
            code: "INVALID_CODE",
            message: "유효하지 않은 바우처 코드입니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── Rate Limiting (IP 기반) ──
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `voucher-view:${ip}`,
      VOUCHER_VIEW_RATE_LIMIT
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // ── 바우처 조회 (service role: RLS 우회) ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select(
        `
        id,
        code,
        order_id,
        owner_id,
        temp_password_expires_at,
        temp_password_attempts,
        reissue_count,
        user_password_hash,
        user_password_attempts,
        is_password_locked,
        fee_paid,
        fee_pg_transaction_id,
        pin_revealed_at,
        is_gift,
        gift_sender_id,
        source_voucher_id,
        status,
        created_at,
        updated_at,
        orders!inner (
          id,
          order_number,
          quantity,
          product_price,
          fee_type,
          fee_amount,
          total_amount,
          product_id,
          created_at
        )
      `
      )
      .eq("code", code)
      .single();

    if (voucherError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOUCHER_NOT_FOUND",
            message: "바우처를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // ── 관련 데이터 병렬 조회 (상품, 소유자, 핀 개수, 선물 보낸 사람) ──
    const order = voucher.orders as unknown as Record<string, unknown>;
    const productId = order.product_id as string;

    const [productResult, ownerResult, pinCountResult, senderResult] = await Promise.all([
      // 상품 정보
      adminClient
        .from("products")
        .select("id, name, price, fee_rate, fee_unit, image_url")
        .eq("id", productId)
        .single(),
      // 소유자 정보
      adminClient
        .from("users")
        .select("id, username, name")
        .eq("id", voucher.owner_id)
        .single(),
      // 핀 개수
      adminClient
        .from("pins")
        .select("id", { count: "exact", head: true })
        .eq("voucher_id", voucher.id),
      // 선물 보낸 사람 (선물받은 바우처인 경우만)
      voucher.is_gift && voucher.gift_sender_id
        ? adminClient
            .from("users")
            .select("username, name")
            .eq("id", voucher.gift_sender_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    const { data: product, error: productError } = productResult;
    if (productError || !product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "상품 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    const { data: owner } = ownerResult;
    const { count: pinCount } = pinCountResult;
    const hasUserPassword = !!voucher.user_password_hash;
    const senderInfo = senderResult.data as { username: string; name: string } | null;

    // ── 응답 구성 (내부 UUID 및 보안 상태 노출 방지) ──
    const TEMP_PW_MAX_ATTEMPTS = 5;
    const USER_PW_MAX_ATTEMPTS = 5;

    const responseData = {
      id: voucher.id,
      code: voucher.code,
      order_id: voucher.order_id,
      temp_password_expires_at: voucher.temp_password_expires_at,
      temp_password_remaining_attempts: Math.max(0, TEMP_PW_MAX_ATTEMPTS - voucher.temp_password_attempts),
      reissue_count: voucher.reissue_count,
      user_password_hash: hasUserPassword ? "[REDACTED]" : null,
      user_password_remaining_attempts: Math.max(0, USER_PW_MAX_ATTEMPTS - voucher.user_password_attempts),
      is_password_locked: voucher.is_password_locked,
      fee_paid: voucher.fee_paid,
      pin_revealed_at: voucher.pin_revealed_at,
      is_gift: voucher.is_gift,
      status: voucher.status,
      pin_ids: [], // 클라이언트에서 사용하는 인터페이스 호환용
      temp_password_hash: null, // 해시값 노출 금지
      created_at: voucher.created_at,
      updated_at: voucher.updated_at,
      order: {
        id: order.id,
        order_number: order.order_number,
        quantity: order.quantity,
        product_price: order.product_price,
        fee_type: order.fee_type,
        fee_amount: order.fee_amount,
        total_amount: order.total_amount,
        created_at: order.created_at,
      },
      product,
      owner: owner ?? { id: voucher.owner_id, username: "unknown", name: "알 수 없음" },
      pin_count: pinCount ?? 0,
      sender: senderInfo,
    };

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error("[GET /api/vouchers/[code]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
