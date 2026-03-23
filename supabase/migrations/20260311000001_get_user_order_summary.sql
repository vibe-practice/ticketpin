-- 사용자 주문 요약 RPC: 주문 건수와 총 금액을 한 번의 쿼리로 반환
CREATE OR REPLACE FUNCTION get_user_order_summary(p_user_id uuid)
RETURNS TABLE(order_count bigint, total_amount numeric) AS $$
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  FROM orders
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;
