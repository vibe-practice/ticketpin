import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelPgPayment } from "@/lib/payment/cancel";
import { sendSmsSync, buildCancelMessage } from "@/lib/sms";

/**
 * POST /api/admin/cancellations/[cancellationId]/retry
 *
 * PG 취소 재시도 API
 *
 * 취소 실패(refund_status=failed) 건에 대해 PG 취소를 재시도한다.
 * cancellations 레코드의 pg_ref_no, pg_tran_date, pg_pay_type를 사용하여
 * MainPay cancelPayment API를 호출한다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cancellationId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { cancellationId } = await params;

    // ── 취소 레코드 조회 ──
    const { data: cancellation, error: cancellationError } = await adminClient
      .from("cancellations")
      .select("id, order_id, voucher_id, refund_amount, refund_status, pg_cancel_transaction_id, pg_ref_no, pg_tran_date, pg_pay_type")
      .eq("id", cancellationId)
      .single();

    if (cancellationError || !cancellation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CANCELLATION_NOT_FOUND", message: "취소 내역을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 상태 검증: 실패 건만 재시도 가능 ──
    if (cancellation.refund_status !== "failed") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "취소 실패 건만 재시도할 수 있습니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── PG 취소 재시도 ──
    const c = cancellation as unknown as {
      id: string;
      order_id: string;
      voucher_id: string;
      refund_amount: number;
      refund_status: string;
      pg_cancel_transaction_id: string | null;
      pg_ref_no: string | null;
      pg_tran_date: string | null;
      pg_pay_type: string | null;
    };

    const cancelResult = await cancelPgPayment({
      refNo: c.pg_ref_no,
      tranDate: c.pg_tran_date,
      payType: c.pg_pay_type,
      cancelAmount: c.refund_amount,
      cancelReason: "관리자 PG 취소 재시도",
    });

    if (!cancelResult.success) {
      console.error(
        `[POST /api/admin/cancellations/[id]/retry] PG 취소 재시도 실패: ${cancelResult.errorCode} - ${cancelResult.errorMessage}`
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_CANCEL_FAILED",
            message: cancelResult.errorMessage ?? "PG 취소 재시도에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 502 }
      );
    }

    const pgCancelResult = {
      success: true,
      pg_cancel_transaction_id: cancelResult.pgCancelTransactionId,
    };

    // ── 취소 레코드 업데이트 ──
    const refundedAt = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("cancellations")
      .update({
        refund_status: "completed",
        pg_cancel_transaction_id: pgCancelResult.pg_cancel_transaction_id,
        refunded_at: refundedAt,
      })
      .eq("id", cancellationId);

    if (updateError) {
      console.error("[POST /api/admin/cancellations/[id]/retry] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "취소 상태 업데이트에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ── SMS 발송: 취소 재시도 성공 알림 ──
    const smsCancellationOrderId = c.order_id;
    const smsCancellationVoucherId = c.voucher_id;
    const smsCancellationRefundAmount = c.refund_amount;

    after(async () => {
      try {
        const smsAdminClient = createAdminClient();

        // 주문 정보 조회 (수신자 전화번호, 주문번호, 상품, 수량)
        const { data: orderData } = await smsAdminClient
          .from("orders")
          .select("order_number, receiver_phone, product_id, quantity")
          .eq("id", smsCancellationOrderId)
          .single();

        if (!orderData?.receiver_phone) {
          console.error("[POST /api/admin/cancellations/[id]/retry] 주문 정보 조회 실패, SMS 미발송");
          return;
        }

        let productName = "상품권";
        if (orderData.product_id) {
          const { data: productData } = await smsAdminClient
            .from("products")
            .select("name")
            .eq("id", orderData.product_id)
            .single();
          productName = productData?.name ?? "상품권";
        }

        const result = await sendSmsSync({
          recipientPhone: orderData.receiver_phone,
          messageContent: buildCancelMessage({
            orderNumber: orderData.order_number,
            productName,
            quantity: orderData.quantity,
            refundAmount: smsCancellationRefundAmount,
          }),
          messageType: "cancel",
          voucherId: smsCancellationVoucherId,
          orderId: smsCancellationOrderId,
          sentBy: "admin",
        });

        if (!result.success) {
          console.error("[POST /api/admin/cancellations/[id]/retry] SMS 발송 실패:", result.error);
        }
      } catch (error) {
        console.error("[POST /api/admin/cancellations/[id]/retry] SMS 발송 중 오류:", error);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        cancellation_id: cancellationId,
        refund_status: "completed",
        pg_cancel_transaction_id: pgCancelResult.pg_cancel_transaction_id,
        refunded_at: refundedAt,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/cancellations/[id]/retry] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
