/**
 * PG 수수료 결제 모듈
 *
 * MainPay 결제 API 연동 (수수료 별도 결제 전용)
 * 결제 준비: paymentReady → aid, nextPcUrl, nextMobileUrl 반환
 * 결제 승인: paymentPay → 결제 정보 반환
 */

import { paymentReady, paymentPay, getCardCompanyName, generateMbrRefNo } from "./mainpay";

export interface PgFeePaymentPrepareRequest {
  /** 주문번호 */
  orderNumber: string;
  /** 수수료 총액 (건당 수수료 x 수량) */
  feeAmount: number;
  /** 상품명 (결제창 표시용) */
  productName: string;
}

export interface PgFeePaymentPrepareResponse {
  success: boolean;
  /** PG사 결제 준비 키 (결제창 호출 시 사용) */
  paymentKey: string | null;
  /** 결제 금액 */
  amount: number;
  /** PC 결제창 URL */
  nextPcUrl: string | null;
  /** 모바일 결제창 URL */
  nextMobileUrl: string | null;
  /** 가맹점 주문번호 (승인 시 필요) */
  mbrRefNo: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PgFeePaymentConfirmRequest {
  /** PG사 결제 준비 키 (aid) */
  paymentKey: string;
  /** 결제 금액 */
  amount: number;
  /** 인증 토큰 (approvalUrl에서 수신) */
  authToken: string;
  /** 가맹점 주문번호 */
  mbrRefNo: string;
}

export interface PgFeePaymentConfirmResponse {
  success: boolean;
  /** PG사 거래 ID */
  pgTransactionId: string | null;
  /** 실제 결제 금액 */
  paidAmount: number;
  /** PG 결제 상세 정보 */
  pgRefNo: string | null;
  pgTranDate: string | null;
  pgPayType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}


/**
 * PG 수수료 결제 준비
 *
 * MainPay paymentReady 호출 → 결제창 URL 반환
 */
export async function prepareFeePayment(
  request: PgFeePaymentPrepareRequest
): Promise<PgFeePaymentPrepareResponse> {
  try {
    const mbrRefNo = generateMbrRefNo("FE");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpin24.com";
    const approvalUrl = `${appUrl}/payment/approval`;
    const closeUrl = `${appUrl}/payment/close`;

    const pgResult = await paymentReady({
      mbrRefNo,
      amount: request.feeAmount,
      goodsName: request.productName.slice(0, 30),
      approvalUrl,
      closeUrl,
    });

    if (pgResult.resultCode !== "200" || !pgResult.data) {
      console.error("[prepareFeePayment] MainPay error:", pgResult);
      return {
        success: false,
        paymentKey: null,
        amount: 0,
        nextPcUrl: null,
        nextMobileUrl: null,
        mbrRefNo: null,
        errorCode: pgResult.resultCode,
        errorMessage: pgResult.resultMessage ?? "결제 준비 중 오류가 발생했습니다.",
      };
    }

    return {
      success: true,
      paymentKey: pgResult.data.aid,
      amount: request.feeAmount,
      nextPcUrl: pgResult.data.nextPcUrl,
      nextMobileUrl: pgResult.data.nextMobileUrl,
      mbrRefNo,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    console.error("[prepareFeePayment] Unexpected error:", error);
    return {
      success: false,
      paymentKey: null,
      amount: 0,
      nextPcUrl: null,
      nextMobileUrl: null,
      mbrRefNo: null,
      errorCode: "PREPARE_ERROR",
      errorMessage: "결제 준비 요청 중 오류가 발생했습니다.",
    };
  }
}

/**
 * PG 수수료 결제 승인
 *
 * MainPay paymentPay 호출 → 결제 정보 반환
 */
export async function confirmFeePayment(
  request: PgFeePaymentConfirmRequest
): Promise<PgFeePaymentConfirmResponse> {
  try {
    const pgResult = await paymentPay({
      aid: request.paymentKey,
      mbrRefNo: request.mbrRefNo,
      authToken: request.authToken,
      amount: request.amount,
    });

    if (pgResult.resultCode !== "200" || !pgResult.data) {
      console.error("[confirmFeePayment] MainPay error:", pgResult);
      return {
        success: false,
        pgTransactionId: null,
        paidAmount: 0,
        pgRefNo: null,
        pgTranDate: null,
        pgPayType: null,
        errorCode: pgResult.resultCode,
        errorMessage: pgResult.resultMessage ?? "결제 승인 중 오류가 발생했습니다.",
      };
    }

    const pgData = pgResult.data;

    return {
      success: true,
      pgTransactionId: pgData.refNo,
      paidAmount: parseInt(pgData.amount, 10),
      pgRefNo: pgData.refNo,
      pgTranDate: pgData.tranDate,
      pgPayType: pgData.payType,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    console.error("[confirmFeePayment] Unexpected error:", error);
    return {
      success: false,
      pgTransactionId: null,
      paidAmount: 0,
      pgRefNo: null,
      pgTranDate: null,
      pgPayType: null,
      errorCode: "CONFIRM_ERROR",
      errorMessage: "결제 승인 요청 중 오류가 발생했습니다.",
    };
  }
}

// 카드사 코드 매핑 (re-export)
export { getCardCompanyName };
