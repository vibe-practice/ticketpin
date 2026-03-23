import { z } from "zod";

/** 전화번호 검증: 01로 시작, 10~11자리 숫자 (하이픈 없이) */
const phoneSchema = z
  .string()
  .regex(/^01\d{8,9}$/, "올바른 전화번호 형식이 아닙니다 (예: 01012345678)")
  .nullable()
  .optional();

// ── 매입 아이디 등록/수정 스키마 ────────────────────────────────────
export const purchaseAccountFormSchema = z.object({
  account_name: z
    .string()
    .min(1, "아이디명을 입력하세요")
    .max(100, "100자 이내로 입력하세요"),
  username: z
    .string()
    .min(4, "로그인 아이디는 4자 이상이어야 합니다")
    .max(20, "20자 이내로 입력하세요")
    .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄만 사용 가능합니다"),
  password: z
    .string()
    .min(6, "비밀번호는 6자 이상이어야 합니다")
    .max(50, "50자 이내로 입력하세요"),
  notification_phone: phoneSchema,
  memo: z.string().max(500, "500자 이내로 입력하세요").nullable().optional(),
});

export type PurchaseAccountFormData = z.infer<typeof purchaseAccountFormSchema>;

// ── 매입 아이디 수정 스키마 (password 선택) ─────────────────────────
export const purchaseAccountUpdateSchema = z.object({
  account_name: z
    .string()
    .min(1, "아이디명을 입력하세요")
    .max(100, "100자 이내로 입력하세요"),
  username: z
    .string()
    .min(4, "로그인 아이디는 4자 이상이어야 합니다")
    .max(20, "20자 이내로 입력하세요")
    .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄만 사용 가능합니다")
    .optional(),
  status: z.enum(["active", "suspended"] as const).optional(),
  notification_phone: phoneSchema,
  memo: z.string().max(500, "500자 이내로 입력하세요").nullable().optional(),
});

export type PurchaseAccountUpdateData = z.infer<typeof purchaseAccountUpdateSchema>;
