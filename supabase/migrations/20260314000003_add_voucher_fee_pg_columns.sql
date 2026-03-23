-- ============================================================
-- vouchers 테이블에 수수료 PG 결제 정보 컬럼 추가
--
-- 수수료 별도 결제 시 PG 환불에 필요한 정보를 저장한다.
-- 기존 fee_paid, fee_pg_transaction_id 외에
-- ref_no, tran_date, pay_type, fee_amount를 추가한다.
-- ============================================================

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS fee_pg_ref_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fee_pg_tran_date VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fee_pg_pay_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC;

COMMENT ON COLUMN vouchers.fee_pg_ref_no IS '수수료 PG 거래 참조번호 (환불 시 필요)';
COMMENT ON COLUMN vouchers.fee_pg_tran_date IS '수수료 PG 거래일시 (환불 시 필요)';
COMMENT ON COLUMN vouchers.fee_pg_pay_type IS '수수료 PG 결제방식 (환불 시 필요)';
COMMENT ON COLUMN vouchers.fee_amount IS '수수료 결제 금액';

-- ============================================================
-- deliver_fee_pins RPC 업데이트: 수수료 PG 정보 파라미터 추가
--
-- 기존 p_pg_transaction_id 외에 p_pg_ref_no, p_pg_tran_date,
-- p_pg_pay_type, p_fee_amount를 받아서 vouchers에 저장한다.
-- ============================================================

