-- ============================================================
-- SECURITY DEFINER 함수 보안 강화
-- search_path 고정 + 권한 제한 (service_role만 호출 가능)
--
-- 대상 함수 7개:
--   1. create_order_with_voucher
--   2. cancel_order_with_refund
--   3. cleanup_expired_admin_sessions
--   4. cleanup_expired_payment_sessions
--   5. deliver_fee_pins
--   6. increment_voucher_password_attempts
--   7. increment_notice_view_count
-- ============================================================

-- 1. create_order_with_voucher (19개 파라미터)
ALTER FUNCTION create_order_with_voucher(
  uuid, uuid, integer, varchar, varchar, varchar, varchar, text, timestamptz,
  varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar
) SET search_path = public;

REVOKE ALL ON FUNCTION create_order_with_voucher(
  uuid, uuid, integer, varchar, varchar, varchar, varchar, text, timestamptz,
  varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar
) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_order_with_voucher(
  uuid, uuid, integer, varchar, varchar, varchar, varchar, text, timestamptz,
  varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar
) FROM anon;
REVOKE ALL ON FUNCTION create_order_with_voucher(
  uuid, uuid, integer, varchar, varchar, varchar, varchar, text, timestamptz,
  varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar
) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_voucher(
  uuid, uuid, integer, varchar, varchar, varchar, varchar, text, timestamptz,
  varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar
) TO service_role;

-- 2. cancel_order_with_refund
ALTER FUNCTION cancel_order_with_refund(uuid, uuid, varchar, text, numeric, text)
  SET search_path = public;

REVOKE ALL ON FUNCTION cancel_order_with_refund(uuid, uuid, varchar, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_order_with_refund(uuid, uuid, varchar, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION cancel_order_with_refund(uuid, uuid, varchar, text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION cancel_order_with_refund(uuid, uuid, varchar, text, numeric, text) TO service_role;

-- 3. cleanup_expired_admin_sessions
ALTER FUNCTION cleanup_expired_admin_sessions()
  SET search_path = public;

REVOKE ALL ON FUNCTION cleanup_expired_admin_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_admin_sessions() FROM anon;
REVOKE ALL ON FUNCTION cleanup_expired_admin_sessions() FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_admin_sessions() TO service_role;

-- 4. cleanup_expired_payment_sessions
ALTER FUNCTION cleanup_expired_payment_sessions()
  SET search_path = public;

REVOKE ALL ON FUNCTION cleanup_expired_payment_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_payment_sessions() FROM anon;
REVOKE ALL ON FUNCTION cleanup_expired_payment_sessions() FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_payment_sessions() TO service_role;

-- 5. deliver_fee_pins
ALTER FUNCTION deliver_fee_pins(uuid, uuid, varchar)
  SET search_path = public;

REVOKE ALL ON FUNCTION deliver_fee_pins(uuid, uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION deliver_fee_pins(uuid, uuid, varchar) FROM anon;
REVOKE ALL ON FUNCTION deliver_fee_pins(uuid, uuid, varchar) FROM authenticated;
GRANT EXECUTE ON FUNCTION deliver_fee_pins(uuid, uuid, varchar) TO service_role;

-- 6. increment_voucher_password_attempts
-- 함수가 존재하지 않을 수 있으므로 먼저 생성 후 보안 적용
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_voucher_password_attempts'
  ) THEN
    ALTER FUNCTION increment_voucher_password_attempts(uuid, integer) SET search_path = public;
    REVOKE ALL ON FUNCTION increment_voucher_password_attempts(uuid, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION increment_voucher_password_attempts(uuid, integer) FROM anon;
    REVOKE ALL ON FUNCTION increment_voucher_password_attempts(uuid, integer) FROM authenticated;
    GRANT EXECUTE ON FUNCTION increment_voucher_password_attempts(uuid, integer) TO service_role;
  END IF;
END $$;

-- 7. increment_notice_view_count
ALTER FUNCTION increment_notice_view_count(uuid)
  SET search_path = public;

REVOKE ALL ON FUNCTION increment_notice_view_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_notice_view_count(uuid) FROM anon;
REVOKE ALL ON FUNCTION increment_notice_view_count(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_notice_view_count(uuid) TO service_role;
