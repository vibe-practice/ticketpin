-- ============================================================
-- 주문 취소 트랜잭션 함수
-- 주문/바우처 상태 변경 + 핀 재고 복구 + 취소 기록 생성을 원자적으로 처리
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
SECURITY DEFINER  -- service_role 권한으로 실행 (RLS 우회)
AS $$
DECLARE
  v_cancellation_id uuid;
  v_pin_count integer;
  v_order RECORD;
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

  -- 3. 바우처 상태 -> cancelled
  UPDATE vouchers
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_voucher_id;

  -- 4. 핀 N개 상태 -> waiting (재고 복구)
  UPDATE pins
  SET status = 'waiting',
      voucher_id = NULL,
      assigned_at = NULL
  WHERE voucher_id = p_voucher_id;

  GET DIAGNOSTICS v_pin_count = ROW_COUNT;

  -- 5. 상품 판매량 차감
  UPDATE products
  SET total_sales = GREATEST(total_sales - v_order.quantity, 0)
  WHERE id = v_order.product_id;

  -- 6. 사용자 구매 통계 차감
  UPDATE users
  SET total_purchase_count = GREATEST(total_purchase_count - 1, 0),
      total_purchase_amount = GREATEST(total_purchase_amount - v_order.total_amount, 0)
  WHERE id = v_order.user_id;

  -- 7. cancellations 테이블에 취소 기록 생성
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
