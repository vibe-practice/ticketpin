"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RotateCcw,
  AlertTriangle,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import {
  AdminDateRangePicker,
  type DateRange,
} from "@/components/admin/AdminDateRangePicker";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import {
  AdminNumberRange,
  type NumberRangeValue,
} from "@/components/admin/AdminNumberRange";
import {
  AdminCsvExportButton,
  type CsvColumnDef,
} from "@/components/admin/AdminCsvExportButton";
import { useToast } from "@/components/ui/toast";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  AdminCancellationListItem,
  CancellationReasonType,
  CancelledBy,
  CancelStatus,
  FeeType,
} from "@/types";

// ─── 라벨/스타일 맵 ──────────────────────────────────────────────────────────

const REASON_LABEL: Record<CancellationReasonType, string> = {
  simple_change: "단순변심",
  wrong_purchase: "오구매",
  admin: "관리자",
  duplicate_payment: "이중결제",
  other: "기타",
};

const CANCELLED_BY_LABEL: Record<CancelledBy, string> = {
  user: "사용자",
  admin: "관리자",
  system: "시스템",
};

const CANCEL_STATUS_LABEL: Record<CancelStatus, string> = {
  completed: "취소완료",
  failed: "취소실패",
};

const CANCEL_STATUS_STYLE: Record<CancelStatus, string> = {
  completed: "bg-success-bg text-success",
  failed: "bg-error-bg text-error",
};

const FEE_TYPE_LABEL: Record<FeeType, string> = {
  included: "수수료 포함",
  separate: "수수료 별도",
};

const CANCELLED_BY_STYLE: Record<CancelledBy, string> = {
  user: "bg-info-bg text-info",
  admin: "bg-brand-primary-soft text-primary",
  system: "bg-neutral-100 text-neutral-700",
};

// ─── 필터 옵션 ───────────────────────────────────────────────────────────────

const CANCEL_STATUS_OPTS = [
  { value: "completed", label: "취소완료" },
  { value: "failed", label: "취소실패" },
];

const REASON_TYPE_OPTS = [
  { value: "simple_change", label: "단순변심" },
  { value: "wrong_purchase", label: "오구매" },
  { value: "admin", label: "관리자" },
  { value: "duplicate_payment", label: "이중결제" },
  { value: "other", label: "기타" },
];

