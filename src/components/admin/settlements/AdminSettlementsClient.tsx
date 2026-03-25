"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Calculator,
  CheckCircle2,
  CreditCard,
  X,
  Calendar,
  Gift,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Hash,
  Search,
  ArrowUpDown,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn, formatDateTime, getToday, shiftDate } from "@/lib/utils";
import {
  SETTLEMENT_STATUS_STYLE,
  SETTLEMENT_STATUS_LABEL,
  VERIFICATION_STATUS_STYLE,
  VERIFICATION_STATUS_LABEL,
  VOUCHER_STATUS_STYLE,
  VOUCHER_STATUS_LABEL,
} from "@/lib/admin-constants";
import type {
  AdminSettlementListItem,
  SettlementStatus,
  SettlementGiftItem,
  VerificationStatus,
  VoucherStatus,
} from "@/types";
import { VoucherDetailModal } from "./VoucherDetailModal";


// ─── 업체 타입 ────────────────────────────────────────────────────────────────

interface BusinessOption {
  id: string;
  name: string;
  commission_rate: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

const CSV_GIFT_COLUMNS: CsvColumnDef<SettlementGiftItem>[] = [
  { key: "created_at", label: "시간", format: (v) => v ? formatDateTime(String(v)) : "" },
  { key: "product_name", label: "상품명" },
  { key: "quantity", label: "수량" },
  { key: "total_amount", label: "금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "settlement_per_item", label: "정산금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "original_buyer_name", label: "최초 구매자" },
  { key: "original_buyer_phone", label: "연락처" },
  { key: "payment_method", label: "결제방법" },
  { key: "installment_type", label: "할부" },
  { key: "commission_included", label: "수수료", format: (v) => v ? "포함" : "별도" },
  { key: "verification_status", label: "검증", format: (v) => VERIFICATION_STATUS_LABEL[v as VerificationStatus] ?? String(v) },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function getDateTimeShort(datetime: string): string {
  const d = new Date(datetime);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${month}/${day} ${time}`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function AdminSettlementsClient() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // 업체 목록
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);

  // 정산 + 건별 데이터
  const [settlements, setSettlements] = useState<AdminSettlementListItem[]>([]);
  const [giftItems, setGiftItems] = useState<SettlementGiftItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // 필터 상태
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 검색/정렬/페이지네이션 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"none" | "asc" | "desc">("none");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // 모바일 필터 토글
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // 모달 상태
  const [selectedGiftItem, setSelectedGiftItem] = useState<SettlementGiftItem | null>(null);
  const [voucherDetailOpen, setVoucherDetailOpen] = useState(false);

  // ─── 업체 목록 조회 ──────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchBusinesses() {
      setBusinessesLoading(true);
      try {
        const res = await fetch("/api/admin/businesses?page_size=100");
        const json = await res.json();
        if (json.success && json.data?.data) {
          const biz: BusinessOption[] = (json.data.data as Record<string, unknown>[]).map((b) => ({
            id: b.id as string,
            name: b.business_name as string,
            commission_rate: Number(b.commission_rate),
            bank_name: b.bank_name as string,
            account_number: b.account_number as string,
            account_holder: b.account_holder as string,
          }));
          setBusinesses(biz);
          if (biz.length > 0) setSelectedBusinessId(biz[0].id);
        }
      } catch {
        toast({ type: "error", title: "업체 목록 조회 실패" });
      } finally {
        setBusinessesLoading(false);
      }
    }
    fetchBusinesses();
  }, [toast]);

  // ─── 정산 + 건별 데이터 조회 ─────────────────────────────────────────────

  const fetchSettlementData = useCallback(async () => {
    if (!selectedBusinessId) return;
    setDataLoading(true);
    try {
      // 정산 레코드 조회
      const stlParams = new URLSearchParams({
        business_id: selectedBusinessId,
        start_date: startDate,
        end_date: endDate,
        page_size: "50",
      });
      if (statusFilter !== "all") stlParams.set("status", statusFilter);
      const stlRes = await fetch(`/api/admin/settlements?${stlParams.toString()}`);
      const stlJson = await stlRes.json();
      const stlData: AdminSettlementListItem[] = stlJson.success ? (stlJson.data ?? []) : [];
      setSettlements(stlData);

      // 각 정산의 건별 항목 5개씩 청크 병렬 조회
      const CHUNK_SIZE = 5;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailResults: { stlId: string; data: any }[] = [];
      for (let i = 0; i < stlData.length; i += CHUNK_SIZE) {
        const chunk = stlData.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (stl) => {
            const detailRes = await fetch(`/api/admin/settlements/${stl.id}`);
            const detailJson = await detailRes.json();
            return { stlId: stl.id, data: detailJson };
          })
        );
        detailResults.push(...chunkResults);
      }

      const allItems: SettlementGiftItem[] = [];
      for (const { stlId, data: detailJson } of detailResults) {
        if (detailJson.success && detailJson.data?.items) {
          const items = detailJson.data.items as Record<string, unknown>[];
          for (const item of items) {
            allItems.push({
              gift_id: (item.gift_id as string) ?? (item.id as string),
              sender_username: "",
              product_name: item.product_name as string,
              product_price: Number(item.product_price),
              quantity: Number(item.quantity),
              total_amount: Number(item.total_amount),
              settlement_per_item: Number(item.settlement_per_item),
              created_at: ((item.gift_created_at as string) ?? (item.created_at as string)),
              source_voucher_code: "",
              new_voucher_code: "",
              new_voucher_status: ((item.voucher_status as string) ?? "gifted") as VoucherStatus,
              original_order_number: (item.order_number as string) ?? "",
              original_buyer_username: "",
              original_buyer_name: (item.original_buyer_name as string) ?? "",
              original_buyer_phone: (item.original_buyer_phone as string) ?? "",
              payment_method: (item.payment_method as string) ?? "",
              installment_type: "",
              commission_included: true,
              verification_status: (item.verification_status as VerificationStatus) ?? "pending",
              verification_memo: (item.verification_memo as string) ?? null,
              pin_ids: [],
              pin_statuses: [],
              // 확장 필드
              ...{ settlement_id: stlId, item_id: item.id, voucher_id: item.voucher_id as string },
            });
          }
        }
      }
      setGiftItems(allItems);
    } catch {
      toast({ type: "error", title: "정산 데이터 조회 실패" });
    } finally {
      setDataLoading(false);
    }
  }, [selectedBusinessId, startDate, endDate, statusFilter, toast]);

  useEffect(() => {
    if (selectedBusinessId) fetchSettlementData();
  }, [selectedBusinessId, startDate, endDate, statusFilter, fetchSettlementData]);

  // 선택된 업체
  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? businesses[0],
    [businesses, selectedBusinessId]
  );

  // 대표 정산 레코드
  const currentSettlement = useMemo(
    () => settlements.length > 0 ? settlements.reduce((a, b) => a.settlement_date > b.settlement_date ? a : b) : null,
    [settlements]
  );

  // 당일 정산 여부 체크
  const isSameDaySettlement = useMemo(() => {
    if (!currentSettlement) return false;
    return currentSettlement.settlement_date === getToday();
  }, [currentSettlement]);

  // 검색 + 정렬
  const filteredGiftItems = useMemo(() => {
    let items = giftItems;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (g) =>
          g.product_name.toLowerCase().includes(q) ||
          g.original_buyer_name.toLowerCase().includes(q) ||
          g.original_order_number.toLowerCase().includes(q)
      );
    }
    if (sortOrder === "asc") {
      items = [...items].sort((a, b) => a.total_amount - b.total_amount);
    } else if (sortOrder === "desc") {
      items = [...items].sort((a, b) => b.total_amount - a.total_amount);
    }
    return items;
  }, [giftItems, searchQuery, sortOrder]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredGiftItems.length / pageSize));
  const paginatedGiftItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGiftItems.slice(start, start + pageSize);
  }, [filteredGiftItems, currentPage, pageSize]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  // 요약 계산
  const summary = useMemo(() => {
    const validItems = giftItems.filter((g) => g.verification_status !== "rejected");
    return {
      giftCount: giftItems.length,
      totalQuantity: giftItems.reduce((s, g) => s + g.quantity, 0),
      totalAmount: giftItems.reduce((s, g) => s + g.total_amount, 0),
      settlementAmount: validItems.reduce((s, g) => s + g.settlement_per_item, 0),
      validCount: validItems.length,
    };
  }, [giftItems]);

  // ─── 상태 변경 ────────────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (id: string, newStatus: SettlementStatus) => {
    const statusLabel = SETTLEMENT_STATUS_LABEL[newStatus];
    const ok = await confirm({
      title: "정산 상태 변경",
      description: `이 정산을 '${statusLabel}' 상태로 변경하시겠습니까?`,
      confirmLabel: "변경",
      cancelLabel: "취소",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/settlements/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: `정산이 '${statusLabel}' 상태로 변경되었습니다` });
        fetchSettlementData();
      } else {
        toast({ type: "error", title: json.error?.message ?? "상태 변경 실패" });
      }
    } catch {
      toast({ type: "error", title: "상태 변경 중 오류가 발생했습니다." });
    }
  }, [confirm, toast, fetchSettlementData]);

  if (businessesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">업체 목록을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">

      {/* ── 페이지 헤더 ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary-soft">
            <Calculator size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground md:text-xl">정산 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              업체별 · 날짜별 정산을 관리합니다
            </p>
          </div>
        </div>

        <AdminCsvExportButton<SettlementGiftItem>
          getData={() => giftItems}
          columns={CSV_GIFT_COLUMNS}
          filename={`정산내역_${selectedBusiness?.name ?? "전체"}_${startDate}_${endDate}`}
          label="CSV"
          size="sm"
        />
      </div>

      {/* ── 필터 바 (데스크탑) ─────────────────────────────────── */}
      <div className="hidden md:flex md:items-center md:gap-4 rounded-lg border border-border bg-card p-4">
        {/* 업체 선택 */}
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-primary shrink-0" />
          <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
            <SelectTrigger className="h-9 w-[200px] text-sm">
              <SelectValue placeholder="업체 선택" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((biz) => (
                <SelectItem key={biz.id} value={biz.id}>
                  {biz.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* 정산 상태 필터 */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[130px] text-sm">
            <SelectValue placeholder="상태 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">상태 전체</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="confirmed">확정</SelectItem>
            <SelectItem value="paid">지급완료</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border" />

        {/* 날짜 범위 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => { setStartDate(shiftDate(startDate, -1)); setEndDate(shiftDate(endDate, -1)); }}
          >
            <ChevronLeft size={16} />
          </Button>

          <Calendar size={16} className="text-primary shrink-0" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
            className="h-9 w-[150px] text-sm"
          />
          <span className="text-[14px] text-muted-foreground">~</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); if (e.target.value < startDate) setStartDate(e.target.value); }}
            className="h-9 w-[150px] text-sm"
          />

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => { setStartDate(shiftDate(startDate, 1)); setEndDate(shiftDate(endDate, 1)); }}
          >
            <ChevronRight size={16} />
          </Button>

          {/* 날짜 프리셋 */}
          <div className="flex items-center gap-1 ml-1">
            {([
              { label: "오늘", getRange: () => { const t = getToday(); return [t, t]; } },
              { label: "어제", getRange: () => { const y = shiftDate(getToday(), -1); return [y, y]; } },
              { label: "1주일", getRange: () => [shiftDate(getToday(), -6), getToday()] },
              { label: "1개월", getRange: () => [shiftDate(getToday(), -29), getToday()] },
            ] as const).map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[14px] text-muted-foreground hover:text-foreground"
                onClick={() => { const [s, e] = preset.getRange(); setStartDate(s); setEndDate(e); }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 정산 상태 + 액션 */}
        <div className="ml-auto flex items-center gap-2">
          {dataLoading ? (
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          ) : currentSettlement ? (
            <>
              <span
                className={cn(
                  "whitespace-nowrap rounded-sm px-2.5 py-1 text-[14px] font-semibold",
                  SETTLEMENT_STATUS_STYLE[currentSettlement.status]
                )}
              >
                {SETTLEMENT_STATUS_LABEL[currentSettlement.status]}
              </span>
              {currentSettlement.status === "pending" && (
                <>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[14px]"
                    disabled={isSameDaySettlement}
                    title={isSameDaySettlement ? "당일에는 정산이 불가능합니다" : undefined}
                    onClick={() => handleStatusChange(currentSettlement.id, "confirmed")}>
                    <CheckCircle2 size={13} className="mr-1" /> 확인
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[14px] text-error hover:text-error"
                    onClick={() => handleStatusChange(currentSettlement.id, "cancelled")}>
                    <X size={13} className="mr-1" /> 취소
                  </Button>
                </>
              )}
              {currentSettlement.status === "confirmed" && (
                <>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[14px]"
                    disabled={isSameDaySettlement}
                    title={isSameDaySettlement ? "당일에는 정산이 불가능합니다" : undefined}
                    onClick={() => handleStatusChange(currentSettlement.id, "paid")}>
                    <CreditCard size={13} className="mr-1" /> 입금완료
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-[14px] text-error hover:text-error"
                    onClick={() => handleStatusChange(currentSettlement.id, "cancelled")}>
                    <X size={13} className="mr-1" /> 취소
                  </Button>
                </>
              )}
              {isSameDaySettlement && (currentSettlement.status === "pending" || currentSettlement.status === "confirmed") && (
                <span className="text-[11px] text-neutral-600">당일에는 정산이 불가능합니다</span>
              )}
            </>
          ) : (
            <span className="text-[14px] text-muted-foreground">정산 미생성</span>
          )}
        </div>
      </div>

      {/* ── 필터 바 (모바일) ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {/* 업체 선택 + 필터 토글 */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Building2 size={15} className="text-primary shrink-0" />
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="h-9 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0">
                <SelectValue placeholder="업체 선택" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((biz) => (
                  <SelectItem key={biz.id} value={biz.id}>
                    {biz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-[52px] shrink-0 gap-1.5 px-3"
            onClick={() => setMobileFilterOpen((v) => !v)}
          >
            <SlidersHorizontal size={15} />
            <span className="text-[14px]">필터</span>
            <ChevronDown
              size={12}
              className={cn("transition-transform duration-200", mobileFilterOpen && "rotate-180")}
            />
          </Button>
        </div>

        {/* 날짜 + 상태 패널 (토글) */}
        {mobileFilterOpen && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            {/* 정산 상태 필터 */}
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-foreground">정산 상태</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="상태 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">상태 전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="confirmed">확정</SelectItem>
                  <SelectItem value="paid">지급완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-px bg-border" />

            {/* 날짜 범위 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                <span className="text-[14px] font-medium text-foreground">기간 선택</span>
              </div>

              {/* 날짜 인풋 행 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 shrink-0 p-0"
                  onClick={() => { setStartDate(shiftDate(startDate, -1)); setEndDate(shiftDate(endDate, -1)); }}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                  className="h-10 flex-1 text-sm"
                />
                <span className="text-[14px] text-muted-foreground shrink-0">~</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); if (e.target.value < startDate) setStartDate(e.target.value); }}
                  className="h-10 flex-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 shrink-0 p-0"
                  onClick={() => { setStartDate(shiftDate(startDate, 1)); setEndDate(shiftDate(endDate, 1)); }}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>

              {/* 프리셋 버튼 */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { label: "오늘", getRange: () => { const t = getToday(); return [t, t]; } },
                  { label: "어제", getRange: () => { const y = shiftDate(getToday(), -1); return [y, y]; } },
                  { label: "1주일", getRange: () => [shiftDate(getToday(), -6), getToday()] },
                  { label: "1개월", getRange: () => [shiftDate(getToday(), -29), getToday()] },
                ] as const).map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-[14px]"
                    onClick={() => { const [s, e] = preset.getRange(); setStartDate(s); setEndDate(e); }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-px bg-border" />

            {/* 정산 상태 + 액션 */}
            <div className="flex items-center gap-2 flex-wrap">
              {dataLoading ? (
                <Loader2 size={15} className="animate-spin text-muted-foreground" />
              ) : currentSettlement ? (
                <>
                  <span
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-[14px] font-semibold",
                      SETTLEMENT_STATUS_STYLE[currentSettlement.status]
                    )}
                  >
                    {SETTLEMENT_STATUS_LABEL[currentSettlement.status]}
                  </span>
                  {currentSettlement.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="h-10 px-4 text-[14px]"
                        disabled={isSameDaySettlement}
                        onClick={() => handleStatusChange(currentSettlement.id, "confirmed")}>
                        <CheckCircle2 size={14} className="mr-1.5" /> 확인
                      </Button>
                      <Button size="sm" variant="outline" className="h-10 px-4 text-[14px] text-error hover:text-error"
                        onClick={() => handleStatusChange(currentSettlement.id, "cancelled")}>
                        <X size={14} className="mr-1.5" /> 취소
                      </Button>
                    </>
                  )}
                  {currentSettlement.status === "confirmed" && (
                    <>
                      <Button size="sm" variant="outline" className="h-10 px-4 text-[14px]"
                        disabled={isSameDaySettlement}
                        onClick={() => handleStatusChange(currentSettlement.id, "paid")}>
                        <CreditCard size={14} className="mr-1.5" /> 입금완료
                      </Button>
                      <Button size="sm" variant="outline" className="h-10 px-4 text-[14px] text-error hover:text-error"
                        onClick={() => handleStatusChange(currentSettlement.id, "cancelled")}>
                        <X size={14} className="mr-1.5" /> 취소
                      </Button>
                    </>
                  )}
                  {isSameDaySettlement && (currentSettlement.status === "pending" || currentSettlement.status === "confirmed") && (
                    <p className="w-full text-[11px] text-neutral-600">당일에는 정산이 불가능합니다</p>
                  )}
                </>
              ) : (
                <span className="text-[14px] text-muted-foreground">정산 미생성</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 요약 카드 ──────────────────────────────────────────── */}
      {selectedBusiness && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          <SummaryCard icon={Gift} label="선물 건수" value={`${summary.giftCount}건`} color="text-neutral-600" bgColor="bg-neutral-100" />
          <SummaryCard icon={CreditCard} label="선물 총액" value={`${summary.totalAmount.toLocaleString()}원`} color="text-foreground" bgColor="bg-muted" />
          <SummaryCard icon={Percent} label="수수료율" value={`${selectedBusiness.commission_rate}%`} color="text-info" bgColor="bg-info-bg" />
          <SummaryCard icon={TrendingUp} label="정산 금액" value={`${summary.settlementAmount.toLocaleString()}원`} color="text-primary" bgColor="bg-brand-primary-soft" highlight />
          {/* 입금 계좌: 모바일에서 2열 full-width */}
          <div className="col-span-2 md:col-span-1">
            <SummaryCard icon={Hash} label="입금 계좌" value={selectedBusiness.bank_name} sub={`${selectedBusiness.account_number} (${selectedBusiness.account_holder})`} color="text-muted-foreground" bgColor="bg-muted" />
          </div>
        </div>
      )}

      {/* ── 검색 + 정렬 바 ──────────────────────────────────────── */}
      {giftItems.length > 0 && (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative flex-1 md:max-w-[400px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="상품권명, 구매자, 주문번호..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 pl-9 text-sm md:h-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 gap-1.5 px-3 text-[14px] md:h-9"
            onClick={() => setSortOrder((prev) => prev === "none" ? "desc" : prev === "desc" ? "asc" : "none")}
          >
            <ArrowUpDown size={13} />
            <span className="hidden sm:inline">금액 </span>
            {sortOrder === "desc" ? "↓" : sortOrder === "asc" ? "↑" : <span className="hidden sm:inline">정렬</span>}
          </Button>
          {searchQuery && (
            <span className="hidden shrink-0 text-[14px] text-muted-foreground sm:inline">
              {filteredGiftItems.length}건
            </span>
          )}
        </div>
      )}

      {/* ── 선물 테이블 (데스크탑) / 카드 리스트 (모바일) ────────── */}
      {dataLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : giftItems.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center md:p-16">
          <Gift size={36} className="mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-[14px] text-muted-foreground">
            {selectedBusiness?.name ?? "업체"}의 {startDate} ~ {endDate} 정산 내역이 없습니다
          </p>
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">상품명</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">수량</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">금액</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">정산금액</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">등록일시</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">상품권 상태</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">검증</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGiftItems.map((gift) => (
                    <tr
                      key={gift.gift_id}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-muted/20 cursor-pointer transition-colors",
                        gift.verification_status === "rejected" && "opacity-50"
                      )}
                      onClick={() => { setSelectedGiftItem(gift); setVoucherDetailOpen(true); }}
                    >
                      <td className="px-3 py-2.5 text-center font-medium text-foreground whitespace-nowrap">{gift.product_name}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">{gift.quantity}개</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">{gift.total_amount.toLocaleString()}원</td>
                      <td className="px-3 py-2.5 text-center font-medium text-primary whitespace-nowrap">{gift.settlement_per_item.toLocaleString()}원</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground whitespace-nowrap text-[14px]">{getDateTimeShort(gift.created_at)}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", VOUCHER_STATUS_STYLE[gift.new_voucher_status])}>
                          {VOUCHER_STATUS_LABEL[gift.new_voucher_status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", VERIFICATION_STATUS_STYLE[gift.verification_status])}>
                          {VERIFICATION_STATUS_LABEL[gift.verification_status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-3 py-2.5 text-center text-foreground whitespace-nowrap">합계 ({summary.giftCount}건)</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{summary.totalQuantity}개</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{summary.totalAmount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5 text-center text-primary whitespace-nowrap">{summary.settlementAmount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5" colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="flex flex-col gap-2 md:hidden">
            {/* 합계 배너 */}
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-brand-primary-muted px-4 py-3">
              <span className="text-[14px] font-semibold text-foreground">
                합계 {summary.giftCount}건 · {summary.totalQuantity}개
              </span>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">총액 {summary.totalAmount.toLocaleString()}원</p>
                <p className="text-[14px] font-bold text-primary">정산 {summary.settlementAmount.toLocaleString()}원</p>
              </div>
            </div>

            {/* 카드 목록 */}
            {paginatedGiftItems.map((gift) => (
              <button
                key={gift.gift_id}
                type="button"
                className={cn(
                  "w-full rounded-lg border border-border bg-card p-4 text-left transition-colors active:bg-muted/30",
                  gift.verification_status === "rejected" && "opacity-50"
                )}
                onClick={() => { setSelectedGiftItem(gift); setVoucherDetailOpen(true); }}
              >
                {/* 상단: 상품명 + 상품권 상태 + 검증 배지 */}
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-foreground leading-snug">{gift.product_name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", VOUCHER_STATUS_STYLE[gift.new_voucher_status])}>
                      {VOUCHER_STATUS_LABEL[gift.new_voucher_status]}
                    </span>
                    <span
                      className={cn(
                        "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                        VERIFICATION_STATUS_STYLE[gift.verification_status]
                      )}
                    >
                      {VERIFICATION_STATUS_LABEL[gift.verification_status]}
                    </span>
                  </div>
                </div>

                {/* 금액 정보 */}
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground">수량</p>
                    <p className="text-[14px] font-medium text-foreground">{gift.quantity}개</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">금액</p>
                    <p className="text-[14px] font-medium text-foreground">{gift.total_amount.toLocaleString()}원</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">정산금액</p>
                    <p className="text-[14px] font-bold text-primary">{gift.settlement_per_item.toLocaleString()}원</p>
                  </div>
                </div>

                {/* 하단: 등록일시 */}
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{getDateTimeShort(gift.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── 페이지네이션 ───────────────────────────── */}
      {giftItems.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 표시 개수 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-muted-foreground">표시:</span>
            {([20, 50, 100] as const).map((size) => (
              <Button
                key={size}
                variant={pageSize === size ? "default" : "outline"}
                size="sm"
                className="h-8 px-3 text-[14px]"
                onClick={() => { setPageSize(size); setCurrentPage(1); }}
              >
                {size}개
              </Button>
            ))}
            <span className="text-[14px] text-muted-foreground">
              {filteredGiftItems.length}건 중 {Math.min((currentPage - 1) * pageSize + 1, filteredGiftItems.length)}-{Math.min(currentPage * pageSize, filteredGiftItems.length)}
            </span>
          </div>
          {/* 페이지네이션 */}
          <div className="flex justify-center md:justify-end">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      {/* ── 모달 ─────────────────────────── */}
      <VoucherDetailModal
        open={voucherDetailOpen}
        onClose={() => { setVoucherDetailOpen(false); fetchSettlementData(); }}
        giftItem={selectedGiftItem}
        commissionRate={selectedBusiness?.commission_rate ?? 0}
      />
    </div>
  );
}

// ─── 요약 카드 컴포넌트 ──────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, sub, color, bgColor, highlight,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: string; bgColor: string; highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-3 md:p-4", highlight ? "bg-brand-primary-soft/30 border-primary/20" : "bg-card")}>
      <div className="flex items-center gap-2 mb-1.5 md:mb-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md md:h-7 md:w-7", bgColor)}>
          <Icon size={12} className={cn(color, "md:text-[14px]")} />
        </div>
        <span className="text-[11px] text-muted-foreground md:text-[14px]">{label}</span>
      </div>
      <p className={cn("text-[15px] font-bold md:text-[17px]", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate md:text-[11px]" title={sub}>{sub}</p>}
    </div>
  );
}
