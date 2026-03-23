-- Fix: cancelled 상태 정산이 존재할 때 새 선물이 들어오면 정산이 생성되지 않는 버그 수정
-- 원인: UPDATE 조건이 status='pending'만 허용 + INSERT ON CONFLICT DO NOTHING
-- 해결: cancelled 상태 정산을 pending으로 되돌리고 금액을 새 값으로 초기화
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
  -- 1) 기존 pending 정산이 있으면 원자적 증분
  UPDATE settlements
  SET gift_count = gift_count + 1,
      gift_total_amount = gift_total_amount + p_total_amount,
      settlement_amount = settlement_amount + p_settlement_per_item
  WHERE business_id = p_business_id
    AND settlement_date = p_settlement_date
    AND status = 'pending'
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NOT NULL THEN
    RETURN v_settlement_id;
  END IF;

  -- 2) cancelled 정산이 있으면 pending으로 되돌리고 새 값으로 초기화
  --    (cancelled 정산의 금액은 0이므로 증분이 아닌 초기값 설정)
  UPDATE settlements
  SET status = 'pending',
      gift_count = 1,
      gift_total_amount = p_total_amount,
      commission_rate = p_commission_rate,
      settlement_amount = p_settlement_per_item
  WHERE business_id = p_business_id
    AND settlement_date = p_settlement_date
    AND status = 'cancelled'
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NOT NULL THEN
    RETURN v_settlement_id;
  END IF;

  -- 3) 정산이 없으면 새로 생성
  INSERT INTO settlements (business_id, settlement_date, gift_count, gift_total_amount, commission_rate, settlement_amount, status)
  VALUES (p_business_id, p_settlement_date, 1, p_total_amount, p_commission_rate, p_settlement_per_item, 'pending')
  ON CONFLICT (business_id, settlement_date) DO NOTHING
  RETURNING id INTO v_settlement_id;

  -- 4) ON CONFLICT 발생 시 (confirmed/paid 상태 정산이 존재) → NULL 반환
  --    confirmed/paid 정산은 이미 확정/지급완료이므로 건드리지 않음
  RETURN v_settlement_id;
END;
$$;
