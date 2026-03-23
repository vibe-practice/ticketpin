-- products 테이블에 soldout 상태 추가
-- 기존 CHECK 제약조건을 제거하고 soldout을 포함한 새 제약조건 추가

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('active', 'inactive', 'soldout'));
