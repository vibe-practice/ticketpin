"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminDateRangePicker, type DateRange } from "@/components/admin/AdminDateRangePicker";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { FaqFormModal } from "@/components/admin/faq/FaqFormModal";
import { cn, formatDateTime } from "@/lib/utils";
import type { AdminFaqItem, FaqCategory } from "@/types";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

export const FAQ_CATEGORIES: Exclude<FaqCategory, "전체">[] = [
  "구매",
  "교환권",
  "선물",
  "환불",
  "계정",
];

const CATEGORY_STYLE: Record<Exclude<FaqCategory, "전체">, string> = {
  구매: "bg-info-bg text-info",
  교환권: "bg-brand-primary-soft text-primary",
  선물: "bg-success-bg text-success",
  환불: "bg-error-bg text-error",
  계정: "bg-muted text-muted-foreground",
};

// ─── CSV 컬럼 ────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminFaqItem>[] = [
  { key: "id", label: "ID" },
  { key: "category", label: "카테고리" },
  { key: "question", label: "질문" },
  { key: "answer", label: "답변" },
  { key: "sort_order", label: "정렬순서" },
  {
    key: "is_visible",
    label: "노출여부",
    format: (v) => (v ? "노출" : "숨김"),
  },
  {
    key: "created_at",
    label: "등록일",
    format: (v) => formatDateTime(String(v)),
  },
];

// ─── 필터 상태 ────────────────────────────────────────────────────────────────

interface FilterState {
  categories: string[];
  visibility: string; // "all" | "visible" | "hidden"
  dateRange: DateRange;
}

const INITIAL_FILTERS: FilterState = {
  categories: [],
  visibility: "all",
  dateRange: { from: null, to: null },
};

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type FaqRow = AdminFaqItem & Record<string, unknown>;

// ─── 폼 저장 데이터 타입 ─────────────────────────────────────────────────────

