-- ============================================================
-- increment_voucher_password_attempts: 비밀번호 시도 횟수 atomic increment
--
-- 경쟁 조건 방지를 위해 DB 레벨에서 원자적으로 증가시킨다.
-- max_attempts 도달 시 자동으로 잠금 처리.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_voucher_password_attempts(
  p_voucher_id UUID,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_attempts INTEGER;
  v_is_locked BOOLEAN;
BEGIN
  UPDATE vouchers
  SET
    user_password_attempts = user_password_attempts + 1,
    is_password_locked = CASE
      WHEN user_password_attempts + 1 >= p_max_attempts THEN true
      ELSE is_password_locked
    END
  WHERE id = p_voucher_id
  RETURNING user_password_attempts, is_password_locked
  INTO v_new_attempts, v_is_locked;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'new_attempts', 0,
      'is_locked', false
    );
  END IF;

  RETURN jsonb_build_object(
    'new_attempts', v_new_attempts,
    'is_locked', v_is_locked
  );
END;
$$;
