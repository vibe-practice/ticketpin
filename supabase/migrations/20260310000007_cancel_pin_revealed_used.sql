-- cancel_order_with_refund: p_force_used 파라미터 추가
-- pin_revealed 상태에서 취소 시 핀을 consumed로 처리하여 재배정 방지
CREATE OR REPLACE FUNCTION cancel_order_with_refund(
  p_order_id uuid,
  p_voucher_id uuid,
  p_reason_type varchar(20),
  p_reason_detail text,
  p_refund_amount numeric,
  p_pg_cancel_transaction_id text,
  p_force_used boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cancellation_id uuid;
  v_pin_count integer;
  v_pins_marked_used integer := 0;
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

  -- 4. 원본 바우처의 핀 처리
  IF p_force_used THEN
    -- pin_revealed 상태: 핀을 consumed로 변경 (재고 복구하지 않음)
    UPDATE pins
    SET status = 'consumed',
        updated_at = now()
    WHERE voucher_id = p_voucher_id;

    GET DIAGNOSTICS v_pin_count = ROW_COUNT;
    v_pins_marked_used := v_pin_count;
  ELSE
    -- 기존 동작: 핀을 waiting으로 복구 (재고 복구)
    UPDATE pins
    SET status = 'waiting',
        voucher_id = NULL,
        assigned_at = NULL
    WHERE voucher_id = p_voucher_id;

    GET DIAGNOSTICS v_pin_count = ROW_COUNT;
  END IF;

  -- 5. 선물 수신자 바우처 연쇄 취소
  FOR v_gift IN
    SELECT g.new_voucher_id
    FROM gifts g
    WHERE g.source_voucher_id = p_voucher_id
  LOOP
    -- 수신자 바우처에 연결된 핀 처리
    IF p_force_used THEN
      UPDATE pins
      SET status = 'consumed',
          updated_at = now()
      WHERE voucher_id = v_gift.new_voucher_id;

      GET DIAGNOSTICS v_gift_pin_count = ROW_COUNT;
      v_pins_marked_used := v_pins_marked_used + v_gift_pin_count;
    ELSE
      UPDATE pins
      SET status = 'waiting',
          voucher_id = NULL,
          assigned_at = NULL
      WHERE voucher_id = v_gift.new_voucher_id;

      GET DIAGNOSTICS v_gift_pin_count = ROW_COUNT;
    END IF;

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
    'restored_pin_count', v_pin_count,
    'pins_marked_used', v_pins_marked_used
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
