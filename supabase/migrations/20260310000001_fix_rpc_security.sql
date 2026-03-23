-- admin_delete_product RPC 보안 강화
-- search_path 설정 + 권한 제한 (service_role만 호출 가능)

-- 기존 함수 재생성 (search_path 추가)
CREATE OR REPLACE FUNCTION admin_delete_product(p_product_id uuid)
RETURNS json AS $$
DECLARE
  v_pin_count int;
  v_order_count int;
  v_gift_count int;
  v_image_url text;
BEGIN
  -- 존재 여부 확인
  SELECT image_url INTO v_image_url
  FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND');
  END IF;

  -- 핀 삭제
  DELETE FROM pins WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_pin_count = ROW_COUNT;

  -- 주문 product_id null 처리
  UPDATE orders SET product_id = NULL WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_order_count = ROW_COUNT;

  -- 선물 이력 product_id null 처리
  UPDATE gifts SET product_id = NULL WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_gift_count = ROW_COUNT;

  -- 결제 세션 product_id null 처리
  UPDATE payment_sessions SET product_id = NULL WHERE product_id = p_product_id;

  -- 상품 삭제
  DELETE FROM products WHERE id = p_product_id;

  RETURN json_build_object(
    'success', true,
    'deleted_pins', v_pin_count,
    'updated_orders', v_order_count,
    'updated_gifts', v_gift_count,
    'image_url', v_image_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 기본 권한 제거 후 service_role에만 부여
REVOKE ALL ON FUNCTION admin_delete_product(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_product(uuid) FROM anon;
REVOKE ALL ON FUNCTION admin_delete_product(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_product(uuid) TO service_role;
