-- payment_sessions: 결제 세션 기반 금액 검증 테이블
-- 결제 준비(ready) 시 서버에서 계산한 금액을 저장하고,
-- 결제 승인(pay) 시 세션의 금액과 비교하여 클라이언트의 금액 조작을 방지한다.

CREATE TABLE payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mbr_ref_no VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  fee_type VARCHAR(10), -- 'included' | 'separate' | null(수수료 결제)
  quantity INTEGER,
  session_type VARCHAR(20) NOT NULL DEFAULT 'order' CHECK (session_type IN ('order', 'fee')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  voucher_code VARCHAR(50), -- 수수료 결제 시 바우처 코드
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes')
);

-- 만료된 pending 세션 조회용 인덱스
CREATE INDEX idx_payment_sessions_expires ON payment_sessions(expires_at) WHERE status = 'pending';

-- mbrRefNo 조회용 (UNIQUE 제약이 있으므로 별도 인덱스 불필요하지만 명시적으로)
-- UNIQUE 제약 자체가 인덱스를 생성함

-- user_id 조회용 (사용자별 세션 조회)
CREATE INDEX idx_payment_sessions_user ON payment_sessions(user_id) WHERE status = 'pending';

-- RLS 비활성화: 서버(adminClient/service_role)로만 접근
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

-- service_role은 RLS를 자동 우회하므로 별도 정책 불필요
-- anon/authenticated 키로는 접근 불가 (정책 없음 = 차단)

-- 만료된 세션 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_payment_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM payment_sessions
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;