// ─── CSV 컬럼 ────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminCancellationListItem>[] = [
  { key: "created_at", label: "취소일시", format: (v) => formatDateTime(String(v)) },
  { key: "order_number", label: "주문번호" },
  { key: "buyer_username", label: "구매자 아이디" },
  { key: "buyer_name", label: "구매자 이름" },
  { key: "product_name", label: "상품명" },
  { key: "quantity", label: "수량" },
  { key: "product_price", label: "상품단가", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "total_amount", label: "총 결제금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "fee_type", label: "수수료유형", format: (v) => FEE_TYPE_LABEL[v as FeeType] ?? String(v) },
  { key: "fee_amount", label: "건당수수료", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "refund_amount", label: "취소금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "voucher_fee_paid", label: "수수료환불", format: (v) => v ? "O" : "-" },
  { key: "voucher_fee_amount", label: "수수료환불금액", format: (v) => v ? `${Number(v).toLocaleString()}` : "-" },
  { key: "reason_type", label: "취소사유", format: (v) => REASON_LABEL[v as CancellationReasonType] ?? String(v) },
  { key: "reason_detail", label: "사유 상세" },
  { key: "cancelled_by", label: "요청자", format: (v) => CANCELLED_BY_LABEL[v as CancelledBy] ?? String(v) },
  { key: "refund_status", label: "취소상태", format: (v) => CANCEL_STATUS_LABEL[v as CancelStatus] ?? String(v) },
  { key: "voucher_code", label: "바우처코드" },
  { key: "pg_cancel_transaction_id", label: "PG취소거래ID" },
  { key: "voucher_fee_pg_transaction_id", label: "수수료PG거래ID" },
];

// ─── 필터 상태 ───────────────────────────────────────────────────────────────

interface FilterState {
  cancelStatus: string[];
  reasonType: string[];
  cancelledBy: string; // "all" | "user" | "admin"
  dateRange: DateRange;
  amountRange: NumberRangeValue;
}

const INITIAL_FILTERS: FilterState = {
  cancelStatus: [],
  reasonType: [],
  cancelledBy: "all",
  dateRange: { from: null, to: null },
  amountRange: {},
};

// ─── 행 타입 ─────────────────────────────────────────────────────────────────

type CancelRow = AdminCancellationListItem & Record<string, unknown>;

// ─── 쿼리 파라미터 빌드 ─────────────────────────────────────────────────────

function buildQueryParams(search: string, filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("limit", "2000");
  params.set("sort_by", "created_at");
  params.set("sort_order", "desc");

  if (search) params.set("search", search);
  if (filters.cancelStatus.length > 0) params.set("cancel_status", filters.cancelStatus.join(","));
  if (filters.reasonType.length > 0) params.set("reason_type", filters.reasonType.join(","));
  if (filters.cancelledBy !== "all") params.set("cancelled_by", filters.cancelledBy);
  if (filters.dateRange.from) params.set("date_from", filters.dateRange.from);
  if (filters.dateRange.to) params.set("date_to", filters.dateRange.to);
  if (filters.amountRange.min != null) params.set("amount_min", String(filters.amountRange.min));
  if (filters.amountRange.max != null) params.set("amount_max", String(filters.amountRange.max));

  return params;
}

// ─── 날짜 유틸 ───────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export function AdminRefundsClient() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminCancellationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // ─── API 호출 ──────────────────────────────────────────────────────────────

  const fetchCancellations = useCallback(async (searchVal: string, filterVal: FilterState) => {
    setLoading(true);
    try {
      const params = buildQueryParams(searchVal, filterVal);
      const res = await fetch(`/api/admin/cancellations?${params.toString()}`);
      if (!res.ok) throw new Error("취소 내역 조회 실패");
      const json = await res.json();

      if (json.success) {
        setData(json.data.data);
      } else {
        throw new Error(json.error?.message ?? "취소 내역 조회 실패");
      }
    } catch (err) {
      toast({ type: "error", title: err instanceof Error ? err.message : "취소 내역을 불러오지 못했습니다" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 초기 로드
  useEffect(() => {
    fetchCancellations("", INITIAL_FILTERS);
  }, [fetchCancellations]);

  // ─── 필터 적용 ──────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
    fetchCancellations(search, filters);
  }, [filters, search, fetchCancellations]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
    fetchCancellations("", INITIAL_FILTERS);
  }, [fetchCancellations]);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
    fetchCancellations(value, appliedFilters);
  }, [appliedFilters, fetchCancellations]);

  // ─── Stat Cards (전체 데이터 기준) ──────────────────────────────────────────

  const stats = useMemo(() => {
    const todayItems = data.filter((c) => isToday(c.created_at));
    const monthItems = data.filter((c) => isThisMonth(c.created_at));
    const failedItems = data.filter((c) => c.refund_status === "failed");
    return {
      todayCount: todayItems.length,
      todayAmount: todayItems.reduce((s, c) => s + c.refund_amount, 0),
      monthCount: monthItems.length,
      monthAmount: monthItems.reduce((s, c) => s + c.refund_amount, 0),
      failedCount: failedItems.length,
      failedAmount: failedItems.reduce((s, c) => s + c.refund_amount, 0),
    };
  }, [data]);

  // ─── 데이터 필터링 (클라이언트 보정) ───────────────────────────────────────

  const filteredData = useMemo<CancelRow[]>(() => {
    return (data as CancelRow[]).filter((item) => {
      // 취소 상태 다중 선택 보정
      if (
        appliedFilters.cancelStatus.length > 0 &&
        !appliedFilters.cancelStatus.includes(item.refund_status)
      ) return false;

      // 취소 사유 다중 선택 보정
      if (
        appliedFilters.reasonType.length > 0 &&
        !appliedFilters.reasonType.includes(item.reason_type)
      ) return false;

      return true;
    });
  }, [data, appliedFilters]);

  // ─── 필터 칩 제거 핸들러 ─────────────────────────────────────────────────────

  const removeFilter = useCallback((key: keyof FilterState) => {
    setAppliedFilters((prev) => {
      const defaults: Record<keyof FilterState, FilterState[keyof FilterState]> = {
        cancelStatus: [],
        reasonType: [],
        cancelledBy: "all",
        dateRange: { from: null, to: null },
        amountRange: {},
      };
      const next = { ...prev, [key]: defaults[key] };
      setFilters((f) => ({ ...f, [key]: defaults[key] }));
      fetchCancellations(appliedSearch, next);
      return next;
    });
  }, [appliedSearch, fetchCancellations]);

  // ─── 활성 필터 칩 ──────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.cancelStatus.length > 0) {
      chips.push({
        key: "cancelStatus",
        label: "취소상태",
        value: appliedFilters.cancelStatus.map((s) => CANCEL_STATUS_LABEL[s as CancelStatus] ?? s).join(", "),
        onRemove: () => removeFilter("cancelStatus"),
      });
    }

    if (appliedFilters.reasonType.length > 0) {
      chips.push({
        key: "reasonType",
        label: "취소사유",
        value: appliedFilters.reasonType.map((s) => REASON_LABEL[s as CancellationReasonType] ?? s).join(", "),
        onRemove: () => removeFilter("reasonType"),
      });
    }

    if (appliedFilters.cancelledBy !== "all") {
      chips.push({
        key: "cancelledBy",
        label: "요청자",
        value: CANCELLED_BY_LABEL[appliedFilters.cancelledBy as CancelledBy],
        onRemove: () => removeFilter("cancelledBy"),
      });
    }

    if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
      const from = appliedFilters.dateRange.from ?? "";
      const to = appliedFilters.dateRange.to ?? "";
      chips.push({
        key: "dateRange",
        label: "기간",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () => removeFilter("dateRange"),
      });
    }

    if (appliedFilters.amountRange.min != null || appliedFilters.amountRange.max != null) {
      const min = appliedFilters.amountRange.min;
      const max = appliedFilters.amountRange.max;
      chips.push({
        key: "amountRange",
        label: "금액",
        value:
          min != null && max != null
            ? `${min.toLocaleString()}~${max.toLocaleString()}원`
            : min != null
              ? `${min.toLocaleString()}원 이상`
              : `${max!.toLocaleString()}원 이하`,
        onRemove: () => removeFilter("amountRange"),
      });
    }

    return chips;
  }, [appliedFilters, removeFilter]);

  // ─── 취소 재시도 ───────────────────────────────────────────────────────────

  const handleRetry = useCallback(
    async (id: string) => {
      setRetryingId(id);
      setRetrySuccess(null);
      try {
        const res = await fetch(`/api/admin/cancellations/${id}/retry`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("환불 재시도 실패");
        const json = await res.json();

        if (json.success) {
          // 로컬 상태 업데이트
          setData((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    refund_status: "completed" as CancelStatus,
                    pg_cancel_transaction_id: json.data.pg_cancel_transaction_id ?? item.pg_cancel_transaction_id,
                    refunded_at: json.data.refunded_at ?? new Date().toISOString(),
                  }
                : item
            )
          );
          setRetrySuccess(id);
          toast({ type: "success", title: "환불 재시도가 성공적으로 처리되었습니다" });
          successTimerRef.current = setTimeout(() => setRetrySuccess(null), 3000);
        } else {
          throw new Error(json.error?.message ?? "환불 재시도 실패");
        }
      } catch (err) {
        toast({ type: "error", title: err instanceof Error ? err.message : "환불 재시도에 실패했습니다" });
      } finally {
        setRetryingId(null);
      }
    },
    [toast]
  );

  // ─── 테이블 컬럼 ──────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        label: "취소일시",
        sortable: true,
        align: "center" as const,
        width: "130px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[12px] text-muted-foreground">
            {formatDateTime(String(v))}
          </span>
        ),
      },
      {
        key: "order_number",
        label: "주문번호",
        sortable: true,
        align: "center" as const,
        width: "155px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap font-mono text-[12px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "buyer_name",
        label: "구매자",
        sortable: true,
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: CancelRow) => (
          <div className="text-center">
            <p className="text-[13px] font-medium text-foreground">{row.buyer_name}</p>
            <p className="text-[11px] text-muted-foreground">{row.buyer_username}</p>
          </div>
        ),
      },
      {
        key: "product_name",
        label: "상품명",
        sortable: true,
        align: "center" as const,
        width: "200px",
        render: (v: unknown, row: CancelRow) => (
          <div className="text-center">
            <p className="truncate text-[13px] text-foreground" title={String(v)}>
              {String(v)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {Number(row.product_price).toLocaleString()}원 x {String(row.quantity)}개
            </p>
          </div>
        ),
      },
      {
        key: "refund_amount",
        label: "취소금액",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[13px] font-semibold text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "voucher_fee_paid",
        label: "수수료환불",
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: CancelRow) => {
          if (row.fee_type !== "separate") {
            return <span className="text-[11px] text-muted-foreground">-</span>;
          }
          if (!row.voucher_fee_paid) {
            return <span className="text-[11px] text-muted-foreground">미결제</span>;
          }
          return (
            <span className="whitespace-nowrap rounded-sm bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
              {row.voucher_fee_amount ? `${Number(row.voucher_fee_amount).toLocaleString()}원` : "환불"}
            </span>
          );
        },
      },
      {
        key: "reason_type",
        label: "취소사유",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span className="text-[12px] text-foreground">
            {REASON_LABEL[v as CancellationReasonType]}
          </span>
        ),
      },
      {
        key: "cancelled_by",
        label: "요청자",
        align: "center" as const,
        width: "65px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              CANCELLED_BY_STYLE[v as CancelledBy]
            )}
          >
            {CANCELLED_BY_LABEL[v as CancelledBy]}
          </span>
        ),
      },
      {
        key: "refund_status",
        label: "취소상태",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              CANCEL_STATUS_STYLE[v as CancelStatus]
            )}
          >
            {CANCEL_STATUS_LABEL[v as CancelStatus]}
          </span>
        ),
      },
    ],
    []
  );

  // ─── 확장 행 ───────────────────────────────────────────────────────────────

  const expandedItem = expandedId
    ? filteredData.find((c) => c.id === expandedId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <RotateCcw size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">취소/환불 관리</h1>
            <p className="text-[12px] text-muted-foreground">
              결제 취소 현황을 조회하고 실패 건을 재처리합니다
            </p>
          </div>
        </div>

        <AdminCsvExportButton<AdminCancellationListItem>
          getData={() => filteredData as AdminCancellationListItem[]}
          columns={CSV_COLUMNS}
          filename="취소환불내역"
          label="CSV 내보내기"
          size="sm"
        />
      </div>

      {/* 취소 재시도 성공 알림 */}
      {retrySuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 py-3">
          <CheckCircle2 size={16} className="text-success" />
          <span className="text-sm font-medium text-success">취소가 성공적으로 처리되었습니다.</span>
        </div>
      )}

      {/* Stat Cards — 3개: 오늘 취소, 이번달 취소, 취소 실패 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 오늘 취소 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">오늘 취소</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.todayCount}건</p>
          <p className="text-xs text-muted-foreground">{stats.todayAmount.toLocaleString()}원</p>
        </div>

        {/* 이번달 취소 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">이번달 취소</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.monthCount}건</p>
          <p className="text-xs text-muted-foreground">{stats.monthAmount.toLocaleString()}원</p>
        </div>

        {/* 취소 실패 */}
        <div className="rounded-lg border border-error/20 bg-error-bg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-error" />
            <span className="text-xs font-medium text-error">취소 실패</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-error">{stats.failedCount}건</p>
          <p className="text-xs text-error">{stats.failedAmount.toLocaleString()}원</p>
        </div>
      </div>

      {/* 검색 + 필터 패널 */}
      <AdminSearchFilterPanel
        searchPlaceholder="주문번호, 구매자, 상품명, 바우처코드로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={filteredData.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 취소 상태 */}
        <AdminMultiSelect
          label="취소 상태"
          options={CANCEL_STATUS_OPTS}
          value={filters.cancelStatus}
          onChange={(v) => setFilters((prev) => ({ ...prev, cancelStatus: v }))}
          placeholder="전체"
        />

        {/* 필터 2: 취소 사유 */}
        <AdminMultiSelect
          label="취소 사유"
          options={REASON_TYPE_OPTS}
          value={filters.reasonType}
          onChange={(v) => setFilters((prev) => ({ ...prev, reasonType: v }))}
          placeholder="전체"
        />

        {/* 필터 3: 취소 요청자 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">취소 요청자</label>
          <Select
            value={filters.cancelledBy}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, cancelledBy: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="user">사용자</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
              <SelectItem value="system">시스템</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 4: 취소 기간 */}
        <AdminDateRangePicker
          label="취소 기간"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />

        {/* 필터 5: 취소 금액 범위 */}
        <AdminNumberRange
          label="취소 금액 범위"
          value={filters.amountRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, amountRange: v }))}
          unit="원"
          min={0}
        />
      </AdminSearchFilterPanel>

      {/* 데이터 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">취소 내역을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<CancelRow>
          columns={columns}
          data={filteredData}
          emptyMessage="조건에 맞는 취소 내역이 없습니다."
          rowKey={(row) => row.id}
          onRowClick={(row) =>
            setExpandedId((prev) => (prev === row.id ? null : row.id))
          }
          pageSizeOptions={[20, 50]}
        />
      )}

      {/* 확장 상세 영역 */}
      {expandedItem && (
        <div className="rounded-lg border border-border bg-muted/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <RotateCcw size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">취소 상세 정보</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDateTime(expandedItem.created_at)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 주문 정보 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">주문 정보</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">주문번호</span>
                  <span className="font-mono text-foreground">{expandedItem.order_number}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">상품명</span>
                  <span className="text-foreground">{expandedItem.product_name}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">단가 x 수량</span>
                  <span className="text-foreground">
                    {expandedItem.product_price.toLocaleString()}원 x {expandedItem.quantity}개
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">수수료 유형</span>
                  <span className="text-foreground">{FEE_TYPE_LABEL[expandedItem.fee_type]}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">건당 수수료</span>
                  <span className="text-foreground">
                    {expandedItem.fee_amount.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">총 결제금액</span>
                  <span className="font-semibold text-foreground">
                    {expandedItem.total_amount.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">구매자</span>
                  <span className="text-foreground">
                    {expandedItem.buyer_name} ({expandedItem.buyer_username})
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">바우처코드</span>
                  <span className="truncate font-mono text-[12px] text-foreground" title={expandedItem.voucher_code}>
                    {expandedItem.voucher_code}
                  </span>
                </div>
              </div>
            </div>

            {/* 취소 상세 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">취소 상세</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">취소 사유</span>
                  <span className="text-foreground">{REASON_LABEL[expandedItem.reason_type]}</span>
                </div>
                {expandedItem.reason_detail && (
                  <div className="mt-1">
                    <p className="text-[11px] text-muted-foreground">사유 상세</p>
                    <p className="text-[13px] text-foreground">{expandedItem.reason_detail}</p>
                  </div>
                )}
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">요청자</span>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                      CANCELLED_BY_STYLE[expandedItem.cancelled_by]
                    )}
                  >
                    {CANCELLED_BY_LABEL[expandedItem.cancelled_by]}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">취소일시</span>
                  <span className="text-foreground">{formatDateTime(expandedItem.created_at)}</span>
                </div>
              </div>
            </div>

            {/* 취소 처리 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">취소 처리</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">취소금액</span>
                  <span className="font-semibold text-foreground">
                    {expandedItem.refund_amount.toLocaleString()}원
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {expandedItem.fee_type === "included"
                    ? `상품가 + 수수료 포함 (${expandedItem.product_price.toLocaleString()} + ${expandedItem.fee_amount.toLocaleString()}) x ${expandedItem.quantity}개`
                    : `상품가만 취소 ${expandedItem.product_price.toLocaleString()} x ${expandedItem.quantity}개`}
                </div>
                {/* 수수료 별도 결제 건의 수수료 환불 정보 */}
                {expandedItem.fee_type === "separate" && (
                  <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-100/50 p-2">
                    <p className="mb-1 text-[11px] font-medium text-neutral-800">수수료 별도 결제</p>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-neutral-700">수수료 결제 여부</span>
                        <span className="font-medium text-neutral-900">
                          {expandedItem.voucher_fee_paid ? "결제완료" : "미결제"}
                        </span>
                      </div>
                      {expandedItem.voucher_fee_paid && expandedItem.voucher_fee_amount != null && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-neutral-700">수수료 환불 금액</span>
                          <span className="font-semibold text-neutral-900">
                            {expandedItem.voucher_fee_amount.toLocaleString()}원
                          </span>
                        </div>
                      )}
                      {expandedItem.voucher_fee_paid && expandedItem.voucher_fee_pg_transaction_id && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-neutral-700">수수료 PG 거래ID</span>
                          <span className="font-mono text-[11px] text-neutral-900">
                            {expandedItem.voucher_fee_pg_transaction_id}
                          </span>
                        </div>
                      )}
                      {expandedItem.voucher_fee_paid && !expandedItem.voucher_fee_pg_transaction_id && (
                        <div className="flex items-center gap-1 text-[11px] text-error">
                          <AlertTriangle size={12} />
                          <span>수수료 PG 환불 정보 없음 (환불 실패 가능성)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">취소상태</span>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                      CANCEL_STATUS_STYLE[expandedItem.refund_status]
                    )}
                  >
                    {CANCEL_STATUS_LABEL[expandedItem.refund_status]}
                  </span>
                </div>
                {expandedItem.pg_cancel_transaction_id && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">PG 취소 ID</span>
                    <span className="font-mono text-[12px] text-foreground">
                      {expandedItem.pg_cancel_transaction_id}
                    </span>
                  </div>
                )}

                {/* 취소 재시도 버튼 (실패 건만) */}
                {expandedItem.refund_status === "failed" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(expandedItem.id);
                      }}
                      disabled={retryingId === expandedItem.id}
                      className="w-full"
                    >
                      {retryingId === expandedItem.id ? (
                        <>
                          <RefreshCw size={14} className="mr-1.5 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} className="mr-1.5" />
                          취소 재시도
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* 취소 완료 표시 */}
                {expandedItem.refund_status === "completed" && (
                  <div className="mt-2 flex items-center gap-1 text-success">
                    <CheckCircle2 size={14} />
                    <span className="text-[12px] font-medium">취소 처리 완료</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
