-- 정산 원자적 upsert RPC (선물 시 자동 정산 생성/업데이트)
-- race condition 방지: SET gift_count = gift_count + 1 패턴 사용
CREATE OR REPLACE FUNCTION upsert_settlement(
  p_business_id uuid,
  p_settlement_date date,
  p_commission_rate numeric,
  p_total_amount integer,
  p_settlement_per_item integer
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_settlement_id uuid;
BEGIN
  -- 기존 pending 정산이 있으면 원자적 증분
  UPDATE settlements
  SET gift_count = gift_count + 1,
      gift_total_amount = gift_total_amount + p_total_amount,
      settlement_amount = settlement_amount + p_settlement_per_item
  WHERE business_id = p_business_id
    AND settlement_date = p_settlement_date
    AND status = 'pending'
  RETURNING id INTO v_settlement_id;

  -- 없으면 새로 생성
  IF v_settlement_id IS NULL THEN
    INSERT INTO settlements (business_id, settlement_date, gift_count, gift_total_amount, commission_rate, settlement_amount, status)
    VALUES (p_business_id, p_settlement_date, 1, p_total_amount, p_commission_rate, p_settlement_per_item, 'pending')
    ON CONFLICT (business_id, settlement_date) DO NOTHING
    RETURNING id INTO v_settlement_id;

    -- ON CONFLICT 발생 시 (다른 상태의 정산이 존재) → pending이면 증분, 아니면 NULL 반환
    IF v_settlement_id IS NULL THEN
      UPDATE settlements
      SET gift_count = gift_count + 1,
          gift_total_amount = gift_total_amount + p_total_amount,
          settlement_amount = settlement_amount + p_settlement_per_item
      WHERE business_id = p_business_id
        AND settlement_date = p_settlement_date
        AND status = 'pending'
      RETURNING id INTO v_settlement_id;
    END IF;
  END IF;

  RETURN v_settlement_id;
END;
$$;
