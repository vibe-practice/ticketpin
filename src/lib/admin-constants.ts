import type { SettlementStatus, BusinessStatus, VerificationStatus, VoucherStatus, PurchaseAccountStatus } from "@/types";

// ─── 정산 상태 ───────────────────────────────────────────────────────────────

export const SETTLEMENT_STATUS_STYLE: Record<SettlementStatus, string> = {
  pending: "bg-amber-50 text-amber-600",
  confirmed: "bg-info-bg text-info",
  paid: "bg-success-bg text-success",
  cancelled: "bg-error-bg text-error",
};

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  pending: "대기",
  confirmed: "확인",
  paid: "입금완료",
  cancelled: "취소",
};

// ─── 업체 상태 ───────────────────────────────────────────────────────────────

export const BUSINESS_STATUS_STYLE: Record<BusinessStatus, string> = {
  active: "bg-success-bg text-success",
  terminated: "bg-muted text-muted-foreground",
};

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  active: "활성",
  terminated: "해지",
};

// ─── 바우처(상품권) 상태 ─────────────────────────────────────────────────────

export const VOUCHER_STATUS_STYLE: Record<VoucherStatus, string> = {
  issued: "bg-muted text-muted-foreground",
  temp_verified: "bg-info-bg text-info",
  password_set: "bg-brand-primary-muted text-primary",
  pin_revealed: "bg-success-bg text-success",
  gifted: "bg-warning-bg text-warning",
  cancelled: "bg-error-bg text-error",
};

export const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  issued: "미확인",
  temp_verified: "임시인증",
  password_set: "비밀번호설정",
  pin_revealed: "핀확인",
  gifted: "재선물",
  cancelled: "취소",
};

// ─── 검증 상태 ───────────────────────────────────────────────────────────────

export const VERIFICATION_STATUS_STYLE: Record<VerificationStatus, string> = {
  verified: "bg-success-bg text-success",
  suspicious: "bg-amber-50 text-amber-600",
  rejected: "bg-error-bg text-error",
  pending: "bg-muted text-muted-foreground",
};

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "정상",
  suspicious: "의심",
  rejected: "거부",
  pending: "대기",
};

// ─── 매입 아이디 상태 ────────────────────────────────────────────────────────

export const PURCHASE_ACCOUNT_STATUS_STYLE: Record<PurchaseAccountStatus, string> = {
  active: "bg-success-bg text-success",
  suspended: "bg-muted text-muted-foreground",
};

export const PURCHASE_ACCOUNT_STATUS_LABEL: Record<PurchaseAccountStatus, string> = {
  active: "활성",
  suspended: "중지",
};
