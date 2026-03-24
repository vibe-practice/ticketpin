import { createAdminClient } from "./admin";
import type { Category, Product, ProductWithCategory, VoucherWithDetails } from "@/types";

/** Supabase 관계 조회 raw 결과 타입 (categories가 배열로 추론됨, 런타임에서는 단일 객체) */
type CategoryJoin = Pick<Category, "id" | "name" | "slug" | "icon">;
interface ProductRowRaw {
  id: string;
  category_id: string;
  name: string;
  price: number;
  fee_rate: number;
  fee_unit: string;
  image_url: string | null;
  description: string | null;
  status: string;
  total_sales: number;
  popular_rank: number | null;
  created_at: string;
  updated_at: string;
  categories: CategoryJoin | CategoryJoin[];
}

// ============================================================
// Categories
// ============================================================

/**
 * 노출 중인(is_visible=true) 카테고리 목록을 sort_order 기준으로 조회
 * RLS 정책: is_visible=true 인 항목만 반환
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, subtitle, slug, icon, image_url, is_visible, sort_order, created_at")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getCategories] Supabase error:", error.message);
    return [];
  }

  return data as Category[];
}

/**
 * slug로 단일 카테고리 조회
 */
export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, subtitle, slug, icon, image_url, is_visible, sort_order, created_at")
    .eq("slug", slug)
    .single();

  if (error) {
    // PGRST116 = row not found (정상적인 not found 상황)
    if (error.code !== "PGRST116") {
      console.error("[getCategoryBySlug] Supabase error:", error.message);
    }
    return null;
  }

  return data as Category;
}

// ============================================================
// Products
// ============================================================

/**
 * Product row를 ProductWithCategory 형태로 변환
 * Supabase의 관계 조회 결과를 프론트 타입에 맞게 매핑
 */
function mapProductWithCategory(
  row: ProductRowRaw,
): ProductWithCategory {
  const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    price: row.price,
    fee_rate: row.fee_rate,
    fee_unit: row.fee_unit as Product["fee_unit"],
    image_url: row.image_url,
    description: row.description,
    status: row.status as Product["status"],
    total_sales: row.total_sales,
    popular_rank: row.popular_rank,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
    },
  };
}

/** 공통 select 절 (products + categories JOIN) */
const PRODUCT_WITH_CATEGORY_SELECT =
  "id, category_id, name, price, fee_rate, fee_unit, image_url, description, status, total_sales, popular_rank, created_at, updated_at, categories(id, name, slug, icon)";

/**
 * 활성(active) 상품 전체 조회 (카테고리 정보 포함)
 */
export async function getAllProducts(): Promise<ProductWithCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_WITH_CATEGORY_SELECT)
    .in("status", ["active", "soldout"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getAllProducts] Supabase error:", error.message);
    return [];
  }

  return (data as ProductRowRaw[]).map(mapProductWithCategory);
}

/**
 * 카테고리별 상품 조회 (활성 상품만)
 */
export async function getProductsByCategory(
  categoryId: string,
): Promise<ProductWithCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_WITH_CATEGORY_SELECT)
    .eq("category_id", categoryId)
    .in("status", ["active", "soldout"])
    .order("price", { ascending: true });

  if (error) {
    console.error("[getProductsByCategory] Supabase error:", error.message);
    return [];
  }

  return (data as ProductRowRaw[]).map(mapProductWithCategory);
}

/**
 * 인기 상품 조회 (관리자가 지정한 popular_rank 순서, 활성 상품만)
 */
export async function getPopularProducts(
  limit = 5,
): Promise<ProductWithCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_WITH_CATEGORY_SELECT)
    .not("popular_rank", "is", null)
    .in("status", ["active", "soldout"])
    .order("popular_rank", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[getPopularProducts] Supabase error:", error.message);
    return [];
  }

  return (data as ProductRowRaw[]).map(mapProductWithCategory);
}

/**
 * ID로 단일 상품 조회 (품절 상품 포함)
 * ISR 재검증 시에도 동작하도록 admin 클라이언트 사용
 */
export async function getProductById(
  id: string,
): Promise<ProductWithCategory | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_WITH_CATEGORY_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[getProductById] Supabase error:", error.message);
    }
    return null;
  }

  return mapProductWithCategory(data as ProductRowRaw);
}

/**
 * 모든 상품 ID 목록 조회 (generateStaticParams용)
 * 빌드 타임에 실행되므로 쿠키 없이 동작하는 admin 클라이언트 사용
 */
export async function getAllProductIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .in("status", ["active", "soldout"]);

  if (error) {
    console.error("[getAllProductIds] Supabase error:", error.message);
    return [];
  }

  return data.map((row) => row.id);
}

/**
 * 모든 카테고리 slug 목록 조회 (generateStaticParams용)
 * 빌드 타임에 실행되므로 쿠키 없이 동작하는 admin 클라이언트 사용
 */
export async function getAllCategorySlugs(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug");

  if (error) {
    console.error("[getAllCategorySlugs] Supabase error:", error.message);
    return [];
  }

  return data.map((row) => row.slug);
}

// ============================================================
// Vouchers
// ============================================================

/** 바우처 API 응답에 포함되는 sender/receiver 정보 */
interface VoucherSenderInfo {
  username: string;
  name: string;
}

/** getVoucherByCode 반환 타입 (VoucherWithDetails + pin_count + sender + receiver) */
export interface VoucherQueryResult extends VoucherWithDetails {
  pin_count: number;
  sender: VoucherSenderInfo | null;
  /** 선물 수신자 (원본 바우처에서 gifted 상태일 때 사용) */
  receiver: VoucherSenderInfo | null;
}

