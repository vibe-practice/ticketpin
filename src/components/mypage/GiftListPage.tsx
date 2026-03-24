"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Gift,
  Send,
  Inbox,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CalendarIcon,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatPrice, formatDateTime, maskCode } from "@/lib/utils";
import {
  type PeriodKey,
  PERIOD_OPTIONS,
  formatDateShort,
} from "@/lib/date-filter";
import { Input } from "@/components/ui/input";
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
import type { GiftHistoryItem, VoucherStatus } from "@/types";

const CONFIG = {
  sent: {
    title: "보낸 선물",
    description: "다른 회원에게 보낸 선물 내역을 확인하세요.",
    searchPlaceholder: "받는 사람 아이디 또는 이름 검색",
    badgeLabel: "보낸 선물",
    badgeIcon: Send,
    badgeClass: "border-warning/20 bg-warning-bg text-warning",
    imageOverlayClass: "bg-warning",
    emptyDescription: "아직 다른 회원에게 선물한 내역이 없습니다.",
    targetHeader: "받는 사람",
    getTargetLabel: (item: GiftHistoryItem) => `@${item.receiver.username}`,
    getTargetFull: (item: GiftHistoryItem) => `@${item.receiver.username} (${item.receiver.name})`,
  },
  received: {
    title: "받은 선물",
    description: "다른 회원으로부터 받은 선물 내역을 확인하세요.",
    searchPlaceholder: "보낸 사람 아이디 또는 이름 검색",
    badgeLabel: "받은 선물",
    badgeIcon: Inbox,
    badgeClass: "border-primary/20 bg-brand-primary-muted text-primary",
    imageOverlayClass: "bg-primary",
    emptyDescription: "아직 다른 회원으로부터 받은 선물이 없습니다.",
    targetHeader: "보낸 사람",
    getTargetLabel: (item: GiftHistoryItem) => `@${item.sender.username}`,
    getTargetFull: (item: GiftHistoryItem) => `@${item.sender.username} (${item.sender.name})`,
  },
} as const;

const RECEIVER_STATUS_CONFIG: Record<VoucherStatus, { label: string; className: string }> = {
  issued: { label: "미확인", className: "bg-muted text-muted-foreground" },
  temp_verified: { label: "임시인증", className: "bg-info-bg text-info" },
  password_set: { label: "비밀번호 설정", className: "bg-brand-primary-muted text-primary" },
  pin_revealed: { label: "핀 확인됨", className: "bg-success-bg text-success" },
  gifted: { label: "재선물", className: "bg-warning-bg text-warning" },
  cancelled: { label: "취소됨", className: "bg-error-bg text-error" },
};

function getPeriodDates(period: PeriodKey): { dateFrom?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── 확장 상세 ──────────────────────────────────────

function ExpandedDetail({ item, type }: { item: GiftHistoryItem; type: "sent" | "received" }) {
  const c = CONFIG[type];
  const linkHref = type === "sent" ? `/v/${item.source_voucher_code}` : `/v/${item.voucher_code}/actions`;

  return (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <div className="bg-muted/20 border-b border-border px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">{type === "sent" ? "받는 사람" : "보낸 사람"}</p>
              <p className="text-[14px] text-foreground font-medium">{c.getTargetFull(item)}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">교환권 코드</p>
              <p className="text-[14px] text-foreground font-medium tabular-nums">{maskCode(item.voucher_code)}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">날짜</p>
              <p className="text-[14px] text-foreground font-medium tabular-nums">{formatShortDateTime(item.created_at)}</p>
            </div>
            {item.order_quantity > 1 && (
              <div>
                <p className="text-[13px] text-muted-foreground mb-1">수량</p>
                <p className="text-[14px] text-foreground font-medium">{item.order_quantity}매</p>
              </div>
            )}
          </div>

          {type === "sent" && (() => {
            const sc = RECEIVER_STATUS_CONFIG[item.new_voucher_status as VoucherStatus];
            if (!sc) return null;
            return (
              <div className="mt-3">
                <span className="text-[13px] text-muted-foreground mr-2">받는 사람 상태:</span>
                <span className={cn("rounded-sm px-2 py-0.5 text-[13px] font-semibold", sc.className)}>{sc.label}</span>
              </div>
            );
          })()}

          <div className="mt-4">
            <Link
              href={linkHref}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border text-[14px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              교환권 상세보기
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── 데스크탑 테이블 행 ─────────────────────────────

function GiftRow({ item, type }: { item: GiftHistoryItem; type: "sent" | "received" }) {
  const [expanded, setExpanded] = useState(false);
  const c = CONFIG[type];
  const BadgeIcon = c.badgeIcon;
  const imageIcon = type === "sent" ? <Send size={9} className="text-primary-foreground" /> : <Gift size={10} className="text-primary-foreground" />;

  return (
    <>
      <tr
        className={cn("border-b border-border transition-colors duration-150 cursor-pointer hover:bg-muted/30", expanded && "bg-muted/20")}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* 상품 */}
        <td className="py-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {item.product?.image_url ? (
                <Image src={item.product.image_url} alt={item.product?.name ?? ""} fill className="object-cover" sizes="52px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Package size={22} className="text-muted-foreground/40" /></div>
              )}
              <div className={cn("absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl", c.imageOverlayClass)}>{imageIcon}</div>
            </div>
            <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1 min-w-0">{item.product?.name ?? "(삭제된 상품)"}</p>
          </div>
        </td>

        {/* 대상 */}
        <td className="py-4 px-3">
          <span className="text-[14px] text-foreground whitespace-nowrap">{c.getTargetLabel(item)}</span>
        </td>

        {/* 금액 */}
        <td className="py-4 px-3 text-right">
          <span className="text-[15px] font-bold text-foreground tabular-nums whitespace-nowrap">{formatPrice(item.product?.price ?? 0)}</span>
        </td>

        {/* 타입 */}
        <td className="py-4 px-3">
          <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap", c.badgeClass)}>
            <BadgeIcon size={11} />
            {c.badgeLabel}
          </span>
        </td>

        {/* 날짜 */}
        <td className="py-4 px-3">
          <span className="text-[14px] text-muted-foreground whitespace-nowrap tabular-nums">{formatShortDateTime(item.created_at)}</span>
        </td>

        {/* 상세 */}
        <td className="py-4 px-3 text-center">
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={expanded ? "접기" : "상세보기"}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && <ExpandedDetail item={item} type={type} />}
    </>
  );
}

