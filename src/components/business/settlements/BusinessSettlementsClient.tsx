"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { ReceiptText, TrendingUp, Loader2 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";
import type { Settlement } from "@/types";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type StatusFilter = "all" | "pending" | "confirmed" | "paid" | "cancelled";
type DateFilter = "today" | "7d" | "30d" | "custom";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "대기" },
  { value: "confirmed", label: "확인" },
  { value: "paid", label: "지급완료" },
  { value: "cancelled", label: "취소" },
];

const DATE_FILTER_TABS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "custom", label: "직접설정" },
];

const STATUS_BADGE: Record<
  Settlement["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "대기",
    className:
      "bg-yellow-50 text-yellow-700 border border-yellow-200 ring-yellow-100",
  },
  confirmed: {
    label: "확인",
    className: "bg-blue-50 text-blue-700 border border-blue-200 ring-blue-100",
  },
  paid: {
    label: "지급완료",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-emerald-100",
  },
  cancelled: {
    label: "취소",
    className:
      "bg-gray-50 text-gray-500 border border-gray-200 ring-gray-100",
  },
};

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────

function getDateBoundary(filter: Exclude<DateFilter, "custom">): string {
  const d = new Date();
  if (filter === "7d") {
    d.setDate(d.getDate() - 6);
  } else if (filter === "30d") {
    d.setDate(d.getDate() - 29);
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

function getTodayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function BusinessSettlementsClient() {
  const { businessId } = useBusinessAuth();
  const [loading, setLoading] = useState(true);

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    all: 0, pending: 0, confirmed: 0, paid: 0, cancelled: 0,
  });
  const [summary, setSummary] = useState({ total_settlement_amount: 0, total_gift_count: 0 });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  // ── 날짜 파라미터 계산 ──────────────────────────────────────────────────────
  const dateParams = useMemo(() => {
    if (dateFilter !== "custom") {
      const boundary = getDateBoundary(dateFilter);
      const today = getTodayKST();
      return { date_from: boundary, date_to: today };
    }
    return {
      date_from: customFrom || undefined,
      date_to: customTo || undefined,
    };
  }, [dateFilter, customFrom, customTo]);

  // ── API 호출 ──────────────────────────────────────────────────────────────────
  const fetchSettlements = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      if (dateParams.date_from) params.set("date_from", dateParams.date_from);
      if (dateParams.date_to) params.set("date_to", dateParams.date_to);

      // 상태 필터를 서버에 전달
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const res = await fetch(
        `/api/business/${businessId}/settlements?${params.toString()}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSettlements(json.data.items);
          setTotal(json.data.total);
          setTotalPages(json.data.total_pages);
          if (json.data.status_counts) setStatusCounts(json.data.status_counts);
          if (json.data.summary) setSummary(json.data.summary);
        }
      }
    } catch {
      // 네트워크 오류
    } finally {
      setLoading(false);
    }
  }, [businessId, page, pageSize, dateParams, statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // 필터 변경 시 페이지 초기화
  const handleStatusFilter = (v: StatusFilter) => {
    setStatusFilter(v);
    setPage(1);
  };
  const handleDateFilter = (v: DateFilter) => {
    setDateFilter(v);
    setPage(1);
  };

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">정산내역</h1>
        <p className="text-sm text-muted-foreground">
          정산 내역을 확인하고 상태를 조회합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="조회 기간 정산건수"
          value={loading ? "-" : `${statusCounts.all}건`}
          subValue={loading ? undefined : `매입 ${summary.total_gift_count.toLocaleString()}건`}
          icon={ReceiptText}
          color="violet"
        />
        <SummaryCard
          label="총 정산금액"
          value={loading ? "-" : formatPrice(summary.total_settlement_amount)}
          subValue={statusCounts.all > 0 ? "필터 적용 기준" : undefined}
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* 필터 영역 */}
      <div className="rounded-xl border border-border bg-card">
        {/* 상태 필터 탭 */}
        <div className="flex items-center gap-1 border-b border-border px-4 pt-4 pb-0">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.value] ?? 0;
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleStatusFilter(tab.value)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                  "rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
                  isActive
                    ? "border-b-2 border-neutral-900 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                    isActive
                      ? "bg-neutral-100 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 기간 필터 */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            기간
          </span>
          <div className="flex flex-wrap gap-1">
            {DATE_FILTER_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={dateFilter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateFilter(tab.value)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-medium",
                  dateFilter === tab.value
                    ? "bg-black text-white hover:bg-neutral-800"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* 직접설정 인풋 */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-900"
                aria-label="시작일"
              />
              <span className="text-xs text-muted-foreground">~</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-900"
                aria-label="종료일"
              />
            </div>
          )}
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* 테이블 헤더 바 */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
          <span className="text-sm font-semibold text-foreground">
            정산 내역
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSizeOption);
                setPage(1);
              }}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}건</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              총{" "}
              <span className="font-semibold text-foreground">
                {total}
              </span>
              건
            </span>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "정산일",
                  "매입건수",
                  "매입총액",
                  "수수료율",
                  "정산금액",
                  "상태",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin text-foreground" />
                      <span className="text-sm text-muted-foreground">로딩 중...</span>
                    </div>
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ReceiptText}
                      title="정산 내역이 없습니다"
                      description="선택한 기간과 상태에 해당하는 정산 내역이 없습니다."
                      size="sm"
                    />
                  </td>
                </tr>
              ) : (
                settlements.map((item) => (
                  <SettlementRow key={item.id} item={item} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 테이블 푸터 — 소계 */}
        {!loading && settlements.length > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              이 페이지 소계
            </span>
            <div className="flex items-center gap-6 text-xs">
              <span className="text-muted-foreground">
                매입{" "}
                <span className="font-semibold text-foreground">
                  {settlements
                    .reduce((a, s) => a + s.gift_count, 0)
                    .toLocaleString()}
                  건
                </span>
              </span>
              <span className="text-muted-foreground">
                정산{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(
                    settlements.reduce((a, s) => a + s.settlement_amount, 0)
                  )}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="pt-1"
        />
      )}
    </div>
  );
}

// ─── 행 컴포넌트 ──────────────────────────────────────────────────────────────

function SettlementRow({ item }: { item: Settlement }) {
  const badge = STATUS_BADGE[item.status];
  const feePercent = 100 - item.commission_rate;

  return (
    <tr className="group transition-colors duration-100 hover:bg-neutral-50/40">
      {/* 정산일 */}
      <td className="px-5 py-3.5 font-mono text-sm tabular-nums text-foreground">
        {item.settlement_date}
      </td>

      {/* 매입건수 */}
      <td className="px-5 py-3.5 text-sm text-foreground">
        {item.gift_count.toLocaleString()}건
      </td>

      {/* 매입총액 */}
      <td className="px-5 py-3.5 text-sm tabular-nums text-foreground">
        {formatPrice(item.gift_total_amount)}
      </td>

      {/* 수수료율 */}
      <td className="px-5 py-3.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="font-medium text-foreground">{feePercent}%</span>
          <span className="text-xs">(매출의 {item.commission_rate}% 정산)</span>
        </span>
      </td>

      {/* 정산금액 */}
      <td className="px-5 py-3.5 text-sm tabular-nums font-semibold text-foreground">
        {formatPrice(item.settlement_amount)}
      </td>

      {/* 상태 */}
      <td className="px-5 py-3.5">
        <span
          className={cn(
            "inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-semibold",
            badge.className
          )}
        >
          {badge.label}
        </span>
      </td>
    </tr>
  );
}

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  violet: {
    iconBg: "bg-neutral-100",
    iconText: "text-foreground",
    valueText: "text-foreground",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    valueText: "text-emerald-700",
  },
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    valueText: "text-blue-700",
  },
};

function SummaryCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: keyof typeof COLOR_MAP;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-xl font-bold", c.valueText)}>{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            c.iconBg
          )}
        >
          <Icon size={18} className={c.iconText} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
