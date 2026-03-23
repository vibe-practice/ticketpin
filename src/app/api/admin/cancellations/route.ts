import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type {
  AdminCancellationListItem,
  CancellationReasonType,
  CancelledBy,
  CancelStatus,
  FeeType,
} from "@/types";

/**
 * GET /api/admin/cancellations
 *
 * 관리자 취소/환불 목록 조회 (필터/검색/페이징/정렬)
 * DB 레벨 JOIN + 필터 + 검색 + 페이지네이션 (RPC 사용)
 *
 * 쿼리 파라미터:
 * - page, limit: 페이징
 * - search: 통합검색 (주문번호, 구매자, 상품명, 바우처코드)
 * - sort_by, sort_order: 정렬
 * - cancel_status: 취소 상태 (comma separated: completed,failed)
 * - reason_type: 취소 사유 (comma separated)
 * - cancelled_by: 취소 요청자 (user|admin)
 * - date_from, date_to: 취소 기간
 * - amount_min, amount_max: 취소 금액 범위
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // ── 페이징 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    // ── 필터 파라미터 ──
    const search = searchParams.get("search")?.trim() ?? "";
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";
    const cancelStatusFilter = searchParams.get("cancel_status")?.split(",").filter(Boolean) ?? [];
    const reasonTypeFilter = searchParams.get("reason_type")?.split(",").filter(Boolean) ?? [];
    const cancelledByFilter = searchParams.get("cancelled_by") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const amountMin = searchParams.get("amount_min") ? parseInt(searchParams.get("amount_min")!, 10) : null;
    const amountMax = searchParams.get("amount_max") ? parseInt(searchParams.get("amount_max")!, 10) : null;

    // ── 정렬 컬럼 검증 ──
    const SORTABLE_COLUMNS = ["created_at", "refund_amount", "order_number", "buyer_name", "product_name"];
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    // ── RPC 호출: DB 레벨 JOIN + 필터 + 검색 + 페이지네이션 ──
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "get_admin_cancellation_list",
      {
        p_search: search,
        p_cancel_status: cancelStatusFilter,
        p_reason_type: reasonTypeFilter,
        p_cancelled_by: cancelledByFilter === "user" || cancelledByFilter === "admin" || cancelledByFilter === "system" ? cancelledByFilter : "",
        p_date_from: dateFrom ? `${dateFrom}T00:00:00.000Z` : null,
        p_date_to: dateTo ? `${dateTo}T23:59:59.999Z` : null,
        p_amount_min: amountMin != null && !isNaN(amountMin) ? amountMin : null,
        p_amount_max: amountMax != null && !isNaN(amountMax) ? amountMax : null,
        p_sort_by: safeSortBy,
        p_sort_order: safeSortOrder,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (rpcError) {
      console.error("[GET /api/admin/cancellations] RPC error:", rpcError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "취소/환불 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const result = rpcResult as { data: Record<string, unknown>[]; total: number };
    const total = result.total ?? 0;
    const rawItems = result.data ?? [];

    // ── AdminCancellationListItem 매핑 ──
    const items: AdminCancellationListItem[] = rawItems.map((row) => ({
      id: row.id as string,
      order_id: row.order_id as string,
      voucher_id: row.voucher_id as string,
      reason_type: row.reason_type as CancellationReasonType,
      reason_detail: (row.reason_detail as string) ?? null,
      cancelled_by: row.cancelled_by as CancelledBy,
      refund_amount: row.refund_amount as number,
      refund_status: row.refund_status as CancelStatus,
      pg_cancel_transaction_id: (row.pg_cancel_transaction_id as string) ?? null,
      pg_ref_no: (row.pg_ref_no as string) ?? null,
      pg_tran_date: (row.pg_tran_date as string) ?? null,
      pg_pay_type: (row.pg_pay_type as string) ?? null,
      refunded_at: (row.refunded_at as string) ?? null,
      created_at: row.created_at as string,
      order_number: (row.order_number as string) ?? "",
      product_name: (row.product_name as string) ?? "",
      product_price: (row.product_price as number) ?? 0,
      buyer_username: (row.buyer_username as string) ?? "",
      buyer_name: (row.buyer_name as string) ?? "",
      quantity: (row.quantity as number) ?? 0,
      fee_type: ((row.fee_type as FeeType) ?? "included") as FeeType,
      fee_amount: (row.fee_amount as number) ?? 0,
      total_amount: (row.total_amount as number) ?? 0,
      voucher_code: (row.voucher_code as string) ?? "",
      voucher_fee_paid: (row.voucher_fee_paid as boolean) ?? false,
      voucher_fee_amount: (row.voucher_fee_amount as number) ?? null,
      voucher_fee_pg_transaction_id: (row.voucher_fee_pg_transaction_id as string) ?? null,
    }));

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
    console.error("[GET /api/admin/cancellations] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
