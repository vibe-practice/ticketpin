-- 선물된 주문에서 원본 바우처(is_gift=false)를 우선 조회하도록 수정
-- 기존: status NOT IN ('gifted','cancelled') 기준 → 수신자 바우처(issued)가 우선 선택됨
-- 수정: is_gift=false인 원본 바우처를 최우선으로 선택

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
    -- 주문 상태 필터
    (array_length(p_order_status, 1) IS NULL OR (
      CASE
        WHEN p_order_status = ARRAY['paid'] THEN o.status != 'cancelled'
        WHEN p_order_status = ARRAY['cancelled'] THEN o.status = 'cancelled'
        ELSE TRUE
      END
    ))
    -- 수수료 방식
    AND (p_fee_type = '' OR o.fee_type = p_fee_type)
    -- 카드사
    AND (array_length(p_card_company, 1) IS NULL OR o.card_company_code = ANY(p_card_company))
    -- 할부
    AND (p_installment = '' OR
      CASE
        WHEN p_installment = 'lumpsum' THEN o.installment_months = 0
        WHEN p_installment = 'installment' THEN o.installment_months > 0
        ELSE TRUE
      END
    )
    -- 날짜 범위
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    -- 금액 범위
    AND (p_amount_min IS NULL OR o.total_amount >= p_amount_min)
    AND (p_amount_max IS NULL OR o.total_amount <= p_amount_max)
    -- 바우처 상태 필터
    AND (array_length(p_voucher_status, 1) IS NULL OR v.status = ANY(p_voucher_status))
    -- 통합 검색 (DB 레벨)
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
      COALESCE(v.reissue_count, 0) AS reissue_count
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
