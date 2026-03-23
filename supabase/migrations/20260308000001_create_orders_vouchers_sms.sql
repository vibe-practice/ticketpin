-- ============================================================
-- Phase 2 DB 스키마: orders, vouchers, cancellations, sms_logs
-- + pins 테이블에 voucher_id 컬럼 추가
-- ============================================================

-- ============================================================
-- 1. orders (주문)
-- ============================================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(20) UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  product_price integer NOT NULL,
  fee_type varchar(20) NOT NULL CHECK (fee_type IN ('included', 'separate')),
  fee_amount integer NOT NULL,
  total_amount integer NOT NULL,
  payment_method varchar(50),
  pg_transaction_id varchar(100),
  -- PG 결제 상세 정보 (MainPay 승인 응답)
  pg_ref_no varchar(100),           -- 거래번호 (취소 시 필요)
  pg_tran_date varchar(50),         -- 거래일자 (취소 시 필요)
  pg_pay_type varchar(50),          -- 결제타입 (취소 시 필요)
  card_no varchar(100),             -- 마스킹 카드번호
  card_company_code varchar(20),    -- 발급사코드
  card_company_name varchar(50),    -- 발급사명
  installment_months integer DEFAULT 0, -- 할부 개월수 (0 = 일시불)
  approval_no varchar(100),         -- 승인번호
  receiver_phone varchar(100) NOT NULL, -- 수신 번호 (암호화 저장)
  status varchar(20) DEFAULT 'paid' CHECK (status IN ('paid', 'password_set', 'pin_revealed', 'gifted', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- orders 인덱스
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
-- order_number는 UNIQUE 제약조건이 자동으로 인덱스를 생성하므로 별도 인덱스 불필요
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);

-- orders updated_at 자동 갱신 트리거
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. vouchers (바우처 / 교환권)
-- ============================================================
CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,   -- URL 경로용 (UUID v4)
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- 임시 비밀번호 (SMS 발송)
  temp_password_hash text,
  temp_password_expires_at timestamptz,
  temp_password_attempts integer DEFAULT 0,
  reissue_count integer DEFAULT 0,    -- 재발행 횟수 (최대 5)
  -- 사용자 비밀번호 (4자리)
  user_password_hash text,
  user_password_attempts integer DEFAULT 0,
  is_password_locked boolean DEFAULT false,
  -- 수수료 (별도 방식인 경우)
  fee_paid boolean DEFAULT false,
  fee_pg_transaction_id varchar(100),
  -- 핀 해제
  pin_revealed_at timestamptz,
  -- 선물 관련
  is_gift boolean DEFAULT false,
  gift_sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
  gift_message varchar(100),
  source_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL, -- self-reference
  -- 상태
  status varchar(20) DEFAULT 'issued' CHECK (status IN ('issued', 'temp_verified', 'password_set', 'pin_revealed', 'gifted', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- vouchers 인덱스
-- code는 UNIQUE 제약조건이 자동으로 인덱스를 생성하므로 별도 인덱스 불필요
CREATE INDEX idx_vouchers_owner_status ON vouchers (owner_id, status);
CREATE INDEX idx_vouchers_order_id ON vouchers (order_id);

-- vouchers updated_at 자동 갱신 트리거
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. cancellations (취소/환불)
-- ============================================================
CREATE TABLE cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  reason_type varchar(20) NOT NULL CHECK (reason_type IN ('simple_change', 'wrong_purchase', 'admin', 'other')),
  reason_detail text,
  cancelled_by varchar(20) NOT NULL CHECK (cancelled_by IN ('user', 'admin')),
  refund_amount integer NOT NULL,
  refund_status varchar(20) DEFAULT 'completed' CHECK (refund_status IN ('completed', 'failed')),
  pg_cancel_transaction_id varchar(100),
  refunded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- cancellations 인덱스
CREATE INDEX idx_cancellations_order_id ON cancellations (order_id);
CREATE INDEX idx_cancellations_voucher_id ON cancellations (voucher_id);

-- ============================================================
-- 4. gifts (선물 이력)
-- ============================================================
CREATE TABLE gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  new_voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  message varchar(100),
  created_at timestamptz DEFAULT now()
);

-- gifts 인덱스
CREATE INDEX idx_gifts_sender_created ON gifts (sender_id, created_at DESC);
CREATE INDEX idx_gifts_receiver_created ON gifts (receiver_id, created_at DESC);

-- ============================================================
-- 5. sms_logs (SMS 발송 이력)
-- ============================================================
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  recipient_phone varchar(100) NOT NULL, -- 수신 번호 (암호화 저장)
  message_type varchar(50) NOT NULL CHECK (message_type IN ('purchase', 'reissue', 'gift', 'cancel', 'admin_resend')),
  message_content text NOT NULL,
  send_status varchar(20) DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed')),
  aligo_response jsonb,
  sent_by varchar(20) DEFAULT 'system' CHECK (sent_by IN ('system', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- sms_logs 인덱스
CREATE INDEX idx_sms_logs_voucher_id ON sms_logs (voucher_id);
CREATE INDEX idx_sms_logs_order_id ON sms_logs (order_id);

-- ============================================================
-- 6. pins 테이블 수정: voucher_id 컬럼 추가 + returned 상태 추가
-- ============================================================

-- 6-1. 기존 CHECK 제약조건 삭제 후 returned 포함하여 재생성
ALTER TABLE pins DROP CONSTRAINT IF EXISTS pins_status_check;
ALTER TABLE pins ADD CONSTRAINT pins_status_check
  CHECK (status IN ('waiting', 'assigned', 'consumed', 'returned'));

-- 6-2. voucher_id 컬럼 추가
ALTER TABLE pins ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;

-- 6-3. voucher_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_pins_voucher_id ON pins (voucher_id);

-- ============================================================
-- 7. RLS (Row Level Security) 정책
-- ============================================================

-- orders: 본인 주문만 조회 가능
-- INSERT/UPDATE/DELETE는 API Routes(service role)에서만 수행
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own" ON orders
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- vouchers: 본인 소유 바우처만 조회 가능
-- INSERT/UPDATE/DELETE는 API Routes(service role)에서만 수행
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vouchers_select_own" ON vouchers
  FOR SELECT
  USING (
    owner_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- gifts: 본인이 보내거나 받은 선물만 조회 가능
-- INSERT/UPDATE/DELETE는 API Routes(service role)에서만 수행
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gifts_select_own" ON gifts
  FOR SELECT
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR receiver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- cancellations: 클라이언트 직접 접근 불가 (API Routes에서 service role 사용)
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;
-- (정책 없음 = anon/authenticated 모두 접근 불가, service role만 가능)

-- sms_logs: 클라이언트 직접 접근 불가 (API Routes에서 service role 사용)
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
-- (정책 없음 = anon/authenticated 모두 접근 불가, service role만 가능)
