/**
 * SMS 모듈 진입점
 */

import { SupabaseClient } from "@supabase/supabase-js";

export { sendSmsAsync, sendSmsSync } from "./send";
export {
  buildPurchaseMessage,
  buildReissueMessage,
  buildGiftMessage,
  buildCancelMessage,
  buildAdminResendMessage,
  buildPasswordResetMessage,
  buildPurchaseNotifyMessage,
} from "./templates";
export type {
  PurchaseTemplateParams,
  ReissueTemplateParams,
  GiftTemplateParams,
  CancelTemplateParams,
  AdminResendTemplateParams,
  PasswordResetTemplateParams,
  PurchaseNotifyTemplateParams,
} from "./templates";

/**
 * 선물 바우처인 경우 수신자(owner) 번호를, 아니면 주문의 receiver_phone을 반환.
 * owner 조회 실패 시 null 반환 (보안: 구매자에게 임시비밀번호 등이 노출되지 않도록).
 */
export async function resolveVoucherSmsPhone(
  adminClient: SupabaseClient,
  orderReceiverPhone: string,
  voucher: { is_gift: boolean; owner_id: string | null }
): Promise<string | null> {
  if (voucher.is_gift && voucher.owner_id) {
    const { data: owner } = await adminClient
      .from("users")
      .select("phone")
      .eq("id", voucher.owner_id)
      .single();
    return owner?.phone ?? null;
  }
  return orderReceiverPhone;
}
