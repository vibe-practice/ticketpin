import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/settlements/overview
 *
 * 전체 업체의 정산 현황 요약 조회 (기간 필터)
 * - query: start_date, end_date (YYYY-MM-DD)
 * - 응답: 업체별 정산 요약 배열 + 전체 통계
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const sp = request.nextUrl.searchParams;
    const startDate = sp.get("start_date") ?? undefined;
    const endDate = sp.get("end_date") ?? undefined;

    // 1. 전체 업체 목록 조회
    const { data: businessesRaw, error: bizError } = await adminClient
      .from("businesses")
      .select(
        `id, business_name, contact_person, contact_phone,
         bank_name, account_number,
         commission_rate, status`
      )
      .order("business_name", { ascending: true });

    if (bizError) {
      console.error("[GET /api/admin/settlements/overview] Businesses query error:", bizError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "업체 목록 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    if (!businessesRaw || businessesRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          rows: [],
          summary: {
            total_businesses: 0,
            total_gift_amount: 0,
            total_settlement_amount: 0,
            pending_count: 0,
          },
        },
      });
    }

    // 2. 해당 기간의 정산 데이터 조회
    let settleQuery = adminClient
      .from("settlements")
      .select("id, business_id, gift_count, gift_total_amount, commission_rate, settlement_amount, status");

    if (startDate) settleQuery = settleQuery.gte("settlement_date", startDate);
    if (endDate) settleQuery = settleQuery.lte("settlement_date", endDate);

    const { data: settlementsRaw, error: settleError } = await settleQuery;

    if (settleError) {
      console.error("[GET /api/admin/settlements/overview] Settlements query error:", settleError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "정산 데이터 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    // 3. 업체별 정산 집계
    /** 업체의 "대표 정산 상태" 결정 — 미처리 상태가 우선 표시됨 */
    const STATUS_PRIORITY: Record<string, number> = {
      pending: 4,    // 미확인 — 가장 시급
      confirmed: 3,  // 확인됨 — 입금 대기
      paid: 2,       // 입금완료
      cancelled: 1,  // 취소
    };

    const settleByBiz = new Map<
      string,
      { gift_total_amount: number; settlement_amount: number; latest_status: string | null }
    >();

    for (const row of settlementsRaw ?? []) {
      const s = row as Record<string, unknown>;
      const bid = s.business_id as string;
      const prev = settleByBiz.get(bid) ?? {
        gift_total_amount: 0,
        settlement_amount: 0,
        latest_status: null,
      };
      const currentStatus = s.status as string;
      // cancelled 상태의 정산은 금액 합산에서 제외
      if (currentStatus !== "cancelled") {
        prev.gift_total_amount += Number(s.gift_total_amount) || 0;
        prev.settlement_amount += Number(s.settlement_amount) || 0;
      }
      const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;
      const prevPriority = prev.latest_status ? (STATUS_PRIORITY[prev.latest_status] ?? 0) : 0;
      if (currentPriority > prevPriority) {
        prev.latest_status = currentStatus;
      }
      settleByBiz.set(bid, prev);
    }

    // 4. 응답 데이터 구성
    const rows = businessesRaw.map((raw) => {
      const biz = raw as Record<string, unknown>;
      const bizId = biz.id as string;
      const settle = settleByBiz.get(bizId);

      return {
        business_id: bizId,
        business_name: biz.business_name as string,
        contact_person: biz.contact_person as string,
        contact_phone: biz.contact_phone as string,
        bank_name: biz.bank_name as string,
        account_number: biz.account_number as string,
        commission_rate: Number(biz.commission_rate),
        gift_total_amount: settle?.gift_total_amount ?? 0,
        settlement_amount: settle?.settlement_amount ?? 0,
        settlement_status: settle?.latest_status ?? null,
        status: biz.status as string,
      };
    });

    // 5. 전체 요약 통계
    const activeRows = rows.filter((r) => r.status === "active");
    const summary = {
      total_businesses: activeRows.length,
      total_gift_amount: activeRows.reduce((s, r) => s + r.gift_total_amount, 0),
      total_settlement_amount: activeRows.reduce((s, r) => s + r.settlement_amount, 0),
      pending_count: activeRows.filter((r) => r.settlement_status === "pending").length,
    };

    return NextResponse.json({
      success: true,
      data: { rows, summary },
    });
  } catch (error) {
    console.error("[GET /api/admin/settlements/overview] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
