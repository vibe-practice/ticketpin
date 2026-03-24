"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  Gift,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarIcon,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatPrice, formatDateTime as formatDateTimeUtil, maskCode } from "@/lib/utils";
import {
  type PeriodKey,
  PERIOD_OPTIONS,
  formatDateShort,
} from "@/lib/date-filter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ko } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type {
  OrderHistoryItem,
  OrderStatus,
  VoucherStatus,
  CancellationReasonType,
  CancelStatus,
} from "@/types";

// ── 상수 ──────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

type StatusTab = "all" | "active" | "cancelled";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "주문확인" },
  { key: "cancelled", label: "취소됨" },
];

// ── 헬퍼 함수 ─────────────────────────────────────────────

function getPaymentMethodLabel(method: string | null) {
  if (!method) return "-";
  const map: Record<string, string> = {
    card: "신용/체크카드",
    bank_transfer: "계좌이체",
    virtual_account: "가상계좌",
    phone: "휴대폰결제",
  };
  return map[method] ?? method;
}

function getCancellationReasonLabel(type: CancellationReasonType) {
  const map: Record<CancellationReasonType, string> = {
    simple_change: "단순 변심",
    wrong_purchase: "잘못된 구매",
    admin: "관리자 처리",
    duplicate_payment: "이중결제",
    other: "기타",
  };
  return map[type] ?? type;
}

const EQUIVALENT_STATUS_MAP: Partial<Record<OrderStatus, VoucherStatus[]>> = {
  paid: ["issued"],
  password_set: ["password_set", "temp_verified"],
  pin_revealed: ["pin_revealed"],
  gifted: ["gifted"],
  cancelled: ["cancelled"],
};

function getPeriodDates(period: PeriodKey): { dateFrom?: string; dateTo?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── 뱃지 컴포넌트들 ───────────────────────────────────────

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; className: string }> = {
    paid: { label: "결제완료", className: "bg-info-bg text-info border-info/20" },
    password_set: { label: "비밀번호 설정", className: "bg-brand-primary-muted text-primary border-primary/20" },
    pin_revealed: { label: "핀 확인", className: "bg-success-bg text-success border-success/20" },
    gifted: { label: "선물완료", className: "bg-warning-bg text-warning border-warning/20" },
    cancelled: { label: "취소됨", className: "bg-error-bg text-error border-error/20" },
  };
  const { label, className } = config[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge className={cn("rounded-sm border px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap", className)}>
      {label}
    </Badge>
  );
}

function VoucherStatusBadge({ status }: { status: VoucherStatus | null }) {
  if (!status) return null;
  const config: Record<VoucherStatus, { label: string; className: string }> = {
    issued: { label: "발급됨", className: "bg-info-bg text-info border-info/20" },
    temp_verified: { label: "임시인증", className: "bg-brand-primary-muted text-primary border-primary/20" },
    password_set: { label: "비밀번호 설정", className: "bg-brand-primary-muted text-primary border-primary/20" },
    pin_revealed: { label: "핀 확인됨", className: "bg-success-bg text-success border-success/20" },
    gifted: { label: "선물완료", className: "bg-warning-bg text-warning border-warning/20" },
    cancelled: { label: "취소됨", className: "bg-error-bg text-error border-error/20" },
  };
  const { label, className } = config[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge className={cn("rounded-sm border px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap", className)}>
      {label}
    </Badge>
  );
}

function CancelStatusBadge({ status }: { status: CancelStatus }) {
  const config: Record<CancelStatus, { label: string; icon: React.ElementType; className: string }> = {
    completed: { label: "취소완료", icon: CheckCircle2, className: "bg-success-bg text-success border-success/20" },
    failed: { label: "취소실패", icon: XCircle, className: "bg-error-bg text-error border-error/20" },
  };
  const { label, icon: Icon, className } = config[status] ?? { label: status, icon: Clock, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[13px] font-semibold", className)}>
      <Icon size={12} />
      {label}
    </span>
  );
}

// ── 테이블 행 확장 상세 ───────────────────────────────────

