"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Package,
  ExternalLink,
  Gift,
  Hash,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  CalendarIcon,
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

const ITEMS_PER_PAGE = 5;

type StatusTab = "all" | "active" | "cancelled";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "사용가능" },
  { key: "cancelled", label: "취소됨" },
];

const ACTIVE_STATUSES: VoucherStatus[] = [
  "issued",
  "temp_verified",
  "password_set",
];

// PeriodKey에서 날짜 범위 계산
function getPeriodDates(period: PeriodKey): { dateFrom?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

// ── 뱃지 컴포넌트 ──────────────────────────────────────────

function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
  const config: Record<VoucherStatus, { label: string; icon: React.ElementType; className: string }> = {
    issued: {
      label: "발급됨",
      icon: Clock,
      className: "bg-info-bg text-info border-info/20",
    },
    temp_verified: {
      label: "임시인증",
      icon: Clock,
      className: "bg-brand-primary-muted text-primary border-primary/20",
    },
    password_set: {
      label: "비밀번호 설정",
      icon: Lock,
      className: "bg-brand-primary-muted text-primary border-primary/20",
    },
    pin_revealed: {
      label: "핀 확인됨",
      icon: CheckCircle2,
      className: "bg-success-bg text-success border-success/20",
    },
    gifted: {
      label: "선물됨",
      icon: Gift,
      className: "bg-warning-bg text-warning border-warning/20",
    },
    cancelled: {
      label: "취소됨",
      icon: XCircle,
      className: "bg-error-bg text-error border-error/20",
    },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[13px] font-semibold",
        className
      )}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

// ── 상품권 카드 ────────────────────────────────────────────

function VoucherCard({ item }: { item: VoucherListItem }) {
  const isActive = ACTIVE_STATUSES.includes(item.status);
  const isGifted = item.status === "gifted";
  const isCancelled = item.status === "cancelled";
  return (
    <Link
      href={`/v/${item.code}`}
      className={cn(
        "group block rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200",
        isCancelled
          ? "border-error/20 opacity-75 hover:opacity-90"
          : isGifted
            ? "border-warning/20 hover:border-warning/40 hover:shadow-md"
            : "border-border hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
      )}
      aria-label={`${item.product?.name ?? "(삭제된 상품)"} 교환권 상세 보기`}
    >
      <div
        className={cn(
          "h-1",
          isCancelled
            ? "bg-gradient-to-r from-error/60 to-error/20"
            : isGifted
              ? "bg-gradient-to-r from-warning/60 to-warning/20"
              : "bg-gradient-to-r from-primary/50 to-primary/10"
        )}
      />

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
          {item.is_gift && (
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-md bg-warning">
              <Gift size={11} className="text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-150">
              {item.product?.name ?? "(삭제된 상품)"}
            </p>
            <div className="shrink-0 mt-0.5">
              <VoucherStatusBadge status={item.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground tabular-nums">
              {formatPrice(item.product?.price ?? 0)}
            </span>
            {item.pin_count > 0 && (
              <>
                <span className="text-[13px] text-muted-foreground/60">·</span>
                <span className="text-[13px] text-muted-foreground">
                  핀 {item.pin_count}개
                </span>
              </>
            )}
            {item.order.quantity > 1 && (
              <>
                <span className="text-[13px] text-muted-foreground/60">·</span>
                <span className="text-[13px] text-muted-foreground">
                  {item.order.quantity}매
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <Calendar size={11} />
              <span>{formatDateShort(new Date(item.created_at))}</span>
            </div>
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground tracking-tight">
              <Hash size={11} />
              <span>{maskCode(item.code)}</span>
            </div>
            {item.pin_revealed_at && (
              <div className="flex items-center gap-1 text-[13px] text-success">
                <CheckCircle2 size={11} />
                <span>핀 확인 {formatDateTime(item.pin_revealed_at)}</span>
              </div>
            )}
            {item.is_gift && item.gift_sender_username && (
              <div className="flex items-center gap-1 text-[13px] text-foreground">
                <Gift size={11} />
                <span>@{item.gift_sender_username} 님으로부터 받은 선물</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isActive && (
        <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            클릭하여 교환권 상세 확인
          </p>
          <div className="flex items-center gap-1 text-[13px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <ExternalLink size={11} />
            <span>바로가기</span>
          </div>
        </div>
      )}
    </Link>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────
function VouchersSkeleton() {
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

// ── 메인 페이지 ───────────────────────────────────────────

export default function VouchersPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // API 데이터 상태
  const [vouchers, setVouchers] = useState<VoucherListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<StatusTab, number>>({ all: 0, active: 0, cancelled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async (
    pageNum: number,
    status: StatusTab,
    periodKey: PeriodKey,
    range?: DateRange,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("status", status);

      if (periodKey === "custom" && range?.from) {
        params.set("date_from", range.from.toISOString());
        if (range.to) {
          params.set("date_to", range.to.toISOString());
        }
      } else {
        const { dateFrom } = getPeriodDates(periodKey);
        if (dateFrom) params.set("date_from", dateFrom);
      }

      const res = await fetch(`/api/mypage/vouchers?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "상품권 목록을 불러오는데 실패했습니다.");
        return;
      }

      setVouchers(json.data.items);
      setTotalCount(json.data.total);
      if (json.data.tab_counts) {
        setTabCounts(json.data.tab_counts);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers(currentPage, statusTab, period, dateRange);
  }, [currentPage, statusTab, period, dateRange, fetchVouchers]);

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

  function handleStatusTabChange(tab: StatusTab) {
    setStatusTab(tab);
    setCurrentPage(1);
  }

  const totalPages = useMemo(
    () => Math.ceil(totalCount / ITEMS_PER_PAGE),
    [totalCount]
  );

  if (isLoading && vouchers.length === 0) {
    return <VouchersSkeleton />;
  }

  return (
    <div className="max-w-4xl w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">내 상품권</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          보유한 상품권의 상태를 확인하고 핀 번호를 조회하세요.
        </p>
      </div>

      <div className="space-y-3">
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

        <div className="flex border-b border-border" role="tablist" aria-label="상품권 상태 필터">
          {STATUS_TABS.map((tab) => {
            const count = tabCounts[tab.key];
            const isSelected = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleStatusTabChange(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-150",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[13px] font-bold tabular-nums",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 로딩 인디케이터 */}
      {isLoading && vouchers.length > 0 && (
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
          개
        </p>
      )}

      {!isLoading && !error && vouchers.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="상품권이 없습니다"
          description={
            statusTab === "active"
              ? "사용 가능한 상품권이 없습니다."
              : statusTab === "cancelled"
                ? "취소된 상품권이 없습니다."
                : period !== "all"
                  ? "선택한 기간에 상품권이 없습니다."
                  : "아직 구매한 상품권이 없습니다. 지금 바로 구매해보세요."
          }
          action={
            statusTab === "all" && period === "all"
              ? { label: "상품권 구경하기", onClick: () => router.push("/") }
              : undefined
          }
          size="md"
        />
      ) : (
        <div className="space-y-3">
          {vouchers.map((item) => (
            <VoucherCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {!isLoading && !error && vouchers.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            상품권 카드를 클릭하면 핀 번호 확인, 선물하기 등 상세 기능을 이용할 수 있습니다.
            취소된 상품권은 더 이상 사용할 수 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
