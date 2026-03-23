import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import type { PurchaseAccountGiftItem } from "@/types";

/**
 * GET /api/admin/purchase-accounts/[accountId]/gifts
 *
 * 매입 아이디의 매입 내역 조회 (결제 정보 포함)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { accountId } = await params;
    if (!UUID_RE.test(accountId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "잘못된 ID 형식입니다." } },
        { status: 400 },
      );
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";

    // purchase_account에서 user_id 조회
    const { data: account } = await adminClient
      .from("purchase_accounts")
      .select("user_id")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "매입 아이디를 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    // gifts 조회 (receiver_id = account.user_id)
    let giftsQuery = adminClient
      .from("gifts")
      .select("*", { count: "exact" })
      .eq("receiver_id", account.user_id)
      .order("created_at", { ascending: false });

    if (dateFrom) giftsQuery = giftsQuery.gte("created_at", `${dateFrom}T00:00:00+09:00`);
    if (dateTo) giftsQuery = giftsQuery.lte("created_at", `${dateTo}T23:59:59+09:00`);

    giftsQuery = giftsQuery.range(from, to);

    const { data: gifts, error: giftsError, count } = await giftsQuery;

    if (giftsError) {
      console.error("[GET gifts] Query error:", giftsError);
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

    // source_voucher → order → product 정보 벌크 조회
    const sourceVoucherIds = giftList.map((g) => g.source_voucher_id).filter(Boolean);
    const { data: vouchers } = await adminClient
      .from("vouchers")
      .select("id, order_id")
      .in("id", sourceVoucherIds);
    const voucherOrderMap = new Map((vouchers ?? []).map((v) => [v.id, v.order_id]));

    const orderIds = [...new Set((vouchers ?? []).map((v) => v.order_id).filter(Boolean))];
    const { data: orders } = await adminClient
      .from("orders")
      .select("id, product_id, quantity, product_price, total_amount, fee_type, fee_amount, card_company_name, installment_months")
      .in("id", orderIds);
    const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

    const productIds = [...new Set((orders ?? []).map((o) => o.product_id).filter(Boolean))];
    const { data: products } = await adminClient
      .from("products")
      .select("id, name")
      .in("id", productIds);
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    // 결과 조합
    const result: PurchaseAccountGiftItem[] = giftList.map((g) => {
      const sender = senderMap.get(g.sender_id);
      const orderId = voucherOrderMap.get(g.source_voucher_id);
      const order = orderId ? orderMap.get(orderId) : null;
      const product = order?.product_id ? productMap.get(order.product_id) : null;

      return {
        gift_id: g.id,
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
    console.error("[GET /api/admin/purchase-accounts/[accountId]/gifts] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
