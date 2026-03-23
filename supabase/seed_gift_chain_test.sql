-- ============================================================
-- 선물 체인 5단계 테스트 시드 데이터
-- 체인: UserA → UserB → UserC → UserD → UserE → UserF
--
-- 정리: seed_gift_chain_cleanup.sql 실행
-- ============================================================

-- ============================================================
-- 1. 테스트 유저 6명 (auth_id는 테스트용 더미)
-- ============================================================
INSERT INTO users (id, auth_id, username, email, name, phone, identity_verified, status) VALUES
  ('ee000000-0000-0000-0000-00000000000a', 'aa000000-0000-0000-0000-00000000000a', 'chain_user_a', 'chain_a@test.com', '체인유저A', 'enc:010-1111-0001', true, 'active'),
  ('ee000000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000b', 'chain_user_b', 'chain_b@test.com', '체인유저B', 'enc:010-1111-0002', true, 'active'),
  ('ee000000-0000-0000-0000-00000000000c', 'aa000000-0000-0000-0000-00000000000c', 'chain_user_c', 'chain_c@test.com', '체인유저C', 'enc:010-1111-0003', true, 'active'),
  ('ee000000-0000-0000-0000-00000000000d', 'aa000000-0000-0000-0000-00000000000d', 'chain_user_d', 'chain_d@test.com', '체인유저D', 'enc:010-1111-0004', true, 'active'),
  ('ee000000-0000-0000-0000-00000000000e', 'aa000000-0000-0000-0000-00000000000e', 'chain_user_e', 'chain_e@test.com', '체인유저E', 'enc:010-1111-0005', true, 'active'),
  ('ee000000-0000-0000-0000-00000000000f', 'aa000000-0000-0000-0000-00000000000f', 'chain_user_f', 'chain_f@test.com', '체인유저F', 'enc:010-1111-0006', true, 'active');

-- ============================================================
-- 2. 주문 1건 (UserA가 컬쳐랜드 1만원권 1매 구매)
-- ============================================================
INSERT INTO orders (id, order_number, user_id, product_id, quantity, product_price, fee_type, fee_amount, total_amount, payment_method, receiver_phone, status) VALUES
  ('ee000000-0000-0000-0001-000000000001', 'ORD-CHAIN-TEST-001', 'ee000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 1, 10000, 'included', 500, 10000, 'card', 'enc:010-1111-0001', 'gifted');

-- ============================================================
-- 3. 바우처 6개 (원본 1개 + 선물로 생성된 5개)
--    체인: V1(A) → V2(B) → V3(C) → V4(D) → V5(E) → V6(F)
-- ============================================================

-- V1: 원본 바우처 (UserA 구매, 이후 UserB에게 선물 → gifted 상태)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000001',
   'chain-v1-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000a',
   'gifted', false, NULL, NULL, NULL,
   '2026-03-01 10:00:00+09');

-- V2: 선물 #1 (A→B, B가 소유, 이후 C에게 선물 → gifted)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000002',
   'chain-v2-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000b',
   'gifted', true,
   'ee000000-0000-0000-0000-00000000000a',
   '생일 축하해 B야!',
   'ee000000-0000-0000-0002-000000000001',
   '2026-03-02 14:00:00+09');

-- V3: 선물 #2 (B→C, C가 소유, 이후 D에게 선물 → gifted)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000003',
   'chain-v3-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000c',
   'gifted', true,
   'ee000000-0000-0000-0000-00000000000b',
   '고마워 C에게 전달!',
   'ee000000-0000-0000-0002-000000000002',
   '2026-03-03 11:30:00+09');

-- V4: 선물 #3 (C→D, D가 소유, 이후 E에게 선물 → gifted)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000004',
   'chain-v4-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000d',
   'gifted', true,
   'ee000000-0000-0000-0000-00000000000c',
   NULL,
   'ee000000-0000-0000-0002-000000000003',
   '2026-03-04 09:00:00+09');

-- V5: 선물 #4 (D→E, E가 소유, 이후 F에게 선물 → gifted)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000005',
   'chain-v5-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0005',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000e',
   'gifted', true,
   'ee000000-0000-0000-0000-00000000000d',
   'D가 E에게 선물합니다',
   'ee000000-0000-0000-0002-000000000004',
   '2026-03-05 16:45:00+09');

