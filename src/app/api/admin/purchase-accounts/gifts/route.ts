import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { escapeIlike } from "@/lib/admin/utils";


/**
 * GET /api/admin/purchase-accounts/gifts
 *
 * 전체 매입 내역 조회 (아이디 필터, 날짜 범위, 검색, 페이징)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const accountId = searchParams.get("account_id") ?? "";
    const search = searchParams.get("search")?.trim() ?? "";

    // 전체 매입 아이디의 user_id 목록 조회
    let purchaseUserIds: string[] = [];
    let accountUserMap = new Map<string, string>(); // user_id -> account_name

    if (accountId) {
      const { data: account } = await adminClient
        .from("purchase_accounts")
        .select("user_id, account_name")
        .eq("id", accountId)
        .single();
      if (!account) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "매입 아이디를 찾을 수 없습니다." } },
          { status: 404 },
        );
      }
      purchaseUserIds = [account.user_id];
      accountUserMap.set(account.user_id, account.account_name);
    } else {
      const { data: accounts } = await adminClient
        .from("purchase_accounts")
        .select("user_id, account_name");
      purchaseUserIds = (accounts ?? []).map((a) => a.user_id);
      accountUserMap = new Map((accounts ?? []).map((a) => [a.user_id, a.account_name]));
    }

    if (purchaseUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { data: [], total: 0, page, per_page: limit, total_pages: 0 },
      });
    }

    // 검색어가 있으면 sender_id 필터링 먼저
    let senderIdFilter: string[] | null = null;
    if (search) {
      const escaped = escapeIlike(search);
      const { data: matchedSenders } = await adminClient
        .from("users")
        .select("id")
        .or(`username.ilike.%${escaped}%,name.ilike.%${escaped}%`)
        .limit(200);
      senderIdFilter = (matchedSenders ?? []).map((s) => s.id);
      if (senderIdFilter.length === 0) {
        return NextResponse.json({
          success: true,
          data: { data: [], total: 0, page, per_page: limit, total_pages: 0 },
        });
      }
    }

    // gifts 조회
    let giftsQuery = adminClient
      .from("gifts")
      .select("*", { count: "exact" })
      .in("receiver_id", purchaseUserIds)
      .order("created_at", { ascending: false });

    if (dateFrom) giftsQuery = giftsQuery.gte("created_at", `${dateFrom}T00:00:00+09:00`);
    if (dateTo) giftsQuery = giftsQuery.lte("created_at", `${dateTo}T23:59:59+09:00`);
    if (senderIdFilter) giftsQuery = giftsQuery.in("sender_id", senderIdFilter);

    giftsQuery = giftsQuery.range(from, to);

    const { data: gifts, error: giftsError, count } = await giftsQuery;

    if (giftsError) {
      console.error("[GET purchase-accounts/gifts] Query error:", giftsError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "매입 내역 조회에 실패했습니다." } },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const giftList = gifts ?? [];

    if (giftList.length === 0) {
      return NextResponse.json({
        success: true,
        data: { data: [], total, page, per_page: limit, total_pages: Math.ceil(total / limit) },
      });
    }

    // sender 정보 벌크 조회
    const senderIds = [...new Set(giftList.map((g) => g.sender_id))];
    const { data: senders } = await adminClient
      .from("users")
      .select("id, username, name, phone")
      .in("id", senderIds);
    const senderMap = new Map((senders ?? []).map((s) => [s.id, s]));

    // source_voucher → order → product 벌크 조회
    const sourceVoucherIds = giftList.map((g) => g.source_voucher_id).filter(Boolean);
    const { data: vouchers } = await adminClient
      .from("vouchers")
      .select("id, order_id, status")
      .in("id", sourceVoucherIds);
    const voucherOrderMap = new Map((vouchers ?? []).map((v) => [v.id, v.order_id]));
    const voucherStatusMap = new Map((vouchers ?? []).map((v) => [v.id, v.status as string]));

    const orderIds = [...new Set((vouchers ?? []).map((v) => v.order_id).filter(Boolean))];
    const { data: orders } = await adminClient
      .from("orders")
      .select("id, product_id, quantity, product_price, total_amount, fee_type, fee_amount, card_company_name, installment_months, status")
      .in("id", orderIds);
    const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

    const productIds = [...new Set((orders ?? []).map((o) => o.product_id).filter(Boolean))];
    const { data: products } = await adminClient
      .from("products")
      .select("id, name")
      .in("id", productIds);
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    // receiver_id -> username 조회
    const receiverIds = [...new Set(giftList.map((g) => g.receiver_id))];
    const { data: receivers } = await adminClient
      .from("users")
      .select("id, username")
      .in("id", receiverIds);
    const receiverMap = new Map((receivers ?? []).map((r) => [r.id, r.username]));

    // 결과 조합
    const result = giftList.map((g) => {
      const sender = senderMap.get(g.sender_id);
      const orderId = voucherOrderMap.get(g.source_voucher_id);
      const order = orderId ? orderMap.get(orderId) : null;
      const product = order?.product_id ? productMap.get(order.product_id) : null;

      return {
        gift_id: g.id,
        order_id: orderId ?? null,
        account_name: accountUserMap.get(g.receiver_id) ?? "",
        account_username: receiverMap.get(g.receiver_id) ?? "",
        sender_username: sender?.username ?? "",
        sender_name: sender?.name ?? "",
        sender_phone: sender?.phone ?? "",
        product_name: product?.name ?? "알 수 없음",
        product_price: order?.product_price ?? 0,
        quantity: order?.quantity ?? 0,
        total_amount: order?.total_amount ?? 0,
        fee_type: order?.fee_type ?? "included",
        fee_amount: order?.fee_amount ?? 0,
        card_company_name: order?.card_company_name ?? null,
        installment_months: order?.installment_months ?? null,
        pin_recycled: g.auto_recycled ?? false,
        order_status: order?.status ?? null,
        voucher_status: voucherStatusMap.get(g.source_voucher_id) ?? null,
        created_at: g.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: result,
        total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/purchase-accounts/gifts] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
