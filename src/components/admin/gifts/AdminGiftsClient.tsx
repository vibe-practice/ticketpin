"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Gift, ArrowRight, Loader2, Link2 } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import type { AdminGiftListItem, VoucherStatus } from "@/types";

// ─── 상태 라벨/색상 맵 ────────────────────────────────────────────────────────

const VOUCHER_STATUS_OPTS = [
  { value: "issued", label: "발급" },
  { value: "temp_verified", label: "임시인증" },
  { value: "password_set", label: "비번설정" },
  { value: "pin_revealed", label: "핀확인" },
  { value: "gifted", label: "선물" },
  { value: "cancelled", label: "취소" },
];

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

const CSV_COLUMNS: CsvColumnDef<AdminGiftListItem>[] = [
  { key: "created_at", label: "선물일시", format: (v) => formatDateTime(String(v)) },
  { key: "sender_username", label: "보낸사람 아이디" },
  { key: "sender_name", label: "보낸사람 이름" },
  { key: "receiver_username", label: "받는사람 아이디" },
  { key: "receiver_name", label: "받는사람 이름" },
  { key: "product_name", label: "상품명" },
  { key: "order_quantity", label: "수량" },
  { key: "product_price", label: "상품단가", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "total_amount", label: "총금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "fee_type", label: "수수료방식", format: (v) => (v === "included" ? "포함" : "별도") },
  { key: "fee_amount", label: "수수료금액", format: (v) => String(Number(v)) },
  { key: "source_voucher_code", label: "원본바우처코드" },
  { key: "new_voucher_code", label: "새바우처코드" },
  { key: "new_voucher_status", label: "바우처상태", format: (v) => VOUCHER_STATUS_LABEL[v as VoucherStatus] ?? String(v) },
];

// ─── 필터 상태 타입 ───────────────────────────────────────────────────────────

interface FilterState {
  voucherStatus: string[];
  feeType: string; // "all" | "included" | "separate"
  dateRange: DateRange;
  amountRange: NumberRangeValue;
}

const INITIAL_FILTERS: FilterState = {
  voucherStatus: [],
  feeType: "all",
  dateRange: { from: null, to: null },
  amountRange: {},
};

// ─── 쿼리 파라미터 빌드 ─────────────────────────────────────────────────────

function buildQueryParams(search: string, filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("limit", "2000");
  params.set("sort_by", "created_at");
  params.set("sort_order", "desc");

  if (search) params.set("search", search);
  if (filters.voucherStatus.length > 0) params.set("voucher_status", filters.voucherStatus.join(","));
  if (filters.feeType !== "all") params.set("fee_type", filters.feeType);
  if (filters.dateRange.from) params.set("date_from", filters.dateRange.from);
  if (filters.dateRange.to) params.set("date_to", filters.dateRange.to);
  if (filters.amountRange.min != null) params.set("amount_min", String(filters.amountRange.min));
  if (filters.amountRange.max != null) params.set("amount_max", String(filters.amountRange.max));

  return params;
}

// ─── 선물 체인 노드 타입 ─────────────────────────────────────────────────────

interface GiftChainNode {
  voucher_id: string;
  voucher_code: string;
  voucher_status: VoucherStatus;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  is_gift: boolean;
  gift_sender_username: string | null;
  created_at: string;
}

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type GiftRow = AdminGiftListItem & Record<string, unknown>;

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminGiftsClient() {
  const { toast } = useToast();
  const [gifts, setGifts] = useState<AdminGiftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 선물 체인 상태
  const [chainData, setChainData] = useState<{ chain: GiftChainNode[]; order_number: string | null } | null>(null);
  const [chainLoading, setChainLoading] = useState(false);

  // ─── API 호출 ──────────────────────────────────────────────────────────────

  const fetchGifts = useCallback(async (searchVal: string, filterVal: FilterState) => {
    setLoading(true);
    try {
      const params = buildQueryParams(searchVal, filterVal);
      const res = await fetch(`/api/admin/gifts?${params.toString()}`);
      if (!res.ok) throw new Error("선물 이력 조회 실패");
      const json = await res.json();

      if (json.success) {
        setGifts(json.data.data);
      } else {
        throw new Error(json.error?.message ?? "선물 이력 조회 실패");
      }
    } catch {
      toast({ type: "error", title: "선물 이력을 불러오지 못했습니다" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 초기 로드
  useEffect(() => {
    fetchGifts("", INITIAL_FILTERS);
  }, [fetchGifts]);

  // ─── 선물 체인 조회 ───────────────────────────────────────────────────────

  const fetchChain = useCallback(async (giftId: string) => {
    setChainLoading(true);
    setChainData(null);
    try {
      const res = await fetch(`/api/admin/gifts/${giftId}/chain`);
      if (!res.ok) throw new Error("선물 체인 조회 실패");
      const json = await res.json();
      if (json.success) {
        setChainData(json.data);
      }
    } catch {
      toast({ type: "error", title: "선물 체인을 불러오지 못했습니다" });
    } finally {
      setChainLoading(false);
    }
  }, [toast]);

  // ─── 필터 적용 ──────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
    fetchGifts(search, filters);
  }, [filters, search, fetchGifts]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
    fetchGifts("", INITIAL_FILTERS);
  }, [fetchGifts]);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
    fetchGifts(value, appliedFilters);
  }, [appliedFilters, fetchGifts]);

  // ─── 행 클릭 → 확장 + 체인 조회 ──────────────────────────────────────────

  const handleRowClick = useCallback((row: GiftRow) => {
    setExpandedId((prev) => {
      const newId = prev === row.id ? null : row.id;
      if (newId) {
        fetchChain(newId);
      } else {
        setChainData(null);
      }
      return newId;
    });
  }, [fetchChain]);

  // ─── 클라이언트 필터링 (API 다중 선택 보정) ──────────────────────────────

  const filteredGifts = useMemo<GiftRow[]>(() => {
    return (gifts as GiftRow[]).filter((gift) => {
      // 바우처 상태 필터 보정
      if (
        appliedFilters.voucherStatus.length >= 1 &&
        !appliedFilters.voucherStatus.includes(gift.new_voucher_status)
      ) {
        return false;
      }
      return true;
    });
  }, [gifts, appliedFilters]);

  // ─── 필터 칩 제거 핸들러 ─────────────────────────────────────────────────────

  const removeFilter = useCallback((key: keyof FilterState) => {
    setAppliedFilters((prev) => {
      const defaults: Record<keyof FilterState, FilterState[keyof FilterState]> = {
        voucherStatus: [],
        feeType: "all",
        dateRange: { from: null, to: null },
        amountRange: {},
      };
      const next = { ...prev, [key]: defaults[key] };
      setFilters((f) => ({ ...f, [key]: defaults[key] }));
      fetchGifts(appliedSearch, next);
      return next;
    });
  }, [appliedSearch, fetchGifts]);

  // ─── 활성 필터 칩 ───────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.voucherStatus.length > 0) {
      chips.push({
        key: "voucherStatus",
        label: "바우처상태",
        value: appliedFilters.voucherStatus
          .map((s) => VOUCHER_STATUS_LABEL[s as VoucherStatus] ?? s)
          .join(", "),
        onRemove: () => removeFilter("voucherStatus"),
      });
    }

    if (appliedFilters.feeType !== "all") {
      chips.push({
        key: "feeType",
        label: "수수료",
        value: appliedFilters.feeType === "included" ? "포함" : "별도",
        onRemove: () => removeFilter("feeType"),
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

  // ─── 테이블 컬럼 정의 ───────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        label: "선물일시",
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
        key: "sender_name",
        label: "보낸 사람",
        align: "center" as const,
        width: "120px",
        render: (_v: unknown, row: GiftRow) => (
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground">{row.sender_name}</p>
            <p className="text-[11px] text-muted-foreground">{row.sender_username}</p>
          </div>
        ),
      },
      {
        key: "receiver_name",
        label: "받는 사람",
        align: "center" as const,
        width: "120px",
        render: (_v: unknown, row: GiftRow) => (
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground">{row.receiver_name}</p>
            <p className="text-[11px] text-muted-foreground">{row.receiver_username}</p>
          </div>
        ),
      },
      {
        key: "product_name",
        label: "상품명",
        sortable: true,
        align: "center" as const,
        width: "200px",
        render: (v: unknown) => (
          <span className="truncate text-[14px] text-foreground" title={String(v)}>
            {String(v)}
          </span>
        ),
      },
      {
        key: "order_quantity",
        label: "수량",
        align: "center" as const,
        width: "55px",
        render: (v: unknown) => (
          <span className="text-[14px] text-foreground">{String(v)}개</span>
        ),
      },
      {
        key: "total_amount",
        label: "총 금액",
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
        key: "fee_amount",
        label: "수수료",
        align: "center" as const,
        width: "100px",
        render: (v: unknown, row: GiftRow) => (
          <div className="text-center">
            <p className="text-[14px] text-foreground">{Number(v).toLocaleString()}원</p>
            <p className="text-[11px] text-muted-foreground">
              {row.fee_type === "included" ? "포함" : "별도"}
            </p>
          </div>
        ),
      },
      {
        key: "new_voucher_status",
        label: "바우처 상태",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              VOUCHER_STATUS_STYLE[v as VoucherStatus]
            )}
          >
            {VOUCHER_STATUS_LABEL[v as VoucherStatus]}
          </span>
        ),
      },
    ],
    []
  );

  // ─── 확장 행 렌더 ──────────────────────────────────────────────────────────

  const expandedGift = expandedId
    ? filteredGifts.find((g) => g.id === expandedId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <Gift size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">선물 이력</h1>
            <p className="text-[14px] text-muted-foreground">
              전체 선물 거래 내역을 조회하고 상세 정보를 확인합니다
            </p>
          </div>
        </div>

        {/* CSV 내보내기 */}
        <AdminCsvExportButton<AdminGiftListItem>
          getData={() => filteredGifts as AdminGiftListItem[]}
          columns={CSV_COLUMNS}
          filename="선물이력"
          label="CSV 내보내기"
          size="sm"
        />
      </div>

      {/* 검색 + 필터 패널 */}
      <AdminSearchFilterPanel
        searchPlaceholder="보낸사람, 받는사람, 상품명, 바우처코드로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={filteredGifts.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 바우처 상태 */}
        <AdminMultiSelect
          label="바우처 상태"
          options={VOUCHER_STATUS_OPTS}
          value={filters.voucherStatus}
          onChange={(v) => setFilters((prev) => ({ ...prev, voucherStatus: v }))}
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

        {/* 필터 3: 선물 기간 */}
        <AdminDateRangePicker
          label="선물 기간"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />

        {/* 필터 4: 금액 범위 */}
        <AdminNumberRange
          label="금액 범위"
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
          <span className="ml-2 text-sm text-muted-foreground">선물 이력을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<GiftRow>
          columns={columns}
          data={filteredGifts}
          emptyMessage="조건에 맞는 선물 이력이 없습니다."
          rowKey={(row) => row.id}
          onRowClick={handleRowClick}
          pageSizeOptions={[20, 50]}
        />
      )}

      {/* 확장 상세 영역 */}
      {expandedGift && (
        <div className="rounded-lg border border-border bg-muted/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Gift size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">선물 상세 정보</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDateTime(expandedGift.created_at)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 바우처 코드 연결 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">바우처 코드</p>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">원본</p>
                  <p className="truncate font-mono text-[14px] text-foreground" title={expandedGift.source_voucher_code}>
                    {expandedGift.source_voucher_code}
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">새 코드</p>
                  <p className="truncate font-mono text-[14px] text-foreground" title={expandedGift.new_voucher_code}>
                    {expandedGift.new_voucher_code}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                      VOUCHER_STATUS_STYLE[expandedGift.new_voucher_status]
                    )}
                  >
                    {VOUCHER_STATUS_LABEL[expandedGift.new_voucher_status]}
                  </span>
                </div>
              </div>
            </div>

            {/* 보낸/받는 사람 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">보낸/받는 사람</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">보낸 사람</p>
                  <p className="text-[14px] font-medium text-foreground">
                    {expandedGift.sender_name}{" "}
                    <span className="text-muted-foreground">({expandedGift.sender_username})</span>
                  </p>
                  <p className="font-mono text-[14px] text-muted-foreground">
                    {formatPhone(expandedGift.sender_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">받는 사람</p>
                  <p className="text-[14px] font-medium text-foreground">
                    {expandedGift.receiver_name}{" "}
                    <span className="text-muted-foreground">({expandedGift.receiver_username})</span>
                  </p>
                  <p className="font-mono text-[14px] text-muted-foreground">
                    {formatPhone(expandedGift.receiver_phone)}
                  </p>
                </div>
              </div>
            </div>

            {/* 금액 상세 */}
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">금액 상세</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted-foreground">상품단가</span>
                  <span className="text-foreground">{expandedGift.product_price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted-foreground">수량</span>
                  <span className="text-foreground">{expandedGift.order_quantity}개</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted-foreground">
                    수수료 ({expandedGift.fee_type === "included" ? "포함" : "별도"})
                  </span>
                  <span className="text-foreground">{expandedGift.fee_amount.toLocaleString()}원</span>
                </div>
                <div className="mt-1 border-t border-border pt-1">
                  <div className="flex justify-between text-[14px] font-semibold">
                    <span className="text-foreground">총 금액</span>
                    <span className="text-primary">{expandedGift.total_amount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 선물 체인 추적 */}
          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Link2 size={14} className="text-primary" />
              <p className="text-xs font-medium text-muted-foreground">선물 체인 추적</p>
              {chainData?.order_number && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  주문번호: {chainData.order_number}
                </span>
              )}
            </div>
            {chainLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">체인 조회 중...</span>
              </div>
            ) : chainData && chainData.chain.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {chainData.chain.map((node, idx) => (
                  <div key={node.voucher_id} className="flex items-center gap-2">
                    {idx > 0 && <ArrowRight size={14} className="shrink-0 text-muted-foreground" />}
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2",
                        node.voucher_id === expandedGift.source_voucher_id
                          ? "border-neutral-300 bg-neutral-100"
                          : node.voucher_id === expandedGift.new_voucher_id
                            ? "border-primary/30 bg-brand-primary-soft"
                            : "border-border bg-muted/40"
                      )}
                    >
                      <p className="text-[14px] font-medium text-foreground">
                        {node.owner_name}
                        <span className="ml-1 text-[11px] text-muted-foreground">({node.owner_username})</span>
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground" title={node.voucher_code}>
                        {node.voucher_code.slice(0, 12)}...
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                          VOUCHER_STATUS_STYLE[node.voucher_status]
                        )}
                      >
                        {VOUCHER_STATUS_LABEL[node.voucher_status]}
                      </span>
                      {node.is_gift && node.gift_sender_username && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          from: {node.gift_sender_username}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">
                선물 체인 정보가 없습니다
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
