import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, resolveBusinessId } from "@/lib/business/auth";

/**
 * GET /api/business/[businessId]/settlements
 *
 * 업체 정산 내역 목록.
 * - 상태 필터: status (pending|confirmed|paid|cancelled)
 * - 기간 필터: date_from, date_to
 * - 페이지네이션: page, limit
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

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const validStatuses = ["pending", "confirmed", "paid", "cancelled"];

    // 메인 쿼리 (서버사이드 필터링 + 페이지네이션)
    let query = adminClient
      .from("settlements")
      .select(
        "id, business_id, settlement_date, gift_count, gift_total_amount, commission_rate, settlement_amount, status, confirmed_at, paid_at, paid_by, memo, created_at, updated_at",
        { count: "exact" }
      )
      .eq("business_id", businessId);

    // 날짜 필터는 모든 쿼리에 공통 적용
    const applyDateFilter = <T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(q: T): T => {
      if (dateFrom) q = q.gte("settlement_date", dateFrom);
      if (dateTo) q = q.lte("settlement_date", dateTo);
      return q;
    };

    query = applyDateFilter(query);

    if (status && validStatuses.includes(status)) {
      query = query.eq("status", status);
    }

    query = query.order("settlement_date", { ascending: false }).range(from, to);

    const { data: settlements, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /api/business/:id/settlements] Query error:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "정산 내역 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    // 상태별 카운트 + 전체 합계 (날짜 필터 적용, 상태 필터 미적용)
    let countsQuery = adminClient
      .from("settlements")
      .select("status, gift_count, settlement_amount")
      .eq("business_id", businessId);
    countsQuery = applyDateFilter(countsQuery);

    const { data: allForCounts } = await countsQuery;

    const statusCounts: Record<string, number> = { all: 0, pending: 0, confirmed: 0, paid: 0, cancelled: 0 };
    let totalSettlementAmount = 0;
    let totalGiftCount = 0;

    for (const row of allForCounts ?? []) {
      const s = row as Record<string, unknown>;
      const st = s.status as string;
      statusCounts.all++;
      if (st in statusCounts) statusCounts[st]++;
      // cancelled 상태의 정산은 합계에서 제외
      if (st !== "cancelled") {
        totalSettlementAmount += (s.settlement_amount as number) ?? 0;
        totalGiftCount += (s.gift_count as number) ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        items: settlements ?? [],
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        status_counts: statusCounts,
        summary: {
          total_settlement_amount: totalSettlementAmount,
          total_gift_count: totalGiftCount,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/business/:id/settlements] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
