-- ============================================================
-- 1. Rate Limiting 테이블 + RPC (서버리스 환경 대응)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key varchar(255) PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 인덱스: 만료된 엔트리 정리용
CREATE INDEX idx_rate_limits_reset_time ON rate_limits (reset_time);

-- RLS 활성화 (클라이언트 직접 접근 불가, service_role만 사용)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 원자적 rate limit 체크 RPC
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key varchar,
  p_max_attempts integer,
  p_window_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_reset_time timestamptz := v_now + (p_window_ms || ' milliseconds')::interval;
  v_entry RECORD;
  v_remaining integer;
BEGIN
  -- 만료된 해당 키의 엔트리 삭제
  DELETE FROM rate_limits WHERE key = p_key AND reset_time <= v_now;

  -- INSERT or UPDATE 원자적 처리 (UPSERT)
  INSERT INTO rate_limits (key, count, reset_time)
  VALUES (p_key, 1, v_reset_time)
  ON CONFLICT (key) DO UPDATE
  SET count = rate_limits.count + 1
  WHERE rate_limits.reset_time > v_now
  RETURNING count, reset_time INTO v_entry;

  -- UPSERT에서 WHERE 조건 미충족 시 (만료된 엔트리가 ON CONFLICT 매칭) → 리셋
  IF v_entry IS NULL THEN
    UPDATE rate_limits
    SET count = 1, reset_time = v_reset_time
    WHERE key = p_key
    RETURNING count, reset_time INTO v_entry;
  END IF;

  -- 초과 여부 판단
  IF v_entry.count > p_max_attempts THEN
    RETURN jsonb_build_object(
      'success', false,
      'remaining', 0,
      'retry_after_ms', EXTRACT(EPOCH FROM (v_entry.reset_time - v_now))::integer * 1000
    );
  END IF;

  v_remaining := p_max_attempts - v_entry.count;
  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_remaining,
    'retry_after_ms', 0
  );
END;
$$;

-- 만료된 rate_limit 엔트리 정리 함수 (크론 또는 수동 호출)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limits WHERE reset_time <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================
-- 2. 정산 항목 검증 원자적 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION verify_settlement_item(
  p_item_id uuid,
  p_settlement_id uuid,
  p_verification_status varchar,
  p_verification_memo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_new_gift_count integer := 0;
  v_new_gift_total_amount integer := 0;
  v_new_settlement_amount integer := 0;
  v_prev_status varchar;
  v_need_recalc boolean := false;
BEGIN
  -- 1. 항목 조회 + 잠금
  SELECT id, settlement_id, verification_status
  INTO v_item
  FROM settlement_gift_items
  WHERE id = p_item_id AND settlement_id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NOT_FOUND',
      'error_message', '정산 항목을 찾을 수 없습니다.'
    );
  END IF;

  v_prev_status := v_item.verification_status;

  -- 2. 검증 상태 업데이트
  UPDATE settlement_gift_items
  SET verification_status = p_verification_status,
      verification_memo = p_verification_memo
  WHERE id = p_item_id;

  -- 3. rejected 관련 변경 시 정산 금액 원자적 재계산
  IF p_verification_status = 'rejected' OR v_prev_status = 'rejected' THEN
    v_need_recalc := true;
  END IF;

  IF v_need_recalc THEN
    -- 정산 테이블도 잠금
    PERFORM id FROM settlements WHERE id = p_settlement_id FOR UPDATE;

    -- rejected 제외 합산
    SELECT
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(total_amount), 0),
      COALESCE(SUM(settlement_per_item), 0)
    INTO v_new_gift_count, v_new_gift_total_amount, v_new_settlement_amount
    FROM settlement_gift_items
    WHERE settlement_id = p_settlement_id
      AND verification_status != 'rejected';

    UPDATE settlements
    SET gift_count = v_new_gift_count,
        gift_total_amount = v_new_gift_total_amount,
        settlement_amount = v_new_settlement_amount
    WHERE id = p_settlement_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'recalculated', v_need_recalc
  );
END;
$$;
