-- ============================================================
-- 핀 조회 검증 토큰 테이블
-- 비밀번호 검증 완료 시 서버에서 발급하는 일회성 토큰
-- sessionStorage에 비밀번호 평문 대신 이 토큰을 저장
-- TTL: 10분
-- ============================================================

CREATE TABLE IF NOT EXISTS pin_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  voucher_id uuid NOT NULL REFERENCES vouchers(id),
  voucher_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes',
  used boolean DEFAULT false
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pin_verification_tokens_token ON pin_verification_tokens (token);
CREATE INDEX IF NOT EXISTS idx_pin_verification_tokens_expires_at ON pin_verification_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_pin_verification_tokens_voucher_id ON pin_verification_tokens (voucher_id);

-- RLS 활성화 (service_role만 접근 가능)
ALTER TABLE pin_verification_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 차단, service_role만 접근


-- 만료된 핀 검증 토큰 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_pin_verification_tokens()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM pin_verification_tokens WHERE expires_at < now() OR used = true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
