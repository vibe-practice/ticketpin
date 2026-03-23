-- 관리자 회원 목록용 집계 RPC 수정
-- 변경 1: 바우처 카운트를 cancelled 제외 → 사용 가능 상태(issued, temp_verified, password_set)만 카운트
-- 변경 2: 주문 건수(order_count) + 총 구매 금액(order_total_amount) 반환 추가

DROP FUNCTION IF EXISTS get_member_counts(UUID[]);

CREATE OR REPLACE FUNCTION get_member_counts(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  voucher_count BIGINT,
  gift_sent_count BIGINT,
  gift_received_count BIGINT,
  order_count BIGINT,
  order_total_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(vc.cnt, 0) AS voucher_count,
    COALESCE(gs.cnt, 0) AS gift_sent_count,
    COALESCE(gr.cnt, 0) AS gift_received_count,
    COALESCE(oc.cnt, 0) AS order_count,
    COALESCE(oc.total_amt, 0) AS order_total_amount
  FROM unnest(p_user_ids) AS u(id)
  LEFT JOIN (
    SELECT owner_id, COUNT(*) AS cnt
    FROM vouchers
    WHERE owner_id = ANY(p_user_ids)
      AND status IN ('issued', 'temp_verified', 'password_set')
    GROUP BY owner_id
  ) vc ON vc.owner_id = u.id
  LEFT JOIN (
    SELECT sender_id, COUNT(*) AS cnt
    FROM gifts
    WHERE sender_id = ANY(p_user_ids)
    GROUP BY sender_id
  ) gs ON gs.sender_id = u.id
  LEFT JOIN (
    SELECT receiver_id, COUNT(*) AS cnt
    FROM gifts
    WHERE receiver_id = ANY(p_user_ids)
    GROUP BY receiver_id
  ) gr ON gr.receiver_id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total_amt
    FROM orders
    WHERE user_id = ANY(p_user_ids)
    GROUP BY user_id
  ) oc ON oc.user_id = u.id;
$$;
