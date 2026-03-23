import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { DashboardStats, PinStockSummary } from "@/types";

/**
 * GET /api/admin/dashboard/stats
 * 대시보드 주요 통계 조회
 *
 * 반환:
 * - 오늘/이번달 매출 및 주문 건수
 * - 전일/전월 매출 (대비 계산용)
 * - 오늘/전일 신규 회원 수
 * - 오늘/이번달 취소 건수
 * - 상품별 핀 재고 현황
 */
export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { adminClient } = auth;

    // 날짜 범위 계산 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);

    // 오늘 시작 (KST 00:00:00)
    const todayStart = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset
    ).toISOString();

    // 전일 시작
    const yesterdayStart = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - 1) - kstOffset
    ).toISOString();

    // 이번달 시작 (KST 기준)
    const monthStart = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1) - kstOffset
    ).toISOString();

    // 전월 시작
    const prevMonthStart = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1) - kstOffset
    ).toISOString();

    // 병렬로 모든 쿼리 실행 (매출은 RPC로 DB 집계)
    const [
      salesStatsResult,
      newUsersTodayResult,
      newUsersYesterdayResult,
      cancelsTodayResult,
      cancelsMonthResult,
      pinStockResult,
    ] = await Promise.all([
      // 매출 통계 (DB에서 SUM/COUNT 집계)
      adminClient.rpc("dashboard_sales_stats", {
        p_today_start: todayStart,
        p_yesterday_start: yesterdayStart,
        p_month_start: monthStart,
        p_prev_month_start: prevMonthStart,
      }),

      // 오늘 신규 회원
      adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // 전일 신규 회원
      adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart),

      // 오늘 취소 건수
      adminClient
        .from("cancellations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // 이번달 취소 건수
      adminClient
        .from("cancellations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),

      // 핀 재고 현황: DB View로 상품별 집계
      adminClient
        .from("product_pin_stats")
        .select("product_id, waiting, assigned, consumed, returned"),
    ]);

    // RPC 에러 체크
    if (salesStatsResult.error) {
      console.error("[GET /api/admin/dashboard/stats] RPC error:", salesStatsResult.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QUERY_ERROR",
            message: "매출 통계 조회에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    const salesStats = salesStatsResult.data as Record<string, number>;
    const today_sales = Number(salesStats.today_sales) || 0;
    const today_order_count = Number(salesStats.today_count) || 0;
    const prev_day_sales = Number(salesStats.yesterday_sales) || 0;
    const month_sales = Number(salesStats.month_sales) || 0;
    const month_order_count = Number(salesStats.month_count) || 0;
    const prev_month_sales = Number(salesStats.prev_month_sales) || 0;

    // 신규 회원 수
    const new_users_today = newUsersTodayResult.count ?? 0;
    const new_users_prev_day = newUsersYesterdayResult.count ?? 0;

    // 취소 건수
    const cancel_count_today = cancelsTodayResult.count ?? 0;
    const cancel_count_month = cancelsMonthResult.count ?? 0;

    // 핀 재고 집계 (DB View에서 이미 상품별로 집계됨)
    const pinStatsData = pinStockResult.data ?? [];

    // 상품명 별도 조회 (핀이 있는 상품만)
    const productIds = pinStatsData.map((r) => (r as Record<string, unknown>).product_id as string);
    const productNameMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products } = await adminClient
        .from("products")
        .select("id, name")
        .in("id", productIds);
      for (const p of products ?? []) {
        productNameMap.set(p.id, p.name);
      }
    }

    const pin_stock: PinStockSummary[] = pinStatsData.map((row) => {
      const r = row as Record<string, unknown>;
      const product_id = r.product_id as string;
      const waiting = Number(r.waiting) || 0;
      const assigned = Number(r.assigned) || 0;
      const consumed = Number(r.consumed) || 0;
      const returned = Number(r.returned) || 0;
      return {
        product_id,
        product_name: productNameMap.get(product_id) ?? "알 수 없는 상품",
        waiting,
        assigned,
        consumed,
        returned,
        total: waiting + assigned + consumed + returned,
      };
    });

    const stats: DashboardStats = {
      today_sales,
      today_order_count,
      month_sales,
      month_order_count,
      prev_day_sales,
      prev_month_sales,
      new_users_today,
      new_users_prev_day,
      cancel_count_today,
      cancel_count_month,
      pin_stock,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (err) {
    console.error("[GET /api/admin/dashboard/stats] Unexpected error:", err);
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