// ── 모바일 행 ─────────────────────────────────────

function GiftMobileCard({ item, type }: { item: GiftHistoryItem; type: "sent" | "received" }) {
  const [expanded, setExpanded] = useState(false);
  const c = CONFIG[type];
  const linkHref = type === "sent" ? `/v/${item.source_voucher_code}` : `/v/${item.voucher_code}/actions`;

  return (
    <div className="border-b border-border">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left px-4 py-3.5 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {item.product?.image_url ? (
              <Image src={item.product.image_url} alt={item.product?.name ?? ""} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Package size={20} className="text-muted-foreground/40" /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground line-clamp-1">{item.product?.name ?? "(삭제된 상품)"}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[14px] font-bold text-foreground tabular-nums">{formatPrice(item.product?.price ?? 0)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[13px] text-muted-foreground">{c.getTargetLabel(item)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[13px] text-muted-foreground tabular-nums">{formatShortDate(item.created_at)}</span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="bg-muted/20 border-t border-border px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">{type === "sent" ? "받는 사람" : "보낸 사람"}</p>
              <p className="text-[13px] text-foreground">{c.getTargetFull(item)}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">교환권 코드</p>
              <p className="text-[13px] text-foreground tabular-nums">{maskCode(item.voucher_code)}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">날짜</p>
              <p className="text-[13px] text-foreground tabular-nums">{formatDateTime(item.created_at)}</p>
            </div>
            {item.order_quantity > 1 && (
              <div>
                <p className="text-[12px] text-muted-foreground mb-0.5">수량</p>
                <p className="text-[13px] text-foreground">{item.order_quantity}매</p>
              </div>
            )}
          </div>
          {type === "sent" && (() => {
            const sc = RECEIVER_STATUS_CONFIG[item.new_voucher_status as VoucherStatus];
            if (!sc) return null;
            return (
              <div>
                <span className="text-[12px] text-muted-foreground mr-1.5">받는 사람 상태:</span>
                <span className={cn("rounded-sm px-1.5 py-0.5 text-[12px] font-semibold", sc.className)}>{sc.label}</span>
              </div>
            );
          })()}
          <Link
            href={linkHref}
            className="flex items-center justify-center gap-1 w-full py-2 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            교환권 상세보기 <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── 스켈레톤 ──────────────────────────────────────────
function GiftsSkeleton() {
  return (
    <div className="w-full space-y-5 animate-pulse">
      <div><div className="h-7 w-24 bg-muted rounded" /><div className="h-5 w-56 bg-muted rounded mt-2" /></div>
      <div className="rounded-xl border border-border overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-16 border-b border-border bg-muted/30" />))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
interface GiftListPageProps { type: "sent" | "received"; }
const ITEMS_PER_PAGE = 10;

export function GiftListPage({ type }: GiftListPageProps) {
  const c = CONFIG[type];
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gifts, setGifts] = useState<GiftHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(searchQuery.trim()); setCurrentPage(1); }, 300); return () => clearTimeout(timer); }, [searchQuery]);

  const fetchGifts = useCallback(async (pageNum: number, giftType: "sent" | "received", periodKey: PeriodKey, range?: DateRange, search?: string) => {
    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set("type", giftType); params.set("page", String(pageNum)); params.set("limit", String(ITEMS_PER_PAGE));
      if (periodKey === "custom" && range?.from) { params.set("date_from", range.from.toISOString()); if (range.to) params.set("date_to", range.to.toISOString()); }
      else { const { dateFrom } = getPeriodDates(periodKey); if (dateFrom) params.set("date_from", dateFrom); }
      if (search) params.set("search", search);
      const res = await fetch(`/api/mypage/gifts?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error?.message ?? "선물 내역을 불러오는데 실패했습니다."); return; }
      setGifts(json.data.items); setTotalCount(json.data.total);
    } catch { setError("네트워크 오류가 발생했습니다."); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchGifts(currentPage, type, period, dateRange, debouncedSearch); }, [currentPage, type, period, dateRange, debouncedSearch, fetchGifts]);

  function handlePeriodClick(key: PeriodKey) { setPeriod(key); setDateRange(undefined); setCurrentPage(1); }
  function handleDateRangeSelect(range: DateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) { setPeriod("custom"); setCalendarOpen(false); setCurrentPage(1); }
  }
  function handleDateRangeApply() {
    if (!dateRange?.from) return;
    setDateRange({ from: dateRange.from, to: dateRange.to ?? dateRange.from }); setPeriod("custom"); setCalendarOpen(false); setCurrentPage(1);
  }
  function handleClearDateRange() { setDateRange(undefined); setPeriod("all"); setCurrentPage(1); }

  const totalPages = useMemo(() => Math.ceil(totalCount / ITEMS_PER_PAGE), [totalCount]);

  if (isLoading && gifts.length === 0) return <GiftsSkeleton />;

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{c.title}</h1>
        <p className="text-[16px] text-muted-foreground mt-1">{c.description}</p>
      </div>

      <div className="space-y-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder={c.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 pl-10 pr-9 text-[14px]" />
          {searchQuery && (<button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="검색어 지우기"><X size={14} /></button>)}
        </div>

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
          {period === "custom" && (<button type="button" onClick={handleClearDateRange} className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card text-muted-foreground hover:border-error/30 hover:text-error hover:bg-error-bg transition-all duration-150" aria-label="기간 초기화"><X size={14} /></button>)}
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.key} type="button" onClick={() => handlePeriodClick(opt.key)} className={cn("h-9 rounded-md px-3 text-[14px] font-medium transition-all duration-150", period === opt.key ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/50")}>{opt.label}</button>
          ))}
        </div>
      </div>

      {isLoading && gifts.length > 0 && (<div className="flex items-center gap-2 text-[15px] text-muted-foreground"><Loader2 size={16} className="animate-spin" /><span>불러오는 중...</span></div>)}
      {error && (<div className="rounded-lg border border-error/20 bg-error-bg px-4 py-3"><p className="text-[14px] text-error">{error}</p></div>)}
      {!isLoading && !error && totalCount > 0 && (<p className="text-[15px] text-muted-foreground">총 <strong className="font-semibold text-foreground">{totalCount}</strong>건</p>)}

      {/* 데스크탑: 테이블 */}
      {!isLoading && !error && gifts.length > 0 && (
        <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-4 sm:px-6 py-3">상품</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[120px]">{c.targetHeader}</th>
                <th className="text-right text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[100px]">금액</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[100px]">구분</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[140px]">날짜</th>
                <th className="text-center text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[50px]">상세</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((item) => (<GiftRow key={item.id} item={item} type={type} />))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일: 리스트 */}
      {!isLoading && !error && gifts.length > 0 && (
        <div className="sm:hidden rounded-xl border border-border overflow-hidden">
          {gifts.map((item) => (<GiftMobileCard key={item.id} item={item} type={type} />))}
        </div>
      )}

      {!isLoading && !error && gifts.length === 0 && (
        <EmptyState icon={Gift} title={`${c.title}이 없습니다`} description={searchQuery || period !== "all" ? "검색 조건에 맞는 선물 내역이 없습니다." : c.emptyDescription} size="md" />
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
