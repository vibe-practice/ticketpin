-- ============================================================
-- Phase 3: 업체(businesses) + 정산(settlements) 스키마
-- 테이블: businesses, settlements, settlement_gift_items
-- + users 테이블에 is_receiving_account 컬럼 추가
-- + recycle_settlement_pins RPC 함수
-- ============================================================

-- ============================================================
-- 0. 트리거 함수 존재 보장 (#11 수정)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 1. users 테이블에 is_receiving_account 컬럼 추가
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_receiving_account boolean DEFAULT false;

-- ============================================================
-- 2. businesses (업체)
-- ============================================================
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  business_name varchar(100) NOT NULL,
  contact_person varchar(50) NOT NULL,
  contact_phone varchar(100) NOT NULL,
  bank_name varchar(50) NOT NULL,
  account_number varchar(30) NOT NULL,
  account_holder varchar(50) NOT NULL,
  commission_rate numeric(5,2) NOT NULL CHECK (commission_rate >= 1 AND commission_rate <= 100),
  receiving_account_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- businesses 인덱스
CREATE INDEX idx_businesses_user_id ON businesses (user_id);
CREATE INDEX idx_businesses_receiving_account_id ON businesses (receiving_account_id);
CREATE INDEX idx_businesses_status ON businesses (status);

-- businesses updated_at 자동 갱신 트리거
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. settlements (정산)
-- ============================================================
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  settlement_date date NOT NULL,
  gift_count integer NOT NULL DEFAULT 0,
  gift_total_amount integer NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL,
  settlement_amount integer NOT NULL DEFAULT 0,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  confirmed_at timestamptz,
  paid_at timestamptz,
  paid_by varchar(100),
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 업체+날짜 중복 방지
  UNIQUE (business_id, settlement_date)
);

-- settlements 인덱스
CREATE INDEX idx_settlements_business_id ON settlements (business_id);
CREATE INDEX idx_settlements_status ON settlements (status);
CREATE INDEX idx_settlements_date ON settlements (settlement_date DESC);

-- settlements updated_at 자동 갱신 트리거
CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. settlement_gift_items (정산 건별 교환권 항목)
-- ============================================================
CREATE TABLE settlement_gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES gifts(id) ON DELETE RESTRICT,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name varchar(200) NOT NULL,
  product_price integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_amount integer NOT NULL,
  settlement_per_item integer NOT NULL,
  verification_status varchar(20) DEFAULT 'pending' CHECK (verification_status IN ('verified', 'suspicious', 'rejected', 'pending')),
  verification_memo text,
  recycle_status varchar(20) DEFAULT 'received' CHECK (recycle_status IN ('received', 'verified', 'recycled', 'rejected')),
  recycled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- settlement_gift_items 인덱스
CREATE INDEX idx_settlement_gift_items_settlement_id ON settlement_gift_items (settlement_id);
CREATE INDEX idx_settlement_gift_items_gift_id ON settlement_gift_items (gift_id);
CREATE INDEX idx_settlement_gift_items_voucher_id ON settlement_gift_items (voucher_id);

-- ============================================================
-- 5. RLS (Row Level Security) 정책
-- ============================================================

-- businesses: 클라이언트 직접 접근 불가 (API Routes에서 service role 사용)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- settlements: 클라이언트 직접 접근 불가
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- settlement_gift_items: 클라이언트 직접 접근 불가
ALTER TABLE settlement_gift_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RPC: recycle_settlement_pins (핀 재활용 원자성 처리)
-- ============================================================
CREATE OR REPLACE FUNCTION recycle_settlement_pins(
  p_settlement_gift_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_voucher_id uuid;
  v_pin_count integer;
BEGIN
  -- 1. settlement_gift_item 조회 (동시성 보호)
  SELECT id, gift_id, voucher_id, recycle_status
  INTO v_item
  FROM settlement_gift_items
  WHERE id = p_settlement_gift_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ITEM_NOT_FOUND',
      'error_message', '정산 항목을 찾을 수 없습니다.'
    );
  END IF;

  -- 이미 재활용된 경우
  IF v_item.recycle_status = 'recycled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_RECYCLED',
      'error_message', '이미 재활용된 항목입니다.'
    );
  END IF;

  v_voucher_id := v_item.voucher_id;

  -- 2. 핀 상태 복구: assigned → waiting, voucher_id = NULL
  UPDATE pins
  SET status = 'waiting',
      voucher_id = NULL,
      assigned_at = NULL
  WHERE voucher_id = v_voucher_id
    AND status = 'assigned';

  GET DIAGNOSTICS v_pin_count = ROW_COUNT;

  -- 3. 바우처 상태 → cancelled
  UPDATE vouchers
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = v_voucher_id;

  -- 4. settlement_gift_items 재활용 상태 업데이트
  UPDATE settlement_gift_items
  SET recycle_status = 'recycled',
      recycled_at = now()
  WHERE id = p_settlement_gift_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'recycled_pin_count', v_pin_count,
    'voucher_id', v_voucher_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[recycle_settlement_pins] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    -- #4 수정: 에러를 호출자에게 전파하여 트랜잭션 롤백 보장
    RAISE;
END;
$$;
