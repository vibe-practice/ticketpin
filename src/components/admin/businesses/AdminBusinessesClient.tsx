"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Building2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  BUSINESS_STATUS_STYLE,
  BUSINESS_STATUS_LABEL,
} from "@/lib/admin-constants";
import type { AdminBusinessListItem, BusinessStatus } from "@/types";
import { BusinessFormModal } from "./BusinessFormModal";
import { BusinessDetailModal } from "./BusinessDetailModal";

// ─── 상태 맵 ──────────────────────────────────────────────────────────────────

const BUSINESS_STATUS_OPTS = [
  { value: "active", label: "활성" },
  { value: "terminated", label: "해지" },
];

// ─── CSV ──────────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminBusinessListItem>[] = [
  { key: "business_name", label: "업체명" },
  { key: "username", label: "회원 아이디" },
  { key: "contact_person", label: "담당자" },
  { key: "contact_phone", label: "연락처" },
  { key: "commission_rate", label: "수수료율(%)" },
  { key: "receiving_account_username", label: "수신계정" },
  { key: "total_gift_count", label: "총 매입건수" },
  { key: "total_gift_amount", label: "총 매입금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "pending_settlement_amount", label: "미정산금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "status", label: "상태", format: (v) => BUSINESS_STATUS_LABEL[v as BusinessStatus] ?? String(v) },
];

// ─── 필터 ─────────────────────────────────────────────────────────────────────

interface FilterState {
  status: string[];
}

const INITIAL_FILTERS: FilterState = {
  status: [],
};

// ─── 행 타입 ──────────────────────────────────────────────────────────────────

type BusinessRow = AdminBusinessListItem & Record<string, unknown>;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function AdminBusinessesClient() {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<AdminBusinessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 서버 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 모달 상태
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<AdminBusinessListItem | null>(null);

  // ─── 데이터 조회 ──────────────────────────────────────────────────────────

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set("search", appliedSearch);
      if (appliedFilters.status.length > 0) params.set("status", appliedFilters.status.join(","));
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await fetch(`/api/admin/businesses?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBusinesses(json.data?.data ?? []);
        setTotal(json.data?.total ?? 0);
      } else {
        toast({ type: "error", title: json.error?.message ?? "업체 목록 조회 실패" });
      }
    } catch {
      toast({ type: "error", title: "업체 목록을 불러오는 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedFilters, page, pageSize, toast]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // ─── 데이터 (서버에서 이미 필터링됨) ──────────────────────────────────

  const tableData = useMemo<BusinessRow[]>(() => {
    return businesses as BusinessRow[];
  }, [businesses]);

  // ─── 필터 핸들러 ────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
    setPage(1);
  }, [filters, search]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }, []);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
    setPage(1);
  }, []);

  // ─── 행 클릭 ────────────────────────────────────────────────────────────

  const handleRowClick = useCallback((row: BusinessRow) => {
    setSelectedBusiness(row as AdminBusinessListItem);
    setDetailModalOpen(true);
  }, []);

  // ─── 필터 칩 ────────────────────────────────────────────────────────────

  const removeFilter = useCallback((key: keyof FilterState) => {
    const defaults: Record<keyof FilterState, FilterState[keyof FilterState]> = {
      status: [],
    };
    setAppliedFilters((prev) => ({ ...prev, [key]: defaults[key] }));
    setFilters((prev) => ({ ...prev, [key]: defaults[key] }));
  }, []);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (appliedFilters.status.length > 0) {
      chips.push({
        key: "status",
        label: "상태",
        value: appliedFilters.status
          .map((s) => BUSINESS_STATUS_LABEL[s as BusinessStatus] ?? s)
          .join(", "),
        onRemove: () => removeFilter("status"),
      });
    }
    return chips;
  }, [appliedFilters, removeFilter]);

  // ─── 테이블 컬럼 ────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "business_name",
        label: "업체명",
        sortable: true,
        align: "center" as const,
        width: "140px",
        render: (v: unknown) => (
          <span className="text-[13px] font-semibold text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "username",
        label: "회원 아이디",
        align: "center" as const,
        width: "110px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">{String(v)}</span>
        ),
      },
      {
        key: "contact_person",
        label: "담당자/연락처",
        align: "center" as const,
        width: "130px",
        render: (_v: unknown, row: BusinessRow) => (
          <div>
            <p className="text-[13px] text-foreground">{row.contact_person}</p>
            <p className="text-[11px] text-muted-foreground">
              {String(row.contact_phone).replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")}
            </p>
          </div>
        ),
      },
      {
        key: "commission_rate",
        label: "수수료율",
        sortable: true,
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span className="text-[13px] font-medium text-foreground">{Number(v)}%</span>
        ),
      },
      {
        key: "receiving_account_username",
        label: "수신 계정",
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className={cn("text-[13px]", v ? "text-foreground" : "text-muted-foreground")}>
            {v ? String(v) : "미지정"}
          </span>
        ),
      },
      {
        key: "total_gift_count",
        label: "총 매입건수",
        sortable: true,
        align: "center" as const,
        width: "90px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{Number(v).toLocaleString()}건</span>
        ),
      },
      {
        key: "total_gift_amount",
        label: "총 매입금액",
        sortable: true,
        align: "center" as const,
        width: "110px",
        render: (v: unknown) => (
          <span className="text-[13px] font-medium text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "pending_settlement_amount",
        label: "미정산 금액",
        sortable: true,
        align: "center" as const,
        width: "110px",
        render: (v: unknown) => (
          <span className={cn(
            "text-[13px] font-semibold",
            Number(v) > 0 ? "text-error" : "text-muted-foreground"
          )}>
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "status",
        label: "상태",
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              BUSINESS_STATUS_STYLE[v as BusinessStatus]
            )}
          >
            {BUSINESS_STATUS_LABEL[v as BusinessStatus]}
          </span>
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
            <Building2 size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">업체 관리</h1>
            <p className="text-[12px] text-muted-foreground">
              업체 등록, 수수료율 관리, 매입/정산 내역을 확인합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminCsvExportButton<AdminBusinessListItem>
            getData={() => tableData as AdminBusinessListItem[]}
            columns={CSV_COLUMNS}
            filename="업체목록"
            label="CSV 내보내기"
            size="sm"
          />
          <Button size="sm" onClick={() => { setSelectedBusiness(null); setFormModalOpen(true); }}>
            <Plus size={14} className="mr-1" />
            업체 등록
          </Button>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <AdminSearchFilterPanel
        searchPlaceholder="업체명, 회원 아이디, 담당자명으로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={total}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        <AdminMultiSelect
          label="상태"
          options={BUSINESS_STATUS_OPTS}
          value={filters.status}
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
          placeholder="전체"
        />
      </AdminSearchFilterPanel>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">업체 목록을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<BusinessRow>
          columns={columns}
          data={tableData}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          emptyMessage="등록된 업체가 없습니다."
          rowKey={(row) => row.id}
          onRowClick={handleRowClick}
          pageSizeOptions={[20, 50, 100]}
        />
      )}

      {/* 업체 등록/수정 모달 */}
      <BusinessFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        business={selectedBusiness}
        onSave={() => {
          setFormModalOpen(false);
          fetchBusinesses();
        }}
      />

      {/* 업체 상세 모달 */}
      <BusinessDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        business={selectedBusiness}
        onDelete={() => {
          setDetailModalOpen(false);
          fetchBusinesses();
        }}
        onEdit={() => {
          setDetailModalOpen(false);
          setFormModalOpen(true);
        }}
      />
    </div>
  );
}
