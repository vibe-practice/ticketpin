import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { AdminOrderListItem, SmsLog, CancellationReasonType, CancelStatus } from "@/types";

/**
 * GET /api/admin/orders
 *
 * 관리자 주문 목록 조회 (7종 필터/검색/페이징/정렬)
 * DB RPC `admin_search_orders`를 사용하여 검색/필터/페이징을 DB 레벨에서 처리
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // -- 페이징 --
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    // -- 필터 파라미터 --
    const search = searchParams.get("search")?.trim() ?? "";
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";
    const orderStatus = searchParams.get("order_status")?.split(",").filter(Boolean) ?? [];
    const feeType = searchParams.get("fee_type") ?? "";
    const cardCompany = searchParams.get("card_company")?.split(",").filter(Boolean) ?? [];
    const installment = searchParams.get("installment") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const amountMin = searchParams.get("amount_min") ? parseInt(searchParams.get("amount_min")!, 10) : null;
    const amountMax = searchParams.get("amount_max") ? parseInt(searchParams.get("amount_max")!, 10) : null;
    const voucherStatusFilter = searchParams.get("voucher_status")?.split(",").filter(Boolean) ?? [];

    // 정렬 컬럼 화이트리스트
    const SORTABLE_COLUMNS = ["created_at", "order_number", "total_amount", "buyer_name", "buyer_username", "product_name"];
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "created_at";

    // -- DB RPC로 검색/필터/페이징 처리 --
    const { data: rpcResult, error: rpcError } = await adminClient.rpc("admin_search_orders", {
      p_search: search,
      p_order_status: orderStatus.length > 0 ? orderStatus : [],
      p_fee_type: feeType,
      p_card_company: cardCompany.length > 0 ? cardCompany : [],
      p_installment: installment,
      p_date_from: dateFrom ? `${dateFrom}T00:00:00.000Z` : null,
      p_date_to: dateTo ? `${dateTo}T23:59:59.999Z` : null,
      p_amount_min: amountMin != null && !isNaN(amountMin) ? amountMin : null,
      p_amount_max: amountMax != null && !isNaN(amountMax) ? amountMax : null,
      p_voucher_status: voucherStatusFilter.length > 0 ? voucherStatusFilter : [],
      p_sort_by: safeSortBy,
      p_sort_order: sortOrder === "asc" ? "asc" : "desc",
      p_offset: offset,
      p_limit: limit,
    });

    if (rpcError) {
      console.error("[GET /api/admin/orders] RPC error:", rpcError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "주문 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const result = rpcResult as { items: Array<Record<string, unknown>>; total: number };
    const ordersRaw = result.items ?? [];
    const total = Number(result.total) || 0;

    if (ordersRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          data: [],
          total,
          page,
          per_page: limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    }

    // -- 관련 데이터 병렬 조회 (핀, 취소, SMS, 선물) --
    const orderIds = ordersRaw.map((o) => o.id as string);
    const voucherIds = ordersRaw
      .map((o) => o.voucher_id as string | null)
      .filter((id): id is string => id != null);

    const [cancellationsResult, smsLogsResult, pinsResult, giftsResult] = await Promise.all([
      adminClient
        .from("cancellations")
        .select("order_id, reason_type, refund_status, refund_amount, created_at")
        .in("order_id", orderIds),
      adminClient
        .from("sms_logs")
        .select("id, voucher_id, order_id, recipient_phone, message_type, message_content, send_status, aligo_response, sent_by, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      voucherIds.length > 0
        ? adminClient
            .from("pins")
            .select("voucher_id")
            .in("voucher_id", voucherIds)
        : Promise.resolve({ data: [] as { voucher_id: string }[] }),
      voucherIds.length > 0
        ? adminClient
            .from("gifts")
            .select("id, source_voucher_id, sender_id, receiver_id, auto_recycled, created_at, new_voucher_id")
            .in("source_voucher_id", voucherIds)
        : Promise.resolve({ data: [] as { id: string; source_voucher_id: string; sender_id: string; receiver_id: string; auto_recycled: boolean; created_at: string; new_voucher_id: string }[] }),
    ]);

    // 선물 송수신자 정보 조회
    const giftsData = giftsResult.data ?? [];
    const giftUserIds = [
      ...new Set([
        ...giftsData.map((g) => g.sender_id as string),
        ...giftsData.map((g) => g.receiver_id as string),
      ]),
    ];
    let giftUsersMap: Record<string, string> = {};
    if (giftUserIds.length > 0) {
      const { data: giftUsers } = await adminClient
        .from("users")
        .select("id, username")
        .in("id", giftUserIds);
      if (giftUsers) {
        giftUsersMap = Object.fromEntries(giftUsers.map((r) => [r.id, r.username]));
      }
    }

    // -- 인덱스 맵 구성 --
    const cancellationByOrderId = new Map(
      (cancellationsResult.data ?? []).map((c) => [c.order_id, c])
    );
    const smsLogsByOrderId = new Map<string, SmsLog[]>();
    for (const log of (smsLogsResult.data ?? [])) {
      const oid = log.order_id as string;
      if (!smsLogsByOrderId.has(oid)) {
        smsLogsByOrderId.set(oid, []);
      }
      smsLogsByOrderId.get(oid)!.push(log as unknown as SmsLog);
    }
    const pinCountByVoucherId = new Map<string, number>();
    for (const pin of (pinsResult.data ?? [])) {
      const vid = pin.voucher_id as string;
      pinCountByVoucherId.set(vid, (pinCountByVoucherId.get(vid) ?? 0) + 1);
    }
    const giftByVoucherId = new Map(
      giftsData.map((g) => [g.source_voucher_id, g])
    );

    // -- AdminOrderListItem 조합 --
    const items: AdminOrderListItem[] = ordersRaw.map((order) => {
      const orderId = order.id as string;
      const voucherId = order.voucher_id as string | null;
      const cancellation = cancellationByOrderId.get(orderId);
      const smsLogs = smsLogsByOrderId.get(orderId) ?? [];
      const gift = voucherId ? giftByVoucherId.get(voucherId) : undefined;

      return {
        // Order 필드
        id: orderId,
        order_number: order.order_number as string,
        user_id: order.user_id as string,
        product_id: (order.product_id as string | null) ?? null,
        quantity: order.quantity as number,
        product_price: order.product_price as number,
        fee_type: order.fee_type as "included" | "separate",
        fee_amount: order.fee_amount as number,
        total_amount: order.total_amount as number,
        payment_method: order.payment_method as string | null,
        pg_transaction_id: order.pg_transaction_id as string | null,
        pg_ref_no: order.pg_ref_no as string | null,
        pg_tran_date: order.pg_tran_date as string | null,
        pg_pay_type: order.pg_pay_type as string | null,
        card_no: order.card_no as string | null,
        card_company_code: order.card_company_code as string | null,
        card_company_name: order.card_company_name as string | null,
        installment_months: order.installment_months as number,
        approval_no: order.approval_no as string | null,
        receiver_phone: order.receiver_phone as string,
        status: order.status as AdminOrderListItem["status"],
        created_at: order.created_at as string,
        updated_at: order.updated_at as string,
        // 확장 필드 (RPC에서 JOIN 처리 완료)
        product_name: (order.product_name as string) ?? "(삭제된 상품)",
        product_image_url: (order.product_image_url as string) ?? null,
        buyer_username: order.buyer_username as string,
        buyer_name: order.buyer_name as string,
        buyer_phone: order.buyer_phone as string,
        voucher_id: voucherId ?? null,
        voucher_code: (order.voucher_code as string) ?? null,
        voucher_status: (order.voucher_status as AdminOrderListItem["voucher_status"]) ?? null,
        is_password_set: (order.is_password_set as boolean) ?? false,
        is_password_locked: (order.is_password_locked as boolean) ?? false,
        reissue_count: (order.reissue_count as number) ?? 0,
        fee_paid: (order.fee_paid as boolean) ?? false,
        fee_pg_transaction_id: (order.fee_pg_transaction_id as string) ?? null,
        voucher_fee_amount: (order.voucher_fee_amount as number) ?? null,
        pin_count: voucherId ? (pinCountByVoucherId.get(voucherId) ?? 0) : 0,
        cancellation: cancellation
          ? {
              reason_type: cancellation.reason_type as CancellationReasonType,
              refund_status: cancellation.refund_status as CancelStatus,
              refund_amount: cancellation.refund_amount as number,
              created_at: cancellation.created_at as string,
            }
          : null,
        sms_logs: smsLogs,
        gift_chain: gift
          ? [{
              sender_username: giftUsersMap[gift.sender_id as string] ?? "",
              receiver_username: giftUsersMap[gift.receiver_id as string] ?? "",
              created_at: gift.created_at as string,
              auto_recycled: (gift.auto_recycled as boolean) ?? false,
            }]
          : null,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        data: items,
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/orders] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
