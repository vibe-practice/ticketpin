-- ============================================================
-- DB 불일치 수동 정리 SQL
-- 날짜: 2026-03-14
-- 대상: 주문 TM-20260314-94P7 (status=cancelled)의 바우처가 pin_revealed로 남아있는 문제
--
-- 실행 전 반드시 확인:
-- 1. 아래 SELECT 쿼리를 먼저 실행하여 현재 상태 확인
-- 2. 정리 대상이 맞는지 확인 후 UPDATE 실행
-- ============================================================

-- [1단계] 현재 상태 확인 (읽기 전용)
-- 주문 상태 확인
SELECT id, order_number, status, total_amount, created_at
FROM orders
WHERE order_number = 'TM-20260314-94P7';

-- 해당 주문의 바우처 상태 확인
SELECT v.id, v.code, v.status, v.order_id, v.created_at
FROM vouchers v
INNER JOIN orders o ON o.id = v.order_id
WHERE o.order_number = 'TM-20260314-94P7';

-- 해당 바우처의 핀 상태 확인
SELECT p.id, p.status, p.voucher_id, p.assigned_at
FROM pins p
INNER JOIN vouchers v ON v.id = p.voucher_id
INNER JOIN orders o ON o.id = v.order_id
WHERE o.order_number = 'TM-20260314-94P7';

-- cancellations 기록 확인
SELECT c.id, c.order_id, c.voucher_id, c.refund_status, c.cancelled_by, c.refund_amount, c.created_at
FROM cancellations c
INNER JOIN orders o ON o.id = c.order_id
WHERE o.order_number = 'TM-20260314-94P7';

-- ============================================================
-- [2단계] 데이터 정리 (위 확인 후 실행)
-- ============================================================

-- 바우처 상태를 cancelled로 변경
UPDATE vouchers
SET status = 'cancelled', updated_at = now()
WHERE order_id = (
  SELECT id FROM orders WHERE order_number = 'TM-20260314-94P7'
)
AND status != 'cancelled';

-- 핀 상태를 consumed로 변경 (pin_revealed 상태에서 취소됐으므로 재배정 방지)
UPDATE pins
SET status = 'consumed'
WHERE voucher_id IN (
  SELECT v.id FROM vouchers v
  INNER JOIN orders o ON o.id = v.order_id
  WHERE o.order_number = 'TM-20260314-94P7'
)
AND status NOT IN ('consumed');

-- cancellations의 refund_status를 completed로 변경 (PG 환불은 이미 완료됨)
UPDATE cancellations
SET refund_status = 'completed'
WHERE order_id = (
  SELECT id FROM orders WHERE order_number = 'TM-20260314-94P7'
)
AND refund_status = 'failed';

-- [3단계] 정리 후 확인
SELECT
  o.order_number,
  o.status AS order_status,
  v.code AS voucher_code,
  v.status AS voucher_status,
  c.refund_status,
  c.cancelled_by
FROM orders o
LEFT JOIN vouchers v ON v.order_id = o.id
LEFT JOIN cancellations c ON c.order_id = o.id
WHERE o.order_number = 'TM-20260314-94P7';
