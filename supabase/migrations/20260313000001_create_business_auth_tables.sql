-- ============================================================
-- Phase 4: 업체 인증 테이블
-- 테이블: business_accounts, business_sessions,
--         business_verification_codes, business_access_logs
-- ============================================================

-- ============================================================
-- 1. business_accounts (업체 로그인 계정)
-- ============================================================
CREATE TABLE business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  login_id varchar(50) NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (login_id),
  UNIQUE (business_id)
);

CREATE INDEX idx_business_accounts_business_id ON business_accounts (business_id);
CREATE INDEX idx_business_accounts_login_id ON business_accounts (login_id);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_business_accounts_updated_at
  BEFORE UPDATE ON business_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화 (service_role만 접근)
ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. business_sessions (업체 로그인 세션)
-- ============================================================
CREATE TABLE business_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token varchar(255) NOT NULL,
  ip_address varchar(45),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),

  UNIQUE (token)
);

CREATE INDEX idx_business_sessions_token ON business_sessions (token);
CREATE INDEX idx_business_sessions_business_id ON business_sessions (business_id);
CREATE INDEX idx_business_sessions_expires_at ON business_sessions (expires_at);

-- RLS 활성화 (service_role만 접근)
ALTER TABLE business_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. business_verification_codes (SMS 인증번호)
-- ============================================================
CREATE TABLE business_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  phone varchar(20) NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bvc_business_id ON business_verification_codes (business_id);
CREATE INDEX idx_bvc_expires_at ON business_verification_codes (expires_at);

-- RLS 활성화 (service_role만 접근)
ALTER TABLE business_verification_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. business_access_logs (업체 접근 로그)
-- ============================================================
CREATE TABLE business_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  ip_address varchar(45) NOT NULL,
  action varchar(30) NOT NULL CHECK (action IN (
    'verify_attempt', 'verify_success',
    'login_attempt', 'login_success', 'login_fail'
  )),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bal_business_id ON business_access_logs (business_id);
CREATE INDEX idx_bal_action ON business_access_logs (action);
CREATE INDEX idx_bal_created_at ON business_access_logs (created_at DESC);

-- RLS 활성화 (service_role만 접근)
ALTER TABLE business_access_logs ENABLE ROW LEVEL SECURITY;
