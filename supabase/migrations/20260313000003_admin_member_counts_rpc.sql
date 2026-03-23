-- 관리자 회원 목록용 집계 RPC
-- 기존: 유저당 3개 count 쿼리 (N+1 문제)
-- 수정: 한 번의 쿼리로 모든 유저의 카운트를 집계

CREATE OR REPLACE FUNCTION get_member_counts(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  voucher_count BIGINT,
  gift_sent_count BIGINT,
  gift_received_count BIGINT
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
    COALESCE(gr.cnt, 0) AS gift_received_count
  FROM unnest(p_user_ids) AS u(id)
  LEFT JOIN (
    SELECT owner_id, COUNT(*) AS cnt
    FROM vouchers
    WHERE owner_id = ANY(p_user_ids)
      AND status != 'cancelled'
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
  ) gr ON gr.receiver_id = u.id;
$$;
