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
  CreditCard,
  Hash,
  Ticket,
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

const ITEMS_PER_PAGE = 5;

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

// 주문 상태와 의미적으로 동일한 바우처 상태 매핑 (중복 뱃지 방지용)
const EQUIVALENT_STATUS_MAP: Partial<Record<OrderStatus, VoucherStatus[]>> = {
  paid: ["issued"],
  password_set: ["password_set", "temp_verified"],
  pin_revealed: ["pin_revealed"],
  gifted: ["gifted"],
  cancelled: ["cancelled"],
};

// PeriodKey에서 날짜 범위 계산
function getPeriodDates(period: PeriodKey): { dateFrom?: string; dateTo?: string } {
  if (period === "all" || period === "custom") return {};
  const option = PERIOD_OPTIONS.find((o) => o.key === period);
  if (!option?.days) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return { dateFrom: cutoff.toISOString() };
}

// ── 뱃지 컴포넌트들 ───────────────────────────────────────

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<
    OrderStatus,
    { label: string; className: string }
  > = {
    paid: {
      label: "결제완료",
      className: "bg-info-bg text-info border-info/20",
    },
    password_set: {
      label: "비밀번호 설정",
      className: "bg-brand-primary-muted text-primary border-primary/20",
    },
    pin_revealed: {
      label: "핀 확인",
      className: "bg-success-bg text-success border-success/20",
    },
    gifted: {
      label: "선물완료",
      className: "bg-warning-bg text-warning border-warning/20",
    },
    cancelled: {
      label: "취소됨",
      className: "bg-error-bg text-error border-error/20",
    },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      className={cn(
        "rounded-sm border px-2 py-0.5 text-[13px] font-semibold",
        className
      )}
    >
      {label}
    </Badge>
  );
}

function VoucherStatusBadge({ status }: { status: VoucherStatus | null }) {
  if (!status) return null;

  const config: Record<VoucherStatus, { label: string; className: string }> = {
    issued: {
      label: "발급됨",
      className: "bg-info-bg text-info border-info/20",
    },
    temp_verified: {
      label: "임시인증",
      className: "bg-brand-primary-muted text-primary border-primary/20",
    },
    password_set: {
      label: "비밀번호 설정",
      className: "bg-brand-primary-muted text-primary border-primary/20",
    },
    pin_revealed: {
      label: "핀 확인됨",
      className: "bg-success-bg text-success border-success/20",
    },
    gifted: {
      label: "선물완료",
      className: "bg-warning-bg text-warning border-warning/20",
    },
    cancelled: {
      label: "취소됨",
      className: "bg-error-bg text-error border-error/20",
    },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      className={cn(
        "rounded-sm border px-2 py-0.5 text-[13px] font-semibold",
        className
      )}
    >
      {label}
    </Badge>
  );
}

