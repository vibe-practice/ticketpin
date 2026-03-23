"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Gift,
  Send,
  Inbox,
  Package,
  Calendar,
  Hash,
  ExternalLink,
  User,
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

// ── 타입별 설정 ────────────────────────────────────────────
const CONFIG = {
  sent: {
    title: "보낸 선물",
    description: "다른 회원에게 보낸 선물 내역을 확인하세요.",
    searchPlaceholder: "받는 사람 아이디 또는 이름 검색",
    badgeLabel: "보낸 선물",
    badgeIcon: Send,
    badgeClass: "border-warning/20 bg-warning-bg text-warning",
    indicatorClass: "from-warning/50 to-warning/10",
    hoverClass: "hover:border-warning/30",
    textHoverClass: "group-hover:text-warning",
    imageOverlayClass: "bg-warning",
    emptyDescription: "아직 다른 회원에게 선물한 내역이 없습니다.",
    bottomText:
      "선물한 상품권은 받는 사람에게 새로운 교환권 코드가 발급됩니다. 기존 교환권 코드로는 더 이상 접근할 수 없습니다.",
    actionLabel: "교환권 보기",
    getTargetUser: (item: GiftHistoryItem) => item.receiver,
    getTargetLabel: (item: GiftHistoryItem) =>
      `@${item.receiver.username} (${item.receiver.name}) 에게 보냄`,
  },
  received: {
    title: "받은 선물",
    description: "다른 회원으로부터 받은 선물 내역을 확인하세요.",
    searchPlaceholder: "보낸 사람 아이디 또는 이름 검색",
    badgeLabel: "받은 선물",
    badgeIcon: Inbox,
    badgeClass: "border-primary/20 bg-brand-primary-muted text-primary",
    indicatorClass: "from-primary/50 to-primary/10",
    hoverClass: "hover:border-primary/30 hover:-translate-y-0.5",
    textHoverClass: "group-hover:text-primary",
    imageOverlayClass: "bg-primary",
    emptyDescription: "아직 다른 회원으로부터 받은 선물이 없습니다.",
    bottomText:
      "받은 선물 카드를 클릭하면 교환권 상세 페이지로 이동합니다. 핀 번호 확인 및 선물하기 등의 기능을 이용할 수 있습니다.",
    actionLabel: "바로 사용하기",
    getTargetUser: (item: GiftHistoryItem) => item.sender,
    getTargetLabel: (item: GiftHistoryItem) =>
      `@${item.sender.username} (${item.sender.name}) 님이 보냄`,
  },
} as const;

// ── 받은 사람 교환권 상태 뱃지 ──────────────────────────────
const RECEIVER_STATUS_CONFIG: Record<VoucherStatus, { label: string; className: string }> = {
  issued: { label: "미확인", className: "bg-muted text-muted-foreground" },
  temp_verified: { label: "임시인증", className: "bg-info-bg text-info" },
  password_set: { label: "비밀번호 설정", className: "bg-brand-primary-muted text-primary" },
  pin_revealed: { label: "핀 확인됨", className: "bg-success-bg text-success" },
  gifted: { label: "재선물", className: "bg-warning-bg text-warning" },
  cancelled: { label: "취소됨", className: "bg-error-bg text-error" },
};