-- V6: 선물 #5 (E→F, F가 최종 소유, password_set 상태 = 아직 사용 가능)
INSERT INTO vouchers (id, code, order_id, owner_id, status, is_gift, gift_sender_id, gift_message, source_voucher_id, created_at) VALUES
  ('ee000000-0000-0000-0002-000000000006',
   'chain-v6-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0006',
   'ee000000-0000-0000-0001-000000000001',
   'ee000000-0000-0000-0000-00000000000f',
   'password_set', true,
   'ee000000-0000-0000-0000-00000000000e',
   '마지막 선물! F에게',
   'ee000000-0000-0000-0002-000000000005',
   '2026-03-06 20:00:00+09');

-- ============================================================
-- 4. 핀 1개 (바우처에 연결, 현재 최종 바우처 V6에 할당)
-- ============================================================
INSERT INTO pins (id, product_id, pin_number_encrypted, status, registration_method, voucher_id, assigned_at) VALUES
  ('ee000000-0000-0000-0003-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'enc:TEST-CHAIN-PIN-001',
   'assigned', 'manual',
   'ee000000-0000-0000-0002-000000000006',
   '2026-03-01 10:00:00+09');

-- ============================================================
-- 5. 선물 이력 5건 (gifts 테이블)
-- ============================================================

-- Gift #1: A → B
INSERT INTO gifts (id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, message, created_at) VALUES
  ('ee000000-0000-0000-0004-000000000001',
   'ee000000-0000-0000-0000-00000000000a',
   'ee000000-0000-0000-0000-00000000000b',
   'ee000000-0000-0000-0002-000000000001',
   'ee000000-0000-0000-0002-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   '생일 축하해 B야!',
   '2026-03-02 14:00:00+09');

-- Gift #2: B → C
INSERT INTO gifts (id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, message, created_at) VALUES
  ('ee000000-0000-0000-0004-000000000002',
   'ee000000-0000-0000-0000-00000000000b',
   'ee000000-0000-0000-0000-00000000000c',
   'ee000000-0000-0000-0002-000000000002',
   'ee000000-0000-0000-0002-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   '고마워 C에게 전달!',
   '2026-03-03 11:30:00+09');

-- Gift #3: C → D
INSERT INTO gifts (id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, message, created_at) VALUES
  ('ee000000-0000-0000-0004-000000000003',
   'ee000000-0000-0000-0000-00000000000c',
   'ee000000-0000-0000-0000-00000000000d',
   'ee000000-0000-0000-0002-000000000003',
   'ee000000-0000-0000-0002-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   NULL,
   '2026-03-04 09:00:00+09');

-- Gift #4: D → E
INSERT INTO gifts (id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, message, created_at) VALUES
  ('ee000000-0000-0000-0004-000000000004',
   'ee000000-0000-0000-0000-00000000000d',
   'ee000000-0000-0000-0000-00000000000e',
   'ee000000-0000-0000-0002-000000000004',
   'ee000000-0000-0000-0002-000000000005',
   'b0000000-0000-0000-0000-000000000001',
   'D가 E에게 선물합니다',
   '2026-03-05 16:45:00+09');

-- Gift #5: E → F
INSERT INTO gifts (id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, message, created_at) VALUES
  ('ee000000-0000-0000-0004-000000000005',
   'ee000000-0000-0000-0000-00000000000e',
   'ee000000-0000-0000-0000-00000000000f',
   'ee000000-0000-0000-0002-000000000005',
   'ee000000-0000-0000-0002-000000000006',
   'b0000000-0000-0000-0000-000000000001',
   '마지막 선물! F에게',
   '2026-03-06 20:00:00+09');

-- ============================================================
-- 완료! 선물 체인 추적 테스트:
-- GET /api/admin/gifts/ee000000-0000-0000-0004-000000000001/chain  (Gift #1 기준)
-- GET /api/admin/gifts/ee000000-0000-0000-0004-000000000003/chain  (Gift #3 기준, 중간)
-- GET /api/admin/gifts/ee000000-0000-0000-0004-000000000005/chain  (Gift #5 기준, 마지막)
-- 모두 동일한 6노드 체인이 반환되어야 합니다.
-- ============================================================
