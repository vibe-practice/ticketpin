-- ============================================================
-- deliver_fee_pins: 수수료 결제 후 핀 전달 상태 전이 RPC
--
-- 바우처·핀·주문 상태를 하나의 트랜잭션으로 원자적 업데이트한다.
-- 부분 실패(바우처는 성공, 핀은 실패 등) 불가능.
--
-- 사전 조건:
--   - 바우처 status = 'password_set'
--   - 핀 status = 'assigned' (해당 바우처에 연결된 핀)
--   - 주문 status = 'password_set'
--
-- 성공 시:
--   - 바우처: fee_paid=true, status='pin_revealed', pin_revealed_at=now
--   - 핀: status='consumed', consumed_at=now
--   - 주문: status='pin_revealed'
-- ============================================================

CREATE OR REPLACE FUNCTION deliver_fee_pins(
  p_voucher_id UUID,
  p_order_id UUID,
  p_pg_transaction_id VARCHAR(100) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher RECORD;
  v_pin_count INTEGER;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. 바우처 조회 + 락 (동시 요청 방어)
  SELECT id, status, fee_paid, is_password_locked
  INTO v_voucher
  FROM vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOUCHER_NOT_FOUND',
      'error_message', '바우처를 찾을 수 없습니다.'
    );
  END IF;

  -- 이미 pin_revealed 상태면 멱등성 보장 (중복 호출 시 성공 반환)
  IF v_voucher.status = 'pin_revealed' THEN
    SELECT count(*) INTO v_pin_count
    FROM pins
    WHERE voucher_id = p_voucher_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_delivered', true,
      'pin_count', v_pin_count
    );
  END IF;

  -- 상태 검증
  IF v_voucher.status != 'password_set' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STATUS',
      'error_message', format('바우처 상태가 올바르지 않습니다: %s', v_voucher.status)
    );
  END IF;

  IF v_voucher.is_password_locked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOUCHER_LOCKED',
      'error_message', '바우처가 잠금 처리되었습니다.'
    );
  END IF;

  -- 2. 핀 존재 여부 사전 검증 (바우처 UPDATE 전에 확인)
  SELECT count(*) INTO v_pin_count
  FROM pins
  WHERE voucher_id = p_voucher_id AND status = 'assigned';

  IF v_pin_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NO_PINS',
      'error_message', '전달할 핀이 없습니다.'
    );
  END IF;

  -- 3. 바우처 상태 전이: password_set -> pin_revealed + fee_paid
  UPDATE vouchers
  SET
    fee_paid = true,
    fee_pg_transaction_id = p_pg_transaction_id,
    status = 'pin_revealed',
    pin_revealed_at = v_now,
    user_password_attempts = 0
  WHERE id = p_voucher_id
    AND status = 'password_set';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOUCHER_UPDATE_FAILED',
      'error_message', '바우처 상태 업데이트에 실패했습니다 (동시 요청 충돌).'
    );
  END IF;

  -- 4. 핀 상태 전이: assigned -> consumed
  UPDATE pins
  SET
    status = 'consumed',
    consumed_at = v_now
  WHERE voucher_id = p_voucher_id
    AND status = 'assigned';

  -- 5. 주문 상태 전이: password_set -> pin_revealed
  UPDATE orders
  SET status = 'pin_revealed'
  WHERE id = p_order_id
    AND status = 'password_set';

  -- 주문 상태 업데이트 실패는 치명적이지 않음 (이미 다른 상태일 수 있음)
  IF NOT FOUND THEN
    RAISE WARNING '[deliver_fee_pins] Order % status update skipped (may already be updated)', p_order_id;
  END IF;

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'already_delivered', false,
    'pin_count', v_pin_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[deliver_fee_pins] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INTERNAL_ERROR',
      'error_message', format('핀 전달 상태 처리 중 오류: %s', SQLERRM)
    );
END;
$$;