CREATE OR REPLACE FUNCTION deliver_fee_pins(
  p_voucher_id UUID,
  p_order_id UUID,
  p_pg_transaction_id VARCHAR(100) DEFAULT NULL,
  p_pg_ref_no VARCHAR(100) DEFAULT NULL,
  p_pg_tran_date VARCHAR(20) DEFAULT NULL,
  p_pg_pay_type VARCHAR(20) DEFAULT NULL,
  p_fee_amount NUMERIC DEFAULT NULL
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

  -- 3. 바우처 상태 전이: password_set -> pin_revealed + fee_paid + PG 정보 저장
  UPDATE vouchers
  SET
    fee_paid = true,
    fee_pg_transaction_id = p_pg_transaction_id,
    fee_pg_ref_no = p_pg_ref_no,
    fee_pg_tran_date = p_pg_tran_date,
    fee_pg_pay_type = p_pg_pay_type,
    fee_amount = p_fee_amount,
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

-- ============================================================
-- admin_search_orders RPC 업데이트: 바우처 수수료 필드 추가
--
-- 목록 조회에 fee_paid, fee_pg_transaction_id, voucher_fee_amount 포함
-- ============================================================

CREATE OR REPLACE FUNCTION admin_search_orders(
  p_search text DEFAULT '',
  p_order_status text[] DEFAULT '{}',
  p_fee_type text DEFAULT '',
  p_card_company text[] DEFAULT '{}',
  p_installment text DEFAULT '',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_amount_min int DEFAULT NULL,
  p_amount_max int DEFAULT NULL,
  p_voucher_status text[] DEFAULT '{}',
  p_sort_by text DEFAULT 'created_at',
  p_sort_order text DEFAULT 'desc',
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 20
) RETURNS json
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_total bigint;
  v_items json;
  v_search_lower text;
  v_search_digits text;
BEGIN
  v_search_lower := LOWER(TRIM(p_search));
  v_search_digits := regexp_replace(v_search_lower, '\D', '', 'g');

  -- 총 건수 조회
  SELECT COUNT(*) INTO v_total
  FROM admin_orders_view o
  LEFT JOIN vouchers v ON v.order_id = o.id
    AND v.id = (
      SELECT v2.id FROM vouchers v2
      WHERE v2.order_id = o.id
      ORDER BY
        CASE WHEN v2.is_gift = false THEN 0 ELSE 1 END,
        CASE WHEN v2.status NOT IN ('gifted', 'cancelled') THEN 0 ELSE 1 END,
        v2.created_at ASC
      LIMIT 1
    )
  WHERE
    (array_length(p_order_status, 1) IS NULL OR (
      CASE
        WHEN p_order_status = ARRAY['paid'] THEN o.status != 'cancelled'
        WHEN p_order_status = ARRAY['cancelled'] THEN o.status = 'cancelled'
        ELSE TRUE
      END
    ))
    AND (p_fee_type = '' OR o.fee_type = p_fee_type)
    AND (array_length(p_card_company, 1) IS NULL OR o.card_company_code = ANY(p_card_company))
    AND (p_installment = '' OR
      CASE
        WHEN p_installment = 'lumpsum' THEN o.installment_months = 0
        WHEN p_installment = 'installment' THEN o.installment_months > 0
        ELSE TRUE
      END
    )
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    AND (p_amount_min IS NULL OR o.total_amount >= p_amount_min)
    AND (p_amount_max IS NULL OR o.total_amount <= p_amount_max)
    AND (array_length(p_voucher_status, 1) IS NULL OR v.status = ANY(p_voucher_status))
    AND (v_search_lower = '' OR (
      o.order_number ILIKE '%' || v_search_lower || '%'
      OR o.buyer_username ILIKE '%' || v_search_lower || '%'
      OR o.buyer_name ILIKE '%' || v_search_lower || '%'
      OR COALESCE(o.product_name, '') ILIKE '%' || v_search_lower || '%'
      OR (length(v_search_digits) >= 3 AND o.buyer_phone LIKE '%' || v_search_digits || '%')
    ));

  -- 데이터 조회 (정렬 + 페이징)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_items
  FROM (
    SELECT
      o.id,
      o.order_number,
      o.user_id,
      o.product_id,
      o.quantity,
      o.product_price,
      o.fee_type,
      o.fee_amount,
      o.total_amount,
      o.payment_method,
      o.pg_transaction_id,
      o.pg_ref_no,
      o.pg_tran_date,
      o.pg_pay_type,
      o.card_no,
      o.card_company_code,
      o.card_company_name,
      o.installment_months,
      o.approval_no,
      o.receiver_phone,
      o.status,
      o.created_at,
      o.updated_at,
      o.buyer_username,
      o.buyer_name,
      o.buyer_phone,
      o.product_name,
      o.product_image_url,
      v.id AS voucher_id,
      v.code AS voucher_code,
      v.status AS voucher_status,
      (v.user_password_hash IS NOT NULL) AS is_password_set,
      COALESCE(v.is_password_locked, false) AS is_password_locked,
      COALESCE(v.reissue_count, 0) AS reissue_count,
      COALESCE(v.fee_paid, false) AS fee_paid,
      v.fee_pg_transaction_id,
      v.fee_amount AS voucher_fee_amount
    FROM admin_orders_view o
    LEFT JOIN vouchers v ON v.order_id = o.id
      AND v.id = (
        SELECT v2.id FROM vouchers v2
        WHERE v2.order_id = o.id
        ORDER BY
          CASE WHEN v2.is_gift = false THEN 0 ELSE 1 END,
          CASE WHEN v2.status NOT IN ('gifted', 'cancelled') THEN 0 ELSE 1 END,
          v2.created_at ASC
        LIMIT 1
      )
    WHERE
      (array_length(p_order_status, 1) IS NULL OR (
        CASE
          WHEN p_order_status = ARRAY['paid'] THEN o.status != 'cancelled'
          WHEN p_order_status = ARRAY['cancelled'] THEN o.status = 'cancelled'
          ELSE TRUE
        END
      ))
      AND (p_fee_type = '' OR o.fee_type = p_fee_type)
      AND (array_length(p_card_company, 1) IS NULL OR o.card_company_code = ANY(p_card_company))
      AND (p_installment = '' OR
        CASE
          WHEN p_installment = 'lumpsum' THEN o.installment_months = 0
          WHEN p_installment = 'installment' THEN o.installment_months > 0
          ELSE TRUE
        END
      )
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at <= p_date_to)
      AND (p_amount_min IS NULL OR o.total_amount >= p_amount_min)
      AND (p_amount_max IS NULL OR o.total_amount <= p_amount_max)
      AND (array_length(p_voucher_status, 1) IS NULL OR v.status = ANY(p_voucher_status))
      AND (v_search_lower = '' OR (
        o.order_number ILIKE '%' || v_search_lower || '%'
        OR o.buyer_username ILIKE '%' || v_search_lower || '%'
        OR o.buyer_name ILIKE '%' || v_search_lower || '%'
        OR COALESCE(o.product_name, '') ILIKE '%' || v_search_lower || '%'
        OR (length(v_search_digits) >= 3 AND o.buyer_phone LIKE '%' || v_search_digits || '%')
      ))
    ORDER BY
      CASE WHEN p_sort_by = 'created_at'   AND p_sort_order = 'desc' THEN o.created_at END DESC,
      CASE WHEN p_sort_by = 'created_at'   AND p_sort_order = 'asc'  THEN o.created_at END ASC,
      CASE WHEN p_sort_by = 'order_number' AND p_sort_order = 'desc' THEN o.order_number END DESC,
      CASE WHEN p_sort_by = 'order_number' AND p_sort_order = 'asc'  THEN o.order_number END ASC,
      CASE WHEN p_sort_by = 'total_amount' AND p_sort_order = 'desc' THEN o.total_amount END DESC,
      CASE WHEN p_sort_by = 'total_amount' AND p_sort_order = 'asc'  THEN o.total_amount END ASC,
      CASE WHEN p_sort_by = 'buyer_name'   AND p_sort_order = 'desc' THEN o.buyer_name END DESC,
      CASE WHEN p_sort_by = 'buyer_name'   AND p_sort_order = 'asc'  THEN o.buyer_name END ASC,
      CASE WHEN p_sort_by = 'buyer_username' AND p_sort_order = 'desc' THEN o.buyer_username END DESC,
      CASE WHEN p_sort_by = 'buyer_username' AND p_sort_order = 'asc'  THEN o.buyer_username END ASC,
      CASE WHEN p_sort_by = 'product_name' AND p_sort_order = 'desc' THEN o.product_name END DESC,
      CASE WHEN p_sort_by = 'product_name' AND p_sort_order = 'asc'  THEN o.product_name END ASC
    OFFSET p_offset
    LIMIT p_limit
  ) t;

  RETURN json_build_object(
    'items', v_items,
    'total', v_total
  );
END;
$$;
