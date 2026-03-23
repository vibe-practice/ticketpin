-- ============================================================
-- 트랜잭션 원자성 보강 마이그레이션
--
-- 1. process_gift: 선물하기 원자적 트랜잭션 (이슈 1 + 이슈 3)
-- 2. reveal_pins: 핀 공개 원자적 상태 전이 (이슈 2)
-- 3. cancel_order_with_refund: 선물 수신자 바우처 연쇄 취소 (이슈 4)
-- ============================================================


-- ============================================================
-- 1. process_gift: 선물하기 원자적 트랜잭션
--
-- 5개 DB 작업을 하나의 트랜잭션으로 처리:
--   (1) 기존 바우처 status = 'password_set' -> 'gifted' (낙관적 잠금)
--   (2) 새 바우처 INSERT
--   (3) 핀 voucher_id 이동
--   (4) 주문 status -> 'gifted'
--   (5) gifts 레코드 INSERT
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

  -- 3. 새 바우처 생성
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

  -- 4. 핀 이동: 기존 바우처 -> 새 바우처
  UPDATE pins
  SET voucher_id = p_new_voucher_id
  WHERE voucher_id = p_source_voucher_id;

  GET DIAGNOSTICS v_pin_count = ROW_COUNT;

  IF v_pin_count = 0 THEN
    RAISE EXCEPTION 'No pins found for source voucher %', p_source_voucher_id;
  END IF;

  -- 5. 주문 상태 -> gifted
  UPDATE orders
  SET status = 'gifted', updated_at = now()
  WHERE id = p_order_id;

  -- 6. gifts 레코드 생성
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

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'pin_count', v_pin_count
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


-- ============================================================
-- 2. reveal_pins: 수수료 불필요 시 핀 공개 원자적 상태 전이
--
-- 3개 UPDATE를 하나의 트랜잭션으로 처리:
--   (1) 바우처: password_set -> pin_revealed
--   (2) 핀: assigned -> consumed
--   (3) 주문: password_set -> pin_revealed
-- ============================================================

CREATE OR REPLACE FUNCTION reveal_pins(
  p_voucher_id UUID,
  p_order_id UUID
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
  -- 1. 바우처 조회 + 락
  SELECT id, status
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

  -- 이미 pin_revealed 상태면 멱등성 보장
  IF v_voucher.status = 'pin_revealed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_revealed', true
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

  -- 2. 핀 존재 여부 사전 검증
  SELECT count(*) INTO v_pin_count
  FROM pins
  WHERE voucher_id = p_voucher_id AND status = 'assigned';

  IF v_pin_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NO_PINS',
      'error_message', '핀을 찾을 수 없습니다.'
    );
  END IF;

  -- 3. 바우처 상태 전이: password_set -> pin_revealed
  UPDATE vouchers
  SET
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

  IF NOT FOUND THEN
    RAISE WARNING '[reveal_pins] Order % status update skipped (may already be updated)', p_order_id;
  END IF;

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'already_revealed', false,
    'pin_count', v_pin_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[reveal_pins] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INTERNAL_ERROR',
      'error_message', format('핀 공개 처리 중 오류: %s', SQLERRM)
    );
END;
$$;


-- ============================================================
-- 3. cancel_order_with_refund 확장: 선물 수신자 바우처 연쇄 취소
--
-- 기존 기능에 추가:
--   - gifts 테이블에서 source_voucher_id로 연결된 new_voucher_id 조회
--   - 수신자 바우처도 cancelled 처리
--   - 수신자 바우처에 연결된 핀도 waiting으로 복귀
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_order_with_refund(
  p_order_id uuid,
  p_voucher_id uuid,
  p_reason_type varchar(20),
  p_reason_detail text,
  p_refund_amount numeric,
  p_pg_cancel_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cancellation_id uuid;
  v_pin_count integer;
  v_order RECORD;
  v_gift RECORD;
  v_gift_pin_count integer;
BEGIN
  -- 1. 주문 상태 확인 (동시성 보호: FOR UPDATE)
  SELECT id, user_id, product_id, quantity, total_amount, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ORDER_NOT_FOUND',
      'error_message', '주문을 찾을 수 없습니다.'
    );
  END IF;

  -- 2. 주문 상태 -> cancelled
  UPDATE orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order_id;

  -- 3. 원본 바우처 상태 -> cancelled
  UPDATE vouchers
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_voucher_id;

  -- 4. 원본 바우처의 핀 -> waiting (재고 복구)
  UPDATE pins
  SET status = 'waiting',
      voucher_id = NULL,
      assigned_at = NULL
  WHERE voucher_id = p_voucher_id;

  GET DIAGNOSTICS v_pin_count = ROW_COUNT;

  -- 5. 선물 수신자 바우처 연쇄 취소 (이슈 4)
  --    gifts 테이블에서 source_voucher_id로 연결된 수신자 바우처를 찾아 취소
  FOR v_gift IN
    SELECT g.new_voucher_id
    FROM gifts g
    WHERE g.source_voucher_id = p_voucher_id
  LOOP
    -- 수신자 바우처에 연결된 핀 -> waiting (재고 복구)
    UPDATE pins
    SET status = 'waiting',
        voucher_id = NULL,
        assigned_at = NULL
    WHERE voucher_id = v_gift.new_voucher_id;

    GET DIAGNOSTICS v_gift_pin_count = ROW_COUNT;
    v_pin_count := v_pin_count + v_gift_pin_count;

    -- 수신자 바우처 상태 -> cancelled
    UPDATE vouchers
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_gift.new_voucher_id;
  END LOOP;

  -- 6. 상품 판매량 차감
  UPDATE products
  SET total_sales = GREATEST(total_sales - v_order.quantity, 0)
  WHERE id = v_order.product_id;

  -- 7. 사용자 구매 통계 차감
  UPDATE users
  SET total_purchase_count = GREATEST(total_purchase_count - 1, 0),
      total_purchase_amount = GREATEST(total_purchase_amount - v_order.total_amount, 0)
  WHERE id = v_order.user_id;

  -- 8. cancellations 테이블에 취소 기록 생성
  INSERT INTO cancellations (
    order_id, voucher_id,
    reason_type, reason_detail,
    cancelled_by, refund_amount,
    refund_status, pg_cancel_transaction_id,
    refunded_at
  ) VALUES (
    p_order_id, p_voucher_id,
    p_reason_type, p_reason_detail,
    'user', p_refund_amount,
    'completed', p_pg_cancel_transaction_id,
    now()
  )
  RETURNING id INTO v_cancellation_id;

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'cancellation_id', v_cancellation_id,
    'restored_pin_count', v_pin_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[cancel_order_with_refund] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INTERNAL_ERROR',
      'error_message', '취소 처리 중 오류가 발생했습니다.'
    );
END;
$$;
