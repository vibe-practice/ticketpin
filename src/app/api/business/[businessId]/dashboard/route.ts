import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, resolveBusinessId } from "@/lib/business/auth";
import type { BusinessDashboardStats } from "@/types";

/**
 * GET /api/business/[businessId]/dashboard
 *
 * 업체 대시보드 통계 데이터 반환.
 * 쿼리 파라미터:
 * - period: today | 7d | 30d | custom (기본값: today)
 * - from: YYYY-MM-DD (custom 기간 시작일)
 * - to: YYYY-MM-DD (custom 기간 종료일)
 */

const kstFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

function getKstToday(): string {
  return kstFormatter.format(new Date());
}

function getKstDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return kstFormatter.format(d);
}

/** 두 날짜 사이의 일수 차이 */
function daysBetween(from: string, to: string): number {
  const f = new Date(from + "T00:00:00+09:00");
  const t = new Date(to + "T00:00:00+09:00");
  return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function getDateRanges(period: string, customFrom?: string, customTo?: string): {
  current: DateRange;
  prev: DateRange;
} {
  const today = getKstToday();

  switch (period) {
    case "7d": {
      const from = getKstDate(-6);
      const prevFrom = getKstDate(-13);
      const prevTo = getKstDate(-7);
      return { current: { from, to: today }, prev: { from: prevFrom, to: prevTo } };
    }
    case "30d": {
      const from = getKstDate(-29);
      const prevFrom = getKstDate(-59);
      const prevTo = getKstDate(-30);
      return { current: { from, to: today }, prev: { from: prevFrom, to: prevTo } };
    }
    case "custom": {
      if (customFrom && customTo) {
        const days = daysBetween(customFrom, customTo);
        const prevToDate = new Date(customFrom + "T00:00:00+09:00");
        prevToDate.setDate(prevToDate.getDate() - 1);
        const prevFromDate = new Date(prevToDate);
        prevFromDate.setDate(prevFromDate.getDate() - days + 1);
        return {
          current: { from: customFrom, to: customTo },
          prev: { from: kstFormatter.format(prevFromDate), to: kstFormatter.format(prevToDate) },
        };
      }
      // custom이지만 from/to 없으면 오늘로 폴백
      const yesterday = getKstDate(-1);
      return { current: { from: today, to: today }, prev: { from: yesterday, to: yesterday } };
    }
    default: {
      // today
      const yesterday = getKstDate(-1);
      return { current: { from: today, to: today }, prev: { from: yesterday, to: yesterday } };
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (auth.error) return auth.error;

    const { businessId: sessionBizId, adminClient } = auth;
    const { businessId: urlIdentifier } = await params;

    // URL의 login_id 또는 UUID를 실제 business_id로 변환
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

    // 쿼리 파라미터 파싱
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "today";
    const customFrom = url.searchParams.get("from") || undefined;
    const customTo = url.searchParams.get("to") || undefined;

    // custom 기간 날짜 형식 유효성 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (period === "custom") {
      if (customFrom && !dateRegex.test(customFrom)) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_QUERY", message: "잘못된 날짜 형식입니다." } },
          { status: 400 }
        );
      }
      if (customTo && !dateRegex.test(customTo)) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_QUERY", message: "잘못된 날짜 형식입니다." } },
          { status: 400 }
        );
      }
      if (customFrom && customTo && customFrom > customTo) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_QUERY", message: "시작일이 종료일보다 클 수 없습니다." } },
          { status: 400 }
        );
      }
    }

    const { current, prev } = getDateRanges(period, customFrom, customTo);

    // 업체 조회
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
      const emptyStats: BusinessDashboardStats = {
        today_gift_count: 0,
        today_gift_amount: 0,
        today_settlement_amount: 0,
        month_settlement_amount: 0,
        prev_day_gift_count: 0,
        prev_day_gift_amount: 0,
        prev_day_settlement_amount: 0,
        prev_month_settlement_amount: 0,
      };
      return NextResponse.json({ success: true, data: emptyStats });
    }

    // recvId가 null이 아님이 상위에서 보장됨 (null이면 early return)
    const receiverId = recvId;

    // 기간별 gifts 집계 함수 (취소된 바우처는 !inner JOIN + .neq()로 DB 레벨 제외)
    async function aggregateGifts(range: DateRange) {
      const { data: gifts } = await adminClient
        .from("gifts")
        .select("id, products(price), new_voucher:vouchers!gifts_new_voucher_id_fkey!inner(status)")
        .eq("receiver_id", receiverId)
        .neq("new_voucher.status", "cancelled")
        .gte("created_at", `${range.from}T00:00:00+09:00`)
        .lte("created_at", `${range.to}T23:59:59.999+09:00`);

      if (!gifts || gifts.length === 0) {
        return { count: 0, amount: 0, settlementAmount: 0 };
      }

      const count = gifts.length;
      const amount = gifts.reduce((acc, g) => {
        const product = (g as Record<string, unknown>).products as Record<string, unknown> | null;
        return acc + ((product?.price as number) ?? 0);
      }, 0);
      const settlementAmount = Math.floor(amount * (commissionRate / 100));

      return { count, amount, settlementAmount };
    }

    // 기간별 settlements 집계 함수
    async function aggregateSettlements(range: DateRange) {
      const { data: settlements } = await adminClient
        .from("settlements")
        .select("gift_count, gift_total_amount, settlement_amount")
        .eq("business_id", businessId)
        .gte("settlement_date", range.from)
        .lte("settlement_date", range.to);

      if (!settlements || settlements.length === 0) {
        return null; // settlements가 없으면 gifts에서 직접 집계
      }

      return settlements.reduce(
        (acc, s) => {
          const row = s as Record<string, unknown>;
          return {
            count: acc.count + ((row.gift_count as number) ?? 0),
            amount: acc.amount + ((row.gift_total_amount as number) ?? 0),
            settlementAmount: acc.settlementAmount + ((row.settlement_amount as number) ?? 0),
          };
        },
        { count: 0, amount: 0, settlementAmount: 0 }
      );
    }

    // 현재 기간 + 이전 기간 집계 (병렬)
    const [currentSettlements, prevSettlements] = await Promise.all([
      aggregateSettlements(current),
      aggregateSettlements(prev),
    ]);

    // settlements가 없으면 gifts에서 직접 집계
    const [currentData, prevData] = await Promise.all([
      currentSettlements ?? aggregateGifts(current),
      prevSettlements ?? aggregateGifts(prev),
    ]);

    // 이번달 정산 합계 (기간 필터와 무관하게 항상 표시)
    const kstParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const kstYear = parseInt(kstParts.find(p => p.type === "year")!.value);
    const kstMonth = parseInt(kstParts.find(p => p.type === "month")!.value);

    const monthStart = `${kstYear}-${String(kstMonth).padStart(2, "0")}-01`;
    const today = getKstToday();

    const prevMonthDate = new Date(kstYear, kstMonth - 2, 1);
    const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const prevMonthEndDate = new Date(kstYear, kstMonth - 1, 0);
    const prevMonthEndStr = kstFormatter.format(prevMonthEndDate);

    const [monthSettlementsData, prevMonthSettlementsData] = await Promise.all([
      aggregateSettlements({ from: monthStart, to: today }),
      aggregateSettlements({ from: prevMonthStart, to: prevMonthEndStr }),
    ]);

    // 이번달 settlements 없으면 gifts 집계 (병렬)
    const [monthData, prevMonthData] = await Promise.all([
      monthSettlementsData ?? aggregateGifts({ from: monthStart, to: today }),
      prevMonthSettlementsData ?? aggregateGifts({ from: prevMonthStart, to: prevMonthEndStr }),
    ]);

    const stats: BusinessDashboardStats = {
      today_gift_count: currentData.count,
      today_gift_amount: currentData.amount,
      today_settlement_amount: currentData.settlementAmount,
      month_settlement_amount: monthData.settlementAmount,
      prev_day_gift_count: prevData.count,
      prev_day_gift_amount: prevData.amount,
      prev_day_settlement_amount: prevData.settlementAmount,
      prev_month_settlement_amount: prevMonthData.settlementAmount,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("[GET /api/business/:id/dashboard] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