function CancelStatusBadge({ status }: { status: CancelStatus }) {
  const config: Record<CancelStatus, { label: string; icon: React.ElementType; className: string }> = {
    completed: {
      label: "취소완료",
      icon: CheckCircle2,
      className: "bg-success-bg text-success border-success/20",
    },
    failed: {
      label: "취소실패",
      icon: XCircle,
      className: "bg-error-bg text-error border-error/20",
    },
  };

  const { label, icon: Icon, className } = config[status] ?? {
    label: status,
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  };

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

// ── 주문 카드 ─────────────────────────────────────────────

function OrderCard({ item }: { item: OrderHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = item.status === "cancelled";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200",
        isCancelled ? "border-error/20" : "border-border hover:border-primary/20",
        expanded && !isCancelled && "border-primary/30 shadow-md"
      )}
    >
      {isCancelled && (
        <div className="h-1 bg-gradient-to-r from-error/60 to-error/30" />
      )}
      {!isCancelled && (
        <div className="h-1 bg-gradient-to-r from-primary/40 to-primary/10" />
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-4 transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
        aria-expanded={expanded}
        aria-label={`주문 상세 ${expanded ? "접기" : "펼치기"}`}
      >
        <div className="flex items-start gap-3">
          <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {item.product?.image_url ? (
              <Image
                src={item.product.image_url}
                alt={item.product?.name ?? "(삭제된 상품)"}
                fill
                className="object-cover"
                sizes="60px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package size={24} className="text-muted-foreground/40" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                {item.product?.name ?? "(삭제된 상품)"}
              </p>
              {expanded ? (
                <ChevronUp size={16} className="mt-0.5 shrink-0 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted-foreground transition-transform" />
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">
                {item.quantity}개
              </span>
              <span className="text-[13px] text-muted-foreground">·</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {formatPrice(item.total_amount)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-muted-foreground">
                {formatDateTimeUtil(item.created_at)}
              </span>
              <span className="text-[13px] text-muted-foreground/50">·</span>
              <OrderStatusBadge status={item.status} />
              {item.voucher_status &&
                !EQUIVALENT_STATUS_MAP[item.status]?.includes(item.voucher_status as VoucherStatus) && (
                <VoucherStatusBadge status={item.voucher_status} />
              )}
            </div>
          </div>
        </div>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <div className="space-y-2">
            <DetailRow icon={Hash} label="주문번호" value={item.order_number} mono />
            <DetailRow icon={CreditCard} label="결제방법" value={getPaymentMethodLabel(item.payment_method)} />
            <DetailRow
              icon={Package}
              label="수수료"
              value={
                item.fee_type === "included"
                  ? `포함 (${formatPrice(item.fee_amount)})`
                  : `별도 (${formatPrice(item.fee_amount)})`
              }
            />
            {item.voucher_code && (
              <DetailRow icon={Ticket} label="교환권 코드" value={maskCode(item.voucher_code)} mono />
            )}
            {item.gift_receiver && (
              <DetailRow
                icon={Gift}
                label="선물 수신자"
                value={`${item.gift_receiver.username} (${item.gift_receiver.name})`}
              />
            )}
          </div>

          {item.voucher_code && !isCancelled && (
            <div className="mt-3">
              <Link href={`/v/${item.voucher_code}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-brand-primary-muted hover:border-primary/50 text-[13px] font-medium"
                >
                  <ExternalLink size={12} />
                  교환권 바로가기
                </Button>
              </Link>
            </div>
          )}

          {isCancelled && item.cancellation && (
            <div className="mt-3 rounded-lg border border-error/20 bg-error-bg/50 px-3 py-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={13} className="text-error shrink-0" />
                <span className="text-[13px] font-semibold text-error">취소/환불 정보</span>
              </div>
              <div className="space-y-1.5">
                <CancelDetailRow
                  label="취소 사유"
                  value={getCancellationReasonLabel(item.cancellation.reason_type as CancellationReasonType)}
                />
                <CancelDetailRow
                  label="환불 금액"
                  value={formatPrice(item.cancellation.refund_amount)}
                  bold
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground shrink-0">취소 상태</span>
                  <CancelStatusBadge status={item.cancellation.refund_status as CancelStatus} />
                </div>
                <CancelDetailRow
                  label="취소 요청일"
                  value={formatDateTimeUtil(item.cancellation.created_at)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <Icon size={12} className="text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "text-[13px] text-foreground text-right truncate",
          mono && "tracking-tight tabular-nums"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CancelDetailRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-[13px] text-foreground", bold && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="max-w-4xl w-full space-y-5 animate-pulse">
      <div>
        <div className="h-6 w-20 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded mt-2" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
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

  // API 데이터 상태
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

      // 기간 필터
      if (periodKey === "custom" && range?.from) {
        params.set("date_from", range.from.toISOString());
        if (range.to) {
          params.set("date_to", range.to.toISOString());
        }
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

  // 필터/페이지 변경 시 API 호출
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

  if (isLoading && orders.length === 0) {
    return <OrdersSkeleton />;
  }

  return (
    <div className="max-w-4xl w-full space-y-5">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">구매내역</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          구매하신 상품권 주문 내역을 확인하세요.
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="space-y-3">
        {/* 기간 빠른 선택 */}
        <div className="flex items-center gap-1.5">
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
                <Calendar
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

        {/* 상태 탭 */}
        <div className="flex border-b border-border" role="tablist" aria-label="주문 상태 필터">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.key}
              onClick={() => handleStatusTabChange(tab.key)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-all duration-150",
                statusTab === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {statusTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 인디케이터 (데이터 갱신 시) */}
      {isLoading && orders.length > 0 && (
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

      {/* 결과 카운트 */}
      {!isLoading && !error && totalCount > 0 && (
        <p className="text-[13px] text-muted-foreground">
          총{" "}
          <strong className="font-semibold text-foreground">
            {totalCount}
          </strong>
          건
        </p>
      )}

      {/* 주문 목록 */}
      {!isLoading && !error && orders.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {orders.map((item) => (
            <OrderCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* 페이징 */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
