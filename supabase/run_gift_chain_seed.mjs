/**
 * 선물 체인 테스트 데이터 삽입/삭제 스크립트
 *
 * 사용법:
 *   node supabase/run_gift_chain_seed.mjs insert   # 삽입
 *   node supabase/run_gift_chain_seed.mjs cleanup   # 삭제
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local 간단 파싱
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const [k, ...v] = l.split("=");
    return [k.trim(), v.join("=").trim()];
  })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const PRODUCT_ID = "b0000000-0000-0000-0000-000000000001"; // 컬쳐랜드 1만원권

const USERS = [
  { id: "ee000000-0000-0000-0000-00000000000a", auth_id: "aa000000-0000-0000-0000-00000000000a", username: "chain_user_a", email: "chain_a@test.com", name: "체인유저A", phone: "enc:010-1111-0001" },
  { id: "ee000000-0000-0000-0000-00000000000b", auth_id: "aa000000-0000-0000-0000-00000000000b", username: "chain_user_b", email: "chain_b@test.com", name: "체인유저B", phone: "enc:010-1111-0002" },
  { id: "ee000000-0000-0000-0000-00000000000c", auth_id: "aa000000-0000-0000-0000-00000000000c", username: "chain_user_c", email: "chain_c@test.com", name: "체인유저C", phone: "enc:010-1111-0003" },
  { id: "ee000000-0000-0000-0000-00000000000d", auth_id: "aa000000-0000-0000-0000-00000000000d", username: "chain_user_d", email: "chain_d@test.com", name: "체인유저D", phone: "enc:010-1111-0004" },
  { id: "ee000000-0000-0000-0000-00000000000e", auth_id: "aa000000-0000-0000-0000-00000000000e", username: "chain_user_e", email: "chain_e@test.com", name: "체인유저E", phone: "enc:010-1111-0005" },
  { id: "ee000000-0000-0000-0000-00000000000f", auth_id: "aa000000-0000-0000-0000-00000000000f", username: "chain_user_f", email: "chain_f@test.com", name: "체인유저F", phone: "enc:010-1111-0006" },
];

const USER_IDS = USERS.map(u => u.id);

const ORDER = {
  id: "ee000000-0000-0000-0001-000000000001",
  order_number: "ORD-CHAIN-TEST-001",
  user_id: USER_IDS[0],
  product_id: PRODUCT_ID,
  quantity: 1,
  product_price: 10000,
  fee_type: "included",
  fee_amount: 500,
  total_amount: 10000,
  payment_method: "card",
  receiver_phone: "enc:010-1111-0001",
  status: "gifted",
};

// V1~V6 바우처 체인
const VOUCHERS = [
  { id: "ee000000-0000-0000-0002-000000000001", code: "chain-v1-test-0001", order_id: ORDER.id, owner_id: USER_IDS[0], status: "gifted", is_gift: false, gift_sender_id: null, gift_message: null, source_voucher_id: null, created_at: "2026-03-01T10:00:00+09:00" },
  { id: "ee000000-0000-0000-0002-000000000002", code: "chain-v2-test-0002", order_id: ORDER.id, owner_id: USER_IDS[1], status: "gifted", is_gift: true, gift_sender_id: USER_IDS[0], gift_message: "생일 축하해 B야!", source_voucher_id: "ee000000-0000-0000-0002-000000000001", created_at: "2026-03-02T14:00:00+09:00" },
  { id: "ee000000-0000-0000-0002-000000000003", code: "chain-v3-test-0003", order_id: ORDER.id, owner_id: USER_IDS[2], status: "gifted", is_gift: true, gift_sender_id: USER_IDS[1], gift_message: "고마워 C에게 전달!", source_voucher_id: "ee000000-0000-0000-0002-000000000002", created_at: "2026-03-03T11:30:00+09:00" },
  { id: "ee000000-0000-0000-0002-000000000004", code: "chain-v4-test-0004", order_id: ORDER.id, owner_id: USER_IDS[3], status: "gifted", is_gift: true, gift_sender_id: USER_IDS[2], gift_message: null, source_voucher_id: "ee000000-0000-0000-0002-000000000003", created_at: "2026-03-04T09:00:00+09:00" },
  { id: "ee000000-0000-0000-0002-000000000005", code: "chain-v5-test-0005", order_id: ORDER.id, owner_id: USER_IDS[4], status: "gifted", is_gift: true, gift_sender_id: USER_IDS[3], gift_message: "D가 E에게 선물합니다", source_voucher_id: "ee000000-0000-0000-0002-000000000004", created_at: "2026-03-05T16:45:00+09:00" },
  { id: "ee000000-0000-0000-0002-000000000006", code: "chain-v6-test-0006", order_id: ORDER.id, owner_id: USER_IDS[5], status: "password_set", is_gift: true, gift_sender_id: USER_IDS[4], gift_message: "마지막 선물! F에게", source_voucher_id: "ee000000-0000-0000-0002-000000000005", created_at: "2026-03-06T20:00:00+09:00" },
];

const PIN = {
  id: "ee000000-0000-0000-0003-000000000001",
  product_id: PRODUCT_ID,
  pin_number_encrypted: "enc:TEST-CHAIN-PIN-001",
  status: "assigned",
  registration_method: "manual",
  voucher_id: VOUCHERS[5].id,
  assigned_at: "2026-03-01T10:00:00+09:00",
};

const GIFTS = [
  { id: "ee000000-0000-0000-0004-000000000001", sender_id: USER_IDS[0], receiver_id: USER_IDS[1], source_voucher_id: VOUCHERS[0].id, new_voucher_id: VOUCHERS[1].id, product_id: PRODUCT_ID, message: "생일 축하해 B야!", created_at: "2026-03-02T14:00:00+09:00" },
  { id: "ee000000-0000-0000-0004-000000000002", sender_id: USER_IDS[1], receiver_id: USER_IDS[2], source_voucher_id: VOUCHERS[1].id, new_voucher_id: VOUCHERS[2].id, product_id: PRODUCT_ID, message: "고마워 C에게 전달!", created_at: "2026-03-03T11:30:00+09:00" },
  { id: "ee000000-0000-0000-0004-000000000003", sender_id: USER_IDS[2], receiver_id: USER_IDS[3], source_voucher_id: VOUCHERS[2].id, new_voucher_id: VOUCHERS[3].id, product_id: PRODUCT_ID, message: null, created_at: "2026-03-04T09:00:00+09:00" },
  { id: "ee000000-0000-0000-0004-000000000004", sender_id: USER_IDS[3], receiver_id: USER_IDS[4], source_voucher_id: VOUCHERS[3].id, new_voucher_id: VOUCHERS[4].id, product_id: PRODUCT_ID, message: "D가 E에게 선물합니다", created_at: "2026-03-05T16:45:00+09:00" },
  { id: "ee000000-0000-0000-0004-000000000005", sender_id: USER_IDS[4], receiver_id: USER_IDS[5], source_voucher_id: VOUCHERS[4].id, new_voucher_id: VOUCHERS[5].id, product_id: PRODUCT_ID, message: "마지막 선물! F에게", created_at: "2026-03-06T20:00:00+09:00" },
];

async function insert() {
  console.log("🔨 선물 체인 테스트 데이터 삽입 시작...\n");

  // 1. Users
  const { error: e1 } = await supabase.from("users").insert(USERS.map(u => ({ ...u, identity_verified: true, status: "active" })));
  if (e1) { console.error("❌ users 삽입 실패:", e1.message); return; }
  console.log("✅ 유저 6명 삽입 완료");

  // 2. Order
  const { error: e2 } = await supabase.from("orders").insert(ORDER);
  if (e2) { console.error("❌ orders 삽입 실패:", e2.message); return; }
  console.log("✅ 주문 1건 삽입 완료");

  // 3. Vouchers (순서대로 삽입 - source_voucher_id 자기참조 때문)
  for (let i = 0; i < VOUCHERS.length; i++) {
    const { error } = await supabase.from("vouchers").insert(VOUCHERS[i]);
    if (error) { console.error(`❌ voucher V${i + 1} 삽입 실패:`, error.message); return; }
  }
  console.log("✅ 바우처 6개 삽입 완료 (V1→V2→V3→V4→V5→V6)");

  // 4. Pin
  const { error: e4 } = await supabase.from("pins").insert(PIN);
  if (e4) { console.error("❌ pins 삽입 실패:", e4.message); return; }
  console.log("✅ 핀 1개 삽입 완료");

  // 5. Gifts
  const { error: e5 } = await supabase.from("gifts").insert(GIFTS);
  if (e5) { console.error("❌ gifts 삽입 실패:", e5.message); return; }
  console.log("✅ 선물 이력 5건 삽입 완료");

  console.log("\n🎉 테스트 데이터 삽입 완료!");
  console.log("\n📋 테스트 API 호출:");
  console.log("  Gift #1 (A→B 시작점): GET /api/admin/gifts/ee000000-0000-0000-0004-000000000001/chain");
  console.log("  Gift #3 (C→D 중간):   GET /api/admin/gifts/ee000000-0000-0000-0004-000000000003/chain");
  console.log("  Gift #5 (E→F 끝):     GET /api/admin/gifts/ee000000-0000-0000-0004-000000000005/chain");
}

async function cleanup() {
  console.log("🧹 선물 체인 테스트 데이터 삭제 시작...\n");

  const giftIds = GIFTS.map(g => g.id);
  const { error: e1 } = await supabase.from("gifts").delete().in("id", giftIds);
  console.log(e1 ? `❌ gifts 삭제 실패: ${e1.message}` : "✅ 선물 이력 5건 삭제");

  const { error: e2 } = await supabase.from("pins").delete().eq("id", PIN.id);
  console.log(e2 ? `❌ pins 삭제 실패: ${e2.message}` : "✅ 핀 1개 삭제");

  // 바우처 역순 삭제 (자기참조 FK)
  for (let i = VOUCHERS.length - 1; i >= 0; i--) {
    const { error } = await supabase.from("vouchers").delete().eq("id", VOUCHERS[i].id);
    if (error) { console.error(`❌ voucher V${i + 1} 삭제 실패:`, error.message); return; }
  }
  console.log("✅ 바우처 6개 삭제");

  const { error: e4 } = await supabase.from("orders").delete().eq("id", ORDER.id);
  console.log(e4 ? `❌ orders 삭제 실패: ${e4.message}` : "✅ 주문 1건 삭제");

  const { error: e5 } = await supabase.from("users").delete().in("id", USER_IDS);
  console.log(e5 ? `❌ users 삭제 실패: ${e5.message}` : "✅ 유저 6명 삭제");

  console.log("\n🧹 정리 완료!");
}

const action = process.argv[2];
if (action === "insert") {
  await insert();
} else if (action === "cleanup") {
  await cleanup();
} else {
  console.log("사용법: node supabase/run_gift_chain_seed.mjs [insert|cleanup]");
}
