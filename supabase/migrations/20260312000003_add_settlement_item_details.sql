-- settlement_gift_items에 선물 시점 + 주문/구매자 정보 컬럼 추가
ALTER TABLE settlement_gift_items ADD COLUMN IF NOT EXISTS gift_created_at timestamptz;
ALTER TABLE settlement_gift_items ADD COLUMN IF NOT EXISTS order_number varchar(50);
ALTER TABLE settlement_gift_items ADD COLUMN IF NOT EXISTS original_buyer_name varchar(100);
ALTER TABLE settlement_gift_items ADD COLUMN IF NOT EXISTS original_buyer_phone varchar(20);
ALTER TABLE settlement_gift_items ADD COLUMN IF NOT EXISTS payment_method varchar(50);
