-- users 테이블의 status CHECK 제약조건 변경: inactive → withdrawn
-- 기존 inactive 데이터를 withdrawn으로 마이그레이션

-- 1. 기존 CHECK 제약조건 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- 2. 기존 inactive 데이터를 withdrawn으로 변경
UPDATE users SET status = 'withdrawn' WHERE status = 'inactive';

-- 3. 새 CHECK 제약조건 추가
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'withdrawn', 'suspended'));
