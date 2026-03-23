"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  CalendarDays,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { BusinessAccessLog, BusinessAccessAction } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDateTime } from "@/lib/utils";
import { getQuickRangeDates, formatDateLabel } from "@/lib/utils/date";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";

// ─────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type QuickRange = "today" | "7d" | "30d" | "custom";

const QUICK_RANGE_LABELS: Record<QuickRange, string> = {
  today: "오늘",
  "7d": "7일",
  "30d": "30일",
  custom: "직접설정",
};

const ACTION_BADGE: Record<
  BusinessAccessAction,
  { label: string; className: string }
> = {
  verify_attempt: {
    label: "인증 시도",
    className:
      "bg-yellow-50 text-yellow-700 border border-yellow-200",
  },
  verify_success: {
    label: "인증 성공",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  login_attempt: {
    label: "로그인 시도",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  login_success: {
    label: "로그인 성공",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  login_fail: {
    label: "로그인 실패",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  page_access: {
    label: "페이지 접근",
    className: "bg-gray-50 text-gray-700 border border-gray-200",
  },
  logout: {
    label: "로그아웃",
    className: "bg-gray-50 text-gray-600 border border-gray-200",
  },
};

// ─────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────

function truncateUA(ua: string | null, maxLen = 60): string {
  if (!ua) return "-";
  return ua.length > maxLen ? ua.slice(0, maxLen) + "..." : ua;
}

// ─────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────

export function BusinessLogsClient() {
  const { businessId } = useBusinessAuth();

  const [logs, setLogs] = useState<BusinessAccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quickRange, setQuickRange] = useState<QuickRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  // ── API 호출 ──────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      if (quickRange !== "custom") {
        const dates = getQuickRangeDates(quickRange);
        if (dates) {
          params.set("from", dates.from);
          params.set("to", dates.to);
        }
      } else if (customRange?.from) {
        params.set("from", customRange.from.toISOString().slice(0, 10));
        if (customRange.to) {
          params.set("to", customRange.to.toISOString().slice(0, 10));
        }
      }

      const res = await fetch(
        `/api/business/${businessId}/access-logs?${params.toString()}`,
        { credentials: "include" }
      );
      const json = await res.json();

      if (json.success) {
        setLogs(json.data.logs);
        setTotal(json.data.total);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [businessId, page, pageSize, quickRange, customRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── 핸들러 ────────────────────────────────────────────────────
  const handleQuickRange = useCallback((range: QuickRange) => {
    setQuickRange(range);
    if (range !== "custom") setCustomRange(undefined);
    setPage(1);
  }, []);

  const handleCalendarSelect = useCallback((range: DateRange | undefined) => {
    setCustomRange(range);
    setPage(1);
    if (range?.from && range?.to) setCalendarOpen(false);
  }, []);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  // ── 직접설정 레이블 ───────────────────────────────────────────
  const customRangeLabel = useMemo(() => {
    if (quickRange !== "custom") return "직접설정";
    if (!customRange?.from) return "날짜 선택";
    if (!customRange.to) return `${formatDateLabel(customRange.from)} ~`;
    return `${formatDateLabel(customRange.from)} ~ ${formatDateLabel(customRange.to)}`;
  }, [quickRange, customRange]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">접근로그</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          포털 접근 이력을 확인합니다.
        </p>
      </div>

      {/* ── 필터 바 ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <CalendarDays size={16} className="text-muted-foreground" />
            기간
          </span>

          {(["today", "7d", "30d"] as QuickRange[]).map((r) => (
            <Button
              key={r}
              variant={quickRange === r ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickRange(r)}
              className={cn(
                "h-8 px-3 text-sm font-medium transition-all",
                quickRange === r
                  ? "bg-violet-600 hover:bg-violet-700 text-white border-transparent"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-violet-300"
              )}
            >
              {QUICK_RANGE_LABELS[r]}
            </Button>
          ))}

          {/* 직접설정 */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={quickRange === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickRange("custom")}
                className={cn(
                  "h-8 gap-1.5 px-3 text-sm font-medium transition-all",
                  quickRange === "custom"
                    ? "bg-violet-600 hover:bg-violet-700 text-white border-transparent"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-violet-300"
                )}
              >
                <CalendarDays size={13} />
                {customRangeLabel}
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform duration-150",
                    calendarOpen && "rotate-180"
                  )}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={handleCalendarSelect}
                initialFocus
                toDate={new Date()}
              />
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSizeOption);
                setPage(1);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}건</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {total}건 조회됨
            </span>
          </div>
        </div>
      </div>

      {/* ── 테이블 ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              로그를 불러오는 중...
            </span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      접근 시간
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      IP 주소
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      액션
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      User-Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <EmptyState
                          icon={Shield}
                          title="접근 로그가 없습니다"
                          description="선택한 기간에 해당하는 접근 로그가 없습니다."
                          size="sm"
                        />
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => {
                      const badge = ACTION_BADGE[log.action] ?? {
                        label: log.action,
                        className: "bg-gray-50 text-gray-600 border border-gray-200",
                      };

                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            "group transition-colors duration-100 hover:bg-violet-50/50",
                            idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                          )}
                        >
                          {/* 접근 시간 */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatDateTime(log.created_at)}
                            </span>
                          </td>
                          {/* IP 주소 */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-sm text-foreground">
                              {log.ip_address}
                            </span>
                          </td>
                          {/* 액션 */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                badge.className
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                          {/* User-Agent */}
                          <td className="px-4 py-3.5">
                            <span
                              className="text-xs text-muted-foreground"
                              title={log.user_agent ?? undefined}
                            >
                              {truncateUA(log.user_agent)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="border-t border-border px-4 py-3">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
