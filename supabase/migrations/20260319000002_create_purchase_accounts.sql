-- ============================================================
-- 매입 아이디 관리 기능
--
-- 1. users 테이블에 is_purchase_account 컬럼 추가
-- 2. purchase_accounts 테이블 생성 (매입 아이디 메타데이터)
-- 3. process_gift RPC 수정: is_purchase_account도 핀 복원 처리
-- ============================================================

-- ============================================================
-- 1. users.is_purchase_account 컬럼 추가
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_purchase_account boolean DEFAULT false;

-- ============================================================
-- 2. purchase_accounts 테이블
-- ============================================================
CREATE TABLE purchase_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_name varchar(100) NOT NULL,
  memo text,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- 인덱스
CREATE INDEX idx_purchase_accounts_status ON purchase_accounts(status);
CREATE INDEX idx_purchase_accounts_user_id ON purchase_accounts(user_id);

-- updated_at 자동 갱신
CREATE TRIGGER set_purchase_accounts_updated_at
  BEFORE UPDATE ON purchase_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. process_gift RPC 수정: is_purchase_account 분기 추가
--
-- 기존: is_receiving_account만 체크
-- 변경: is_receiving_account OR is_purchase_account
-- ============================================================

CREATE OR REPLACE FUNCTION process_gift(
  p_source_voucher_id UUID,
  p_new_voucher_id UUID,
  p_new_voucher_code VARCHAR(50),
  p_order_id UUID,
  p_sender_id UUID,
  p_receiver_id UUID,
  p_temp_password_hash TEXT,
  p_temp_password_expires_at TIMESTAMPTZ,
  p_product_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source RECORD;
  v_pin_count INTEGER;
  v_gift_id UUID;
  v_is_receiving_account BOOLEAN;
  v_is_purchase_account BOOLEAN;
  v_should_recycle BOOLEAN;
BEGIN
  -- 1. 기존 바우처 조회 + 락 (동시 선물 방어)
  SELECT id, status, order_id, owner_id
  INTO v_source
  FROM vouchers
  WHERE id = p_source_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOUCHER_NOT_FOUND',
      'error_message', '바우처를 찾을 수 없습니다.'
    );
  END IF;

  -- 낙관적 잠금: password_set 상태만 선물 가능
  IF v_source.status != 'password_set' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STATUS',
      'error_message', format('선물할 수 없는 바우처 상태입니다: %s', v_source.status)
    );
  END IF;

  -- 2. 기존 바우처 상태 -> gifted
  UPDATE vouchers
  SET status = 'gifted', updated_at = now()
  WHERE id = p_source_voucher_id
    AND status = 'password_set';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CONCURRENT_GIFT',
      'error_message', '동시 요청으로 인해 선물 처리에 실패했습니다.'
    );
  END IF;

  -- 3. 수신자의 is_receiving_account / is_purchase_account 확인
  SELECT
    COALESCE(is_receiving_account, false),
    COALESCE(is_purchase_account, false)
  INTO v_is_receiving_account, v_is_purchase_account
  FROM users
  WHERE id = p_receiver_id;

  -- 수신계정 또는 매입계정이면 핀 복원
  v_should_recycle := v_is_receiving_account OR v_is_purchase_account;

  -- 4. 새 바우처 생성 (두 경우 모두 생성 — 기록용)
  INSERT INTO vouchers (
    id, code, order_id, owner_id,
    temp_password_hash, temp_password_expires_at,
    temp_password_attempts, reissue_count,
    user_password_hash, user_password_attempts,
    is_password_locked, fee_paid, fee_pg_transaction_id,
    pin_revealed_at,
    is_gift, gift_sender_id, source_voucher_id,
    status
  ) VALUES (
    p_new_voucher_id, p_new_voucher_code, p_order_id, p_receiver_id,
    p_temp_password_hash, p_temp_password_expires_at,
    0, 0,
    NULL, 0,
    false, false, NULL,
    NULL,
    true, p_sender_id, p_source_voucher_id,
    'issued'
  );

  -- 5. 핀 처리: 수신계정/매입계정 여부에 따라 분기
  IF v_should_recycle THEN
    -- 수신계정/매입계정: 핀을 waiting으로 복원 (재고 복구)
    UPDATE pins
    SET status = 'waiting',
        voucher_id = NULL,
        assigned_at = NULL
    WHERE voucher_id = p_source_voucher_id;

    GET DIAGNOSTICS v_pin_count = ROW_COUNT;

    IF v_pin_count = 0 THEN
      RAISE EXCEPTION 'No pins found for source voucher %', p_source_voucher_id;
    END IF;

    -- gifts 레코드 생성 (auto_recycled 표시)
    INSERT INTO gifts (
      sender_id, receiver_id,
      source_voucher_id, new_voucher_id,
      product_id,
      auto_recycled, recycled_pin_count
    ) VALUES (
      p_sender_id, p_receiver_id,
      p_source_voucher_id, p_new_voucher_id,
      p_product_id,
      true, v_pin_count
    )
    RETURNING id INTO v_gift_id;

  ELSE
    -- 일반 계정: 핀을 새 바우처로 이동 (기존 동작)
    UPDATE pins
    SET voucher_id = p_new_voucher_id
    WHERE voucher_id = p_source_voucher_id;

    GET DIAGNOSTICS v_pin_count = ROW_COUNT;

    IF v_pin_count = 0 THEN
      RAISE EXCEPTION 'No pins found for source voucher %', p_source_voucher_id;
    END IF;

    -- gifts 레코드 생성
    INSERT INTO gifts (
      sender_id, receiver_id,
      source_voucher_id, new_voucher_id,
      product_id
    ) VALUES (
      p_sender_id, p_receiver_id,
      p_source_voucher_id, p_new_voucher_id,
      p_product_id
    )
    RETURNING id INTO v_gift_id;
  END IF;

  -- 6. 주문 상태 -> gifted
  UPDATE orders
  SET status = 'gifted', updated_at = now()
  WHERE id = p_order_id;

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'pin_count', v_pin_count,
    'auto_recycled', v_should_recycle
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DUPLICATE_VOUCHER',
      'error_message', '바우처 코드가 중복되었습니다. 다시 시도해 주세요.'
    );
  WHEN OTHERS THEN
    RAISE WARNING '[process_gift] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INTERNAL_ERROR',
      'error_message', format('선물 처리 중 오류: %s', SQLERRM)
    );
END;
$$;
