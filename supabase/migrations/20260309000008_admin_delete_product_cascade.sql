-- 상품 강제 삭제를 위한 마이그레이션
-- orders.product_id, gifts.product_id를 nullable로 변경하고
-- 트랜잭션 내에서 cascade 삭제하는 RPC function 생성

-- 1) orders.product_id를 nullable로 변경
ALTER TABLE orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT orders_product_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 2) gifts.product_id를 nullable로 변경
ALTER TABLE gifts ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE gifts DROP CONSTRAINT gifts_product_id_fkey;
ALTER TABLE gifts ADD CONSTRAINT gifts_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 3) payment_sessions.product_id FK를 ON DELETE SET NULL로 변경
ALTER TABLE payment_sessions DROP CONSTRAINT payment_sessions_product_id_fkey;
ALTER TABLE payment_sessions ADD CONSTRAINT payment_sessions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 4) 상품 강제 삭제 RPC function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
