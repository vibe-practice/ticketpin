import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { DashboardChartItem } from "@/types";

/**
 * GET /api/admin/dashboard/chart
 * 대시보드 차트 데이터 조회 (일별 매출 + 주문 건수 추이)
 *
 * Query params:
 *   days - 조회 기간 (기본 30, 최대 90)
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10) || 30));

    // KST 기준 날짜 범위 계산
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);

    // 시작일 (days일 전 KST 00:00:00)
    const startDate = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - days + 1) - kstOffset
    );

    // 종료일 (내일 KST 00:00:00 = 오늘까지 포함)
    const endDate = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1) - kstOffset
    );

    // DB에서 일별 집계 (RPC)
    const { data: rpcResult, error } = await adminClient.rpc("dashboard_chart_data", {
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      console.error("[GET /api/admin/dashboard/chart] RPC error:", error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QUERY_ERROR",
            message: "차트 데이터 조회에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // RPC 결과를 Map으로 변환 (빈 날짜 채우기용)
    const dbData = (rpcResult as Array<{ date: string; sales: number; order_count: number; cancel_count: number }>) ?? [];
    const dbMap = new Map<string, { sales: number; order_count: number }>();
    for (const row of dbData) {
      dbMap.set(row.date, {
        sales: Number(row.sales) || 0,
        order_count: Number(row.order_count) || 0,
      });
    }

    // 모든 날짜를 포함한 배열 생성 (데이터 없는 날짜는 0으로)
    const chartData: DashboardChartItem[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(
        Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - days + 1 + i)
      );
      const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      const entry = dbMap.get(dateStr);
      chartData.push({
        date: dateStr,
        sales: entry?.sales ?? 0,
        order_count: entry?.order_count ?? 0,
      });
    }

    return NextResponse.json({ success: true, data: chartData });
  } catch (err) {
    console.error("[GET /api/admin/dashboard/chart] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
