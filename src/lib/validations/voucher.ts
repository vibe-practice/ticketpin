import { z } from "zod";

/**
 * 바우처 코드 검증 (UUID v4 형식)
 */
export const voucherCodeSchema = z
  .string()
  .uuid("유효하지 않은 바우처 코드입니다.");

/**
 * 임시 비밀번호 검증 요청
 * POST /api/vouchers/[code]/verify-temp-password
 */
export const verifyTempPasswordSchema = z.object({
  temp_password: z
    .string()
    .length(3, "임시 비밀번호는 3자리여야 합니다.")
    .regex(/^\d{3}$/, "임시 비밀번호는 숫자 3자리여야 합니다."),
});

export type VerifyTempPasswordInput = z.infer<typeof verifyTempPasswordSchema>;

/**
 * 사용자 비밀번호 설정 요청
 * POST /api/vouchers/[code]/set-password
 */
export const setPasswordSchema = z.object({
  password: z
    .string()
    .length(4, "비밀번호는 4자리여야 합니다.")
    .regex(/^\d{4}$/, "비밀번호는 숫자 4자리여야 합니다."),
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/**
 * 핀 해제 (비밀번호 검증) 요청
 * POST /api/vouchers/[code]/unlock-pins
 */
export const unlockPinsSchema = z.object({
  password: z
    .string()
    .length(4, "비밀번호는 4자리여야 합니다.")
    .regex(/^\d{4}$/, "비밀번호는 숫자 4자리여야 합니다."),
});

export type UnlockPinsInput = z.infer<typeof unlockPinsSchema>;

/**
 * 수수료 결제 승인 요청
 * POST /api/vouchers/[code]/fee-payment/confirm
 *
 * password: 바우처 사용자 비밀번호 (4자리 숫자) — 핀 복호화 권한 검증용
 */
export const feePaymentConfirmSchema = z.object({
  payment_key: z
    .string()
    .min(1, "결제 키가 필요합니다.")
    .max(200, "결제 키가 너무 깁니다."),
  amount: z
    .number()
    .int("결제 금액은 정수여야 합니다.")
    .positive("결제 금액은 0보다 커야 합니다.")
    .max(10_000_000, "결제 금액이 비정상적으로 큽니다."),
  auth_token: z
    .string()
    .min(1, "인증 토큰이 필요합니다.")
    .max(100, "인증 토큰이 너무 깁니다."),
  mbr_ref_no: z
    .string()
    .min(1, "가맹점 주문번호가 필요합니다.")
    .max(20, "가맹점 주문번호가 너무 깁니다."),
  password: z
    .string()
    .length(4, "비밀번호는 4자리여야 합니다.")
    .regex(/^\d{4}$/, "비밀번호는 숫자 4자리여야 합니다."),
});

export type FeePaymentConfirmInput = z.infer<typeof feePaymentConfirmSchema>;

/**
 * 선물하기 요청
 * POST /api/vouchers/[code]/gift
 */
export const giftSchema = z.object({
  receiver_username: z
    .string()
    .min(1, "수신자 아이디를 입력해주세요.")
    .max(50, "아이디는 50자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문, 숫자, 밑줄만 사용 가능합니다."),
});

export type GiftInput = z.infer<typeof giftSchema>;
