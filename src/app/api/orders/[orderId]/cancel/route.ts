import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelOrderSchema } from "@/lib/validations/order";
import { checkRateLimit } from "@/lib/rate-limit";
import { cancelPgPayment } from "@/lib/payment/cancel";
import { sendSmsSync, buildCancelMessage } from "@/lib/sms";

// Rate limit: 분당 최대 5건 취소 요청
const CANCEL_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

// 취소 가능한 주문 상태 (화이트리스트)
// password_set 상태는 user_password_hash가 설정되어 후속 검증에서 항상 거부되므로 제외
const CANCELLABLE_STATUSES = ["paid"] as const;

/**
 * POST /api/orders/[orderId]/cancel
 *
 * 주문 취소 API
 * 1. 인증 확인 (본인 주문만 취소 가능)
 * 2. Rate limiting (user_id 기반)
 * 3. 입력 검증 (reason_type, reason_detail)
 * 4. 취소 조건 검증:
 *    - 주문 상태가 paid인 경우만 허용
 *    - 결제 당일(KST 기준)인 경우만 허용
 *    - 바우처의 user_password가 미설정 상태 (user_password_hash IS NULL)
 *    - 직접 구매 건 (is_gift = false)
 * 5. PG 결제 취소 (stub)
 * 6. DB 상태 업데이트 (RPC 트랜잭션: orders, vouchers, pins, cancellations)
 * 7. 취소 SMS 발송
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // ── orderId UUID 형식 검증 ──
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ORDER_ID",
            message: "유효하지 않은 주문 ID입니다.",
          },
        },
        { status: 400 }
      );
    }

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
          error: {
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
          },
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
          error: {
            code: "USER_NOT_FOUND",
            message: "사용자 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    if (userData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_INACTIVE",
            message: "비활성화된 계정입니다.",
          },
        },
        { status: 403 }
      );
    }

    // ── Rate Limiting (user_id 기반) ──
    const rateLimitResult = await checkRateLimit(
      `cancel:${userData.id}`,
      CANCEL_RATE_LIMIT
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
          error: {
            code: "INVALID_JSON",
            message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = cancelOrderSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstError?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // ── 주문 조회 (본인 주문인지 확인) ──
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(
        "id, order_number, user_id, product_id, quantity, product_price, fee_amount, total_amount, receiver_phone, status, created_at, pg_ref_no, pg_tran_date, pg_pay_type"
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: "주문을 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // 본인 주문 확인
    if (order.user_id !== userData.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "본인의 주문만 취소할 수 있습니다.",
          },
        },
        { status: 403 }
      );
    }

    // ── 취소 가능 상태 검증 (화이트리스트) ──
    if (
      !CANCELLABLE_STATUSES.includes(
        order.status as (typeof CANCELLABLE_STATUSES)[number]
      )
    ) {
      const statusMessages: Record<string, string> = {
        cancelled: "이미 취소된 주문입니다.",
        pin_revealed: "핀 번호가 확인된 주문은 취소할 수 없습니다.",
        gifted: "선물된 주문은 취소할 수 없습니다.",
      };
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_CANCELLABLE",
            message:
              statusMessages[order.status] ??
              "현재 주문 상태에서는 취소할 수 없습니다.",
          },
        },
        { status: 409 }
      );
    }

    // ── 결제 당일 여부 검증 (KST = UTC+9 고정 오프셋) ──
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const nowKST = new Date(Date.now() + KST_OFFSET_MS);
    const orderKST = new Date(
      new Date(order.created_at).getTime() + KST_OFFSET_MS
    );
    const isSameDay =
      orderKST.getUTCFullYear() === nowKST.getUTCFullYear() &&
      orderKST.getUTCMonth() === nowKST.getUTCMonth() &&
      orderKST.getUTCDate() === nowKST.getUTCDate();

    if (!isSameDay) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CANCEL_PERIOD_EXPIRED",
            message:
              "결제 당일에만 취소가 가능합니다. 고객센터에 문의해 주세요.",
          },
        },
        { status: 409 }
      );
    }

    // ── 바우처 조회 (취소 조건 검증) ──
    const { data: vouchers, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, code, user_password_hash, is_gift, status")
      .eq("order_id", orderId);

    if (voucherError || !vouchers || vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOUCHER_NOT_FOUND",
            message: "연결된 바우처를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    const voucher = vouchers[0];

    // 비밀번호 설정 여부 확인 (user_password_hash가 null이어야 취소 가능)
    if (voucher.user_password_hash !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PASSWORD_ALREADY_SET",
            message:
              "비밀번호가 설정된 바우처는 취소할 수 없습니다. 고객센터에 문의해 주세요.",
          },
        },
        { status: 409 }
      );
    }

    // 선물받은 바우처 확인 (직접 구매만 취소 가능)
    if (voucher.is_gift) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "GIFT_CANNOT_CANCEL",
            message: "선물받은 바우처는 취소할 수 없습니다.",
          },
        },
        { status: 409 }
      );
    }

    // ── PG 결제 취소 (Stub) ──
    const cancelReason =
      input.reason_type === "simple_change"
        ? "단순 변심"
        : input.reason_type === "wrong_purchase"
          ? "잘못된 구매"
          : input.reason_detail!; // refine으로 "other"일 때 reason_detail 필수 보장됨

    const pgResult = await cancelPgPayment({
      refNo: order.pg_ref_no,
      tranDate: order.pg_tran_date,
      payType: order.pg_pay_type,
      cancelAmount: order.total_amount,
      cancelReason,
    });

    if (!pgResult.success) {
      console.error(
        "[POST /api/orders/[orderId]/cancel] PG 취소 실패:",
        pgResult.errorMessage
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_CANCEL_FAILED",
            message:
              "결제 취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 502 }
      );
    }

    // ── DB 상태 업데이트 (RPC 트랜잭션) ──
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "cancel_order_with_refund",
      {
        p_order_id: orderId,
        p_voucher_id: voucher.id,
        p_reason_type: input.reason_type,
        p_reason_detail: input.reason_detail ?? null,
        p_refund_amount: pgResult.cancelledAmount,
        p_pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
        p_force_used: false,
      }
    );

    if (rpcError) {
      console.error(
        "[POST /api/orders/[orderId]/cancel] RPC 에러:",
        rpcError.message
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_UPDATE_FAILED_AFTER_PG_CANCEL",
            message: "결제 취소는 완료되었으나 주문 상태 업데이트에 실패했습니다. 고객센터에 문의해 주세요.",
            pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
          },
        },
        { status: 500 }
      );
    }

    if (!rpcResult?.success) {
      console.error(
        "[POST /api/orders/[orderId]/cancel] RPC 실패:",
        rpcResult?.error_code,
        rpcResult?.error_message
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_UPDATE_FAILED_AFTER_PG_CANCEL",
            message: "결제 취소는 완료되었으나 주문 상태 업데이트에 실패했습니다. 고객센터에 문의해 주세요.",
            pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
          },
        },
        { status: 500 }
      );
    }

    console.log(`[order-cancel] 주문 취소 완료: orderId=${orderId}, refund=${pgResult.cancelledAmount}`);

    // ── SMS 발송 (after API로 응답 후 실행) ──
    const smsOrderNumber = order.order_number;
    const smsQuantity = order.quantity;
    const smsRefundAmount = pgResult.cancelledAmount;
    const smsReceiverPhone = order.receiver_phone;
    const smsVoucherId = voucher.id;
    const smsOrderId = orderId;
    const smsProductId = order.product_id;

    after(async () => {
      try {
        // 상품명 조회
        const smsAdminClient = createAdminClient();
        let productName = "상품권";
        if (smsProductId) {
          const { data: productData } = await smsAdminClient
            .from("products")
            .select("name")
            .eq("id", smsProductId)
            .single();
          productName = productData?.name ?? "상품권";
        }

        const smsMessage = buildCancelMessage({
          orderNumber: smsOrderNumber,
          productName,
          quantity: smsQuantity,
          refundAmount: smsRefundAmount,
        });

        const result = await sendSmsSync({
          recipientPhone: smsReceiverPhone,
          messageContent: smsMessage,
          messageType: "cancel",
          voucherId: smsVoucherId,
          orderId: smsOrderId,
        });

        if (!result.success) {
          console.error("[POST /api/orders/[orderId]/cancel] 취소 SMS 발송 실패:", result.error);
        }
      } catch (error) {
        console.error(
          "[POST /api/orders/[orderId]/cancel] SMS 발송 중 오류:",
          error
        );
      }
    });

    // ── 성공 응답 ──
    return NextResponse.json(
      {
        success: true,
        data: {
          order_id: orderId,
          order_number: order.order_number,
          cancellation_id: rpcResult.cancellation_id ?? null,
          refund_amount: pgResult.cancelledAmount,
          refund_status: "completed",
          pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[POST /api/orders/[orderId]/cancel] Unexpected error:",
      error
    );
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
