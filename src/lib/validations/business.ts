import { z } from "zod";

// ── 업체 등록/수정 스키마 ────────────────────────────────────────
export const businessFormSchema = z.object({
  user_id: z.string().min(1, "업체 회원을 선택하세요"),
  business_name: z.string().min(1, "업체명을 입력하세요").max(100, "100자 이내로 입력하세요"),
  contact_person: z.string().min(1, "담당자명을 입력하세요").max(50, "50자 이내로 입력하세요"),
  contact_phone: z
    .string()
    .min(1, "연락처를 입력하세요")
    .regex(/^01[016789]\d{7,8}$/, "올바른 휴대폰 번호 형식이 아닙니다."),
  bank_name: z.string().min(1, "은행을 선택하세요"),
  account_number: z
    .string()
    .min(1, "계좌번호를 입력하세요")
    .max(30, "30자 이내로 입력하세요")
    .regex(/^[\d-]+$/, "숫자와 하이픈만 입력 가능합니다."),
  account_holder: z.string().min(1, "예금주를 입력하세요").max(50, "50자 이내로 입력하세요"),
  commission_rate: z
    .number()
    .min(1, "수수료율은 1% 이상이어야 합니다")
    .max(100, "수수료율은 100% 이하여야 합니다"),
  receiving_account_id: z.string().nullable().optional(),
  memo: z.string().max(500, "500자 이내로 입력하세요").nullable().optional(),
});

export type BusinessFormData = z.infer<typeof businessFormSchema>;

// ── 정산 메모 스키마 ──────────────────────────────────────────────
export const settlementMemoSchema = z.object({
  memo: z.string().max(500, "500자 이내로 입력하세요").nullable().optional(),
});

export type SettlementMemoFormData = z.infer<typeof settlementMemoSchema>;

// ── 검증 상태 변경 스키마 ─────────────────────────────────────────
export const verificationSchema = z.object({
  verification_status: z.enum(["verified", "suspicious", "rejected", "pending"] as const),
  verification_memo: z.string().max(500, "500자 이내로 입력하세요").nullable().optional(),
});

export type VerificationFormData = z.infer<typeof verificationSchema>;

// ── 은행 목록 ─────────────────────────────────────────────────────
export const BANK_LIST = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "SC제일은행",
  "한국씨티은행",
  "NH농협은행",
  "IBK기업은행",
  "카카오뱅크",
  "케이뱅크",
  "토스뱅크",
  "수협은행",
  "대구은행",
  "부산은행",
  "경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
] as const;
