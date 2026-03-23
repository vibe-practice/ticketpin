-- 관리자 취소/환불 목록 조회 RPC
-- 기존: cancellations 2000건 메모리 로드 + post-filter
-- 수정: DB 레벨 JOIN + 필터 + 검색 + 페이지네이션

CREATE OR REPLACE FUNCTION get_admin_cancellation_list(
  p_search TEXT DEFAULT '',
  p_cancel_status TEXT[] DEFAULT '{}',
  p_reason_type TEXT[] DEFAULT '{}',
  p_cancelled_by TEXT DEFAULT '',
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_amount_min INTEGER DEFAULT NULL,
  p_amount_max INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_total BIGINT;
  v_items JSON;
BEGIN
  -- 총 건수 조회
  SELECT COUNT(*)
  INTO v_total
  FROM cancellations c
  JOIN orders o ON o.id = c.order_id
  JOIN vouchers v ON v.id = c.voucher_id
  LEFT JOIN users u ON u.id = o.user_id
  LEFT JOIN products p ON p.id = o.product_id
  WHERE
    -- cancel_status 필터
    (cardinality(p_cancel_status) = 0 OR c.refund_status = ANY(p_cancel_status))
    -- reason_type 필터
    AND (cardinality(p_reason_type) = 0 OR c.reason_type = ANY(p_reason_type))
    -- cancelled_by 필터
    AND (p_cancelled_by = '' OR c.cancelled_by = p_cancelled_by)
    -- 날짜 범위
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to IS NULL OR c.created_at <= p_date_to)
    -- 금액 범위
    AND (p_amount_min IS NULL OR c.refund_amount >= p_amount_min)
    AND (p_amount_max IS NULL OR c.refund_amount <= p_amount_max)
    -- 통합 검색 (주문번호, 구매자아이디, 구매자이름, 상품명, 바우처코드)
    AND (
      p_search = ''
      OR o.order_number ILIKE '%' || p_search || '%'
      OR u.username ILIKE '%' || p_search || '%'
      OR u.name ILIKE '%' || p_search || '%'
      OR p.name ILIKE '%' || p_search || '%'
      OR v.code ILIKE '%' || p_search || '%'
    );

  -- 데이터 조회 (정렬 + 페이지네이션)
  SELECT json_agg(row_data)
  INTO v_items
  FROM (
    SELECT
      c.id,
      c.order_id,
      c.voucher_id,
      c.reason_type,
      c.reason_detail,
      c.cancelled_by,
      c.refund_amount,
      c.refund_status,
      c.pg_cancel_transaction_id,
      c.refunded_at,
      c.created_at,
      COALESCE(o.order_number, '') AS order_number,
      COALESCE(p.name, '') AS product_name,
      COALESCE(p.price, 0) AS product_price,
      COALESCE(u.username, '') AS buyer_username,
      COALESCE(u.name, '') AS buyer_name,
      COALESCE(o.quantity, 0) AS quantity,
      COALESCE(o.fee_type, 'included') AS fee_type,
      COALESCE(o.fee_amount, 0) AS fee_amount,
      COALESCE(o.total_amount, 0) AS total_amount,
      COALESCE(v.code, '') AS voucher_code
    FROM cancellations c
    JOIN orders o ON o.id = c.order_id
    JOIN vouchers v ON v.id = c.voucher_id
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN products p ON p.id = o.product_id
    WHERE
      (cardinality(p_cancel_status) = 0 OR c.refund_status = ANY(p_cancel_status))
      AND (cardinality(p_reason_type) = 0 OR c.reason_type = ANY(p_reason_type))
      AND (p_cancelled_by = '' OR c.cancelled_by = p_cancelled_by)
      AND (p_date_from IS NULL OR c.created_at >= p_date_from)
      AND (p_date_to IS NULL OR c.created_at <= p_date_to)
      AND (p_amount_min IS NULL OR c.refund_amount >= p_amount_min)
      AND (p_amount_max IS NULL OR c.refund_amount <= p_amount_max)
      AND (
        p_search = ''
        OR o.order_number ILIKE '%' || p_search || '%'
        OR u.username ILIKE '%' || p_search || '%'
        OR u.name ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR v.code ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE WHEN p_sort_order = 'asc' THEN
        CASE p_sort_by
          WHEN 'created_at' THEN c.created_at::TEXT
          WHEN 'refund_amount' THEN LPAD(c.refund_amount::TEXT, 15, '0')
          WHEN 'order_number' THEN o.order_number
          WHEN 'buyer_name' THEN u.name
          WHEN 'product_name' THEN p.name
          ELSE c.created_at::TEXT
        END
      END ASC NULLS LAST,
      CASE WHEN p_sort_order = 'desc' OR p_sort_order IS NULL THEN
        CASE p_sort_by
          WHEN 'created_at' THEN c.created_at::TEXT
          WHEN 'refund_amount' THEN LPAD(c.refund_amount::TEXT, 15, '0')
          WHEN 'order_number' THEN o.order_number
          WHEN 'buyer_name' THEN u.name
          WHEN 'product_name' THEN p.name
          ELSE c.created_at::TEXT
        END
      END DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  ) AS row_data;

  -- 결과 조합
  v_result := json_build_object(
    'data', COALESCE(v_items, '[]'::JSON),
    'total', v_total
  );

  RETURN v_result;
END;
$$;
