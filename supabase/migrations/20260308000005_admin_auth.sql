-- ============================================================
-- 관리자 인증 시스템 (P4-013)
-- 테이블: admin_allowed_ips, admin_sessions
-- 시드: 초기 허용 IP, 관리자 계정
-- ============================================================

-- ============================================================
-- 1. admin_allowed_ips (허용된 관리자 IP 목록)
-- ============================================================
CREATE TABLE admin_allowed_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address varchar(45) UNIQUE NOT NULL,
  description varchar(200),
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화 (정책 없음 — service role만 접근)
ALTER TABLE admin_allowed_ips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. admin_sessions (관리자 세션)
-- ============================================================
CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token varchar(100) UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions (token);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions (expires_at);

-- RLS 활성화 (정책 없음 — service role만 접근)
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. 시드 데이터
-- ============================================================

-- 초기 허용 IP
INSERT INTO admin_allowed_ips (ip_address, description)
VALUES ('112.153.214.71', '초기 관리자 IP')
ON CONFLICT (ip_address) DO NOTHING;

-- 초기 관리자 계정 (배포 후 반드시 비밀번호를 변경해 주세요)
INSERT INTO admin_users (username, password_hash, name)
VALUES ('admin', '$2b$12$l7qK6onxqP9N0ROhGgueSuzuvxgQ1YGsyG99iqMYwwmdxJl3CDaGu', '관리자')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- 4. 만료된 세션 자동 정리 함수
-- ============================================================
-- 주기적 실행을 위해 Supabase 대시보드에서 pg_cron extension 활성화 후
-- 아래 SQL을 실행하세요:
--   SELECT cron.schedule(
--     'cleanup-admin-sessions',
--     '0 * * * *',
--     'SELECT cleanup_expired_admin_sessions()'
--   );
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < now();
END;
$$;
