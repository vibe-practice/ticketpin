import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

/**
 * GET /api/mypage/gifts
 *
 * 선물 내역 조회 (보낸/받은).
 *
 * 쿼리 파라미터:
 * - type ("sent" | "received", required)
 * - page (number, default: 1)
 * - limit (number, default: 5, max: 50)
 * - date_from (ISO 8601, optional)
 * - date_to (ISO 8601, optional)
 * - search (string, optional — 상대방 아이디/이름 검색)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;
    const { searchParams } = request.nextUrl;

    // ── 타입 파라미터 (필수) ──
    const type = searchParams.get("type");
    if (type !== "sent" && type !== "received") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "type은 'sent' 또는 'received'여야 합니다." },
        },
        { status: 400 }
      );
    }

    // ── 페이징 파라미터 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const search = searchParams.get("search")?.trim().toLowerCase();

    // ── 선물 목록 쿼리 ──
    // 보낸 선물: sender_id = userId, 받은 선물: receiver_id = userId
    const filterColumn = type === "sent" ? "sender_id" : "receiver_id";

    let query = adminClient
      .from("gifts")
      .select(
        `id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, created_at,
         sender:sender_id (id, username, name),
         receiver:receiver_id (id, username, name),
         product:product_id (id, name, price, image_url)`,
        { count: "exact" }
      )
      .eq(filterColumn, userId)
      .order("created_at", { ascending: false });

    // 기간 필터
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      const toDate = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", toDate);
    }

    // 검색: 상대방 username/name으로 DB 레벨 필터링
    if (search) {
      const escapedSearch = search.replace(/[%_]/g, "\\$&");
      const targetColumn = type === "sent" ? "receiver_id" : "sender_id";
      const { data: matchedUsers } = await adminClient
        .from("users")
        .select("id")
        .or(`username.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`);

      if (matchedUsers && matchedUsers.length > 0) {
        const ids = matchedUsers.map((u) => (u as Record<string, unknown>).id as string);
        query = query.in(targetColumn, ids);
      } else {
        return NextResponse.json({
          success: true,
          data: { items: [], total: 0, page, limit, total_pages: 0 },
        });
      }
    }

    // 페이징
    query = query.range(from, to);

    const { data: gifts, count: rawCount, error: giftsError } = await query;

    if (giftsError) {
      console.error("[GET /api/mypage/gifts] Query error:", giftsError.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "선물 내역 조회 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    if (!gifts || gifts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page,
          limit,
          total_pages: 0,
        },
      });
    }

    // ── 바우처 + 주문 병렬 조회 ──
    const allVoucherIds = new Set<string>();
    for (const g of gifts) {
      const gr = g as Record<string, unknown>;
      if (gr.source_voucher_id) allVoucherIds.add(gr.source_voucher_id as string);
      if (gr.new_voucher_id) allVoucherIds.add(gr.new_voucher_id as string);
    }

    // 바우처 조회 (order_id도 함께 가져옴)
    const { data: vouchersData } = await adminClient
      .from("vouchers")
      .select("id, code, status, order_id")
      .in("id", allVoucherIds.size > 0 ? [...allVoucherIds] : ["__none__"]);

    const voucherMap = new Map<string, { code: string; status: string; order_id: string }>();
    if (vouchersData) {
      for (const v of vouchersData) {
        const vr = v as Record<string, unknown>;
        voucherMap.set(vr.id as string, {
          code: vr.code as string,
          status: vr.status as string,
          order_id: vr.order_id as string,
        });
      }
    }

    // 주문 ID 추출 후 주문 수량 조회
    const orderIds = new Set<string>();
    for (const [, v] of voucherMap) {
      orderIds.add(v.order_id);
    }

    const { data: ordersData } = await adminClient
      .from("orders")
      .select("id, quantity")
      .in("id", orderIds.size > 0 ? [...orderIds] : ["__none__"]);

    const orderQuantityMap = new Map<string, number>();
    if (ordersData) {
      for (const o of ordersData) {
        const or = o as Record<string, unknown>;
        orderQuantityMap.set(or.id as string, or.quantity as number);
      }
    }

    // ── 데이터 매핑 ──
    const items = gifts.map((gift) => {
      const g = gift as Record<string, unknown>;
      const sender = g.sender as Record<string, unknown> | null;
      const receiver = g.receiver as Record<string, unknown> | null;
      const product = g.product as Record<string, unknown> | null;

      const sourceVoucher = voucherMap.get(g.source_voucher_id as string);
      const newVoucher = voucherMap.get(g.new_voucher_id as string);

      // source_voucher의 order_id를 통해 quantity 조회
      const orderQuantity = sourceVoucher
        ? orderQuantityMap.get(sourceVoucher.order_id) ?? 1
        : 1;

      return {
        id: g.id,
        sender_id: g.sender_id,
        receiver_id: g.receiver_id,
        source_voucher_id: g.source_voucher_id,
        new_voucher_id: g.new_voucher_id,
        product_id: g.product_id,
        created_at: g.created_at,
        sender: sender
          ? { id: sender.id, username: sender.username, name: sender.name }
          : { id: g.sender_id, username: "unknown", name: "알 수 없음" },
        receiver: receiver
          ? { id: receiver.id, username: receiver.username, name: receiver.name }
          : { id: g.receiver_id, username: "unknown", name: "알 수 없음" },
        product: product
          ? { id: product.id, name: product.name, price: product.price, image_url: product.image_url }
          : { id: g.product_id, name: "알 수 없는 상품", price: 0, image_url: null },
        voucher_code: newVoucher?.code ?? "",
        source_voucher_code: sourceVoucher?.code ?? "",
        order_quantity: orderQuantity,
        new_voucher_status: newVoucher?.status ?? "issued",
      };
    });

    const total = rawCount ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/mypage/gifts] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
