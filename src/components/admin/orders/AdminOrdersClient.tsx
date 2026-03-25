"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Package2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminDateRangePicker, type DateRange } from "@/components/admin/AdminDateRangePicker";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminNumberRange, type NumberRangeValue } from "@/components/admin/AdminNumberRange";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import { useToast } from "@/components/ui/toast";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import type {
  AdminOrderListItem,
  OrderStatus,
  VoucherStatus,
} from "@/types";

// ─── 상태 라벨/색상 맵 ────────────────────────────────────────────────────────

// 주문 상태: 결제완료 / 취소 (2가지만)
const ORDER_STATUS_OPTS = [
  { value: "paid", label: "결제완료" },
  { value: "cancelled", label: "취소" },
];

// 바우처 상태: 진행 상태 전체
const VOUCHER_STATUS_OPTS = [
  { value: "issued", label: "발급" },
  { value: "temp_verified", label: "임시인증" },
  { value: "password_set", label: "비번설정" },
  { value: "pin_revealed", label: "핀확인" },
  { value: "gifted", label: "선물" },
  { value: "cancelled", label: "취소" },
];

// 카드사 필터 옵션 (주요 카드사)
const CARD_COMPANY_OPTS = [
  { value: "01", label: "비씨카드" },
  { value: "02", label: "신한카드" },
  { value: "03", label: "삼성카드" },
  { value: "04", label: "현대카드" },
  { value: "05", label: "롯데카드" },
  { value: "07", label: "국민카드" },
  { value: "08", label: "하나카드(구외환)" },
  { value: "12", label: "농협카드" },
  { value: "27", label: "하나카드" },
  { value: "31", label: "우리카드" },
];

// 주문 상태 → 결제완료 or 취소로 매핑 (password_set, pin_revealed, gifted 모두 결제완료)
type DisplayOrderStatus = "paid" | "cancelled";

function getDisplayOrderStatus(status: OrderStatus): DisplayOrderStatus {
  return status === "cancelled" ? "cancelled" : "paid";
}

const ORDER_STATUS_STYLE: Record<DisplayOrderStatus, string> = {
  paid: "bg-info-bg text-info",
  cancelled: "bg-error-bg text-error",
};

const ORDER_STATUS_LABEL: Record<DisplayOrderStatus, string> = {
  paid: "결제완료",
  cancelled: "취소",
};

const VOUCHER_STATUS_STYLE: Record<VoucherStatus, string> = {
  issued: "bg-info-bg text-info",
  temp_verified: "bg-neutral-100 text-neutral-600",
  password_set: "bg-brand-primary-soft text-primary",
  pin_revealed: "bg-success-bg text-success",
  gifted: "bg-neutral-100 text-neutral-600",
  cancelled: "bg-error-bg text-error",
};

const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  issued: "발급",
  temp_verified: "임시인증",
  password_set: "비번설정",
  pin_revealed: "핀확인",
  gifted: "선물",
  cancelled: "취소",
};

// ─── CSV 컬럼 정의 ────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminOrderListItem>[] = [
  { key: "order_number", label: "주문번호" },
  { key: "buyer_username", label: "구매자 아이디" },
  { key: "buyer_name", label: "구매자 이름" },
  { key: "product_name", label: "상품명" },
  { key: "quantity", label: "수량" },
  {
    key: "total_amount",
    label: "총 결제금액",
    format: (v) => `${Number(v).toLocaleString()}`,
  },
  {
    key: "fee_type",
    label: "수수료 방식",
    format: (v) => (v === "included" ? "포함" : "별도"),
  },
  { key: "fee_amount", label: "수수료", format: (v) => String(Number(v)) },
  {
    key: "card_company_name",
    label: "카드사",
    format: (v) => String(v ?? "—"),
  },
  {
    key: "installment_months",
    label: "할부",
    format: (v) => (Number(v) === 0 ? "일시불" : `${v}개월`),
  },
  {
    key: "status",
    label: "주문상태",
    format: (v) => ORDER_STATUS_LABEL[getDisplayOrderStatus(v as OrderStatus)] ?? String(v),
  },
  {
    key: "voucher_status",
    label: "바우처상태",
    format: (v) =>
      v ? (VOUCHER_STATUS_LABEL[v as VoucherStatus] ?? String(v)) : "없음",
  },
  {
    key: "created_at",
    label: "주문일시",
    format: (v) => formatDateTime(String(v)),
  },
];

// ─── 필터 상태 타입 ───────────────────────────────────────────────────────────

interface FilterState {
  orderStatus: string[];
  feeType: string; // "all" | "included" | "separate"
  cardCompany: string[];
  installment: string; // "all" | "lumpsum" | "installment"
  dateRange: DateRange;
  amountRange: NumberRangeValue;
  voucherStatus: string[];
}

const INITIAL_FILTERS: FilterState = {
  orderStatus: [],
  feeType: "all",
  cardCompany: [],
  installment: "all",
  dateRange: { from: null, to: null },
  amountRange: {},
  voucherStatus: [],
};

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type OrderRow = AdminOrderListItem & Record<string, unknown>;

