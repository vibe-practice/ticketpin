"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Package,
  Gift,
  Hash,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatPrice, formatDateTime, maskCode } from "@/lib/utils";
import {
  type PeriodKey,
  PERIOD_OPTIONS,
  formatDateShort,
} from "@/lib/date-filter";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ko } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { VoucherListItem, VoucherStatus } from "@/types";

const ITEMS_PER_PAGE = 10;

type StatusTab = "all" | "active" | "cancelled";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "사용가능" },
  { key: "cancelled", label: "취소됨" },
];

function getPeriodDates(period: PeriodKey): { dateFrom?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── 뱃지 ──────────────────────────────────────────

function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
  const config: Record<VoucherStatus, { label: string; icon: React.ElementType; className: string }> = {
    issued: { label: "발급됨", icon: Clock, className: "bg-info-bg text-info border-info/20" },
    temp_verified: { label: "임시인증", icon: Clock, className: "bg-brand-primary-muted text-primary border-primary/20" },
    password_set: { label: "비밀번호 설정", icon: Lock, className: "bg-brand-primary-muted text-primary border-primary/20" },
    pin_revealed: { label: "핀 확인됨", icon: CheckCircle2, className: "bg-success-bg text-success border-success/20" },
    gifted: { label: "선물됨", icon: Gift, className: "bg-warning-bg text-warning border-warning/20" },
    cancelled: { label: "취소됨", icon: XCircle, className: "bg-error-bg text-error border-error/20" },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap", className)}>
      <Icon size={12} />
      {label}
    </span>
  );
}

// ── 테이블 확장 상세 ──────────────────────────────────

