// ============================================================
// 공통
// ============================================================

export type Timestamp = string; // ISO 8601 (e.g. "2026-02-28T12:00:00Z")

// ============================================================
// User
// ============================================================

export type UserStatus = "active" | "withdrawn" | "suspended";

export interface User {
  id: string;
  auth_id: string;
  username: string;
  email: string; // 계정 복구·서비스 안내용
  name: string; // DB에서는 암호화 저장
  phone: string; // DB에서는 암호화 저장
  identity_verified: boolean;
  status: UserStatus;
  total_purchase_count: number;
  total_purchase_amount: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================
// Category
// ============================================================

export interface Category {
  id: string;
  name: string;
  subtitle: string; // 영문 서브타이틀 (예: "CULTURELAND GIFT CARD")
  slug: string;
  icon: string; // Lucide 아이콘 이름
  is_visible: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// ============================================================
// Product
// ============================================================

export type ProductStatus = "active" | "inactive" | "soldout";
export type FeeUnit = "percent" | "fixed";

export interface Product {
  id: string;
  category_id: string;
  name: string;
  price: number; // 원 단위
  fee_rate: number; // 수수료 값 (fee_unit에 따라 % 또는 원)
  fee_unit: FeeUnit; // "percent" = %, "fixed" = 원
  image_url: string | null;
  description: string | null;
  status: ProductStatus;
  total_sales: number;
  popular_rank: number | null; // 1~5, 인기 상품 슬롯 (null = 미지정)
  created_at: Timestamp;
  updated_at: Timestamp;
}

// category 정보가 JOIN된 형태 (목록 조회 시)
export interface ProductWithCategory extends Product {
  category: Pick<Category, "id" | "name" | "slug" | "icon">;
}

// ============================================================
// Pin
// ============================================================

export type PinStatus = "waiting" | "assigned" | "consumed" | "returned";
export type PinRegistrationMethod = "manual" | "csv";

export interface Pin {
  id: string;
  product_id: string;
  pin_number_encrypted: string; // AES-256-GCM 암호화 (DB 저장용)
  status: PinStatus;
  registration_method: PinRegistrationMethod;
  assigned_at: Timestamp | null;
  consumed_at: Timestamp | null;
  created_at: Timestamp;
}

// ============================================================
// Order
// ============================================================

export type OrderStatus =
  | "paid"
  | "password_set"
  | "pin_revealed"
  | "gifted"
  | "cancelled";

export type FeeType = "included" | "separate";

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  product_id: string | null;
  quantity: number;
  product_price: number;
  fee_type: FeeType;
  fee_amount: number;
  total_amount: number;
  payment_method: string | null;
  pg_transaction_id: string | null;
  // PG 결제 정보 (MainPay 승인 응답)
  pg_ref_no: string | null; // 거래번호 (취소 시 필요)
  pg_tran_date: string | null; // 거래일자 (취소 시 필요)
  pg_pay_type: string | null; // 결제타입 (취소 시 필요)
  card_no: string | null; // 마스킹 카드번호 (예: 949019******8803)
  card_company_code: string | null; // 발급사코드 (예: "03")
  card_company_name: string | null; // 발급사명 (예: "삼성카드")
  installment_months: number; // 할부 개월수 (0 = 일시불)
  approval_no: string | null; // 승인번호
  receiver_phone: string; // DB에서는 암호화 저장
  status: OrderStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 상품/사용자 정보가 JOIN된 형태
export interface OrderWithDetails extends Order {
  product: Pick<Product, "id" | "name" | "price" | "fee_rate" | "fee_unit" | "image_url"> | null;
  user: Pick<User, "id" | "username" | "name" | "phone">;
}

// ============================================================
// Voucher
// ============================================================

export type VoucherStatus =
  | "issued"
  | "temp_verified"
  | "password_set"
  | "pin_revealed"
  | "gifted"
  | "cancelled";

export interface Voucher {
  id: string;
  code: string; // URL 경로용 (UUID v4)
  order_id: string;
  pin_ids: string[]; // 1 바우처 = N 핀 (DB에서는 pins.voucher_id로 역참조)
  owner_id: string;
  temp_password_hash: string | null;
  temp_password_expires_at: Timestamp | null;
  temp_password_attempts: number;
  reissue_count: number;
  user_password_hash: string | null;
  user_password_attempts: number;
  is_password_locked: boolean;
  fee_paid: boolean;
  fee_pg_transaction_id: string | null;
  pin_revealed_at: Timestamp | null;
  is_gift: boolean;
  gift_sender_id: string | null;
  source_voucher_id: string | null;
  status: VoucherStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 주문/상품 정보가 JOIN된 형태
export interface VoucherWithDetails extends Voucher {
  order: Pick<Order, "id" | "order_number" | "quantity" | "product_price" | "fee_type" | "fee_amount" | "total_amount" | "created_at">;
  product: Pick<Product, "id" | "name" | "price" | "fee_rate" | "fee_unit" | "image_url"> | null;
  owner: Pick<User, "id" | "username" | "name">;
}

// ============================================================
// Gift
// ============================================================

export interface Gift {
  id: string;
  sender_id: string;
  receiver_id: string;
  source_voucher_id: string;
  new_voucher_id: string;
  product_id: string | null;
  created_at: Timestamp;
}

// ============================================================
// Cancellation
// ============================================================

export type CancellationReasonType =
  | "simple_change"
  | "wrong_purchase"
  | "admin"
  | "duplicate_payment"
  | "other";

export type CancelledBy = "user" | "admin" | "system";

export type CancelStatus = "completed" | "failed";

export interface Cancellation {
  id: string;
  order_id: string;
  voucher_id: string;
  reason_type: CancellationReasonType;
  reason_detail: string | null;
  cancelled_by: CancelledBy;
  refund_amount: number;
  refund_status: CancelStatus;
  pg_cancel_transaction_id: string | null;
  pg_ref_no: string | null;
  pg_tran_date: string | null;
  pg_pay_type: string | null;
  refunded_at: Timestamp | null;
  created_at: Timestamp;
}

// ============================================================
// SmsLog
// ============================================================

export type SmsMessageType =
  | "purchase"
  | "reissue"
  | "gift"
  | "cancel"
  | "admin_resend"
  | "purchase_notify";

export type SmsSendStatus = "pending" | "sent" | "failed";
export type SmsSentBy = "system" | "admin";

export interface SmsLog {
  id: string;
  voucher_id: string | null;
  order_id: string | null;
  recipient_phone: string; // DB에서는 암호화 저장
  message_type: SmsMessageType;
  message_content: string;
  send_status: SmsSendStatus;
  aligo_response: Record<string, unknown> | null;
  sent_by: SmsSentBy;
  created_at: Timestamp;
}

// ============================================================
// Gift (JOIN된 형태)
// ============================================================

export interface GiftWithDetails extends Gift {
  sender: Pick<User, "id" | "username" | "name">;
  receiver: Pick<User, "id" | "username" | "name">;
  product: Pick<Product, "id" | "name" | "price" | "image_url">;
}

// ============================================================
// MyPage
// ============================================================

export interface MyPageSummary {
  user: Pick<User, "id" | "username" | "name" | "email" | "phone" | "identity_verified" | "created_at">;
  voucher_count: number; // 보유 상품권 수 (사용 가능)
  total_purchase_count: number; // 총 구매 건수
  total_purchase_amount: number; // 총 구매 금액
  gift_sent_count: number; // 보낸 선물 수
  gift_received_count: number; // 받은 선물 수
}

// 주문 내역 목록 아이템 (마이페이지용)
export interface OrderHistoryItem extends OrderWithDetails {
  voucher_status: VoucherStatus | null; // 연결된 바우처 상태
  voucher_code: string | null; // 바우처 URL 코드
  gift_receiver: Pick<User, "username" | "name"> | null; // 선물 수신자 (gifted 상태일 때)
  cancellation: Pick<Cancellation, "reason_type" | "refund_status" | "refund_amount" | "created_at"> | null;
}

// 내 상품권 목록 아이템 (마이페이지용)
export interface VoucherListItem {
  id: string;
  code: string;
  status: VoucherStatus;
  is_gift: boolean;
  gift_sender_username: string | null;
  pin_count: number;
  pin_revealed_at: Timestamp | null;
  temp_password_expires_at: Timestamp | null;
  created_at: Timestamp;
  order: Pick<Order, "id" | "order_number" | "quantity" | "total_amount">;
  product: Pick<Product, "id" | "name" | "price" | "image_url">;
}

// 선물 내역 아이템 (마이페이지용 — 보낸/받은 공통)
export interface GiftHistoryItem extends GiftWithDetails {
  voucher_code: string; // 새 바우처 코드 (받은 사람이 접근하는 URL)
  source_voucher_code: string; // 원래 바우처 코드
  order_quantity: number; // 주문 수량 (핀 N개)
  new_voucher_status: VoucherStatus; // 받은 사람의 교환권 상태
}

// ============================================================
// Admin
// ============================================================

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  created_at: Timestamp;
}

// 대시보드 Stat Cards
export interface DashboardStats {
  today_sales: number;
  today_order_count: number;
  month_sales: number;
  month_order_count: number;
  prev_day_sales: number;
  prev_month_sales: number;
  new_users_today: number;
  new_users_prev_day: number;
  cancel_count_today: number;
  cancel_count_month: number;
  pin_stock: PinStockSummary[];
}

// 핀 재고 현황 (상품별)
export interface PinStockSummary {
  product_id: string;
  product_name: string;
  waiting: number;
  assigned: number;
  consumed: number;
  returned: number;
  total: number;
}

// 대시보드 차트 데이터 (일별 매출 추이)
export interface DashboardChartItem {
  date: string; // "2026-03-01"
  sales: number;
  order_count: number;
}

// 관리자 주문 목록 아이템
export interface AdminOrderListItem extends Order {
  product_name: string;
  product_image_url: string | null;
  buyer_username: string;
  buyer_name: string;
  buyer_phone: string;
  voucher_id: string | null;
  voucher_code: string | null;
  voucher_status: VoucherStatus | null;
  is_password_set: boolean;
  is_password_locked: boolean;
  reissue_count: number;
  fee_paid: boolean;
  fee_pg_transaction_id: string | null;
  voucher_fee_amount: number | null;
  pin_count: number;
  cancellation: Pick<Cancellation, "reason_type" | "refund_status" | "refund_amount" | "created_at"> | null;
  sms_logs: SmsLog[];
  gift_chain: Array<{
    sender_username: string;
    receiver_username: string;
    created_at: string;
    auto_recycled: boolean;
  }> | null;
}

// 관리자 회원 목록 아이템
export interface AdminUserListItem extends User {
  order_count: number;
  voucher_count: number;
  gift_sent_count: number;
  gift_received_count: number;
}

// 관리자 상품 목록 아이템
export interface AdminProductListItem extends Product {
  category_name: string;
  category_slug: string;
  pin_stock_waiting: number;
  pin_stock_assigned: number;
  pin_stock_consumed: number;
  pin_stock_returned: number;
}

// 인기 상품 순위 아이템 (관리자 UI용)
export interface PopularRankItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  status: ProductStatus;
  popular_rank: number;
}

// 관리자 핀 목록 아이템
export interface AdminPinListItem {
  id: string;
  product_id: string;
  product_name: string;
  pin_number: string;
  status: PinStatus;
  registration_method: PinRegistrationMethod;
  voucher_code: string | null;
  assigned_user_id: string | null; // 할당/소진/반환된 사용자 ID
  assigned_username: string | null; // 사용자 아이디
  assigned_user_name: string | null; // 사용자 이름
  assigned_at: Timestamp | null;
  consumed_at: Timestamp | null;
  returned_at: Timestamp | null;
  created_at: Timestamp;
}

// 관리자 선물 이력 아이템
export interface AdminGiftListItem extends Gift {
  sender_username: string;
  sender_name: string;
  sender_phone: string;
  receiver_username: string;
  receiver_name: string;
  receiver_phone: string;
  product_name: string;
  product_price: number;
  source_voucher_code: string;
  new_voucher_code: string;
  new_voucher_status: VoucherStatus;
  order_quantity: number;
  fee_amount: number;
  fee_type: FeeType;
  total_amount: number;
}

// 관리자 취소/환불 목록 아이템
export interface AdminCancellationListItem extends Cancellation {
  order_number: string;
  product_name: string;
  product_price: number;
  buyer_username: string;
  buyer_name: string;
  quantity: number;
  fee_type: FeeType;
  fee_amount: number; // 건당 수수료
  total_amount: number;
  voucher_code: string;
  // 수수료 환불 관련 (수수료 별도 결제 건)
  voucher_fee_paid: boolean;
  voucher_fee_amount: number | null;
  voucher_fee_pg_transaction_id: string | null;
}

// 관리자 FAQ (관리용 확장)
export interface AdminFaqItem {
  id: string;
  category: Exclude<FaqCategory, "전체">;
  question: string;
  answer: string;
  is_visible: boolean;
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================
// Business (업체)
// ============================================================

export type BusinessStatus = "active" | "terminated";

export interface Business {
  id: string;
  user_id: string;
  business_name: string;
  contact_person: string;
  contact_phone: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  /** 정산율 (%). 예: 96이면 매출의 96%를 정산, 수수료 4% */
  commission_rate: number;
  receiving_account_id: string | null;
  /** SMS 인증번호 수신 전용 휴대폰 번호. null이면 contact_phone 폴백 */
  auth_phone: string | null;
  status: BusinessStatus;
  memo: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdminBusinessListItem extends Business {
  username: string;
  user_name: string;
  receiving_account_username: string | null;
  total_gift_count: number;
  total_gift_amount: number;
  total_settled_amount: number;
  pending_settlement_amount: number;
}

// ============================================================
// Settlement (정산)
// ============================================================

export type SettlementStatus = "pending" | "confirmed" | "paid" | "cancelled";

export interface Settlement {
  id: string;
  business_id: string;
  settlement_date: string;
  gift_count: number;
  gift_total_amount: number;
  commission_rate: number;
  settlement_amount: number;
  status: SettlementStatus;
  confirmed_at: Timestamp | null;
  paid_at: Timestamp | null;
  paid_by: string | null;
  memo: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdminSettlementListItem extends Settlement {
  business_name: string;
  contact_person: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export type VerificationStatus = "verified" | "suspicious" | "rejected" | "pending";

export interface SettlementGiftItem {
  gift_id: string;
  sender_username: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_amount: number;
  settlement_per_item: number;
  created_at: Timestamp;
  source_voucher_code: string;
  new_voucher_code: string;
  new_voucher_status: VoucherStatus;
  original_order_number: string;
  original_buyer_username: string;
  original_buyer_name: string;
  original_buyer_phone: string;                // 최초 구매자 연락처
  payment_method: string;                      // 결제 방법 (카드, 무통장 등)
  installment_type: string;                    // 할부 유형 ("일시불", "3개월", "6개월" 등)
  commission_included: boolean;                // 수수료 포함 결제 여부 (true=포함, false=별도)
  verification_status: VerificationStatus;
  verification_memo: string | null;
  pin_ids: string[];
  pin_statuses: PinStatus[];
}

// ============================================================
// ReceivedVoucher (수신 교환권)
// ============================================================

export type RecycleStatus = "received" | "verified" | "recycled" | "rejected";

export interface ReceivedVoucherItem {
  gift_id: string;
  voucher_id: string;
  voucher_code: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  pin_ids: string[];
  pin_numbers: string[];
  pin_statuses: PinStatus[];
  recycle_status: RecycleStatus;
  recycled_at: Timestamp | null;
  verification_status: VerificationStatus;
  original_order_number: string;
  original_buyer_username: string;
  sender_username: string;
  business_name: string;
  received_at: Timestamp;
}

// 관리자 공지사항 (관리용 확장)
export interface AdminNotice extends Notice {
  is_important: boolean;
  is_visible: boolean;
  created_by: string; // admin_user id
  created_by_name: string;
  updated_at: Timestamp;
}

// ============================================================
// Business Portal (업체 포털)
// ============================================================

export interface BusinessDashboardStats {
  today_gift_count: number;
  today_gift_amount: number;
  today_settlement_amount: number;
  month_settlement_amount: number;
  prev_day_gift_count: number;
  prev_day_gift_amount: number;
  prev_day_settlement_amount: number;
  prev_month_settlement_amount: number;
}

export interface BusinessGiftListItem {
  id: string;
  sender_username: string;
  sender_name: string;
  sender_phone: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_amount: number;
  payment_method: string;
  card_company: string;
  installment: string;
  settlement_amount: number;
  created_at: Timestamp;
  voucher_status?: string;
}

export type BusinessAccessAction =
  | "verify_attempt"
  | "verify_success"
  | "login_attempt"
  | "login_success"
  | "login_fail"
  | "page_access"
  | "logout";

export interface BusinessAccessLog {
  id: string;
  business_id: string;
  ip_address: string;
  action: BusinessAccessAction;
  user_agent: string | null;
  created_at: Timestamp;
}

export interface BusinessAccount {
  id: string;
  business_id: string;
  login_id: string;
  password_hash: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BusinessSession {
  id: string;
  business_id: string;
  token: string;
  ip_address: string | null;
  expires_at: Timestamp;
  created_at: Timestamp;
}

export interface BusinessVerificationCode {
  id: string;
  business_id: string;
  code: string;
  phone: string;
  expires_at: Timestamp;
  verified: boolean;
  created_at: Timestamp;
}

// ============================================================
// FAQ
// ============================================================

export type FaqCategory =
  | "전체"
  | "구매"
  | "교환권"
  | "선물"
  | "환불"
  | "계정";

export interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, "전체">;
  question: string;
  answer: string;
}

// ============================================================
// Notice
// ============================================================

export type NoticeCategory = "전체" | "일반" | "이벤트" | "점검";

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: Exclude<NoticeCategory, "전체">;
  is_important?: boolean;
  created_at: Timestamp;
  view_count: number;
}

// ============================================================
// PurchaseAccount (매입 아이디)
// ============================================================

export type PurchaseAccountStatus = "active" | "suspended";

export interface PurchaseAccount {
  id: string;
  user_id: string;
  account_name: string;
  notification_phone: string | null;
  memo: string | null;
  status: PurchaseAccountStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdminPurchaseAccountListItem extends PurchaseAccount {
  username: string;
  total_gift_count: number;
  total_gift_amount: number;
}

export interface PurchaseAccountGiftItem {
  gift_id: string;
  sender_username: string;
  sender_name: string;
  sender_phone: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_amount: number;
  fee_type: string;
  fee_amount: number;
  card_company_name: string | null;
  installment_months: number | null;
  pin_recycled: boolean;
  created_at: Timestamp;
}