interface SaveFaqData {
  category: Exclude<FaqCategory, "전체">;
  question: string;
  answer: string;
  sort_order: number;
  is_visible: boolean;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminFaqClient() {
  // 데이터 상태
  const [faqs, setFaqs] = useState<AdminFaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 검색/필터
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminFaqItem | null>(null);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AdminFaqItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 토스트
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ─── 데이터 로딩 ─────────────────────────────────────────────────────────

  const fetchFaqs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/faqs");
      const json = await res.json();
      if (json.success) {
        setFaqs(json.data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  // ─── 토스트 ───────────────────────────────────────────────────────────────

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ─── 필터 적용 ───────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
  }, [filters, search]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
  }, []);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
  }, []);

  // ─── 데이터 필터링 ────────────────────────────────────────────────────────

  const filteredFaqs = useMemo<FaqRow[]>(() => {
    return (faqs as FaqRow[]).filter((faq) => {
      if (appliedSearch) {
        const q = appliedSearch.toLowerCase();
        const matched =
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q) ||
          faq.id.toLowerCase().includes(q);
        if (!matched) return false;
      }

      if (appliedFilters.categories.length > 0 && !appliedFilters.categories.includes(faq.category as string)) {
        return false;
      }

      if (appliedFilters.visibility !== "all") {
        const isVisible = faq.is_visible as boolean;
        if (appliedFilters.visibility === "visible" && !isVisible) return false;
        if (appliedFilters.visibility === "hidden" && isVisible) return false;
      }

      if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
        const d = (faq.created_at as string).split("T")[0];
        if (appliedFilters.dateRange.from && d < appliedFilters.dateRange.from) return false;
        if (appliedFilters.dateRange.to && d > appliedFilters.dateRange.to) return false;
      }

      return true;
    });
  }, [faqs, appliedSearch, appliedFilters]);

  // ─── 활성 필터 칩 ─────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.categories.length > 0) {
      chips.push({
        key: "category",
        label: "카테고리",
        value: appliedFilters.categories.join(", "),
        onRemove: () => setAppliedFilters((prev) => ({ ...prev, categories: [] })),
      });
    }

    if (appliedFilters.visibility !== "all") {
      chips.push({
        key: "visibility",
        label: "노출여부",
        value: appliedFilters.visibility === "visible" ? "노출" : "숨김",
        onRemove: () => setAppliedFilters((prev) => ({ ...prev, visibility: "all" })),
      });
    }

    if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
      const from = appliedFilters.dateRange.from ?? "";
      const to = appliedFilters.dateRange.to ?? "";
      chips.push({
        key: "date",
        label: "등록일",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () => setAppliedFilters((prev) => ({ ...prev, dateRange: { from: null, to: null } })),
      });
    }

    return chips;
  }, [appliedFilters]);

  // ─── 카테고리 멀티셀렉 옵션 ─────────────────────────────────────────────

  const categoryOpts = FAQ_CATEGORIES.map((c) => ({ value: c, label: c }));

  // ─── 테이블 컬럼 ─────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "sort_order",
        label: "순서",
        sortable: true,
        align: "center" as const,
        width: "60px",
        render: (v: unknown) => (
          <span className="font-mono text-[14px] text-muted-foreground">
            {String(v).padStart(2, "0")}
          </span>
        ),
      },
      {
        key: "category",
        label: "카테고리",
        align: "center" as const,
        width: "90px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              CATEGORY_STYLE[v as Exclude<FaqCategory, "전체">]
            )}
          >
            {String(v)}
          </span>
        ),
      },
      {
        key: "question",
        label: "질문",
        sortable: true,
        align: "left" as const,
        render: (v: unknown, row: FaqRow) => (
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-foreground max-w-[360px]" title={String(v)}>
              {String(v)}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground max-w-[360px]">
              {String(row.answer)}
            </p>
          </div>
        ),
      },
      {
        key: "is_visible",
        label: "노출",
        align: "center" as const,
        width: "80px",
        render: (v: unknown, row: FaqRow) => (
          <div className="flex items-center justify-center gap-1.5">
            <Switch
              checked={v as boolean}
              onCheckedChange={() => handleToggleVisible(row as AdminFaqItem)}
              aria-label={v ? "노출 중" : "숨김"}
              onClick={(e) => e.stopPropagation()}
            />
            {v ? (
              <Eye size={12} className="text-success" />
            ) : (
              <EyeOff size={12} className="text-muted-foreground" />
            )}
          </div>
        ),
      },
      {
        key: "created_at",
        label: "등록일",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-muted-foreground">
            {String(v).split("T")[0]}
          </span>
        ),
      },
      {
        key: "_actions",
        label: "액션",
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: FaqRow) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditTarget(row as AdminFaqItem);
                setFormOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-brand-primary-soft hover:text-primary transition-colors"
              aria-label="수정"
              title="수정"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row as AdminFaqItem);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
              aria-label="삭제"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ─── 노출 여부 토글 ──────────────────────────────────────────────────────

  const handleToggleVisible = useCallback(async (faq: AdminFaqItem) => {
    const newVisible = !faq.is_visible;
    // 낙관적 업데이트
    setFaqs((prev) =>
      prev.map((f) =>
        f.id === faq.id ? { ...f, is_visible: newVisible } : f
      )
    );
    try {
      const res = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: newVisible }),
      });
      const json = await res.json();
      if (!json.success) {
        // 롤백
        setFaqs((prev) =>
          prev.map((f) =>
            f.id === faq.id ? { ...f, is_visible: faq.is_visible } : f
          )
        );
        showToast("error", json.error?.message ?? "노출 상태 변경에 실패했습니다.");
      }
    } catch {
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === faq.id ? { ...f, is_visible: faq.is_visible } : f
        )
      );
      showToast("error", "노출 상태 변경에 실패했습니다.");
    }
  }, [showToast]);

  // ─── FAQ 저장 ────────────────────────────────────────────────────────────

  const handleSaveFaq = useCallback(
    async (data: SaveFaqData) => {
      try {
        if (editTarget) {
          const res = await fetch(`/api/admin/faqs/${editTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (json.success) {
            setFaqs((prev) =>
              prev.map((f) => (f.id === editTarget.id ? json.data : f))
            );
            showToast("success", "FAQ가 수정되었습니다.");
          } else {
            showToast("error", json.error?.message ?? "FAQ 수정에 실패했습니다.");
          }
        } else {
          const res = await fetch("/api/admin/faqs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (json.success) {
            setFaqs((prev) => [json.data, ...prev]);
            showToast("success", "FAQ가 등록되었습니다.");
          } else {
            showToast("error", json.error?.message ?? "FAQ 등록에 실패했습니다.");
          }
        }
      } catch {
        showToast("error", "FAQ 저장 중 오류가 발생했습니다.");
      }
      setEditTarget(null);
    },
    [editTarget, showToast]
  );

  // ─── FAQ 삭제 ────────────────────────────────────────────────────────────

  const handleDeleteFaq = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/faqs/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id));
        showToast("success", "FAQ가 삭제되었습니다.");
      } else {
        showToast("error", json.error?.message ?? "FAQ 삭제에 실패했습니다.");
      }
    } catch {
      showToast("error", "FAQ 삭제 중 오류가 발생했습니다.");
    }
    setDeleteTarget(null);
    setIsDeleting(false);
  }, [deleteTarget, isDeleting, showToast]);

  // ─── 최대 정렬 순서 ─────────────────────────────────────────────────────

  const maxSortOrder = useMemo(
    () => Math.max(0, ...faqs.map((f) => f.sort_order)) + 1,
    [faqs]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">FAQ 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 인라인 토스트 */}
      {toastMsg && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg text-[14px] font-medium transition-all",
            toastMsg.type === "success"
              ? "border-success/30 bg-success-bg text-success"
              : "border-error/30 bg-error-bg text-error"
          )}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          {toastMsg.text}
        </div>
      )}

      {/* ── 페이지 헤더 ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <HelpCircle size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">FAQ 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              자주 묻는 질문을 등록, 수정, 삭제합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminCsvExportButton<AdminFaqItem>
            getData={() => filteredFaqs as AdminFaqItem[]}
            columns={CSV_COLUMNS}
            filename="FAQ목록"
            label="CSV 내보내기"
            size="sm"
          />
          <Button
            size="sm"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[14px]"
          >
            <Plus size={15} />
            FAQ 등록
          </Button>
        </div>
      </div>

      {/* ── 검색 + 필터 패널 ──────────────────────────────────────── */}
      <AdminSearchFilterPanel
        searchPlaceholder="질문, 답변 내용으로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={filteredFaqs.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 카테고리 */}
        <AdminMultiSelect
          label="카테고리"
          options={categoryOpts}
          value={filters.categories}
          onChange={(v) => setFilters((prev) => ({ ...prev, categories: v }))}
          placeholder="전체"
        />

        {/* 필터 2: 노출 여부 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">노출 여부</label>
          <Select
            value={filters.visibility}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, visibility: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="visible">노출</SelectItem>
              <SelectItem value="hidden">숨김</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 3: 등록일 */}
        <AdminDateRangePicker
          label="등록일"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />
      </AdminSearchFilterPanel>

      {/* ── 데이터 테이블 ─────────────────────────────────────────── */}
      <AdminDataTable<FaqRow>
        columns={columns}
        data={filteredFaqs}
        emptyMessage="조건에 맞는 FAQ가 없습니다."
        rowKey={(row) => row.id}
        onRowClick={(row) => {
          setEditTarget(row as AdminFaqItem);
          setFormOpen(true);
        }}
        pageSizeOptions={[10, 20, 50]}
      />

      {/* ── FAQ 등록/수정 모달 ──────────────────────────────────── */}
      <FaqFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        faq={editTarget}
        maxSortOrder={maxSortOrder}
        onSave={handleSaveFaq}
      />

      {/* ── FAQ 삭제 확인 다이얼로그 ────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>FAQ 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              해당 FAQ를 삭제하시겠습니까?
              <br />
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.question}&rdquo;</span>
              <br />
              삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteFaq} disabled={isDeleting}>
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
