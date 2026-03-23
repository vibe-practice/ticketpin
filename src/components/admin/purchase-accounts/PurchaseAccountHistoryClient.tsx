"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { ClipboardList, Loader2, Search } from "lucide-react";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import type { PurchaseAccountGiftItem, AdminOrderListItem } from "@/types";

// ─── 확장 타입 ──────────────────────────────────────────────────────────────────

interface HistoryItem extends PurchaseAccountGiftItem {
  order_id: string | null;
  order_status: string | null;
  voucher_status: string | null;
  account_name: string;
  account_username: string;
}

// ─── 상태 라벨/스타일 ──────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: "결제완료",
  password_set: "비번설정",
  pin_revealed: "핀확인",
  gifted: "선물",
  cancelled: "취소",
};

const ORDER_STATUS_STYLE: Record<string, string> = {
  paid: "bg-info-bg text-info",
  password_set: "bg-brand-primary-muted text-primary",
  pin_revealed: "bg-success-bg text-success",
  gifted: "bg-amber-50 text-amber-600",
  cancelled: "bg-error-bg text-error",
};

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  issued: "발급",
  temp_verified: "임시인증",
  password_set: "비번설정",
  pin_revealed: "핀확인",
  gifted: "선물",
  cancelled: "취소",
};

const VOUCHER_STATUS_STYLE: Record<string, string> = {
  issued: "bg-muted text-muted-foreground",
  temp_verified: "bg-info-bg text-info",
  password_set: "bg-brand-primary-muted text-primary",
  pin_revealed: "bg-success-bg text-success",
  gifted: "bg-amber-50 text-amber-600",
  cancelled: "bg-error-bg text-error",
};

// ─── 날짜 프리셋 ────────────────────────────────────────────────────────────────

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const today = fmt(kstNow);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(kstNow);
      y.setDate(y.getDate() - 1);
      const yd = fmt(y);
      return { from: yd, to: yd };
    }
    case "week": {
      const w = new Date(kstNow);
      w.setDate(w.getDate() - 6);
      return { from: fmt(w), to: today };
    }
    case "month": {
      const m = new Date(kstNow);
      m.setDate(m.getDate() - 29);
      return { from: fmt(m), to: today };
    }
    case "custom":
      return { from: "", to: "" };
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<HistoryItem>[] = [
  { key: "created_at", label: "일시", format: (v) => new Date(String(v)).toLocaleString("ko-KR") },
  { key: "order_status", label: "주문상태", format: (v) => ORDER_STATUS_LABEL[String(v)] ?? String(v) },
  { key: "voucher_status", label: "바우처상태", format: (v) => VOUCHER_STATUS_LABEL[String(v)] ?? String(v) },
  { key: "sender_username", label: "보낸 아이디" },
  { key: "sender_name", label: "이름" },
  { key: "sender_phone", label: "연락처" },
  { key: "product_name", label: "상품명" },
  { key: "quantity", label: "수량" },
  { key: "total_amount", label: "결제금액", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "fee_type", label: "수수료", format: (v) => v === "included" ? "포함" : "별도" },
  { key: "card_company_name", label: "카드사", format: (v) => v ? String(v) : "-" },
  { key: "installment_months", label: "할부", format: (v) => v && Number(v) > 0 ? `${v}개월` : "일시불" },
  { key: "pin_recycled", label: "핀 복원", format: (v) => v ? "완료" : "미완료" },
];

type HistoryRow = HistoryItem & Record<string, unknown>;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

interface AccountOption {
  id: string;
  account_name: string;
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "yesterday", label: "어제" },
  { value: "week", label: "1주일" },
  { value: "month", label: "최근 30일" },
  { value: "custom", label: "기간별" },
];

export function PurchaseAccountHistoryClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 필터
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateFrom, setDateFrom] = useState(() => getDateRange("today").from);
  const [dateTo, setDateTo] = useState(() => getDateRange("today").to);
  // 적용된 날짜 (custom 모드에서 "조회" 클릭 시에만 적용)
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => getDateRange("today").from);
  const [appliedDateTo, setAppliedDateTo] = useState(() => getDateRange("today").to);

  // 검색
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // 주문 상세 모달
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderListItem | null>(null);

  // 매입 아이디 옵션 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/purchase-accounts?page_size=100");
        const json = await res.json();
        if (json.success) {
          setAccountOptions(
            (json.data?.data ?? []).map((a: { id: string; account_name: string }) => ({
              id: a.id,
              account_name: a.account_name,
            })),
          );
        }
      } catch {
        // 무시
      }
    })();
  }, []);

  // ─── 데이터 조회 ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") params.set("account_id", selectedAccountId);
      if (appliedDateFrom) params.set("date_from", appliedDateFrom);
      if (appliedDateTo) params.set("date_to", appliedDateTo);
      if (appliedSearch) params.set("search", appliedSearch);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await fetch(`/api/admin/purchase-accounts/gifts?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data?.data ?? []);
        setTotal(json.data?.total ?? 0);
      } else {
        toast({ type: "error", title: json.error?.message ?? "매입 내역 조회 실패" });
      }
    } catch {
      toast({ type: "error", title: "매입 내역을 불러오는 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, appliedDateFrom, appliedDateTo, appliedSearch, page, pageSize, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const tableData = useMemo<HistoryRow[]>(() => items as HistoryRow[], [items]);

  // ─── 날짜 프리셋 핸들러 ─────────────────────────────────────────────────

  const handlePresetClick = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const range = getDateRange(preset);
      setDateFrom(range.from);
      setDateTo(range.to);
      setAppliedDateFrom(range.from);
      setAppliedDateTo(range.to);
      setPage(1);
    }
  }, []);

  // ─── "기간별" 조회 버튼 핸들러 ─────────────────────────────────────────

  const handleCustomDateApply = useCallback(() => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
  }, [dateFrom, dateTo]);

  // ─── 검색 핸들러 ────────────────────────────────────────────────────────

  const handleSearchSubmit = useCallback(() => {
    setAppliedSearch(search);
    setPage(1);
  }, [search]);

  // ─── 초기화 ──────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setSelectedAccountId("all");
    setDatePreset("today");
    const range = getDateRange("today");
    setDateFrom(range.from);
    setDateTo(range.to);
    setAppliedDateFrom(range.from);
    setAppliedDateTo(range.to);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }, []);

  // ─── 행 클릭 → 주문 상세 모달 ─────────────────────────────────────────

  const handleRowClick = useCallback(async (row: HistoryRow) => {
    const orderId = row.order_id;
    if (!orderId) {
      toast({ type: "error", title: "주문 정보를 찾을 수 없습니다." });
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedOrder(json.data);
      } else {
        toast({ type: "error", title: json.error?.message ?? "주문 상세 조회 실패" });
      }
    } catch {
      toast({ type: "error", title: "주문 상세를 불러오는 중 오류가 발생했습니다." });
    }
  }, [toast]);

  // ─── 테이블 컬럼 ────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        label: "일시",
        sortable: true,
        align: "center" as const,
        width: "140px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">
            {new Date(String(v)).toLocaleString("ko-KR")}
          </span>
        ),
      },
      {
        key: "order_status",
        label: "주문상태",
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => {
          const s = String(v);
          return (
            <span
              className={cn(
                "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                ORDER_STATUS_STYLE[s] ?? "bg-muted text-muted-foreground",
              )}
            >
              {ORDER_STATUS_LABEL[s] ?? s}
            </span>
          );
        },
      },
      {
        key: "voucher_status",
        label: "바우처",
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => {
          const s = String(v);
          return (
            <span
              className={cn(
                "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                VOUCHER_STATUS_STYLE[s] ?? "bg-muted text-muted-foreground",
              )}
            >
              {VOUCHER_STATUS_LABEL[s] ?? s}
            </span>
          );
        },
      },
      {
        key: "sender_username",
        label: "보낸 아이디",
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "sender_name",
        label: "이름",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "sender_phone",
        label: "연락처",
        align: "center" as const,
        width: "110px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">
            {String(v).replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")}
          </span>
        ),
      },
      {
        key: "product_name",
        label: "상품명",
        align: "center" as const,
        width: "140px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{String(v)}</span>
        ),
      },
      {
        key: "quantity",
        label: "수량",
        align: "center" as const,
        width: "50px",
        render: (v: unknown) => (
          <span className="text-[13px] text-foreground">{Number(v)}</span>
        ),
      },
      {
        key: "total_amount",
        label: "결제금액",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="text-[13px] font-medium text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "fee_type",
        label: "수수료",
        align: "center" as const,
        width: "60px",
        render: (v: unknown) => (
          <span className={cn(
            "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
            v === "included" ? "bg-info-bg text-info" : "bg-amber-50 text-amber-600",
          )}>
            {v === "included" ? "포함" : "별도"}
          </span>
        ),
      },
      {
        key: "card_company_name",
        label: "카드사",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">{v ? String(v) : "-"}</span>
        ),
      },
      {
        key: "installment_months",
        label: "할부",
        align: "center" as const,
        width: "60px",
        render: (v: unknown) => (
          <span className="text-[13px] text-muted-foreground">
            {v && Number(v) > 0 ? `${v}개월` : "일시불"}
          </span>
        ),
      },
      {
        key: "pin_recycled",
        label: "핀 복원",
        align: "center" as const,
        width: "65px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
              v ? "bg-success-bg text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {v ? "완료" : "미완료"}
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
            <ClipboardList size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">매입 내역</h1>
            <p className="text-[12px] text-muted-foreground">
              매입 아이디로 수신된 선물 내역을 확인합니다
            </p>
          </div>
        </div>

        <AdminCsvExportButton<HistoryItem>
          getData={() => tableData as HistoryItem[]}
          columns={CSV_COLUMNS}
          filename="매입내역"
          label="CSV 내보내기"
          size="sm"
        />
      </div>

      {/* 필터 영역 */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        {/* 1행: 매입 아이디 + 날짜 프리셋 */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">매입 아이디</Label>
            <Select value={selectedAccountId} onValueChange={(v) => { setSelectedAccountId(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px] text-sm">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {accountOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">기간</Label>
            <div className="flex gap-1">
              {DATE_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={datePreset === p.value ? "default" : "outline"}
                  className="h-9 px-3 text-[13px]"
                  onClick={() => handlePresetClick(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 2행: 기간별 선택 시 날짜 입력 + 검색 */}
        <div className="flex flex-wrap items-end gap-4">
          {datePreset === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">시작일</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-[160px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">종료일</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-[160px] text-sm"
                />
              </div>
              <Button size="sm" className="h-9" onClick={handleCustomDateApply}>
                조회
              </Button>
            </>
          )}

          <div className="flex-1" />

          {/* 검색 */}
          <div className="flex gap-2">
            <Input
              placeholder="보낸 아이디, 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
              className="h-9 w-[220px] text-sm"
            />
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={handleSearchSubmit}>
              <Search size={14} />
            </Button>
          </div>

          <Button size="sm" variant="outline" className="h-9" onClick={handleReset}>
            초기화
          </Button>
        </div>
      </div>

      {/* 결과 건수 */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          총 <span className="font-semibold text-foreground">{total.toLocaleString()}</span>건
          {appliedSearch && (
            <span className="ml-2 text-primary">
              &quot;{appliedSearch}&quot; 검색 결과
            </span>
          )}
        </p>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">매입 내역을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<HistoryRow>
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
          emptyMessage="매입 내역이 없습니다."
          rowKey={(row) => row.gift_id}
          onRowClick={handleRowClick}
          pageSizeOptions={[20, 50, 100]}
        />
      )}

      {/* 주문 상세 모달 (주문관리와 동일) */}
      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