// ─── API 쿼리 빌더 ──────────────────────────────────────────────────────────

function buildQueryParams(search: string, filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("limit", "10000");
  params.set("sort_by", "created_at");
  params.set("sort_order", "desc");

  if (search) params.set("search", search);

  // 주문 상태 (단일 값만 API 지원)
  if (filters.orderStatus.length === 1) {
    params.set("order_status", filters.orderStatus[0]);
  }

  if (filters.feeType !== "all") params.set("fee_type", filters.feeType);
  if (filters.cardCompany.length > 0) params.set("card_company", filters.cardCompany.join(","));
  if (filters.installment !== "all") params.set("installment", filters.installment);
  if (filters.dateRange.from) params.set("date_from", filters.dateRange.from);
  if (filters.dateRange.to) params.set("date_to", filters.dateRange.to);
  if (filters.amountRange.min != null) params.set("amount_min", String(filters.amountRange.min));
  if (filters.amountRange.max != null) params.set("amount_max", String(filters.amountRange.max));

  // 바우처 상태 (단일 값만 API 지원)
  if (filters.voucherStatus.length === 1) {
    params.set("voucher_status", filters.voucherStatus[0]);
  }

  return params;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminOrdersClient() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderListItem | null>(null);

  // ─── API 호출 ──────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (searchVal: string, filterVal: FilterState) => {
    setLoading(true);
    try {
      const params = buildQueryParams(searchVal, filterVal);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error("주문 목록 조회 실패");
      const json = await res.json();

      if (json.success) {
        setOrders(json.data.data);
      } else {
        toast({ type: "error", title: json.error?.message ?? "주문 목록 조회 실패" });
      }
    } catch {
      toast({ type: "error", title: "주문 목록을 불러오지 못했습니다" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 초기 로드
  useEffect(() => {
    fetchOrders("", INITIAL_FILTERS);
  }, [fetchOrders]);

  // ─── 주문 업데이트 (모달 액션 후) ────────────────────────────────────────────

  const handleOrderUpdate = useCallback((updatedOrder: AdminOrderListItem) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setSelectedOrder(updatedOrder);
  }, []);

  // ─── 필터 적용 ──────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    fetchOrders(search, filters);
  }, [filters, search, fetchOrders]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    fetchOrders("", INITIAL_FILTERS);
  }, [fetchOrders]);

  const handleSearchSubmit = useCallback((value: string) => {
    fetchOrders(value, appliedFilters);
  }, [appliedFilters, fetchOrders]);

  // ─── 데이터 필터링 (API에서 처리 못한 다중 선택 보정) ──────────────────────────

  const filteredOrders = useMemo<OrderRow[]>(() => {
    let result = orders as OrderRow[];

    // 다중 바우처 상태 선택 시 클라이언트 필터링 (API는 단일 값만 지원)
    if (appliedFilters.voucherStatus.length > 1) {
      result = result.filter(
        (o) => o.voucher_status && appliedFilters.voucherStatus.includes(o.voucher_status)
      );
    }

    return result;
  }, [orders, appliedFilters.voucherStatus]);

  // ─── 활성 필터 칩 ───────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.orderStatus.length > 0) {
      chips.push({
        key: "orderStatus",
        label: "주문상태",
        value: appliedFilters.orderStatus
          .map((s) => ORDER_STATUS_LABEL[s as DisplayOrderStatus] ?? s)
          .join(", "),
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, orderStatus: [] })),
      });
    }

    if (appliedFilters.feeType !== "all") {
      chips.push({
        key: "feeType",
        label: "수수료",
        value: appliedFilters.feeType === "included" ? "포함" : "별도",
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, feeType: "all" })),
      });
    }

    if (appliedFilters.cardCompany.length > 0) {
      chips.push({
        key: "cardCompany",
        label: "카드사",
        value: appliedFilters.cardCompany
          .map((c) => CARD_COMPANY_OPTS.find((o) => o.value === c)?.label ?? c)
          .join(", "),
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, cardCompany: [] })),
      });
    }

    if (appliedFilters.installment !== "all") {
      chips.push({
        key: "installment",
        label: "할부",
        value: appliedFilters.installment === "lumpsum" ? "일시불" : "할부",
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, installment: "all" })),
      });
    }

    if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
      const from = appliedFilters.dateRange.from ?? "";
      const to = appliedFilters.dateRange.to ?? "";
      chips.push({
        key: "dateRange",
        label: "기간",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            dateRange: { from: null, to: null },
          })),
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
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, amountRange: {} })),
      });
    }

    if (appliedFilters.voucherStatus.length > 0) {
      chips.push({
        key: "voucherStatus",
        label: "바우처상태",
        value: appliedFilters.voucherStatus
          .map((s) => VOUCHER_STATUS_LABEL[s as VoucherStatus] ?? s)
          .join(", "),
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, voucherStatus: [] })),
      });
    }

    return chips;
  }, [appliedFilters]);

  // ─── 테이블 컬럼 정의 ───────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        label: "주문일시",
        sortable: true,
        align: "center" as const,
        width: "130px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-muted-foreground">
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
          <span className="whitespace-nowrap font-mono text-[14px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "buyer_name",
        label: "구매자",
        sortable: true,
        align: "center" as const,
        width: "60px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-medium text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "buyer_username",
        label: "아이디",
        sortable: true,
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "buyer_phone",
        label: "전화번호",
        align: "center" as const,
        width: "110px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap font-mono text-[14px] text-foreground">
            {formatPhone(String(v))}
          </span>
        ),
      },
      {
        key: "product_name",
        label: "상품명",
        sortable: true,
        align: "center" as const,
        width: "250px",
        render: (v: unknown, row: OrderRow) => (
          <div className="flex items-center justify-center gap-2">
            {row.product_image_url && (
              <Image
                src={String(row.product_image_url)}
                alt={String(v)}
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-[14px] text-foreground" title={String(v)}>{String(v)}</p>
              <p className="text-[11px] text-muted-foreground">
                {Number(row.product_price).toLocaleString()}원 × {row.quantity}개
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "total_amount",
        label: "총 결제금액",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-semibold text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "card_company_name",
        label: "카드사",
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-foreground">{String(v ?? "—")}</span>
        ),
      },
      {
        key: "installment_months",
        label: "할부",
        align: "center" as const,
        width: "55px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-foreground">
            {Number(v) === 0 ? "일시불" : `${v}개월`}
          </span>
        ),
      },
      {
        key: "status",
        label: "주문상태",
        align: "center" as const,
        width: "75px",
        render: (v: unknown) => {
          const displayStatus = getDisplayOrderStatus(v as OrderStatus);
          return (
            <span
              className={cn(
                "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                ORDER_STATUS_STYLE[displayStatus]
              )}
            >
              {ORDER_STATUS_LABEL[displayStatus]}
            </span>
          );
        },
      },
      {
        key: "voucher_status",
        label: "바우처상태",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) =>
          v ? (
            <span
              className={cn(
                "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                VOUCHER_STATUS_STYLE[v as VoucherStatus]
              )}
            >
              {VOUCHER_STATUS_LABEL[v as VoucherStatus]}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <Package2 size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">주문 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              전체 주문 내역을 조회하고 상세 정보를 확인합니다
            </p>
          </div>
        </div>

        {/* CSV 내보내기 */}
        <AdminCsvExportButton<AdminOrderListItem>
          getData={() => filteredOrders as AdminOrderListItem[]}
          columns={CSV_COLUMNS}
          filename="주문목록"
          label="CSV 내보내기"
          size="sm"
        />
      </div>

      {/* 검색 + 필터 패널 */}
      <AdminSearchFilterPanel
        searchPlaceholder="주문번호, 구매자, 전화번호, 상품명으로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={filteredOrders.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 주문 상태 */}
        <AdminMultiSelect
          label="주문 상태"
          options={ORDER_STATUS_OPTS}
          value={filters.orderStatus}
          onChange={(v) => setFilters((prev) => ({ ...prev, orderStatus: v }))}
          placeholder="전체"
        />

        {/* 필터 2: 수수료 방식 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">수수료 방식</label>
          <Select
            value={filters.feeType}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, feeType: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="included">포함</SelectItem>
              <SelectItem value="separate">별도</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 3: 카드사 */}
        <AdminMultiSelect
          label="카드사"
          options={CARD_COMPANY_OPTS}
          value={filters.cardCompany}
          onChange={(v) => setFilters((prev) => ({ ...prev, cardCompany: v }))}
          placeholder="전체"
        />

        {/* 필터 4: 할부 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">할부</label>
          <Select
            value={filters.installment}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, installment: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="lumpsum">일시불</SelectItem>
              <SelectItem value="installment">할부</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 5: 주문 기간 */}
        <AdminDateRangePicker
          label="주문 기간"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />

        {/* 필터 6: 금액 범위 */}
        <AdminNumberRange
          label="금액 범위"
          value={filters.amountRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, amountRange: v }))}
          unit="원"
          min={0}
        />

        {/* 필터 7: 바우처 상태 */}
        <AdminMultiSelect
          label="바우처 상태"
          options={VOUCHER_STATUS_OPTS}
          value={filters.voucherStatus}
          onChange={(v) => setFilters((prev) => ({ ...prev, voucherStatus: v }))}
          placeholder="전체"
        />
      </AdminSearchFilterPanel>

      {/* 데이터 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">주문 목록을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<OrderRow>
          columns={columns}
          data={filteredOrders}
          emptyMessage="조건에 맞는 주문이 없습니다."
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedOrder(row as AdminOrderListItem)}
          pageSizeOptions={[10, 20, 50]}
        />
      )}

      {/* 상세 모달 */}
      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdate={handleOrderUpdate}
      />
    </div>
  );
}
