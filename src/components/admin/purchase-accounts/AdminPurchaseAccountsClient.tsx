"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Wallet, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  PURCHASE_ACCOUNT_STATUS_STYLE,
  PURCHASE_ACCOUNT_STATUS_LABEL,
} from "@/lib/admin-constants";
import type { AdminPurchaseAccountListItem, PurchaseAccountStatus } from "@/types";
import { PurchaseAccountFormModal } from "./PurchaseAccountFormModal";

// ─── 상태 옵션 ────────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: "active", label: "활성" },
  { value: "suspended", label: "중지" },
];

// ─── CSV ──────────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminPurchaseAccountListItem>[] = [
  { key: "account_name", label: "아이디명" },
  { key: "username", label: "로그인 아이디" },
  { key: "notification_phone", label: "알림 연락처", format: (v) => v ? String(v) : "" },
  { key: "status", label: "상태", format: (v) => PURCHASE_ACCOUNT_STATUS_LABEL[v as PurchaseAccountStatus] ?? String(v) },
  { key: "total_gift_count", label: "총 매입건수" },
  { key: "total_gift_amount", label: "총 매입금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "created_at", label: "등록일", format: (v) => new Date(String(v)).toLocaleDateString("ko-KR") },
];

// ─── 필터 ─────────────────────────────────────────────────────────────────────

interface FilterState {
  status: string[];
}

const INITIAL_FILTERS: FilterState = { status: [] };

type AccountRow = AdminPurchaseAccountListItem & Record<string, unknown>;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function AdminPurchaseAccountsClient() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdminPurchaseAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AdminPurchaseAccountListItem | null>(null);

  // ─── 데이터 조회 ──────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set("search", appliedSearch);
      if (appliedFilters.status.length > 0) params.set("status", appliedFilters.status.join(","));
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await fetch(`/api/admin/purchase-accounts?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data?.data ?? []);
        setTotal(json.data?.total ?? 0);
      } else {
        toast({ type: "error", title: json.error?.message ?? "매입 아이디 목록 조회 실패" });
      }
    } catch {
      toast({ type: "error", title: "매입 아이디 목록을 불러오는 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedFilters, page, pageSize, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const tableData = useMemo<AccountRow[]>(() => accounts as AccountRow[], [accounts]);

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

  // ─── 행 클릭 → 수정 모달 ──────────────────────────────────────────────

  const handleRowClick = useCallback((row: AccountRow) => {
    setSelectedAccount(row as AdminPurchaseAccountListItem);
    setFormModalOpen(true);
  }, []);

  // ─── 필터 칩 ────────────────────────────────────────────────────────────

  const removeFilter = useCallback((key: keyof FilterState) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: [] }));
    setFilters((prev) => ({ ...prev, [key]: [] }));
  }, []);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (appliedFilters.status.length > 0) {
      chips.push({
        key: "status",
        label: "상태",
        value: appliedFilters.status
          .map((s) => PURCHASE_ACCOUNT_STATUS_LABEL[s as PurchaseAccountStatus] ?? s)
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
        key: "account_name",
        label: "아이디명",
        sortable: true,
        align: "center" as const,
        width: "140px",
        render: (v: unknown) => (
          <span className="text-[13px] font-semibold text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "username",
        label: "로그인 아이디",
        align: "center" as const,
        width: "120px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">{String(v)}</span>
        ),
      },
      {
        key: "notification_phone",
        label: "알림 연락처",
        align: "center" as const,
        width: "120px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">
            {v ? String(v).replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3") : "-"}
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
              PURCHASE_ACCOUNT_STATUS_STYLE[v as PurchaseAccountStatus],
            )}
          >
            {PURCHASE_ACCOUNT_STATUS_LABEL[v as PurchaseAccountStatus]}
          </span>
        ),
      },
      {
        key: "total_gift_count",
        label: "총 매입건수",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{Number(v).toLocaleString()}건</span>
        ),
      },
      {
        key: "total_gift_amount",
        label: "총 매입금액",
        sortable: true,
        align: "center" as const,
        width: "120px",
        render: (v: unknown) => (
          <span className="text-[13px] font-medium text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "memo",
        label: "메모",
        align: "center" as const,
        width: "150px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground truncate max-w-[150px] block">
            {v ? String(v) : "-"}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "등록일",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">
            {new Date(String(v)).toLocaleDateString("ko-KR")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <Wallet size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">매입 아이디 관리</h1>
            <p className="text-[12px] text-muted-foreground">
              상품권 매입용 아이디를 등록하고 관리합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminCsvExportButton<AdminPurchaseAccountListItem>
            getData={() => tableData as AdminPurchaseAccountListItem[]}
            columns={CSV_COLUMNS}
            filename="매입아이디목록"
            label="CSV 내보내기"
            size="sm"
          />
          <Button
            size="sm"
            onClick={() => {
              setSelectedAccount(null);
              setFormModalOpen(true);
            }}
          >
            <Plus size={14} className="mr-1" />
            아이디 등록
          </Button>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <AdminSearchFilterPanel
        searchPlaceholder="아이디명으로 검색"
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
          options={STATUS_OPTS}
          value={filters.status}
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
          placeholder="전체"
        />
      </AdminSearchFilterPanel>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">매입 아이디 목록을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<AccountRow>
          columns={columns}
          data={tableData}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          emptyMessage="등록된 매입 아이디가 없습니다."
          rowKey={(row) => row.id}
          onRowClick={handleRowClick}
          pageSizeOptions={[20, 50, 100]}
        />
      )}

      {/* 등록/수정 모달 */}
      <PurchaseAccountFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        account={selectedAccount}
        onSave={() => {
          setFormModalOpen(false);
          fetchAccounts();
        }}
      />
    </div>
  );
}
