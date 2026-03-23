import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";

/**
 * GET /api/admin/businesses/[businessId]/gifts
 *
 * 업체의 매입 내역 (수신 계정으로 받은 선물 목록)
 * JOIN 체인: gifts → vouchers(new_voucher_id) → orders → users (구매자 역추적)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 업체 ID입니다." } },
        { status: 400 }
      );
    }

    // 업체 조회 → receiving_account_id 확인
    const { data: biz, error: bizError } = await adminClient
      .from("businesses")
      .select("id, receiving_account_id")
      .eq("id", businessId)
      .single();

    if (bizError || !biz) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    const recvId = (biz as Record<string, unknown>).receiving_account_id as string | null;
    if (!recvId) {
      return NextResponse.json({
        success: true,
        data: { data: [], total: 0, page: 1, per_page: 50, total_pages: 0 },
      });
    }

    const { searchParams } = request.nextUrl;

    // 페이징
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 날짜 필터
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";

    // gifts 조회 (receiver_id = receiving_account_id)
    let query = adminClient
      .from("gifts")
      .select(
        `id, sender_id, receiver_id, source_voucher_id, new_voucher_id,
         product_id, created_at,
         products(id, name, price, image_url),
         sender:users!gifts_sender_id_fkey(id, username, name, phone),
         receiver:users!gifts_receiver_id_fkey(id, username, name, phone),
         source_voucher:vouchers!gifts_source_voucher_id_fkey(code),
         new_voucher:vouchers!gifts_new_voucher_id_fkey(id, code, status, order_id)`,
        { count: "exact" }
      )
      .eq("receiver_id", recvId);

    // 날짜 필터
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00+09:00`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999+09:00`);
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: giftsRaw, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /api/admin/businesses/:id/gifts] Query error:", queryError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "매입 내역 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    if (!giftsRaw || giftsRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: { data: [], total, page, per_page: limit, total_pages: Math.ceil(total / limit) },
      });
    }

    // 주문 정보 역추적 (new_voucher → order)
    const orderIds = giftsRaw
      .map((g) => {
        const newVoucher = (g as Record<string, unknown>).new_voucher as Record<string, unknown> | null;
        return newVoucher?.order_id as string | null;
      })
      .filter((id): id is string => !!id);

    const orderMap = new Map<string, Record<string, unknown>>();
    if (orderIds.length > 0) {
      const { data: orders } = await adminClient
        .from("orders")
        .select("id, order_number, quantity, total_amount, fee_type, fee_amount, user_id")
        .in("id", orderIds);

      for (const o of orders ?? []) {
        const order = o as Record<string, unknown>;
        orderMap.set(order.id as string, order);
      }

      // 최초 구매자 정보
      const buyerIds = [...new Set((orders ?? []).map((o) => (o as Record<string, unknown>).user_id as string))];
      if (buyerIds.length > 0) {
        const { data: buyers } = await adminClient
          .from("users")
          .select("id, username, name")
          .in("id", buyerIds);

        const buyerMap = new Map<string, Record<string, unknown>>();
        for (const b of buyers ?? []) {
          const buyer = b as Record<string, unknown>;
          buyerMap.set(buyer.id as string, buyer);
        }

        // order에 buyer 정보 병합
        for (const [, order] of orderMap) {
          const buyer = buyerMap.get(order.user_id as string);
          if (buyer) {
            order.buyer_username = buyer.username;
            order.buyer_name = buyer.name;
          }
        }
      }
    }

    // 데이터 매핑
    const items = giftsRaw.map((raw) => {
      const g = raw as Record<string, unknown>;
      const product = g.products as Record<string, unknown> | null;
      const sender = g.sender as Record<string, unknown> | null;
      const receiver = g.receiver as Record<string, unknown> | null;
      const sourceVoucher = g.source_voucher as Record<string, unknown> | null;
      const newVoucher = g.new_voucher as Record<string, unknown> | null;
      const orderId = newVoucher?.order_id as string | null;
      const order = orderId ? orderMap.get(orderId) : undefined;

      return {
        id: g.id as string,
        created_at: g.created_at as string,
        // 상품
        product_name: (product?.name as string) ?? "알 수 없음",
        product_price: (product?.price as number) ?? 0,
        // 발신자
        sender_username: (sender?.username as string) ?? "",
        sender_name: (sender?.name as string) ?? "",
        // 수신자
        receiver_username: (receiver?.username as string) ?? "",
        // 바우처
        source_voucher_code: (sourceVoucher?.code as string) ?? "",
        new_voucher_code: (newVoucher?.code as string) ?? "",
        new_voucher_status: (newVoucher?.status as string) ?? "",
        // 주문 역추적
        order_number: (order?.order_number as string) ?? "",
        order_quantity: (order?.quantity as number) ?? 1,
        total_amount: (order?.total_amount as number) ?? 0,
        fee_type: (order?.fee_type as string) ?? "included",
        fee_amount: (order?.fee_amount as number) ?? 0,
        original_buyer_username: (order?.buyer_username as string) ?? "",
        original_buyer_name: (order?.buyer_name as string) ?? "",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: items,
        total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/businesses/:id/gifts] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
