-- ============================================================
-- 주문 생성 + 핀 배정 + 바우처 생성 트랜잭션 함수
-- SELECT FOR UPDATE 락으로 핀 중복 배정 방지
-- fee_rate + fee_unit 기반 수수료 계산
-- ============================================================

CREATE OR REPLACE FUNCTION create_order_with_voucher(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_fee_type varchar(20),
  p_receiver_phone varchar(100),
  p_order_number varchar(20),
  p_voucher_code varchar(50),
  p_temp_password_hash text,
  p_temp_password_expires_at timestamptz,
  -- PG 결제 정보 (결제 완료된 상태에서 전달)
  p_payment_method varchar(50) DEFAULT NULL,
  p_pg_transaction_id varchar(100) DEFAULT NULL,
  p_pg_ref_no varchar(100) DEFAULT NULL,
  p_pg_tran_date varchar(50) DEFAULT NULL,
  p_pg_pay_type varchar(50) DEFAULT NULL,
  p_card_no varchar(100) DEFAULT NULL,
  p_card_company_code varchar(20) DEFAULT NULL,
  p_card_company_name varchar(50) DEFAULT NULL,
  p_installment_months integer DEFAULT 0,
  p_approval_no varchar(100) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- service_role 권한으로 실행 (RLS 우회)
AS $$
DECLARE
  v_product RECORD;
  v_fee_amount integer;
  v_total_amount integer;
  v_order_id uuid;
  v_voucher_id uuid;
  v_pin_ids uuid[];
  v_pin_count integer;
BEGIN
  -- 1. 상품 정보 조회 (fee_rate, fee_unit 사용)
  SELECT id, price, fee_rate, fee_unit, status
  INTO v_product
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PRODUCT_NOT_FOUND',
      'error_message', '상품을 찾을 수 없습니다.'
    );
  END IF;

  IF v_product.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PRODUCT_INACTIVE',
      'error_message', '현재 판매 중이 아닌 상품입니다.'
    );
  END IF;

  -- 2. 수수료 계산 (fee_unit 기반)
  -- percent: 상품가의 퍼센트 (반올림), fixed: 고정 금액
  IF v_product.fee_unit = 'percent' THEN
    v_fee_amount := ROUND(v_product.price * v_product.fee_rate / 100);
  ELSE
    v_fee_amount := v_product.fee_rate;
  END IF;

  -- 총액 계산
  -- [경고 6] separate 타입에서도 fee_amount는 기록함 (나중에 수수료 별도 결제 시 참조용)
  -- 단, total_amount에는 수수료를 포함하지 않음
  IF p_fee_type = 'included' THEN
    -- 수수료 포함: (상품가 + 수수료) x 수량
    v_total_amount := (v_product.price + v_fee_amount) * p_quantity;
  ELSE
    -- 수수료 별도: 상품가 x 수량 (수수료는 핀 조회 시 별도 결제)
    v_total_amount := v_product.price * p_quantity;
  END IF;

  -- 3. 핀 N개 SELECT FOR UPDATE (중복 배정 방지 락)
  SELECT array_agg(id)
  INTO v_pin_ids
  FROM (
    SELECT id
    FROM pins
    WHERE product_id = p_product_id
      AND status = 'waiting'
      AND voucher_id IS NULL
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_quantity
  ) AS selected_pins;

  -- 핀 부족 체크
  v_pin_count := coalesce(array_length(v_pin_ids, 1), 0);

  IF v_pin_count < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_PINS',
      'error_message', format('재고가 부족합니다. 요청: %s개, 재고: %s개', p_quantity, v_pin_count)
    );
  END IF;

  -- 4. 주문(order) 생성
  INSERT INTO orders (
    order_number, user_id, product_id, quantity,
    product_price, fee_type, fee_amount, total_amount,
    payment_method, pg_transaction_id,
    pg_ref_no, pg_tran_date, pg_pay_type,
    card_no, card_company_code, card_company_name,
    installment_months, approval_no,
    receiver_phone, status
  ) VALUES (
    p_order_number, p_user_id, p_product_id, p_quantity,
    v_product.price, p_fee_type, v_fee_amount, v_total_amount,
    p_payment_method, p_pg_transaction_id,
    p_pg_ref_no, p_pg_tran_date, p_pg_pay_type,
    p_card_no, p_card_company_code, p_card_company_name,
    p_installment_months, p_approval_no,
    p_receiver_phone, 'paid'
  )
  RETURNING id INTO v_order_id;

  -- 5. 바우처(voucher) 생성
  INSERT INTO vouchers (
    code, order_id, owner_id,
    temp_password_hash, temp_password_expires_at,
    temp_password_attempts, reissue_count,
    user_password_attempts, is_password_locked,
    fee_paid, is_gift, status
  ) VALUES (
    p_voucher_code, v_order_id, p_user_id,
    p_temp_password_hash, p_temp_password_expires_at,
    0, 0,
    0, false,
    CASE WHEN p_fee_type = 'included' THEN true ELSE false END,
    false, 'issued'
  )
  RETURNING id INTO v_voucher_id;

  -- 6. 핀 N개 상태 변경: waiting -> assigned
  UPDATE pins
  SET status = 'assigned',
      voucher_id = v_voucher_id,
      assigned_at = now()
  WHERE id = ANY(v_pin_ids);

  -- 7. 상품 판매량 업데이트
  UPDATE products
  SET total_sales = total_sales + p_quantity
  WHERE id = p_product_id;

  -- 8. 사용자 구매 통계 업데이트
  UPDATE users
  SET total_purchase_count = total_purchase_count + 1,
      total_purchase_amount = total_purchase_amount + v_total_amount
  WHERE id = p_user_id;

  -- 성공 응답
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'voucher_id', v_voucher_id,
    'voucher_code', p_voucher_code,
    'total_amount', v_total_amount,
    'fee_amount', v_fee_amount,
    'product_price', v_product.price,
    'pin_count', v_pin_count
  );

EXCEPTION
  WHEN unique_violation THEN
    -- 주문번호(order_number) 또는 바우처 코드(voucher_code) 충돌
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNIQUE_VIOLATION',
      'error_message', '주문번호 또는 바우처 코드가 중복되었습니다. 다시 시도해 주세요.'
    );
  WHEN OTHERS THEN
    -- 예상치 못한 에러 로깅 후 안전한 응답 반환
    RAISE WARNING '[create_order_with_voucher] SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INTERNAL_ERROR',
      'error_message', '주문 처리 중 오류가 발생했습니다.'
    );
END;
$$;
