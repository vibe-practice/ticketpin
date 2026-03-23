import type { Business } from "@/types";

export const MOCK_BUSINESS_INFO: Business = {
  id: "biz-001",
  user_id: "user-biz-001",
  business_name: "테스트 업체",
  contact_person: "김담당",
  contact_phone: "010-1234-5678",
  bank_name: "국민은행",
  account_number: "123-456-789012",
  account_holder: "주식회사 테스트업체",
  commission_rate: 96,
  receiving_account_id: "user-recv-001",
  auth_phone: "01012345678",
  status: "active",
  memo: null,
  created_at: "2026-01-15T09:00:00Z",
  updated_at: "2026-03-01T10:00:00Z",
};
