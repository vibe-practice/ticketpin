/**
 * PG 결제 취소 모듈
 *
 * MainPay 전액 취소 API 연동
 * HOST: https://relay.mainpay.co.kr/v1/api/payments/payment/cancel
 */

import { paymentCancel, generateMbrRefNo } from "./mainpay";

export interface PgCancelRequest {
  /** 원 거래번호 (orders.pg_ref_no) */
  refNo: string | null;
  /** 원 거래일자 (orders.pg_tran_date) */
  tranDate: string | null;
  /** 결제타입 (orders.pg_pay_type) */
  payType: string | null;
  /** 취소 금액 */
  cancelAmount: number;
  /** 취소 사유 */
  cancelReason: string;
}

export interface PgCancelResponse {
  success: boolean;
  /** PG사 취소 거래 ID */
  pgCancelTransactionId: string | null;
  /** 실제 취소 금액 */
  cancelledAmount: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * PG 결제 취소 요청
 *
 * refNo, tranDate, payType이 모두 없으면 (PG 미결제 건) 즉시 성공 반환.
 * 그 외: MainPay paymentCancel() 호출.
 */
export async function cancelPgPayment(
  request: PgCancelRequest
): Promise<PgCancelResponse> {
  // PG 결제 정보가 없는 경우 (미결제 건) 즉시 성공 반환
  if (!request.refNo || !request.tranDate || !request.payType) {
    return {
      success: true,
      pgCancelTransactionId: null,
      cancelledAmount: request.cancelAmount,
      errorCode: null,
      errorMessage: null,
    };
  }

  try {
    const mbrRefNo = generateMbrRefNo("CL");

    const pgResult = await paymentCancel({
      mbrRefNo,
      orgRefNo: request.refNo,
      orgTranDate: request.tranDate,
      payType: request.payType,
      amount: request.cancelAmount,
    });

    if (pgResult.resultCode !== "200" || !pgResult.data) {
      console.error("[cancelPgPayment] MainPay cancel error:", pgResult);
      return {
        success: false,
        pgCancelTransactionId: null,
        cancelledAmount: 0,
        errorCode: pgResult.resultCode,
        errorMessage: pgResult.resultMessage ?? "PG 취소에 실패했습니다.",
      };
    }

    return {
      success: true,
      pgCancelTransactionId: pgResult.data.refNo,
      cancelledAmount: request.cancelAmount,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    console.error("[cancelPgPayment] Unexpected error:", error);
    return {
      success: false,
      pgCancelTransactionId: null,
      cancelledAmount: 0,
      errorCode: "CANCEL_ERROR",
      errorMessage: "PG 취소 요청 중 오류가 발생했습니다.",
    };
  }
}
