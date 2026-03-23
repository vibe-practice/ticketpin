-- businesses 테이블에 SMS 인증 전용 휴대폰 번호 컬럼 추가
-- 담당자 연락처(contact_phone)와 SMS 인증번호 수신 번호를 분리

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS auth_phone TEXT;

-- 초기값: 기존 contact_phone 값으로 세팅
UPDATE businesses
  SET auth_phone = contact_phone
  WHERE auth_phone IS NULL;

COMMENT ON COLUMN businesses.auth_phone IS 'SMS 인증번호 수신 전용 휴대폰 번호. NULL이면 contact_phone 폴백.';
