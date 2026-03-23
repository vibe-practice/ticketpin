import type { VoucherStatus } from "@/types";

// ============================================================
// 보유(활성) 바우처 상태 — 핀 확인 완료(pin_revealed)는 사용 완료로 간주
// ============================================================

export const ACTIVE_VOUCHER_STATUSES: VoucherStatus[] = [
  "issued",
  "temp_verified",
  "password_set",
];
