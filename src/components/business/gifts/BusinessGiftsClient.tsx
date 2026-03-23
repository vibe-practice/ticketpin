"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Download,
  CalendarDays,
  ChevronDown,
  Package,
  TrendingUp,
  Receipt,
  Loader2,
  Search,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { BusinessGiftListItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";
import { cn, formatPrice, formatDateTime } from "@/lib/utils";
import { getQuickRangeDates, formatDateLabel } from "@/lib/utils/date";

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

function downloadCSV(items: BusinessGiftListItem[]) {
  const header = ["주문일시", "이름", "상품명", "수량", "결제금액", "카드사", "일시불/할부", "정산예정금액", "상태"];
  const rows = items.map((item) => [
    formatDateTime(item.created_at).replace(".", "-").replace(".", "-"),
    item.sender_name,
    item.product_name,
    String(item.quantity),
    String(item.total_amount),
    item.card_company,
    item.installment,
    String(item.settlement_amount),
    item.voucher_status === "cancelled" ? "취소" : "정상",
  ]);

  const csvContent =
    "\uFEFF" + // BOM (Excel 한글 호환)
    [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `매입상세_${dateStr}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────
// 합계 카드 컴포넌트
// ─────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

function SummaryCard({ icon, label, value, sub, accent }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm",
        accent && "border-violet-200 bg-violet-50"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          accent ? "bg-violet-100 text-violet-600" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-xl font-bold tracking-tight",
            accent ? "text-violet-700" : "text-foreground"
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 메인 클라이언트 컴포넌트
// ─────────────────────────────────────────────────────────────────

export function BusinessGiftsClient() {
  const { businessId } = useBusinessAuth();
  const [gifts, setGifts] = useState<BusinessGiftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total_count: 0, total_amount: 0, total_settlement: 0 });

  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [csvLoading, setCsvLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── 날짜 범위 계산 ──────────────────────────────────────────────
  const dateParams = useMemo(() => {
    if (quickRange !== "custom") {
      return getQuickRangeDates(quickRange);
    }
    if (!customRange?.from) return null;
    const kstFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
    const from = kstFmt.format(customRange.from);
    const to = customRange.to ? kstFmt.format(customRange.to) : from;
    return { from, to };
  }, [quickRange, customRange]);

  // ── 디바운스된 검색어 ──────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── API 호출 ──────────────────────────────────────────────────────
  const fetchGifts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (dateParams) {
        params.set("date_from", dateParams.from);
        params.set("date_to", dateParams.to);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(
        `/api/business/${businessId}/gifts?${params.toString()}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setGifts(json.data.items);
          setTotal(json.data.total);
          setTotalPages(json.data.total_pages);
          setSummary(json.data.summary);
        }
      }
    } catch {
      // 네트워크 오류 시 빈 데이터 유지
    } finally {
      setLoading(false);
    }
  }, [businessId, page, pageSize, dateParams, debouncedSearch]);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  // ── CSV 내보내기 ──────────────────────────────────────────────────
  const handleCSVExport = useCallback(async () => {
    if (!businessId) return;
    setCsvLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");
      if (dateParams) {
        params.set("date_from", dateParams.from);
        params.set("date_to", dateParams.to);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(
        `/api/business/${businessId}/gifts?${params.toString()}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          downloadCSV(json.data.items);
        }
      }
    } catch {
      // CSV 다운로드 실패
    } finally {
      setCsvLoading(false);
    }
  }, [businessId, dateParams, debouncedSearch]);

  // ── 핸들러 ───────────────────────────────────────────────────────
  const handleQuickRange = useCallback(
    (range: QuickRange) => {
      setQuickRange(range);
      if (range !== "custom") setCustomRange(undefined);
      setPage(1);
    },
    []
  );

  const handleCalendarSelect = useCallback((range: DateRange | undefined) => {
    setCustomRange(range);
    setPage(1);
    if (range?.from && range?.to) setCalendarOpen(false);
  }, []);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  // ── 직접설정 레이블 ──────────────────────────────────────────────
  const customRangeLabel = useMemo(() => {
    if (quickRange !== "custom") return "직접설정";
    if (!customRange?.from) return "날짜 선택";
    if (!customRange.to) return `${formatDateLabel(customRange.from)} ~`;
    return `${formatDateLabel(customRange.from)} ~ ${formatDateLabel(customRange.to)}`;
  }, [quickRange, customRange]);

  return (
    <div className="space-y-6">
      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">매입상세</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            고객이 업체로 선물한 매입 내역을 확인합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCSVExport}
          disabled={total === 0 || csvLoading}
          className="h-9 gap-1.5 self-start border-border text-sm font-medium"
        >
          {csvLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          CSV 내보내기
        </Button>
      </div>

      {/* ── 합계 카드 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Package size={20} />}
          label="총 건수"
          value={`${summary.total_count.toLocaleString()}건`}
        />
        <SummaryCard
          icon={<Receipt size={20} />}
          label="총 금액"
          value={formatPrice(summary.total_amount)}
          accent
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          label="총 정산금액"
          value={formatPrice(summary.total_settlement)}
        />
      </div>

      {/* ── 필터 바 ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <CalendarDays size={16} className="text-muted-foreground" />
            기간
          </span>

          {/* 빠른 선택 버튼 */}
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

      {/* ── 검색 ──────────────────────────────────────────────────── */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름, 전화번호, 상품명, 카드사 등 검색..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* ── 테이블 ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  주문일시
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  상품명
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  수량
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  결제금액
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  카드사
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  일시불/할부
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  정산예정금액
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin text-violet-500" />
                      <span className="text-sm text-muted-foreground">로딩 중...</span>
                    </div>
                  </td>
                </tr>
              ) : gifts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={Package}
                      title="매입 내역이 없습니다"
                      description="선택한 기간에 해당하는 매입 내역이 없습니다."
                      size="sm"
                    />
                  </td>
                </tr>
              ) : (
                gifts.map((item, idx) => {
                  const isCancelled = item.voucher_status === "cancelled";
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "group transition-colors duration-100 hover:bg-violet-50/50",
                        idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                        isCancelled && "opacity-60"
                      )}
                    >
                      {/* 주문일시 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={cn("font-mono text-xs text-muted-foreground", isCancelled && "line-through")}>
                          {formatDateTime(item.created_at)}
                        </span>
                      </td>
                      {/* 이름 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={cn("font-medium text-foreground", isCancelled && "line-through")}>{item.sender_name}</span>
                          {item.sender_phone && (
                            <span className="text-xs text-muted-foreground">{item.sender_phone}</span>
                          )}
                        </div>
                      </td>
                      {/* 상품명 */}
                      <td className="px-4 py-3.5">
                        <span className={cn("font-medium text-foreground", isCancelled && "line-through")}>{item.product_name}</span>
                      </td>
                      {/* 수량 */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={cn("font-medium text-foreground", isCancelled && "line-through")}>{item.quantity.toLocaleString()}</span>
                        <span className="ml-0.5 text-xs text-muted-foreground">개</span>
                      </td>
                      {/* 결제금액 */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={cn("font-semibold text-foreground", isCancelled && "line-through")}>
                          {formatPrice(item.total_amount)}
                        </span>
                      </td>
                      {/* 카드사 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={cn("text-sm text-foreground", isCancelled && "line-through")}>
                          {item.card_company || "-"}
                        </span>
                      </td>
                      {/* 일시불/할부 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border",
                          isCancelled
                            ? "bg-muted text-muted-foreground border-border line-through"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        )}>
                          {item.installment}
                        </span>
                      </td>
                      {/* 정산예정금액 */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={cn(
                          "font-bold",
                          isCancelled ? "text-muted-foreground line-through" : "text-violet-700"
                        )}>
                          {formatPrice(item.settlement_amount)}
                        </span>
                      </td>
                      {/* 상태 */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                            취소
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                            정상
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* 테이블 하단 합계 행 */}
            {!loading && gifts.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={3} className="px-4 py-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      전체 {total}건 중 {(page - 1) * pageSize + 1}
                      {" "}~ {Math.min(page * pageSize, total)}건 표시
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {gifts.reduce((acc, g) => acc + g.quantity, 0).toLocaleString()}개
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-foreground">
                      {formatPrice(summary.total_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-violet-700">
                      {formatPrice(summary.total_settlement)}
                    </span>
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
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
      </div>
    </div>
  );
}
