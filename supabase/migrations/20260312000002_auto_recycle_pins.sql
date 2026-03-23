-- ============================================================
-- 핀 자동 복원 기능
--
-- 1. gifts 테이블에 auto_recycled, recycled_pin_count 컬럼 추가
-- 2. process_gift RPC 수정: 수신계정 여부에 따라 핀 자동 복원
-- ============================================================

-- ============================================================
-- 1. gifts 테이블 컬럼 추가
-- ============================================================
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS auto_recycled boolean DEFAULT false;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS recycled_pin_count integer DEFAULT 0;

-- ============================================================
-- 2. process_gift RPC 수정: 수신계정(is_receiving_account) 분기
--
-- 수신계정으로 선물 시:
--   - 핀을 waiting으로 복원 (voucher_id=NULL, assigned_at=NULL)
--   - gifts에 auto_recycled=true, recycled_pin_count 저장
--   - 새 바우처는 생성 (기록용, 핀 없음)
-- 일반 계정:
--   - 기존 동작 (핀을 새 바우처로 이동)
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

  -- 낙관적 잠금: password_set 상태만 선물 가능 (이슈 3 해결)
  IF v_source.status != 'password_set' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STATUS',
      'error_message', format('선물할 수 없는 바우처 상태입니다: %s', v_source.status)
    );
  END IF;

  -- 2. 기존 바우처 상태 -> gifted (WHERE status 조건으로 이중 보호)
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

  -- 3. 수신자의 is_receiving_account 확인
  SELECT COALESCE(is_receiving_account, false)
  INTO v_is_receiving_account
  FROM users
  WHERE id = p_receiver_id;

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

  -- 5. 핀 처리: 수신계정 여부에 따라 분기
  IF v_is_receiving_account THEN
    -- 수신계정: 핀을 waiting으로 복원 (재고 복구)
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
    'auto_recycled', v_is_receiving_account
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