// PeriodKey에서 날짜 범위 계산
function getPeriodDates(period: PeriodKey): { dateFrom?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

// ── 카드 컴포넌트 ──────────────────────────────────────────
function GiftCard({
  item,
  type,
}: {
  item: GiftHistoryItem;
  type: "sent" | "received";
}) {
  const c = CONFIG[type];
  const BadgeIcon = c.badgeIcon;
  const imageIcon = type === "sent" ? <Send size={10} className="text-primary-foreground" /> : <Gift size={11} className="text-primary-foreground" />;

  return (
    <Link
      href={type === "sent" ? `/v/${item.source_voucher_code}` : `/v/${item.voucher_code}/actions`}
      className={cn(
        "group block rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md",
        c.hoverClass
      )}
      aria-label={`${item.product?.name ?? "(삭제된 상품)"} 선물 교환권 상세 보기`}
    >
      <div className={cn("h-1 bg-gradient-to-r", c.indicatorClass)} />

      <div className="flex items-start gap-3.5 p-4">
        <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {item.product?.image_url ? (
            <Image
              src={item.product.image_url}
              alt={item.product?.name ?? "(삭제된 상품)"}
              fill
              className="object-cover"
              sizes="68px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={26} className="text-muted-foreground/40" />
            </div>
          )}
          <div className={cn("absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-md", c.imageOverlayClass)}>
            {imageIcon}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm font-semibold text-foreground leading-snug line-clamp-2 transition-colors duration-150", c.textHoverClass)}>
              {item.product?.name ?? "(삭제된 상품)"}
            </p>
            <span className={cn("shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[13px] font-semibold", c.badgeClass)}>
              <BadgeIcon size={11} />
              {c.badgeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground tabular-nums">
              {formatPrice(item.product?.price ?? 0)}
            </span>
            {item.order_quantity > 1 && (
              <>
                <span className="text-[13px] text-muted-foreground/60">·</span>
                <span className="text-[13px] text-muted-foreground">
                  {item.order_quantity}매
                </span>
              </>
            )}
            {type === "sent" && (() => {
              const sc = RECEIVER_STATUS_CONFIG[item.new_voucher_status as VoucherStatus];
              if (!sc) return null;
              return (
                <span className={cn("rounded-sm px-1.5 py-0.5 text-[13px] font-semibold", sc.className)}>
                  {sc.label}
                </span>
              );
            })()}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1 text-[13px] text-foreground">
              <User size={11} />
              <span>{c.getTargetLabel(item)}</span>
            </div>
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <Calendar size={11} />
              <span>{formatDateTime(item.created_at)}</span>
            </div>
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground tracking-tight">
              <Hash size={11} />
              <span>{maskCode(item.voucher_code)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          클릭하여 교환권 상세 확인
        </p>
        <div className="flex items-center gap-1 text-[13px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <ExternalLink size={11} />
          <span>{c.actionLabel}</span>
        </div>
      </div>
    </Link>
  );
}

// ── 스켈레톤 ──────────────────────────────────────────
function GiftsSkeleton() {
  return (
    <div className="max-w-4xl w-full space-y-5 animate-pulse">
      <div>
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-4 w-56 bg-muted rounded mt-2" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
interface GiftListPageProps {
  type: "sent" | "received";
}

const ITEMS_PER_PAGE = 5;

export function GiftListPage({ type }: GiftListPageProps) {
  const c = CONFIG[type];
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // API 데이터 상태
  const [gifts, setGifts] = useState<GiftHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 검색 디바운스
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGifts = useCallback(async (
    pageNum: number,
    giftType: "sent" | "received",
    periodKey: PeriodKey,
    range?: DateRange,
    search?: string,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("type", giftType);
      params.set("page", String(pageNum));
      params.set("limit", String(ITEMS_PER_PAGE));

      if (periodKey === "custom" && range?.from) {
        params.set("date_from", range.from.toISOString());
        if (range.to) {
          params.set("date_to", range.to.toISOString());
        }
      } else {
        const { dateFrom } = getPeriodDates(periodKey);
        if (dateFrom) params.set("date_from", dateFrom);
      }

      if (search) {
        params.set("search", search);
      }

      const res = await fetch(`/api/mypage/gifts?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "선물 내역을 불러오는데 실패했습니다.");
        return;
      }

      setGifts(json.data.items);
      setTotalCount(json.data.total);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts(currentPage, type, period, dateRange, debouncedSearch);
  }, [currentPage, type, period, dateRange, debouncedSearch, fetchGifts]);

  function handlePeriodClick(key: PeriodKey) {
    setPeriod(key);
    setDateRange(undefined);
    setCurrentPage(1);
  }

  function handleDateRangeSelect(range: DateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
      setPeriod("custom");
      setCalendarOpen(false);
      setCurrentPage(1);
    }
  }

  function handleClearDateRange() {
    setDateRange(undefined);
    setPeriod("all");
    setCurrentPage(1);
  }

  const totalPages = useMemo(
    () => Math.ceil(totalCount / ITEMS_PER_PAGE),
    [totalCount]
  );

  if (isLoading && gifts.length === 0) {
    return <GiftsSkeleton />;
  }

  return (
    <div className="max-w-4xl w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">{c.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>
      </div>

      <div className="space-y-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={c.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-8 text-[13px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="검색어 지우기"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 rounded-md px-3 text-[13px] font-medium transition-all duration-150",
                  period === "custom"
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-brand-primary-muted"
                )}
              >
                <CalendarIcon size={13} />
                {period === "custom" && dateRange?.from
                  ? dateRange.to
                    ? `${formatDateShort(dateRange.from)} ~ ${formatDateShort(dateRange.to)}`
                    : formatDateShort(dateRange.from)
                  : "기간"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                locale={ko}
              />
            </PopoverContent>
          </Popover>

          {period === "custom" && (
            <button
              type="button"
              onClick={handleClearDateRange}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card text-muted-foreground hover:border-error/30 hover:text-error hover:bg-error-bg transition-all duration-150"
              aria-label="기간 초기화"
            >
              <X size={14} />
            </button>
          )}

          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handlePeriodClick(opt.key)}
              className={cn(
                "h-9 rounded-md px-3 text-[13px] font-medium transition-all duration-150",
                period === opt.key
                  ? "bg-primary text-white shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-brand-primary-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 인디케이터 */}
      {isLoading && gifts.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span>불러오는 중...</span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error-bg px-4 py-3">
          <p className="text-[13px] text-error">{error}</p>
        </div>
      )}

      {!isLoading && !error && totalCount > 0 && (
        <p className="text-[13px] text-muted-foreground">
          총{" "}
          <strong className="font-semibold text-foreground">
            {totalCount}
          </strong>
          건
        </p>
      )}

      {!isLoading && !error && gifts.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={`${c.title}이 없습니다`}
          description={
            searchQuery || period !== "all"
              ? "검색 조건에 맞는 선물 내역이 없습니다."
              : c.emptyDescription
          }
          size="md"
        />
      ) : (
        <div className="space-y-3">
          {gifts.map((item) => (
            <GiftCard key={item.id} item={item} type={type} />
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {!isLoading && !error && gifts.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {c.bottomText}
          </p>
        </div>
      )}
    </div>
  );
}
