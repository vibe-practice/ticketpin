/**
 * SMS 메시지 템플릿 생성 함수
 *
 * docs/sms-message.md 에 정의된 템플릿을 그대로 사용한다.
 * 모든 메시지에 이모지를 사용하지 않는다.
 */

/** 천 단위 콤마 포맷 */
function formatAmount(amount: number): string {
  return amount.toLocaleString("ko-KR");
}

/** 바우처 URL 생성 */
function voucherUrl(code: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpin24.com";
  return `${appUrl}/v/${code}`;
}

// ============================================================
// 구매 완료 (purchase)
// ============================================================

export interface PurchaseTemplateParams {
  productName: string;
  quantity: number;
  totalAmount: number;
  voucherCode: string;
  tempPassword: string;
  /** 수수료 별도일 때만 필요 */
  feeTotal?: number;
}

/**
 * 구매 완료 SMS 메시지 생성
 * - feeTotal이 있으면 수수료 별도 템플릿, 없으면 수수료 포함 템플릿
 */
export function buildPurchaseMessage(params: PurchaseTemplateParams): string {
  const base = `[티켓매니아] 상품권 구매 완료

${params.productName} ${params.quantity}매
결제금액: ${formatAmount(params.totalAmount)}원

아래 링크에서 상품권을 확인하세요.
${voucherUrl(params.voucherCode)}

임시 비밀번호: ${params.tempPassword}
(유효시간 20분)`;

  if (params.feeTotal != null && params.feeTotal > 0) {
    return `${base}

핀 번호 해제 수수료: ${formatAmount(params.feeTotal)}원
수수료 결제 후 핀 번호를 확인하실 수 있습니다.

결제 취소는 구매 당일 자정까지만 가능합니다.`;
  }

  return `${base}

결제 취소는 구매 당일 자정까지만 가능합니다.`;
}

// ============================================================
// 임시 비밀번호 재발행 (reissue)
// ============================================================

export interface ReissueTemplateParams {
  tempPassword: string;
  voucherCode: string;
}

export function buildReissueMessage(params: ReissueTemplateParams): string {
  return `[티켓매니아] 임시 비밀번호 재발행

새 임시 비밀번호: ${params.tempPassword}
(유효시간 20분)

${voucherUrl(params.voucherCode)}`;
}

// ============================================================
// 선물 수신 (gift)
// ============================================================

export interface GiftTemplateParams {
  senderName: string;
  senderUsername: string;
  productName: string;
  quantity: number;
  productPrice: number;
  newVoucherCode: string;
  tempPassword: string;
  /** 수수료 별도일 때만 필요 */
  feeTotal?: number;
}

export function buildGiftMessage(params: GiftTemplateParams): string {
  const base = `[티켓매니아] 상품권 선물 도착

${params.senderName}(${params.senderUsername})님이 상품권을 보냈습니다.

${params.productName} ${params.quantity}매
금액: ${formatAmount(params.productPrice)}원

아래 링크에서 상품권을 확인하세요.
${voucherUrl(params.newVoucherCode)}

임시 비밀번호: ${params.tempPassword}
(유효시간 20분)`;

  if (params.feeTotal != null && params.feeTotal > 0) {
    return `${base}

핀 번호 해제 수수료: ${formatAmount(params.feeTotal)}원
수수료 결제 후 핀 번호를 확인하실 수 있습니다.`;
  }

  return base;
}

// ============================================================
// 결제 취소 완료 (cancel)
// ============================================================

export interface CancelTemplateParams {
  orderNumber: string;
  productName: string;
  quantity: number;
  refundAmount: number;
}

export function buildCancelMessage(params: CancelTemplateParams): string {
  return `[티켓매니아] 결제 취소 완료

주문번호: ${params.orderNumber}
상품명: ${params.productName} ${params.quantity}매
취소금액: ${formatAmount(params.refundAmount)}원

카드사 사정에 따라 영업일 기준 3~5일 내에 취소가 반영됩니다.`;
}

// ============================================================
// 관리자 문자 재발송 (admin_resend)
// ============================================================

export interface AdminResendTemplateParams {
  voucherCode: string;
  tempPassword: string;
}

export function buildAdminResendMessage(params: AdminResendTemplateParams): string {
  return `[티켓매니아] 임시 비밀번호 안내

아래 링크에서 상품권을 확인하세요.
${voucherUrl(params.voucherCode)}

새 임시 비밀번호: ${params.tempPassword}
(유효시간 20분)`;
}

// ============================================================
// 매입 알림 (purchase_notify)
// ============================================================

export interface PurchaseNotifyTemplateParams {
  /** 선물 보낸 일시 (KST, "YYYY-MM-DD HH:mm" 형식) */
  giftDateTime: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  /** "included" = 수수료 포함, "separate" = 수수료 별도 */
  feeType: string;
  /** 수수료 별도일 때 수수료 총액 */
  feeTotal?: number;
  /** 결제 카드사명 (예: "삼성카드") */
  cardCompanyName: string | null;
  /** 선물 보낸 사람 이름 */
  senderName: string;
}

export function buildPurchaseNotifyMessage(params: PurchaseNotifyTemplateParams): string {
  const feeText =
    params.feeType === "separate" && params.feeTotal != null && params.feeTotal > 0
      ? `수수료 : 별도 (${formatAmount(params.feeTotal)}원)`
      : `수수료 : 포함`;

  return `[티켓매니아] 매입 알림

선물 보낸 일시 : ${params.giftDateTime}
상품명 : ${params.productName}
갯수 : ${params.quantity}
총 결제 금액 : ${formatAmount(params.totalAmount)}원
${feeText}
결제 카드사 : ${params.cardCompanyName ?? "정보 없음"}
이름 : ${params.senderName}`;
}

// ============================================================
// 관리자 비밀번호 초기화 (password_reset)
// ============================================================

export interface PasswordResetTemplateParams {
  voucherCode: string;
}

export function buildPasswordResetMessage(params: PasswordResetTemplateParams): string {
  return `[티켓매니아] 비밀번호 초기화 안내

관리자에 의해 비밀번호가 초기화되었습니다.
아래 링크에서 새 비밀번호를 설정해주세요.

${voucherUrl(params.voucherCode)}`;
}
