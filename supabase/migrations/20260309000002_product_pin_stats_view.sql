-- product_pin_stats View: 상품별 핀 재고 집계
-- 기존 메모리 레벨 카운팅을 DB 레벨로 전환하여 성능 최적화
-- 기반 인덱스: idx_pins_product_status ON pins (product_id, status)

CREATE OR REPLACE VIEW product_pin_stats AS
SELECT
  product_id,
  COUNT(*) FILTER (WHERE status = 'waiting')  AS waiting,
  COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
  COUNT(*) FILTER (WHERE status = 'consumed') AS consumed,
  COUNT(*) FILTER (WHERE status = 'returned') AS returned,
  COUNT(*)                                     AS total
FROM pins
GROUP BY product_id;

-- View 접근 권한 (관리자 API에서만 사용하므로 service_role만 부여)
GRANT SELECT ON product_pin_stats TO service_role;
