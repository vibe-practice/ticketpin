import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";
import { ACTIVE_VOUCHER_STATUSES } from "@/lib/voucher-status";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

/**
 * GET /api/mypage/vouchers
 *
 * 내 상품권 목록 조회 (서버사이드 필터/페이징).
 *
 * 쿼리 파라미터:
 * - page (number, default: 1)
 * - limit (number, default: 5, max: 50)
 * - status ("all" | "active" | "cancelled", default: "all")
 * - date_from (ISO 8601, optional)
 * - date_to (ISO 8601, optional)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;
    const { searchParams } = request.nextUrl;

    // ── 페이징 파라미터 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const statusFilter = searchParams.get("status") ?? "all";
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    // ── 바우처 목록 쿼리 (단순 쿼리 — 중첩 JOIN 없음) ──
    let query = adminClient
      .from("vouchers")
      .select(
        `id, code, order_id, owner_id, status, is_gift, gift_sender_id,
         pin_revealed_at, temp_password_expires_at, created_at`,
        { count: "exact" }
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    // 상태 필터
    if (statusFilter === "active") {
      query = query.in("status", ACTIVE_VOUCHER_STATUSES);
    } else if (statusFilter === "cancelled") {
      query = query.eq("status", "cancelled");
    }

    // 기간 필터
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      const toDate = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", toDate);
    }

    // 페이징
    query = query.range(from, to);

    const { data: vouchers, count, error: vouchersError } = await query;

    if (vouchersError || !vouchers) {
      console.error("[GET /api/mypage/vouchers] Query error:", vouchersError?.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "상품권 목록 조회 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    if (vouchers.length === 0) {
      const tabCounts = await getTabCounts(adminClient, userId);
      const emptyTotal = count ?? 0;
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: emptyTotal,
          page,
          limit,
          total_pages: Math.ceil(emptyTotal / limit),
          tab_counts: tabCounts,
        },
      });
    }

    // ── 1단계: 바우처 결과에서 필요한 ID 추출 ──
    const orderIds = [...new Set(vouchers.map((v) => (v as Record<string, unknown>).order_id as string))];
    const voucherIds = vouchers.map((v) => (v as Record<string, unknown>).id as string);
    const giftSenderIds = vouchers
      .map((v) => (v as Record<string, unknown>).gift_sender_id as string | null)
      .filter((id): id is string => id !== null);
    const uniqueSenderIds = [...new Set(giftSenderIds)];

    // ── 2단계: 주문 + 핀 + 선물 보낸 사람 + 탭 건수를 병렬 조회 ──
    const [ordersResult, pinResult, sendersResult, tabCounts] = await Promise.all([
      adminClient
        .from("orders")
        .select("id, order_number, quantity, total_amount, product_id")
        .in("id", orderIds.length > 0 ? orderIds : ["__none__"]),
      adminClient
        .from("pins")
        .select("voucher_id")
        .in("voucher_id", voucherIds.length > 0 ? voucherIds : ["__none__"]),
      uniqueSenderIds.length > 0
        ? adminClient.from("users").select("id, username").in("id", uniqueSenderIds)
        : Promise.resolve({ data: null, error: null }),
      getTabCounts(adminClient, userId),
    ]);

    // 주문 매핑 + product_id 추출
    const orderMap = new Map<string, Record<string, unknown>>();
    const productIds = new Set<string>();
    if (ordersResult.data) {
      for (const o of ordersResult.data) {
        const oRecord = o as Record<string, unknown>;
        orderMap.set(oRecord.id as string, oRecord);
        if (oRecord.product_id) productIds.add(oRecord.product_id as string);
      }
    }

    // ── 3단계: 상품 조회 (주문 결과에 의존) ──
    const { data: productsData } = await adminClient
      .from("products")
      .select("id, name, price, image_url")
      .in("id", productIds.size > 0 ? [...productIds] : ["__none__"]);

    const productMap = new Map<string, Record<string, unknown>>();
    if (productsData) {
      for (const p of productsData) {
        const pRecord = p as Record<string, unknown>;
        productMap.set(pRecord.id as string, pRecord);
      }
    }

    // 핀 개수 매핑
    if (pinResult.error) {
      console.error("[GET /api/mypage/vouchers] Pin count error:", pinResult.error.message);
    }
    const pinCountMap = new Map<string, number>();
    if (pinResult.data) {
      for (const pin of pinResult.data) {
        const vId = (pin as Record<string, unknown>).voucher_id as string;
        pinCountMap.set(vId, (pinCountMap.get(vId) ?? 0) + 1);
      }
    }

    // 선물 보낸 사람 매핑
    let senderUsernameMap = new Map<string, string>();
    if (sendersResult.data) {
      senderUsernameMap = new Map(
        sendersResult.data.map((s) => {
          const sr = s as Record<string, unknown>;
          return [sr.id as string, sr.username as string];
        })
      );
    }

    // ── 응답 데이터 매핑 ──
    const items = vouchers.map((voucher) => {
      const v = voucher as Record<string, unknown>;
      const vId = v.id as string;
      const order = orderMap.get(v.order_id as string);
      const product = order ? productMap.get(order.product_id as string) : null;

      return {
        id: vId,
        code: v.code,
        status: v.status,
        is_gift: v.is_gift ?? false,
        gift_sender_username: v.gift_sender_id
          ? senderUsernameMap.get(v.gift_sender_id as string) ?? null
          : null,
        pin_count: pinCountMap.get(vId) ?? 0,
        pin_revealed_at: v.pin_revealed_at,
        temp_password_expires_at: v.temp_password_expires_at ?? null,
        created_at: v.created_at,
        order: order
          ? {
              id: order.id,
              order_number: order.order_number,
              quantity: order.quantity,
              total_amount: order.total_amount,
            }
          : null,
        product: product
          ? {
              id: product.id,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
            }
          : null,
      };
    });

    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        tab_counts: tabCounts,
      },
    });
  } catch (error) {
    console.error("[GET /api/mypage/vouchers] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

/**
 * 탭별 건수 조회 (all, active, cancelled)
 */
async function getTabCounts(
  adminClient: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  userId: string
) {
  const [allResult, activeResult, cancelledResult] = await Promise.all([
    adminClient
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
    adminClient
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .in("status", ACTIVE_VOUCHER_STATUSES),
    adminClient
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "cancelled"),
  ]);

  return {
    all: allResult.count ?? 0,
    active: activeResult.count ?? 0,
    cancelled: cancelledResult.count ?? 0,
  };
}
