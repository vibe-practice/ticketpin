-- 인기 상품 순위 (관리자가 수동으로 1~5번까지 지정)
ALTER TABLE products ADD COLUMN popular_rank smallint;

-- 1~5 범위 제약
ALTER TABLE products ADD CONSTRAINT products_popular_rank_check CHECK (popular_rank BETWEEN 1 AND 5);

-- 같은 순위 중복 불가 (NULL은 허용)
CREATE UNIQUE INDEX idx_products_popular_rank ON products (popular_rank) WHERE popular_rank IS NOT NULL;

-- 인기 상품 순위 원자적 업데이트 RPC 함수
CREATE OR REPLACE FUNCTION update_popular_ranks(p_ranks jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 기존 순위 초기화
  UPDATE products SET popular_rank = NULL WHERE popular_rank IS NOT NULL;

  -- 새 순위 설정
  IF jsonb_array_length(p_ranks) > 0 THEN
    FOR i IN 0..jsonb_array_length(p_ranks) - 1 LOOP
      UPDATE products
      SET popular_rank = (p_ranks->i->>'rank')::smallint
      WHERE id = (p_ranks->i->>'product_id')::uuid;
    END LOOP;
  END IF;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS update_popular_ranks(jsonb);
-- DROP INDEX IF EXISTS idx_products_popular_rank;
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_popular_rank_check;
-- ALTER TABLE products DROP COLUMN IF EXISTS popular_rank;
