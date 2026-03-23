"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Banknote,
  Calculator,
  CalendarCheck,
  CalendarRange,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DashboardStatCard } from "@/components/admin/dashboard/DashboardStatCard";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";
import type { BusinessDashboardStats } from "@/types";
import { cn } from "@/lib/utils";
import { formatDateKR, toKstDateStr } from "@/lib/utils/date";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type PeriodPreset = "today" | "7d" | "30d" | "custom";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function calcChangeRate(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

// ─── 기간 프리셋 정의 ────────────────────────────────────────────────────────

const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
];

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "오늘",
  "7d": "최근 7일",
  "30d": "최근 30일",
  custom: "직접설정",
};

const CHANGE_LABELS: Record<PeriodPreset, string> = {
  today: "전일 대비",
  "7d": "이전 7일 대비",
  "30d": "이전 30일 대비",
  custom: "이전 동일 기간 대비",
};

// ─── 통계 카드 설정 ──────────────────────────────────────────────────────────

interface StatCardConfig {
  getTitle: (period: PeriodPreset) => string;
  getValue: (stats: BusinessDashboardStats) => string;
  getChangeRate: (stats: BusinessDashboardStats) => number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const STAT_CARD_CONFIGS: StatCardConfig[] = [
  {
    getTitle: (p) => `${PERIOD_LABELS[p]} 매입건수`,
    getValue: (s) => `${s.today_gift_count.toLocaleString("ko-KR")}건`,
    getChangeRate: (s) => calcChangeRate(s.today_gift_count, s.prev_day_gift_count),
    icon: ShoppingBag,
    iconBg: "bg-neutral-100",
    iconColor: "text-foreground",
  },
  {
    getTitle: (p) => `${PERIOD_LABELS[p]} 매입금액`,
    getValue: (s) => formatAmount(s.today_gift_amount),
    getChangeRate: (s) => calcChangeRate(s.today_gift_amount, s.prev_day_gift_amount),
    icon: Banknote,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  {
    getTitle: (p) => `${PERIOD_LABELS[p]} 정산금액`,
    getValue: (s) => formatAmount(s.today_settlement_amount),
    getChangeRate: (s) =>
      calcChangeRate(s.today_settlement_amount, s.prev_day_settlement_amount),
    icon: Calculator,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    getTitle: () => "이번달 정산금액",
    getValue: (s) => formatAmount(s.month_settlement_amount),
    getChangeRate: (s) =>
      calcChangeRate(s.month_settlement_amount, s.prev_month_settlement_amount),
    icon: CalendarCheck,
    iconBg: "bg-neutral-100",
    iconColor: "text-foreground",
  },
];

// ─── 기본 통계 (로딩 중 표시용) ──────────────────────────────────────────────

const EMPTY_STATS: BusinessDashboardStats = {
  today_gift_count: 0,
  today_gift_amount: 0,
  today_settlement_amount: 0,
  month_settlement_amount: 0,
  prev_day_gift_count: 0,
  prev_day_gift_amount: 0,
  prev_day_settlement_amount: 0,
  prev_month_settlement_amount: 0,
};

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export function BusinessDashboardClient() {
  const { businessId } = useBusinessAuth();
  const [stats, setStats] = useState<BusinessDashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodPreset>("today");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  const fetchDashboard = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && dateRange.from) {
        params.set("from", toKstDateStr(dateRange.from));
        params.set("to", dateRange.to ? toKstDateStr(dateRange.to) : toKstDateStr(dateRange.from));
      }
      const url = `/api/business/${businessId}/dashboard?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      }
    } catch {
      // 네트워크 오류 시 빈 통계 유지
    } finally {
      setLoading(false);
    }
  }, [businessId, period, dateRange]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 직접설정 선택 범위 표시 텍스트 (확정된 범위)
  const customRangeLabel = useMemo(() => {
    if (!dateRange.from) return "날짜 선택";
    if (!dateRange.to) return formatDateKR(dateRange.from);
    return `${formatDateKR(dateRange.from)} ~ ${formatDateKR(dateRange.to)}`;
  }, [dateRange]);

  // 캘린더에서 선택 중인 범위 표시 텍스트 (임시)
  const pendingRangeLabel = useMemo(() => {
    if (!pendingDateRange.from) return "날짜를 선택하세요";
    if (!pendingDateRange.to) return formatDateKR(pendingDateRange.from);
    return `${formatDateKR(pendingDateRange.from)} ~ ${formatDateKR(pendingDateRange.to)}`;
  }, [pendingDateRange]);

  const changeLabel = CHANGE_LABELS[period];

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            대시보드
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            업체 포털에 오신 것을 환영합니다. 실시간 매입·정산 현황을 확인하세요.
          </p>
        </div>

        {/* ── 기간 필터 ── */}
        <div className="flex items-center gap-2">
          {/* 프리셋 버튼 그룹 */}
          <div className="flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
            {PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  setPeriod(preset.value);
                  setCalendarOpen(false);
                }}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                  period === preset.value
                    ? "bg-black text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 직접설정 — Popover 달력 */}
          <Popover open={calendarOpen} onOpenChange={(open) => {
              setCalendarOpen(open);
              if (open) {
                setPendingDateRange({ from: dateRange.from, to: dateRange.to });
              }
            }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriod("custom")}
                className={cn(
                  "h-8 gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                  period === "custom"
                    ? "border-neutral-900 bg-black text-white hover:bg-neutral-800"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarRange size={13} />
                {period === "custom" ? customRangeLabel : "직접설정"}
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform duration-150",
                    calendarOpen && "rotate-180"
                  )}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-auto p-0"
              sideOffset={6}
            >
              <div className="rounded-xl border border-border bg-card shadow-lg">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">기간 직접 설정</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    시작일과 종료일을 선택하세요
                  </p>
                </div>
                <Calendar
                  mode="range"
                  selected={
                    pendingDateRange.from
                      ? { from: pendingDateRange.from, to: pendingDateRange.to }
                      : undefined
                  }
                  onSelect={(range) => {
                    setPendingDateRange({
                      from: range?.from,
                      to: range?.to,
                    });
                  }}
                  numberOfMonths={2}
                  className="p-3"
                />
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {pendingDateRange.from
                      ? pendingRangeLabel
                      : "날짜를 선택하세요"}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setPendingDateRange({ from: undefined, to: undefined });
                        setDateRange({ from: undefined, to: undefined });
                        setPeriod("today");
                        setCalendarOpen(false);
                      }}
                    >
                      초기화
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 bg-black text-xs hover:bg-neutral-800"
                      disabled={!pendingDateRange.from}
                      onClick={() => {
                        setDateRange({
                          from: pendingDateRange.from,
                          to: pendingDateRange.to,
                        });
                        setCalendarOpen(false);
                      }}
                    >
                      적용
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── 통계 카드 4개 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">통계 로딩 중...</span>
          </div>
        ) : (
          STAT_CARD_CONFIGS.map((config) => (
            <DashboardStatCard
              key={config.getTitle(period)}
              title={config.getTitle(period)}
              value={config.getValue(stats)}
              changeRate={config.getChangeRate(stats)}
              changeLabel={config.getTitle(period) === "이번달 정산금액" ? "전월 대비" : changeLabel}
              icon={config.icon}
              iconBg={config.iconBg}
              iconColor={config.iconColor}
            />
          ))
        )}
      </div>

      {/* ── 안내 배너 ── */}
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-black">
          <span className="text-[10px] font-bold text-white">i</span>
        </div>
        <p className="text-xs text-foreground">
          현재{" "}
          <span className="font-semibold">
            {period === "custom" ? customRangeLabel : PERIOD_LABELS[period]}
          </span>{" "}
          기준 데이터입니다. {changeLabel} 변화율이 함께 표시됩니다.
        </p>
      </div>
    </div>
  );
}
