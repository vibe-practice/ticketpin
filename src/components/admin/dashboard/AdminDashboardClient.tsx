"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart,
  CreditCard,
  Calendar,
  CalendarDays,
  UserPlus,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { DashboardStatCard } from "./DashboardStatCard";
import { DashboardSalesChart } from "./DashboardSalesChart";
import { DashboardRecentOrders } from "./DashboardRecentOrders";
import { DashboardPinStock } from "./DashboardPinStock";
import { cn } from "@/lib/utils";
import type { DashboardStats, DashboardChartItem, AdminOrderListItem } from "@/types";

// 증감률 계산
function calcChangeRate(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

// 금액 포맷
function formatKoreanMoney(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (amount >= 10_000) {
    const man = Math.floor(amount / 10_000);
    const rest = amount % 10_000;
    return rest > 0 ? `${man.toLocaleString()}만 ${rest.toLocaleString()}원` : `${man.toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// 빈 stats 초기값
const emptyStats: DashboardStats = {
  today_sales: 0,
  today_order_count: 0,
  month_sales: 0,
  month_order_count: 0,
  prev_day_sales: 0,
  prev_month_sales: 0,
  new_users_today: 0,
  new_users_prev_day: 0,
  cancel_count_today: 0,
  cancel_count_month: 0,
  pin_stock: [],
};

export function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [chartData, setChartData] = useState<DashboardChartItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<AdminOrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [statsRes, chartRes, ordersRes] = await Promise.all([
        fetch("/api/admin/dashboard/stats"),
        fetch("/api/admin/dashboard/chart"),
        fetch("/api/admin/dashboard/recent-orders"),
      ]);

      // 인증 오류 체크
      if (statsRes.status === 401 || chartRes.status === 401 || ordersRes.status === 401) {
        setError("관리자 인증이 필요합니다. 다시 로그인해 주세요.");
        return;
      }

      const [statsJson, chartJson, ordersJson] = await Promise.all([
        statsRes.json(),
        chartRes.json(),
        ordersRes.json(),
      ]);

      if (statsJson.success) {
        setStats(statsJson.data);
      }
      if (chartJson.success) {
        setChartData(chartJson.data);
      }
      if (ordersJson.success) {
        setRecentOrders(ordersJson.data);
      }

      // 모든 API가 실패한 경우에만 에러 표시
      if (!statsJson.success && !chartJson.success && !ordersJson.success) {
        setError("대시보드 데이터를 불러오는데 실패했습니다.");
      }
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const todaySalesChangeRate = calcChangeRate(stats.today_sales, stats.prev_day_sales);
  const monthSalesChangeRate = calcChangeRate(stats.month_sales, stats.prev_month_sales);
  const newUsersChangeRate = calcChangeRate(stats.new_users_today, stats.new_users_prev_day);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">대시보드 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">대시보드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            오늘 기준 실시간 현황 ({new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0]})
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2",
            "text-xs font-medium text-muted-foreground shadow-sm",
            "transition-all hover:border-primary/50 hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          aria-label="새로고침"
        >
          <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "갱신 중..." : "새로고침"}
        </button>
      </div>

      {/* 1행: Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardStatCard
          title="오늘 총 결제금액"
          value={formatKoreanMoney(stats.today_sales)}
          subValue={`전일 ${formatKoreanMoney(stats.prev_day_sales)}`}
          changeRate={todaySalesChangeRate}
          changeLabel="전일 대비"
          icon={CreditCard}
          iconBg="bg-brand-primary-muted"
          iconColor="text-primary"
        />
        <DashboardStatCard
          title="오늘 총 결제건수"
          value={`${stats.today_order_count.toLocaleString()}건`}
          icon={ShoppingCart}
          iconBg="bg-info-bg"
          iconColor="text-info"
        />
        <DashboardStatCard
          title="이번달 매출"
          value={formatKoreanMoney(stats.month_sales)}
          subValue={`전월 ${formatKoreanMoney(stats.prev_month_sales)}`}
          changeRate={monthSalesChangeRate}
          changeLabel="전월 대비"
          icon={CalendarDays}
          iconBg="bg-success-bg"
          iconColor="text-success"
        />
        <DashboardStatCard
          title="이번달 주문건수"
          value={`${stats.month_order_count.toLocaleString()}건`}
          icon={Calendar}
          iconBg="bg-accent/10"
          iconColor="text-accent"
        />
        <DashboardStatCard
          title="오늘 신규 회원"
          value={`${stats.new_users_today}명`}
          subValue={`전일 ${stats.new_users_prev_day}명`}
          changeRate={newUsersChangeRate}
          changeLabel="전일 대비"
          icon={UserPlus}
          iconBg="bg-brand-primary-muted"
          iconColor="text-primary"
        />
        <DashboardStatCard
          title="오늘 취소건수"
          value={`${stats.cancel_count_today}건`}
          subValue={`이번달 ${stats.cancel_count_month}건`}
          icon={XCircle}
          iconBg="bg-error-bg"
          iconColor="text-error"
          variant={stats.cancel_count_today > 5 ? "danger" : "default"}
        />
      </div>

      {/* 2행: 매출 차트 */}
      <DashboardSalesChart data={chartData} />

      {/* 3행: 최근 주문 + 핀 재고 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <DashboardRecentOrders orders={recentOrders} />
        <DashboardPinStock stocks={stats.pin_stock} />
      </div>
    </div>
  );
}
