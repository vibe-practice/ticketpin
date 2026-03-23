-- P4-018 리뷰 수정: pin_number_hash 컬럼 추가
-- 핀 번호의 HMAC-SHA256 해시를 저장하여 DB 레벨 중복 체크 및 검색 지원
-- 암호화된 핀 번호를 전체 복호화하지 않고도 O(1)으로 조회 가능

-- 1. 컬럼 추가 (nullable로 시작 — 기존 데이터 호환)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS pin_number_hash TEXT;

-- 2. 인덱스 생성 (중복 체크 + 검색 성능)
CREATE INDEX IF NOT EXISTS idx_pins_pin_number_hash ON pins (pin_number_hash);

-- 3. 복합 인덱스 (상품별 중복 체크용)
CREATE INDEX IF NOT EXISTS idx_pins_product_hash_status ON pins (product_id, pin_number_hash, status);
