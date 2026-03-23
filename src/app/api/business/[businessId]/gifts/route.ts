import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, resolveBusinessId } from "@/lib/business/auth";

/**
 * GET /api/business/[businessId]/gifts
 *
 * 업체 매입(선물) 상세 내역.
 * - 기간 필터: date_from, date_to
 * - 페이지네이션: page, limit
 * - CSV 전체 데이터: format=csv (페이지네이션 무시, 최대 10000건)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (auth.error) return auth.error;

    const { businessId: sessionBizId, adminClient } = auth;
    const { businessId: urlIdentifier } = await params;

    const businessId = await resolveBusinessId(urlIdentifier);
    if (!businessId || sessionBizId !== businessId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BUSINESS_FORBIDDEN", message: "접근 권한이 없습니다." },
        },
        { status: 403 }
      );
    }

    // 업체 조회 → receiving_account_id, commission_rate 확인
    const { data: biz, error: bizError } = await adminClient
      .from("businesses")
      .select("id, receiving_account_id, commission_rate")
      .eq("id", businessId)
      .single();

    if (bizError || !biz) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BUSINESS_NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const recvId = (biz as Record<string, unknown>).receiving_account_id as string | null;
    const commissionRate = (biz as Record<string, unknown>).commission_rate as number;

    if (!recvId) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          total_pages: 0,
          summary: { total_count: 0, total_amount: 0, total_settlement: 0 },
        },
      });
    }

    const { searchParams } = request.nextUrl;
    const format = searchParams.get("format");
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const search = (searchParams.get("search") ?? "").trim().toLowerCase();

    const isCSV = format === "csv";
    const hasSearch = search.length > 0;
    const page = isCSV ? 1 : Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = isCSV ? 10000 : Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));

    // gifts 조회 (receiver_id = receiving_account_id)
    // LEFT JOIN으로 cancelled 바우처도 포함 (취소 건 표시를 위해)
    let query = adminClient
      .from("gifts")
      .select(
        `id, created_at, product_id,
         products(id, name, price),
         sender:users!gifts_sender_id_fkey(id, username, name, phone),
         new_voucher:vouchers!gifts_new_voucher_id_fkey(id, order_id, status)`,
        { count: "exact" }
      )
      .eq("receiver_id", recvId);

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00+09:00`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999+09:00`);
    }

    query = query.order("created_at", { ascending: false });

    // 검색어가 없으면 DB 레벨 페이지네이션, 있으면 전체 조회 후 필터링
    if (!hasSearch) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    } else {
      // 검색 시에도 최대 2000건으로 제한 (메모리 보호)
      query = query.limit(2000);
    }

    const { data: giftsRaw, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /api/business/:id/gifts] Query error:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "매입 내역 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    if (!giftsRaw || giftsRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
          summary: { total_count: 0, total_amount: 0, total_settlement: 0 },
        },
      });
    }

    // 주문 정보 역추적 (수량, 결제수단 등)
    const orderIds = giftsRaw
      .map((g) => {
        const newVoucher = (g as Record<string, unknown>).new_voucher as Record<string, unknown> | null;
        return newVoucher?.order_id as string | null;
      })
      .filter((id): id is string => !!id);

    const orderMap = new Map<string, Record<string, unknown>>();
    if (orderIds.length > 0) {
      const uniqueOrderIds = [...new Set(orderIds)];
      const { data: orders } = await adminClient
        .from("orders")
        .select("id, user_id, quantity, total_amount, payment_method, card_company_name, installment_months")
        .in("id", uniqueOrderIds);

      for (const o of orders ?? []) {
        const order = o as Record<string, unknown>;
        orderMap.set(order.id as string, order);
      }
    }

    // 원래 구매자(user_id) 정보 일괄 조회
    const buyerIds = [...new Set(
      [...orderMap.values()]
        .map((o) => o.user_id as string | null)
        .filter((id): id is string => !!id)
    )];
    const buyerMap = new Map<string, Record<string, unknown>>();
    if (buyerIds.length > 0) {
      const { data: buyers } = await adminClient
        .from("users")
        .select("id, username, name, phone")
        .in("id", buyerIds);

      for (const b of buyers ?? []) {
        const buyer = b as Record<string, unknown>;
        buyerMap.set(buyer.id as string, buyer);
      }
    }

    // 매핑
    const items = giftsRaw.map((raw) => {
      const g = raw as Record<string, unknown>;
      const product = g.products as Record<string, unknown> | null;
      const sender = g.sender as Record<string, unknown> | null;
      const newVoucher = g.new_voucher as Record<string, unknown> | null;
      const orderId = newVoucher?.order_id as string | null;
      const order = orderId ? orderMap.get(orderId) : undefined;

      // 원래 구매자 정보 (주문의 user_id → users)
      const buyerId = order?.user_id as string | null;
      const buyer = buyerId ? buyerMap.get(buyerId) : undefined;

      const productPrice = (product?.price as number) ?? 0;
      const quantity = (order?.quantity as number) ?? 1;
      const totalAmount = (order?.total_amount as number) ?? productPrice;
      const paymentMethod = (order?.payment_method as string) ?? "신용카드";
      const cardCompany = (order?.card_company_name as string) ?? "";
      const installmentMonths = (order?.installment_months as number) ?? 0;
      const installment = installmentMonths === 0 ? "일시불" : `${installmentMonths}개월`;
      const voucherStatus = (newVoucher?.status as string) ?? "";
      const isCancelled = voucherStatus === "cancelled";
      const settlementAmount = isCancelled ? 0 : Math.floor(totalAmount * (commissionRate / 100));
      return {
        id: g.id as string,
        sender_username: (buyer?.username as string) ?? (sender?.username as string) ?? "",
        sender_name: (buyer?.name as string) ?? (sender?.name as string) ?? "",
        sender_phone: (buyer?.phone as string) ?? (sender?.phone as string) ?? "",
        product_name: (product?.name as string) ?? "알 수 없음",
        product_price: productPrice,
        quantity,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        card_company: cardCompany,
        installment,
        settlement_amount: settlementAmount,
        created_at: g.created_at as string,
        voucher_status: voucherStatus,
      };
    });

    // 검색어 필터링 (매핑 후 클라이언트 필드 기반)
    let allFilteredItems = items;
    let filteredTotal = count ?? 0;

    if (hasSearch) {
      allFilteredItems = items.filter((item) => {
        const searchable = [
          item.sender_name,
          item.sender_phone,
          item.product_name,
          item.card_company,
          item.installment,
          String(item.quantity),
          String(item.total_amount),
          String(item.settlement_amount),
        ].join(" ").toLowerCase();
        return searchable.includes(search);
      });
      filteredTotal = allFilteredItems.length;
    }

    // 수동 페이지네이션 (검색 시)
    const filteredItems = hasSearch
      ? allFilteredItems.slice((page - 1) * limit, (page - 1) * limit + limit)
      : items;

    // 합계 계산
    const summaryTotalCount = filteredTotal;
    let summaryTotalAmount = 0;
    let summaryTotalSettlement = 0;

    if (hasSearch || isCSV || filteredTotal <= limit) {
      const summarySource = hasSearch ? allFilteredItems : items;
      summaryTotalAmount = summarySource.reduce((acc, i) => acc + i.total_amount, 0);
      summaryTotalSettlement = summarySource.reduce((acc, i) => acc + i.settlement_amount, 0);
    } else {
      // RPC로 전체 합계 조회 (건수 제한 없음)
      const rpcParams: Record<string, string> = { p_receiver_id: recvId };
      if (dateFrom) rpcParams.p_date_from = `${dateFrom}T00:00:00+09:00`;
      if (dateTo) rpcParams.p_date_to = `${dateTo}T23:59:59.999+09:00`;

      const { data: summaryData } = await adminClient.rpc("get_gifts_summary", rpcParams);

      if (summaryData) {
        const summary = summaryData as { count: number; total_amount: number };
        summaryTotalAmount = summary.total_amount;
        summaryTotalSettlement = Math.floor(summary.total_amount * (commissionRate / 100));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
        total: filteredTotal,
        page,
        limit,
        total_pages: Math.ceil(filteredTotal / limit),
        summary: {
          total_count: summaryTotalCount,
          total_amount: summaryTotalAmount,
          total_settlement: summaryTotalSettlement,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/business/:id/gifts] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