function ExpandedDetail({ item }: { item: VoucherListItem }) {
  const isCancelled = item.status === "cancelled";
  return (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <div className="bg-muted/20 border-b border-border px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">교환권 코드</p>
              <p className="text-[14px] text-foreground font-medium tabular-nums">{maskCode(item.code)}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">핀 개수</p>
              <p className="text-[14px] text-foreground font-medium">{item.pin_count}개</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">발급일</p>
              <p className="text-[14px] text-foreground font-medium tabular-nums">{formatShortDate(item.created_at)}</p>
            </div>
            {item.order.quantity > 1 && (
              <div>
                <p className="text-[13px] text-muted-foreground mb-1">수량</p>
                <p className="text-[14px] text-foreground font-medium">{item.order.quantity}매</p>
              </div>
            )}
          </div>

          {item.pin_revealed_at && (
            <div className="mt-3 flex items-center gap-1.5 text-[14px] text-success">
              <CheckCircle2 size={14} />
              <span>핀 확인 {formatDateTime(item.pin_revealed_at)}</span>
            </div>
          )}

          {item.is_gift && item.gift_sender_username && (
            <div className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <Gift size={14} />
              <span>@{item.gift_sender_username} 님으로부터 받은 선물</span>
            </div>
          )}

          {!isCancelled && (
            <div className="mt-4">
              <Link
                href={`/v/${item.code}`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border text-[14px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                교환권 상세보기
                <ChevronRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── 데스크탑 테이블 행 ────────────────────────────────

function VoucherRow({ item }: { item: VoucherListItem }) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = item.status === "cancelled";

  return (
    <>
      <tr
        className={cn(
          "border-b border-border transition-colors duration-150 cursor-pointer hover:bg-muted/30",
          isCancelled && "bg-error-bg/10",
          expanded && "bg-muted/20"
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* 상품 */}
        <td className="py-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {item.product?.image_url ? (
                <Image src={item.product.image_url} alt={item.product?.name ?? ""} fill className="object-cover" sizes="52px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package size={22} className="text-muted-foreground/40" />
                </div>
              )}
              {item.is_gift && (
                <div className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl bg-warning">
                  <Gift size={9} className="text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1">
                {item.product?.name ?? "(삭제된 상품)"}
              </p>
              <p className="text-[13px] text-muted-foreground mt-0.5 tabular-nums">
                <Hash size={10} className="inline -mt-0.5 mr-0.5" />
                {maskCode(item.code)}
              </p>
            </div>
          </div>
        </td>

        {/* 금액 */}
        <td className="py-4 px-3 text-right">
          <span className="text-[15px] font-bold text-foreground tabular-nums whitespace-nowrap">
            {formatPrice(item.product?.price ?? 0)}
          </span>
        </td>

        {/* 핀 */}
        <td className="py-4 px-3 text-center">
          <span className="text-[14px] text-foreground tabular-nums">{item.pin_count}</span>
        </td>

        {/* 상태 */}
        <td className="py-4 px-3">
          <VoucherStatusBadge status={item.status} />
        </td>

        {/* 발급일 */}
        <td className="py-4 px-3">
          <span className="text-[14px] text-muted-foreground whitespace-nowrap tabular-nums">
            {formatShortDate(item.created_at)}
          </span>
        </td>

        {/* 상세 */}
        <td className="py-4 px-3 text-center">
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={expanded ? "접기" : "상세보기"}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && <ExpandedDetail item={item} />}
    </>
  );
}

// ── 모바일 행 ─────────────────────────────────────

function VoucherMobileCard({ item }: { item: VoucherListItem }) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = item.status === "cancelled";

  return (
    <div className={cn("border-b border-border", isCancelled && "bg-error-bg/10")}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left px-4 py-3.5 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {item.product?.image_url ? (
              <Image src={item.product.image_url} alt={item.product?.name ?? ""} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package size={20} className="text-muted-foreground/40" />
              </div>
            )}
            {item.is_gift && (
              <div className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl bg-warning">
                <Gift size={9} className="text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-foreground line-clamp-1">{item.product?.name ?? "(삭제된 상품)"}</p>
              <VoucherStatusBadge status={item.status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[14px] font-bold text-foreground tabular-nums">{formatPrice(item.product?.price ?? 0)}</span>
              {item.pin_count > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[13px] text-muted-foreground">핀 {item.pin_count}개</span>
                </>
              )}
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[13px] text-muted-foreground tabular-nums">{formatShortDate(item.created_at).slice(5)}</span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="bg-muted/20 border-t border-border px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">교환권 코드</p>
              <p className="text-[13px] text-foreground tabular-nums">{maskCode(item.code)}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">핀 개수</p>
              <p className="text-[13px] text-foreground">{item.pin_count}개</p>
            </div>
            {item.order.quantity > 1 && (
              <div>
                <p className="text-[12px] text-muted-foreground mb-0.5">수량</p>
                <p className="text-[13px] text-foreground">{item.order.quantity}매</p>
              </div>
            )}
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">발급일</p>
              <p className="text-[13px] text-foreground tabular-nums">{formatShortDate(item.created_at)}</p>
            </div>
          </div>
          {item.pin_revealed_at && (
            <div className="flex items-center gap-1.5 text-[13px] text-success">
              <CheckCircle2 size={12} />
              <span>핀 확인 {formatDateTime(item.pin_revealed_at)}</span>
            </div>
          )}
          {item.is_gift && item.gift_sender_username && (
            <p className="text-[13px] text-muted-foreground">
              <Gift size={12} className="inline -mt-0.5 mr-1" />
              @{item.gift_sender_username} 님으로부터 받은 선물
            </p>
          )}
          {!isCancelled && (
            <Link
              href={`/v/${item.code}`}
              className="flex items-center justify-center gap-1 w-full py-2 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              교환권 상세보기 <ChevronRight size={13} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────
function VouchersSkeleton() {
  return (
    <div className="w-full space-y-5 animate-pulse">
      <div>
        <div className="h-7 w-24 bg-muted rounded" />
        <div className="h-5 w-56 bg-muted rounded mt-2" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 border-b border-border bg-muted/30" />
        ))}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────

export default function VouchersPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [vouchers, setVouchers] = useState<VoucherListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<StatusTab, number>>({ all: 0, active: 0, cancelled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async (pageNum: number, status: StatusTab, periodKey: PeriodKey, range?: DateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("status", status);
      if (periodKey === "custom" && range?.from) {
        params.set("date_from", range.from.toISOString());
        if (range.to) params.set("date_to", range.to.toISOString());
      } else {
        const { dateFrom } = getPeriodDates(periodKey);
        if (dateFrom) params.set("date_from", dateFrom);
      }
      const res = await fetch(`/api/mypage/vouchers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error?.message ?? "상품권 목록을 불러오는데 실패했습니다."); return; }
      setVouchers(json.data.items);
      setTotalCount(json.data.total);
      if (json.data.tab_counts) setTabCounts(json.data.tab_counts);
    } catch { setError("네트워크 오류가 발생했습니다."); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchVouchers(currentPage, statusTab, period, dateRange); }, [currentPage, statusTab, period, dateRange, fetchVouchers]);

  function handlePeriodClick(key: PeriodKey) { setPeriod(key); setDateRange(undefined); setCurrentPage(1); }
  function handleDateRangeSelect(range: DateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) { setPeriod("custom"); setCalendarOpen(false); setCurrentPage(1); }
  }
  function handleDateRangeApply() {
    if (!dateRange?.from) return;
    setDateRange({ from: dateRange.from, to: dateRange.to ?? dateRange.from });
    setPeriod("custom"); setCalendarOpen(false); setCurrentPage(1);
  }
  function handleClearDateRange() { setDateRange(undefined); setPeriod("all"); setCurrentPage(1); }
  function handleStatusTabChange(tab: StatusTab) { setStatusTab(tab); setCurrentPage(1); }

  const totalPages = useMemo(() => Math.ceil(totalCount / ITEMS_PER_PAGE), [totalCount]);

  if (isLoading && vouchers.length === 0) return <VouchersSkeleton />;

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">내 상품권</h1>
        <p className="text-[16px] text-muted-foreground mt-1">보유한 상품권의 상태를 확인하고 핀 번호를 조회하세요.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn("inline-flex items-center gap-1.5 h-9 rounded-md px-3 text-[14px] font-medium transition-all duration-150", period === "custom" ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/50")}>
                <CalendarIcon size={14} />
                {period === "custom" && dateRange?.from ? (dateRange.to ? `${formatDateShort(dateRange.from)} ~ ${formatDateShort(dateRange.to)}` : formatDateShort(dateRange.from)) : "기간"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI mode="range" selected={dateRange} onSelect={handleDateRangeSelect} numberOfMonths={2} disabled={{ after: new Date() }} locale={ko} />
              <div className="border-t border-border px-3 py-2 flex justify-end">
                <button type="button" onClick={handleDateRangeApply} disabled={!dateRange?.from} className={cn("px-4 py-1.5 rounded-md text-[14px] font-medium transition-colors duration-150", dateRange?.from ? "bg-foreground text-background hover:bg-foreground/80" : "bg-muted text-muted-foreground cursor-not-allowed")}>적용</button>
              </div>
            </PopoverContent>
          </Popover>
          {period === "custom" && (
            <button type="button" onClick={handleClearDateRange} className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card text-muted-foreground hover:border-error/30 hover:text-error hover:bg-error-bg transition-all duration-150" aria-label="기간 초기화"><X size={14} /></button>
          )}
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.key} type="button" onClick={() => handlePeriodClick(opt.key)} className={cn("h-9 rounded-md px-3 text-[14px] font-medium transition-all duration-150", period === opt.key ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/50")}>{opt.label}</button>
          ))}
        </div>

        <div className="flex border-b border-border" role="tablist" aria-label="상품권 상태 필터">
          {STATUS_TABS.map((tab) => {
            const count = tabCounts[tab.key];
            const isSelected = statusTab === tab.key;
            return (
              <button key={tab.key} type="button" role="tab" aria-selected={isSelected} onClick={() => handleStatusTabChange(tab.key)} className={cn("relative flex items-center gap-1.5 px-4 py-2.5 text-[15px] font-medium transition-all duration-150", isSelected ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                {tab.label}
                {count > 0 && (
                  <span className={cn("inline-flex items-center justify-center rounded-full min-w-[20px] h-[20px] px-1.5 text-[12px] font-bold tabular-nums", isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{count}</span>
                )}
                {isSelected && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground" />}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && vouchers.length > 0 && (
        <div className="flex items-center gap-2 text-[15px] text-muted-foreground"><Loader2 size={16} className="animate-spin" /><span>불러오는 중...</span></div>
      )}
      {error && (<div className="rounded-lg border border-error/20 bg-error-bg px-4 py-3"><p className="text-[14px] text-error">{error}</p></div>)}
      {!isLoading && !error && totalCount > 0 && (
        <p className="text-[15px] text-muted-foreground">총 <strong className="font-semibold text-foreground">{totalCount}</strong>개</p>
      )}

      {/* 데스크탑: 테이블 */}
      {!isLoading && !error && vouchers.length > 0 && (
        <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-4 sm:px-6 py-3">상품</th>
                <th className="text-right text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[100px]">금액</th>
                <th className="text-center text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[50px]">핀</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[120px]">상태</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[100px]">발급일</th>
                <th className="text-center text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[50px]">상세</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((item) => (<VoucherRow key={item.id} item={item} />))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일: 리스트 */}
      {!isLoading && !error && vouchers.length > 0 && (
        <div className="sm:hidden rounded-xl border border-border overflow-hidden">
          {vouchers.map((item) => (<VoucherMobileCard key={item.id} item={item} />))}
        </div>
      )}

      {!isLoading && !error && vouchers.length === 0 && (
        <EmptyState icon={Ticket} title="상품권이 없습니다" description={statusTab === "active" ? "사용 가능한 상품권이 없습니다." : statusTab === "cancelled" ? "취소된 상품권이 없습니다." : period !== "all" ? "선택한 기간에 상품권이 없습니다." : "아직 구매한 상품권이 없습니다. 지금 바로 구매해보세요."} action={statusTab === "all" && period === "all" ? { label: "상품권 구경하기", onClick: () => router.push("/") } : undefined} size="md" />
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
