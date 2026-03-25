import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCancelOrderSchema } from "@/lib/validations/admin";
import { cancelPgPayment } from "@/lib/payment/cancel";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSmsSync, buildCancelMessage } from "@/lib/sms";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/orders/[orderId]/cancel
 *
 * 관리자 주문 취소
 * - cancelled 외 모든 상태 취소 가능
 * - PG 환불 + DB 상태 업데이트 (RPC 트랜잭션)
 * - 취소 SMS 발송
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!UUID_REGEX.test(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ORDER_ID", message: "유효하지 않은 주문 ID입니다." },
        },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // 입력 검증
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    const parsed = adminCancelOrderSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // 주문 조회
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_number, user_id, product_id, quantity, product_price, total_amount, receiver_phone, status, pg_ref_no, pg_tran_date, pg_pay_type")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 이미 취소된 주문 확인
    if (order.status === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ALREADY_CANCELLED", message: "이미 취소된 주문입니다." },
        },
        { status: 409 }
      );
    }

    // 바우처 조회: order_id에 연결된 모든 바우처 (선물 시 원본+선물 바우처 공존)
    const { data: vouchers, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, code, status, is_gift, source_voucher_id, fee_paid, fee_pg_transaction_id, fee_pg_ref_no, fee_pg_tran_date, fee_pg_pay_type, fee_amount")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (voucherError || !vouchers || vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_NOT_FOUND", message: "연결된 바우처를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 활성 바우처 찾기: gifted/cancelled가 아닌 최신 바우처 (선물 수신자의 바우처)
    const activeVoucher = vouchers.find(
      (v) => v.status !== "gifted" && v.status !== "cancelled"
    ) ?? vouchers[0];

    // PG 결제 취소
    const cancelReason =
      input.reason_type === "simple_change"
        ? "단순 변심"
        : input.reason_type === "wrong_purchase"
          ? "잘못된 구매"
          : input.reason_type === "admin"
            ? "관리자 처리"
            : input.reason_detail ?? "기타";

    const pgResult = await cancelPgPayment({
      refNo: order.pg_ref_no,
      tranDate: order.pg_tran_date,
      payType: order.pg_pay_type,
      cancelAmount: order.total_amount,
      cancelReason,
    });

    if (!pgResult.success) {
      console.error("[POST /api/admin/orders/[orderId]/cancel] PG 취소 실패:", pgResult.errorMessage);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PG_CANCEL_FAILED",
            message: "결제 취소 처리 중 오류가 발생했습니다.",
          },
        },
        { status: 502 }
      );
    }

    // DB 상태 업데이트 (RPC 트랜잭션)
    // cancelled_by를 "admin"으로 설정하기 위해 RPC 함수의 하드코딩된 "user"를 우회
    // cancel_order_with_refund는 cancelled_by를 "user"로 하드코딩하고 있으므로,
    // 관리자 취소에서는 직접 업데이트 후 cancellations 레코드를 수정
    // pin_revealed 상태에서 취소 시 핀을 used로 처리하여 재배정 방지
    const forceUsed = activeVoucher.status === "pin_revealed";

    const rpcParams = {
      p_order_id: orderId,
      p_voucher_id: activeVoucher.id,
      p_reason_type: input.reason_type,
      p_reason_detail: input.reason_detail ?? null,
      p_refund_amount: pgResult.cancelledAmount,
      p_pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
      p_force_used: forceUsed,
    };

    // RPC 호출 (1회 재시도 포함)
    let rpcResult: Record<string, unknown> | null = null;
    let rpcError: { message: string } | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await adminClient.rpc("cancel_order_with_refund", rpcParams);
      rpcResult = data as Record<string, unknown> | null;
      rpcError = error;

      if (!error && rpcResult?.success) break;

      if (attempt === 0) {
        console.warn("[cancel] RPC 1차 실패, 재시도:", {
          orderId,
          error: error?.message,
          rpcResult: (rpcResult as Record<string, unknown>)?.error_message,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // RPC 최종 실패 시: 개별 UPDATE로 직접 상태 전이 (바우처+핀 포함)
    if (rpcError || !rpcResult?.success) {
      console.error("[cancel] PG 취소 성공했으나 RPC 최종 실패 — 개별 UPDATE fallback 시작:", {
        orderId,
        pgCancelTransactionId: pgResult.pgCancelTransactionId,
        cancelledAmount: pgResult.cancelledAmount,
        rpcError: rpcError?.message,
        rpcErrorCode: (rpcResult as Record<string, unknown>)?.error_code,
        rpcErrorMessage: (rpcResult as Record<string, unknown>)?.error_message,
      });

      const fallbackErrors: string[] = [];

      // 1. 주문 상태 -> cancelled
      const { error: orderUpdateError } = await adminClient
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (orderUpdateError) {
        fallbackErrors.push(`주문 상태 변경 실패: ${orderUpdateError.message}`);
      }

      // 2. 바우처 상태 -> cancelled (activeVoucher + 동일 주문의 모든 바우처)
      const allVoucherIds = vouchers.map((v) => v.id);
      const { error: voucherUpdateError } = await adminClient
        .from("vouchers")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in("id", allVoucherIds);

      if (voucherUpdateError) {
        fallbackErrors.push(`바우처 상태 변경 실패: ${voucherUpdateError.message}`);
      }

      // 3. 핀 상태 처리 (forceUsed이면 consumed, 아니면 waiting으로 복구)
      for (const vid of allVoucherIds) {
        if (forceUsed) {
          const { error: pinError } = await adminClient
            .from("pins")
            .update({ status: "consumed" })
            .eq("voucher_id", vid);
          if (pinError) {
            fallbackErrors.push(`핀 consumed 변경 실패 (voucher=${vid}): ${pinError.message}`);
          }
        } else {
          const { error: pinError } = await adminClient
            .from("pins")
            .update({ status: "waiting", voucher_id: null, assigned_at: null })
            .eq("voucher_id", vid);
          if (pinError) {
            fallbackErrors.push(`핀 waiting 복구 실패 (voucher=${vid}): ${pinError.message}`);
          }
        }
      }

      // 4. cancellations 테이블에 기록
      const { error: fallbackCancelError } = await adminClient
        .from("cancellations")
        .insert({
          order_id: orderId,
          voucher_id: activeVoucher.id,
          reason_type: input.reason_type,
          reason_detail: input.reason_detail ?? null,
          cancelled_by: "admin",
          refund_amount: pgResult.cancelledAmount,
          refund_status: fallbackErrors.length > 0 ? "failed" : "completed",
          pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
          refunded_at: new Date().toISOString(),
        });

      if (fallbackCancelError) {
        fallbackErrors.push(`cancellation 기록 실패: ${fallbackCancelError.message}`);
      }

      if (fallbackErrors.length > 0) {
        // PG 환불은 성공했으나 DB 상태 전이가 불완전한 위험 상태 — 상세 구조화 로그
        console.error("[cancel] CRITICAL: PG 환불 완료 후 DB fallback 일부 실패", JSON.stringify({
          severity: "CRITICAL",
          orderId,
          orderNumber: order.order_number,
          pgCancelTransactionId: pgResult.pgCancelTransactionId,
          cancelledAmount: pgResult.cancelledAmount,
          fallbackErrors,
          timestamp: new Date().toISOString(),
        }));
      } else {
        console.log("[cancel] Fallback으로 모든 상태 전이 완료:", orderId);
      }

      // Fallback이 모두 성공한 경우에도 성공으로 반환 (PG 환불은 이미 완료됨)
      if (fallbackErrors.length === 0) {
        // cancelled_by 업데이트는 이미 INSERT에서 admin으로 설정됨
        // SMS 발송은 성공 경로와 동일하게 진행 (아래 after 블록에서 처리)
        console.log(`[admin-cancel] 주문 취소 완료 (fallback): orderId=${orderId}, orderNumber=${order.order_number}`);

        // SMS 발송 (after API로 응답 후 실행)
        const fbSmsOrderNumber = order.order_number;
        const fbSmsQuantity = order.quantity;
        const fbSmsRefundAmount = pgResult.cancelledAmount;
        const fbSmsReceiverPhone = order.receiver_phone;
        const fbSmsVoucherId = activeVoucher.id;
        const fbSmsOrderId = orderId;
        const fbSmsProductId = order.product_id;

        after(async () => {
          try {
            const smsClient = createAdminClient();
            let productName = "상품권";
            if (fbSmsProductId) {
              const { data: productData } = await smsClient
                .from("products")
                .select("name")
                .eq("id", fbSmsProductId)
                .single();
              productName = productData?.name ?? "상품권";
            }

            const result = await sendSmsSync({
              recipientPhone: fbSmsReceiverPhone,
              messageContent: buildCancelMessage({
                orderNumber: fbSmsOrderNumber,
                productName,
                quantity: fbSmsQuantity,
                refundAmount: fbSmsRefundAmount,
              }),
              messageType: "cancel",
              voucherId: fbSmsVoucherId,
              orderId: fbSmsOrderId,
              sentBy: "admin",
            });

            if (!result.success) {
              console.error("[cancel fallback] SMS 발송 실패:", result.error);
            }
          } catch (error) {
            console.error("[cancel fallback] SMS 발송 중 오류:", error);
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            order_id: orderId,
            order_number: order.order_number,
            cancellation_id: null,
            refund_amount: pgResult.cancelledAmount,
            refund_status: "completed",
            fallback_used: true,
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DB_UPDATE_FAILED_AFTER_PG_CANCEL",
            message: "결제 취소는 완료되었으나 DB 상태 전이에 일부 실패했습니다. 취소 목록에서 재시도해 주세요.",
            pg_cancel_transaction_id: pgResult.pgCancelTransactionId,
            fallback_errors: fallbackErrors,
          },
        },
        { status: 500 }
      );
    }

    // 같은 order_id의 다른 바우처도 cancelled로 변경 (원본 바우처 등)
    const otherVoucherIds = vouchers
      .filter((v) => v.id !== activeVoucher.id && v.status !== "cancelled")
      .map((v) => v.id);

    if (otherVoucherIds.length > 0) {
      const { error: otherVoucherError } = await adminClient
        .from("vouchers")
        .update({ status: "cancelled" })
        .in("id", otherVoucherIds);
      if (otherVoucherError) {
        console.error("[cancel] 연관 바우처 취소 업데이트 실패:", otherVoucherError);
      }
    }

    // cancelled_by를 "admin"으로 업데이트 (RPC가 "user"로 하드코딩되어 있음)
    const cancellationId = rpcResult?.cancellation_id as string | undefined;
    if (cancellationId) {
      const { error: cancelledByError } = await adminClient
        .from("cancellations")
        .update({ cancelled_by: "admin" })
        .eq("id", cancellationId);
      if (cancelledByError) {
        console.error("[cancel] cancelled_by 업데이트 실패:", cancelledByError);
      }
    }

    // ── 직접 구매 바우처(activeVoucher) 수수료 PG 환불 처리 ──
    const feeCancelWarnings: string[] = [];
    let feeRefundedAmount = 0; // 수수료 환불 성공 금액 (SMS 합산용)
    const activeVoucherRecord = activeVoucher as Record<string, unknown>;
    if (activeVoucherRecord.fee_paid && activeVoucherRecord.fee_pg_transaction_id && (activeVoucherRecord.fee_amount as number) > 0) {
      try {
        const feeAmount = (activeVoucherRecord.fee_amount as number) ?? 0;
        const directFeeCancelResult = await cancelPgPayment({
          refNo: (activeVoucherRecord.fee_pg_ref_no as string) ?? null,
          tranDate: (activeVoucherRecord.fee_pg_tran_date as string) ?? null,
          payType: (activeVoucherRecord.fee_pg_pay_type as string) ?? null,
          cancelAmount: feeAmount,
          cancelReason: "관리자 주문 취소에 따른 수수료 환불",
        });

        if (directFeeCancelResult.success) {
          feeRefundedAmount = feeAmount;
        } else {
          const warning = `직접구매 바우처 ${activeVoucherRecord.code}: 수수료 PG 환불 실패 (fee_pg_transaction_id=${activeVoucherRecord.fee_pg_transaction_id}, amount=${activeVoucherRecord.fee_amount})`;
          feeCancelWarnings.push(warning);
          console.error("[cancel] 직접구매 바우처 수수료 PG 환불 실패:", {
            voucherId: activeVoucherRecord.id,
            voucherCode: activeVoucherRecord.code,
            feeAmount: activeVoucherRecord.fee_amount,
            feePgTransactionId: activeVoucherRecord.fee_pg_transaction_id,
            errorCode: directFeeCancelResult.errorCode,
            errorMessage: directFeeCancelResult.errorMessage,
          });
        }
      } catch (directFeeError) {
        console.error("[cancel] 직접구매 바우처 수수료 PG 환불 처리 중 오류:", directFeeError);
        feeCancelWarnings.push("직접구매 바우처 수수료 환불 처리 중 예외 발생");
      }
    }

    // ── 연쇄 취소된 선물 바우처의 수수료 PG 환불 처리 ──
    // cancel_order_with_refund RPC는 선물 수신자 바우처도 연쇄 취소하지만,
    // 수신자가 수수료를 별도 PG 결제한 경우 해당 환불은 처리하지 않으므로 여기서 처리
    try {
      // 이 주문의 바우처에서 파생된 선물 바우처 중 fee_paid=true인 건 조회
      // 원본 바우처(gifted 상태)에서 파생된 선물 바우처를 찾음
      const sourceVoucher = vouchers.find((v) => v.status === "gifted" || v.status === "cancelled");
      const sourceVoucherId = sourceVoucher?.id ?? activeVoucher.id;
      const { data: giftVouchers } = await adminClient
        .from("vouchers")
        .select("id, code, fee_paid, fee_pg_transaction_id, fee_pg_ref_no, fee_pg_tran_date, fee_pg_pay_type, fee_amount, status")
        .eq("source_voucher_id", sourceVoucherId)
        .eq("status", "cancelled");

      if (giftVouchers && giftVouchers.length > 0) {
        for (const gv of giftVouchers) {
          const gvRecord = gv as Record<string, unknown>;
          if (gvRecord.fee_paid && gvRecord.fee_pg_transaction_id && (gvRecord.fee_amount as number) > 0) {
            const feeCancelResult = await cancelPgPayment({
              refNo: (gvRecord.fee_pg_ref_no as string) ?? null,
              tranDate: (gvRecord.fee_pg_tran_date as string) ?? null,
              payType: (gvRecord.fee_pg_pay_type as string) ?? null,
              cancelAmount: (gvRecord.fee_amount as number) ?? 0,
              cancelReason: "원본 주문 관리자 취소에 따른 수수료 환불",
            });

            if (!feeCancelResult.success) {
              const warning = `바우처 ${gvRecord.code}: 수수료 PG 환불 실패 (fee_pg_transaction_id=${gvRecord.fee_pg_transaction_id}, amount=${gvRecord.fee_amount})`;
              feeCancelWarnings.push(warning);
              console.error("[cancel] 수수료 PG 환불 실패:", {
                voucherId: gvRecord.id,
                voucherCode: gvRecord.code,
                feeAmount: gvRecord.fee_amount,
                feePgTransactionId: gvRecord.fee_pg_transaction_id,
                errorCode: feeCancelResult.errorCode,
                errorMessage: feeCancelResult.errorMessage,
              });
            }
          }
        }
      }
    } catch (feeError) {
      console.error("[cancel] 수수료 PG 환불 처리 중 오류:", feeError);
      feeCancelWarnings.push("수수료 환불 조회/처리 중 예외 발생");
    }

    console.log(`[admin-cancel] 주문 취소 완료: orderId=${orderId}, orderNumber=${order.order_number}, refund=${pgResult.cancelledAmount}, cancelledBy=admin`);

    // SMS 발송 (after API로 응답 후 실행)
    const smsOrderNumber = order.order_number;
    const smsQuantity = order.quantity;
    const smsRefundAmount = pgResult.cancelledAmount + feeRefundedAmount;
    const smsReceiverPhone = order.receiver_phone;
    const smsVoucherId = activeVoucher.id;
    const smsOrderId = orderId;
    const smsProductId = order.product_id;

    after(async () => {
      try {
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

        const result = await sendSmsSync({
          recipientPhone: smsReceiverPhone,
          messageContent: buildCancelMessage({
            orderNumber: smsOrderNumber,
            productName,
            quantity: smsQuantity,
            refundAmount: smsRefundAmount,
          }),
          messageType: "cancel",
          voucherId: smsVoucherId,
          orderId: smsOrderId,
          sentBy: "admin",
        });

        if (!result.success) {
          console.error("[POST /api/admin/orders/[orderId]/cancel] SMS 발송 실패:", result.error);
        }
      } catch (error) {
        console.error("[POST /api/admin/orders/[orderId]/cancel] SMS 발송 중 오류:", error);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        order_number: order.order_number,
        cancellation_id: cancellationId ?? null,
        refund_amount: pgResult.cancelledAmount,
        refund_status: "completed",
        ...(feeCancelWarnings.length > 0 && { fee_cancel_warnings: feeCancelWarnings }),
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/orders/[orderId]/cancel] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
