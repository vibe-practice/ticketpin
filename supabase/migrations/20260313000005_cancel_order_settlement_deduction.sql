-- ============================================================
-- cancel_order_with_refund: 정산 감산 로직 추가
-- 주문 취소 시 settlement_gift_items의 verification_status를 rejected로 변경하고
-- 해당 settlement의 gift_count, gift_total_amount, settlement_amount를 재계산
-- (paid 상태 settlement는 금액 변경하지 않고 memo에 기록)
-- ============================================================

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
  v_settlement_rec RECORD;
  v_new_gift_count integer;
  v_new_gift_total integer;
  v_new_settlement_amount integer;
  v_settlement_status text;
  v_existing_memo text;
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

  -- 9. 정산 감산: 취소된 바우처와 연결된 settlement_gift_items를 rejected로 변경
  -- 원본 바우처 + 선물 수신자 바우처 모두 처리
  UPDATE settlement_gift_items
  SET verification_status = 'rejected'
  WHERE voucher_id = p_voucher_id
    AND verification_status != 'rejected';

  -- 선물로 생성된 바우처의 settlement_gift_items도 처리
  UPDATE settlement_gift_items
  SET verification_status = 'rejected'
  WHERE voucher_id IN (
    SELECT g.new_voucher_id
    FROM gifts g
    WHERE g.source_voucher_id = p_voucher_id
  )
  AND verification_status != 'rejected';

  -- 영향받은 settlement들의 합계를 재계산
  -- paid 상태인 settlement는 금액을 변경하지 않고 memo에 기록
  FOR v_settlement_rec IN
    SELECT DISTINCT sgi.settlement_id
    FROM settlement_gift_items sgi
    WHERE sgi.voucher_id = p_voucher_id
       OR sgi.voucher_id IN (
         SELECT g.new_voucher_id FROM gifts g WHERE g.source_voucher_id = p_voucher_id
       )
  LOOP
    -- 해당 settlement의 현재 상태 조회
    SELECT status, COALESCE(memo, '') INTO v_settlement_status, v_existing_memo
    FROM settlements
    WHERE id = v_settlement_rec.settlement_id;

    -- rejected가 아닌 항목만으로 합계 재계산
    SELECT
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(total_amount), 0),
      COALESCE(SUM(settlement_per_item), 0)
    INTO v_new_gift_count, v_new_gift_total, v_new_settlement_amount
    FROM settlement_gift_items
    WHERE settlement_id = v_settlement_rec.settlement_id
      AND verification_status != 'rejected';

    IF v_settlement_status = 'paid' THEN
      -- paid 상태: 금액 변경하지 않고 memo에 기록
      UPDATE settlements
      SET memo = CASE
            WHEN v_existing_memo = '' THEN '취소된 주문 감산 보류 - 이미 입금 완료 상태 (주문: ' || p_order_id::text || ')'
            ELSE v_existing_memo || E'\n' || '취소된 주문 감산 보류 - 이미 입금 완료 상태 (주문: ' || p_order_id::text || ')'
          END
      WHERE id = v_settlement_rec.settlement_id;
    ELSIF v_new_gift_count = 0 THEN
      -- 재계산 후 gift_count가 0이면 settlement를 cancelled로 변경
      UPDATE settlements
      SET gift_count = 0,
          gift_total_amount = 0,
          settlement_amount = 0,
          status = 'cancelled'
      WHERE id = v_settlement_rec.settlement_id;
    ELSE
      -- pending/confirmed 상태: 정상 재계산
      UPDATE settlements
      SET gift_count = v_new_gift_count,
          gift_total_amount = v_new_gift_total,
          settlement_amount = v_new_settlement_amount
      WHERE id = v_settlement_rec.settlement_id;
    END IF;
  END LOOP;

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

-- ============================================================
-- get_gifts_summary: 업체 매입(선물) 전체 합계 조회 RPC
-- 취소된 바우처(vouchers.status = 'cancelled')의 gift는 합산에서 제외
-- ============================================================

CREATE OR REPLACE FUNCTION get_gifts_summary(
  p_receiver_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count bigint;
  v_total_amount numeric;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(p.price), 0)
  INTO v_count, v_total_amount
  FROM gifts g
  INNER JOIN vouchers v ON v.id = g.new_voucher_id AND v.status != 'cancelled'
  LEFT JOIN products p ON p.id = g.product_id
  WHERE g.receiver_id = p_receiver_id
    AND (p_date_from IS NULL OR g.created_at >= p_date_from)
    AND (p_date_to IS NULL OR g.created_at <= p_date_to);

  RETURN jsonb_build_object(
    'count', v_count,
    'total_amount', v_total_amount
  );
END;
$$;

-- ============================================================
-- 인덱스: gifts.source_voucher_id (선물 연쇄 취소 시 성능 향상)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_gifts_source_voucher_id ON gifts (source_voucher_id);
