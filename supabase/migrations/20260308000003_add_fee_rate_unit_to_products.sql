-- ============================================================
-- products 테이블: fee_amount → fee_rate + fee_unit 마이그레이션
-- 기존 fee_amount (건당 고정 금액)를 fee_rate + fee_unit 으로 분리하여
-- 퍼센트/고정 두 가지 수수료 방식을 지원
-- ============================================================

-- 1. 새 컬럼 추가
ALTER TABLE products
  ADD COLUMN fee_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN fee_unit varchar(20) NOT NULL DEFAULT 'fixed'
    CHECK (fee_unit IN ('percent', 'fixed'));

-- 2. 기존 fee_amount 데이터를 fee_rate로 마이그레이션 (fee_unit='fixed' 유지)
UPDATE products
SET fee_rate = fee_amount,
    fee_unit = 'fixed';

-- 3. 기존 fee_amount 컬럼 제거
ALTER TABLE products DROP COLUMN fee_amount;
