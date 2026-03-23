-- 공지사항 조회수 증가 RPC 함수
CREATE OR REPLACE FUNCTION increment_notice_view_count(target_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE notices
  SET view_count = view_count + 1
  WHERE id = target_id;
$$;