/**
 * 바우처 코드로 상세 정보 조회 (서버 컴포넌트용)
 * - adminClient 사용 (인증 불필요, SMS 링크 접근)
 * - 주문/상품/소유자/핀 개수/선물 보낸 사람 정보 포함
 */
export async function getVoucherByCode(code: string): Promise<VoucherQueryResult | null> {
  const adminClient = createAdminClient();

  // ── 바우처 조회 ──
  const { data: voucher, error: voucherError } = await adminClient
    .from("vouchers")
    .select(
      `
      id,
      code,
      order_id,
      owner_id,
      temp_password_expires_at,
      temp_password_attempts,
      reissue_count,
      user_password_hash,
      user_password_attempts,
      is_password_locked,
      fee_paid,
      fee_pg_transaction_id,
      pin_revealed_at,
      is_gift,
      gift_sender_id,
      source_voucher_id,
      status,
      created_at,
      updated_at,
      orders!inner (
        id,
        order_number,
        quantity,
        product_price,
        fee_type,
        fee_amount,
        total_amount,
        product_id,
        created_at
      )
    `
    )
    .eq("code", code)
    .single();

  if (voucherError || !voucher) {
    if (voucherError?.code !== "PGRST116") {
      console.error("[getVoucherByCode] Supabase error:", voucherError?.message);
    }
    return null;
  }

  // orders는 !inner로 단일 객체
  const order = voucher.orders as unknown as Record<string, unknown>;
  const productId = order.product_id as string | null;

  // ── 상품 정보 조회 ──
  let product: Record<string, unknown> | null = null;
  if (productId) {
    const { data: productData } = await adminClient
      .from("products")
      .select("id, name, price, fee_rate, fee_unit, image_url")
      .eq("id", productId)
      .single();
    product = productData as Record<string, unknown> | null;
  }

  // ── 소유자 정보 조회 ──
  const { data: owner } = await adminClient
    .from("users")
    .select("id, username, name")
    .eq("id", voucher.owner_id)
    .single();

  // ── 핀 개수 조회 ──
  const { count: pinCount } = await adminClient
    .from("pins")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", voucher.id);

  // ── 선물 보낸 사람 / 받은 사람 정보 ──
  let sender: VoucherSenderInfo | null = null;
  let receiver: VoucherSenderInfo | null = null;

  if (voucher.is_gift && voucher.gift_sender_id) {
    // 새 바우처 (선물받은 바우처): gift_sender_id로 sender 조회
    const { data: senderData } = await adminClient
      .from("users")
      .select("username, name")
      .eq("id", voucher.gift_sender_id)
      .single();
    if (senderData) {
      sender = senderData;
    }
  } else if (voucher.status === "gifted" && !voucher.is_gift) {
    // 원본 바우처 (선물한 바우처): gifts 테이블에서 sender/receiver 조회
    const { data: giftRecord } = await adminClient
      .from("gifts")
      .select("sender_id, receiver_id")
      .eq("source_voucher_id", voucher.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (giftRecord) {
      const [senderResult, receiverResult] = await Promise.all([
        adminClient
          .from("users")
          .select("username, name")
          .eq("id", giftRecord.sender_id)
          .single(),
        adminClient
          .from("users")
          .select("username, name")
          .eq("id", giftRecord.receiver_id)
          .single(),
      ]);
      if (senderResult.data) sender = senderResult.data;
      if (receiverResult.data) receiver = receiverResult.data;
    }
  }

  // user_password_hash 존재 여부만 반환 (해시값 노출 금지)
  const hasUserPassword = !!voucher.user_password_hash;

  return {
    id: voucher.id,
    code: voucher.code,
    order_id: voucher.order_id,
    pin_ids: [], // 서버 페이지에서는 pin_ids 불필요 (pin_count로 대체)
    owner_id: voucher.owner_id,
    temp_password_hash: null, // 해시값 노출 금지
    temp_password_expires_at: voucher.temp_password_expires_at,
    temp_password_attempts: voucher.temp_password_attempts,
    reissue_count: voucher.reissue_count,
    user_password_hash: hasUserPassword ? "[REDACTED]" : null,
    user_password_attempts: voucher.user_password_attempts,
    is_password_locked: voucher.is_password_locked,
    fee_paid: voucher.fee_paid,
    fee_pg_transaction_id: voucher.fee_pg_transaction_id,
    pin_revealed_at: voucher.pin_revealed_at,
    is_gift: voucher.is_gift,
    gift_sender_id: voucher.gift_sender_id,
    source_voucher_id: voucher.source_voucher_id,
    status: voucher.status as VoucherWithDetails["status"],
    created_at: voucher.created_at,
    updated_at: voucher.updated_at,
    order: {
      id: order.id as string,
      order_number: order.order_number as string,
      quantity: order.quantity as number,
      product_price: order.product_price as number,
      fee_type: order.fee_type as string,
      fee_amount: order.fee_amount as number,
      total_amount: order.total_amount as number,
      created_at: order.created_at as string,
    } as VoucherWithDetails["order"],
    product: product
      ? (product as NonNullable<VoucherWithDetails["product"]>)
      : null,
    owner: owner
      ? (owner as VoucherWithDetails["owner"])
      : { id: voucher.owner_id, username: "unknown", name: "알 수 없음" },
    pin_count: pinCount ?? 0,
    sender,
    receiver,
  };
}