function ExpandedDetail({ item }: { item: OrderHistoryItem }) {
  const isCancelled = item.status === "cancelled";
  return (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <div className="bg-muted/20 border-b border-border px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">주문번호</p>
              <p className="text-[14px] text-foreground font-medium tabular-nums">{item.order_number}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">결제방법</p>
              <p className="text-[14px] text-foreground font-medium">{getPaymentMethodLabel(item.payment_method)}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-1">수수료</p>
              <p className="text-[14px] text-foreground font-medium">
                {item.fee_type === "included" ? `포함 (${formatPrice(item.fee_amount)})` : `별도 (${formatPrice(item.fee_amount)})`}
              </p>
            </div>
            {item.voucher_code && (
              <div>
                <p className="text-[13px] text-muted-foreground mb-1">교환권 코드</p>
                <p className="text-[14px] text-foreground font-medium tabular-nums">{maskCode(item.voucher_code)}</p>
              </div>
            )}
          </div>

          {item.gift_receiver && (
            <div className="mt-3 flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <Gift size={14} />
              <span>선물 수신자: <strong className="text-foreground">{item.gift_receiver.username} ({item.gift_receiver.name})</strong></span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            {item.voucher_code && !isCancelled && (
              <Link href={`/v/${item.voucher_code}`}>
                <Button size="sm" variant="outline" className="h-9 gap-1.5 text-[14px] font-medium">
                  <ExternalLink size={14} />
                  교환권 바로가기
                </Button>
              </Link>
            )}
          </div>

          {isCancelled && item.cancellation && (
            <div className="mt-4 rounded-lg border border-error/20 bg-error-bg/50 px-4 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <AlertTriangle size={14} className="text-error" />
                <span className="text-[15px] font-semibold text-error">취소/환불 정보</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[13px] text-muted-foreground mb-1">취소 사유</p>
                  <p className="text-[14px] text-foreground">{getCancellationReasonLabel(item.cancellation.reason_type as CancellationReasonType)}</p>
                </div>
                <div>
                  <p className="text-[13px] text-muted-foreground mb-1">환불 금액</p>
                  <p className="text-[14px] text-foreground font-semibold">{formatPrice(item.cancellation.refund_amount)}</p>
                </div>
                <div>
                  <p className="text-[13px] text-muted-foreground mb-1">취소 상태</p>
                  <CancelStatusBadge status={item.cancellation.refund_status as CancelStatus} />
                </div>
                <div>
                  <p className="text-[13px] text-muted-foreground mb-1">취소 요청일</p>
                  <p className="text-[14px] text-foreground">{formatDateTimeUtil(item.cancellation.created_at)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── 테이블 행 ─────────────────────────────────────────────

function OrderRow({ item }: { item: OrderHistoryItem }) {
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
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1">
                {item.product?.name ?? "(삭제된 상품)"}
              </p>
              {item.gift_receiver && (
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  → {item.gift_receiver.username}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* 수량 */}
        <td className="py-4 px-3 text-center">
          <span className="text-[15px] text-foreground tabular-nums">{item.quantity}개</span>
        </td>

        {/* 금액 */}
        <td className="py-4 px-3 text-right">
          <span className="text-[15px] font-bold text-foreground tabular-nums whitespace-nowrap">
            {formatPrice(item.total_amount)}
          </span>
        </td>

        {/* 상태 */}
        <td className="py-4 px-3">
          <div className="flex flex-col items-start gap-1">
            <OrderStatusBadge status={item.status} />
            {item.voucher_status &&
              !EQUIVALENT_STATUS_MAP[item.status]?.includes(item.voucher_status as VoucherStatus) && (
              <VoucherStatusBadge status={item.voucher_status} />
            )}
          </div>
        </td>

        {/* 날짜 */}
        <td className="py-4 px-3">
          <span className="text-[14px] text-muted-foreground whitespace-nowrap tabular-nums">
            {formatShortDateTime(item.created_at)}
          </span>
        </td>

        {/* 상세 */}
        <td className="py-4 px-3 text-center">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? "접기" : "상세보기"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && <ExpandedDetail item={item} />}
    </>
  );
}

// ── 모바일 카드 행 ────────────────────────────────────────

function OrderMobileCard({ item }: { item: OrderHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = item.status === "cancelled";

  return (
    <div className={cn("border-b border-border", isCancelled && "bg-error-bg/10")}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {item.product?.image_url ? (
              <Image src={item.product.image_url} alt={item.product?.name ?? ""} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package size={20} className="text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-foreground line-clamp-1">{item.product?.name ?? "(삭제된 상품)"}</p>
              <OrderStatusBadge status={item.status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[14px] font-bold text-foreground tabular-nums">{formatPrice(item.total_amount)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[13px] text-muted-foreground">{item.quantity}개</span>
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
              <p className="text-[12px] text-muted-foreground mb-0.5">주문번호</p>
              <p className="text-[13px] text-foreground tabular-nums">{item.order_number}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">결제방법</p>
              <p className="text-[13px] text-foreground">{getPaymentMethodLabel(item.payment_method)}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">수수료</p>
              <p className="text-[13px] text-foreground">{item.fee_type === "included" ? `포함` : `별도`} ({formatPrice(item.fee_amount)})</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">날짜</p>
              <p className="text-[13px] text-foreground tabular-nums">{formatShortDateTime(item.created_at)}</p>
            </div>
          </div>
          {item.voucher_code && (
            <div>
              <p className="text-[12px] text-muted-foreground mb-0.5">교환권 코드</p>
              <p className="text-[13px] text-foreground tabular-nums">{maskCode(item.voucher_code)}</p>
            </div>
          )}
          {item.gift_receiver && (
            <p className="text-[13px] text-muted-foreground">
              선물 → {item.gift_receiver.username} ({item.gift_receiver.name})
            </p>
          )}
          {item.voucher_status && !EQUIVALENT_STATUS_MAP[item.status]?.includes(item.voucher_status as VoucherStatus) && (
            <VoucherStatusBadge status={item.voucher_status} />
          )}
          <div className="flex gap-2 pt-1">
            {item.voucher_code && !isCancelled && (
              <Link href={`/v/${item.voucher_code}`}>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[13px]">
                  <ExternalLink size={12} />
                  교환권 바로가기
                </Button>
              </Link>
            )}
          </div>
          {isCancelled && item.cancellation && (
            <div className="rounded-lg border border-error/20 bg-error-bg/50 px-3 py-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-error" />
                <span className="text-[13px] font-semibold text-error">취소/환불</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[12px] text-muted-foreground">사유</p>
                  <p className="text-[13px] text-foreground">{getCancellationReasonLabel(item.cancellation.reason_type as CancellationReasonType)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">환불</p>
                  <p className="text-[13px] text-foreground font-semibold">{formatPrice(item.cancellation.refund_amount)}</p>
                </div>
              </div>
              <CancelStatusBadge status={item.cancellation.refund_status as CancelStatus} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────
function OrdersSkeleton() {
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

export default function OrdersPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (
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
        if (range.to) params.set("date_to", range.to.toISOString());
      } else {
        const { dateFrom } = getPeriodDates(periodKey);
        if (dateFrom) params.set("date_from", dateFrom);
      }
      const res = await fetch(`/api/mypage/orders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "주문 목록을 불러오는데 실패했습니다.");
        return;
      }
      setOrders(json.data.items);
      setTotalCount(json.data.total);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(currentPage, statusTab, period, dateRange);
  }, [currentPage, statusTab, period, dateRange, fetchOrders]);

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

  function handleDateRangeApply() {
    if (!dateRange?.from) return;
    setDateRange({ from: dateRange.from, to: dateRange.to ?? dateRange.from });
    setPeriod("custom");
    setCalendarOpen(false);
    setCurrentPage(1);
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

  const totalPages = useMemo(() => Math.ceil(totalCount / ITEMS_PER_PAGE), [totalCount]);

  if (isLoading && orders.length === 0) return <OrdersSkeleton />;

  return (
    <div className="w-full space-y-5">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">구매내역</h1>
        <p className="text-[16px] text-muted-foreground mt-1">
          구매하신 상품권 주문 내역을 확인하세요.
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 rounded-md px-3 text-[14px] font-medium transition-all duration-150",
                  period === "custom"
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/50"
                )}
              >
                <CalendarIcon size={14} />
                {period === "custom" && dateRange?.from
                  ? dateRange.to
                    ? `${formatDateShort(dateRange.from)} ~ ${formatDateShort(dateRange.to)}`
                    : formatDateShort(dateRange.from)
                  : "기간"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                locale={ko}
              />
              <div className="border-t border-border px-3 py-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleDateRangeApply}
                  disabled={!dateRange?.from}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[14px] font-medium transition-colors duration-150",
                    dateRange?.from
                      ? "bg-foreground text-background hover:bg-foreground/80"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  적용
                </button>
              </div>
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
                "h-9 rounded-md px-3 text-[14px] font-medium transition-all duration-150",
                period === opt.key
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex border-b border-border" role="tablist" aria-label="주문 상태 필터">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.key}
              onClick={() => handleStatusTabChange(tab.key)}
              className={cn(
                "relative px-4 py-2.5 text-[15px] font-medium transition-all duration-150",
                statusTab === tab.key ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {statusTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading && orders.length > 0 && (
        <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span>불러오는 중...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-error/20 bg-error-bg px-4 py-3">
          <p className="text-[14px] text-error">{error}</p>
        </div>
      )}

      {!isLoading && !error && totalCount > 0 && (
        <p className="text-[15px] text-muted-foreground">
          총 <strong className="font-semibold text-foreground">{totalCount}</strong>건
        </p>
      )}

      {/* 데스크탑: 테이블 */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-4 sm:px-6 py-3">상품</th>
                <th className="text-center text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[60px]">수량</th>
                <th className="text-right text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[100px]">금액</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[120px]">상태</th>
                <th className="text-left text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[140px]">주문일</th>
                <th className="text-center text-[13px] font-semibold text-muted-foreground px-3 py-3 w-[50px]">상세</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((item) => (
                <OrderRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일: 리스트 */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="sm:hidden rounded-xl border border-border overflow-hidden">
          {orders.map((item) => (
            <OrderMobileCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="주문 내역이 없습니다"
          description={
            statusTab === "cancelled"
              ? "취소된 주문이 없습니다."
              : period !== "all"
                ? "선택한 기간에 주문 내역이 없습니다."
                : "아직 구매한 상품권이 없습니다. 지금 바로 구매해보세요."
          }
          action={
            statusTab === "all" && period === "all"
              ? { label: "상품권 구경하기", onClick: () => router.push("/") }
              : undefined
          }
          size="md"
        />
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
