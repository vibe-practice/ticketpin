-- 성능 최적화: 대시보드 RPC + 관리자 주문 View + 인덱스
-- P: 대시보드 stats/chart의 전체 row JS 집계 -> DB 집계 전환
-- P: 관리자 주문 검색 1000건 하드 리밋 -> DB 레벨 검색/페이징

-- ============================================================
-- 1. 대시보드 매출 통계 RPC
-- ============================================================
CREATE OR REPLACE FUNCTION dashboard_sales_stats(
  p_today_start timestamptz,
  p_yesterday_start timestamptz,
  p_month_start timestamptz,
  p_prev_month_start timestamptz
) RETURNS json
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'today_sales',      COALESCE(SUM(total_amount) FILTER (WHERE created_at >= p_today_start AND status != 'cancelled'), 0),
    'today_count',      COUNT(*) FILTER (WHERE created_at >= p_today_start AND status != 'cancelled'),
    'yesterday_sales',  COALESCE(SUM(total_amount) FILTER (WHERE created_at >= p_yesterday_start AND created_at < p_today_start AND status != 'cancelled'), 0),
    'yesterday_count',  COUNT(*) FILTER (WHERE created_at >= p_yesterday_start AND created_at < p_today_start AND status != 'cancelled'),
    'month_sales',      COALESCE(SUM(total_amount) FILTER (WHERE created_at >= p_month_start AND status != 'cancelled'), 0),
    'month_count',      COUNT(*) FILTER (WHERE created_at >= p_month_start AND status != 'cancelled'),
    'prev_month_sales', COALESCE(SUM(total_amount) FILTER (WHERE created_at >= p_prev_month_start AND created_at < p_month_start AND status != 'cancelled'), 0),
    'prev_month_count', COUNT(*) FILTER (WHERE created_at >= p_prev_month_start AND created_at < p_month_start AND status != 'cancelled')
  ) FROM orders;
$$;

-- ============================================================
-- 2. 대시보드 차트 데이터 RPC (일별 집계)
-- ============================================================
CREATE OR REPLACE FUNCTION dashboard_chart_data(
  p_start_date timestamptz,
  p_end_date timestamptz
) RETURNS json
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json)
  FROM (
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
      COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS sales,
      COUNT(*) FILTER (WHERE status != 'cancelled') AS order_count,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancel_count
    FROM orders
    WHERE created_at >= p_start_date AND created_at < p_end_date
    GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
  ) t;
$$;

-- ============================================================
-- 3. 관리자 주문 목록 View (orders + users + products JOIN)
-- ============================================================
CREATE OR REPLACE VIEW admin_orders_view AS
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
  -- buyer 정보 (users JOIN)
  u.username AS buyer_username,
  u.name     AS buyer_name,
  u.phone    AS buyer_phone,
  -- product 정보 (products LEFT JOIN)
  p.name      AS product_name,
  p.image_url AS product_image_url
FROM orders o
INNER JOIN users u ON u.id = o.user_id
LEFT JOIN products p ON p.id = o.product_id;

-- View 접근 권한 (관리자 API에서만 사용하므로 service_role만)
GRANT SELECT ON admin_orders_view TO service_role;

-- ============================================================
-- 4. 관리자 주문 검색 RPC (View 기반 통합 검색 + 페이징)
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
        CASE WHEN v2.status NOT IN ('gifted', 'cancelled') THEN 0 ELSE 1 END,
        v2.created_at DESC
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
          CASE WHEN v2.status NOT IN ('gifted', 'cancelled') THEN 0 ELSE 1 END,
          v2.created_at DESC
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

-- ============================================================
-- 5. 누락 인덱스 추가
-- ============================================================

-- 바우처 목록 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_vouchers_owner_created ON vouchers (owner_id, created_at DESC);

-- 선물 조회 최적화
CREATE INDEX IF NOT EXISTS idx_gifts_source_voucher ON gifts (source_voucher_id);

-- 주문 기간 조회 최적화 (대시보드용)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
