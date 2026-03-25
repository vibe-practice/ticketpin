-- ============================================================
-- 본인인증 세션 + 비밀번호 재설정 토큰 테이블
-- 기존 인메모리 Map -> Supabase DB 전환
-- ============================================================

-- 본인인증 세션 테이블
CREATE TABLE IF NOT EXISTS identity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  tid text NOT NULL,
  confirmed boolean DEFAULT false,
  result_name text,
  result_phone text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes'
);

-- 인덱스: session_id로 조회 (UNIQUE이므로 자동 인덱스 생성)
-- 인덱스: tid로 조회 (콜백에서 사용)
CREATE INDEX IF NOT EXISTS idx_identity_sessions_tid ON identity_sessions (tid);

-- 만료된 레코드 자동 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_identity_sessions_expires_at ON identity_sessions (expires_at);

-- RLS 활성화 (service_role만 접근 가능)
ALTER TABLE identity_sessions ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 차단, service_role만 접근


-- 비밀번호 재설정 토큰 테이블
CREATE TABLE IF NOT EXISTS reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id text UNIQUE NOT NULL,
  username text NOT NULL,
  phone text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 만료된 레코드 자동 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires_at ON reset_tokens (expires_at);

-- RLS 활성화 (service_role만 접근 가능)
ALTER TABLE reset_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 차단, service_role만 접근


-- 만료된 세션/토큰 정리 함수 (수동 또는 크론으로 호출)
CREATE OR REPLACE FUNCTION cleanup_expired_identity_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_sessions int;
  deleted_tokens int;
BEGIN
  DELETE FROM identity_sessions WHERE expires_at < now();
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  DELETE FROM reset_tokens WHERE expires_at < now();
  GET DIAGNOSTICS deleted_tokens = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_sessions', deleted_sessions,
    'deleted_tokens', deleted_tokens
  );
END;
$$;
