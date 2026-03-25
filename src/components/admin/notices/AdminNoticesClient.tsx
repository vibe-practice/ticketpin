"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Pin,
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
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { NoticeFormModal } from "@/components/admin/notices/NoticeFormModal";
import { cn, formatDateTime } from "@/lib/utils";
import type { AdminNotice, NoticeCategory } from "@/types";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<Exclude<NoticeCategory, "전체">, string> = {
  일반: "bg-info-bg text-info",
  이벤트: "bg-brand-primary-soft text-primary",
  점검: "bg-warning-bg text-warning",
};

// ─── CSV 컬럼 ────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminNotice>[] = [
  { key: "id", label: "ID" },
  { key: "title", label: "제목" },
  { key: "category", label: "카테고리" },
  {
    key: "is_important",
    label: "중요공지",
    format: (v) => (v ? "Y" : "N"),
  },
  {
    key: "is_visible",
    label: "노출여부",
    format: (v) => (v ? "노출" : "숨김"),
  },
  { key: "view_count", label: "조회수" },
  { key: "created_by_name", label: "작성자" },
  {
    key: "created_at",
    label: "등록일",
    format: (v) => formatDateTime(String(v)),
  },
];

// ─── 필터 상태 ────────────────────────────────────────────────────────────────

interface FilterState {
  category: string;     // "all" | "일반" | "이벤트" | "점검"
  importance: string;   // "all" | "important" | "normal"
  visibility: string;   // "all" | "visible" | "hidden"
  dateRange: DateRange;
}

const INITIAL_FILTERS: FilterState = {
  category: "all",
  importance: "all",
  visibility: "all",
  dateRange: { from: null, to: null },
};

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type NoticeRow = AdminNotice & Record<string, unknown>;

// ─── 폼 저장 데이터 타입 ─────────────────────────────────────────────────────

interface SaveNoticeData {
  title: string;
  content: string;
  category: Exclude<NoticeCategory, "전체">;
  is_important: boolean;
  is_visible: boolean;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminNoticesClient() {
  // 데이터 상태
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 검색/필터
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminNotice | null>(null);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 토스트
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ─── 데이터 로딩 ─────────────────────────────────────────────────────────

  const fetchNotices = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/notices");
      const json = await res.json();
      if (json.success) {
        setNotices(json.data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

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

  const filteredNotices = useMemo<NoticeRow[]>(() => {
    return (notices as NoticeRow[]).filter((notice) => {
      if (appliedSearch) {
        const q = appliedSearch.toLowerCase();
        const matched =
          notice.title.toLowerCase().includes(q) ||
          notice.content.toLowerCase().includes(q) ||
          notice.id.toLowerCase().includes(q);
        if (!matched) return false;
      }

      if (appliedFilters.category !== "all" && notice.category !== appliedFilters.category) {
        return false;
      }

      if (appliedFilters.importance !== "all") {
        const isImportant = notice.is_important as boolean;
        if (appliedFilters.importance === "important" && !isImportant) return false;
        if (appliedFilters.importance === "normal" && isImportant) return false;
      }

      if (appliedFilters.visibility !== "all") {
        const isVisible = notice.is_visible as boolean;
        if (appliedFilters.visibility === "visible" && !isVisible) return false;
        if (appliedFilters.visibility === "hidden" && isVisible) return false;
      }

      if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
        const d = (notice.created_at as string).split("T")[0];
        if (appliedFilters.dateRange.from && d < appliedFilters.dateRange.from) return false;
        if (appliedFilters.dateRange.to && d > appliedFilters.dateRange.to) return false;
      }

      return true;
    });
  }, [notices, appliedSearch, appliedFilters]);

  // ─── 활성 필터 칩 ─────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.category !== "all") {
      chips.push({
        key: "category",
        label: "카테고리",
        value: appliedFilters.category,
        onRemove: () => setAppliedFilters((prev) => ({ ...prev, category: "all" })),
      });
    }

    if (appliedFilters.importance !== "all") {
      chips.push({
        key: "importance",
        label: "중요공지",
        value: appliedFilters.importance === "important" ? "중요" : "일반",
        onRemove: () => setAppliedFilters((prev) => ({ ...prev, importance: "all" })),
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

  // ─── 테이블 컬럼 ─────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "category",
        label: "카테고리",
        align: "center" as const,
        width: "90px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              CATEGORY_STYLE[v as Exclude<NoticeCategory, "전체">]
            )}
          >
            {String(v)}
          </span>
        ),
      },
      {
        key: "title",
        label: "제목",
        sortable: true,
        align: "left" as const,
        render: (v: unknown, row: NoticeRow) => (
          <div className="flex items-start gap-1.5 min-w-0">
            {row.is_important && (
              <Pin size={12} className="mt-0.5 shrink-0 text-warning" aria-label="중요 공지" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-foreground max-w-[400px]" title={String(v)}>
                {String(v)}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground max-w-[400px]">
                {String(row.content).replace(/<[^>]*>/g, "").replace(/\n/g, " ")}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "is_important",
        label: "중요",
        align: "center" as const,
        width: "70px",
        render: (v: unknown, row: NoticeRow) => (
          <div className="flex items-center justify-center">
            <Switch
              checked={v as boolean}
              onCheckedChange={() => handleToggleImportant(row as AdminNotice)}
              aria-label={v ? "중요 공지" : "일반 공지"}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ),
      },
      {
        key: "is_visible",
        label: "노출",
        align: "center" as const,
        width: "80px",
        render: (v: unknown, row: NoticeRow) => (
          <div className="flex items-center justify-center gap-1.5">
            <Switch
              checked={v as boolean}
              onCheckedChange={() => handleToggleVisible(row as AdminNotice)}
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
        key: "view_count",
        label: "조회수",
        sortable: true,
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => (
          <span className="text-[14px] text-muted-foreground">
            {Number(v).toLocaleString()}
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
          <span className="whitespace-nowrap text-[14px] text-muted-foreground">
            {String(v).split("T")[0]}
          </span>
        ),
      },
      {
        key: "created_by_name",
        label: "작성자",
        align: "center" as const,
        width: "80px",
        render: (v: unknown) => (
          <span className="text-[14px] text-muted-foreground">{String(v)}</span>
        ),
      },
      {
        key: "_actions",
        label: "액션",
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: NoticeRow) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditTarget(row as AdminNotice);
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
                setDeleteTarget(row as AdminNotice);
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

  // ─── 토글 핸들러 ─────────────────────────────────────────────────────────

  const handleToggleImportant = useCallback(async (notice: AdminNotice) => {
    const newImportant = !notice.is_important;
    setNotices((prev) =>
      prev.map((n) =>
        n.id === notice.id ? { ...n, is_important: newImportant } : n
      )
    );
    try {
      const res = await fetch(`/api/admin/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_important: newImportant }),
      });
      const json = await res.json();
      if (!json.success) {
        setNotices((prev) =>
          prev.map((n) =>
            n.id === notice.id ? { ...n, is_important: notice.is_important } : n
          )
        );
        showToast("error", json.error?.message ?? "중요 상태 변경에 실패했습니다.");
      }
    } catch {
      setNotices((prev) =>
        prev.map((n) =>
          n.id === notice.id ? { ...n, is_important: notice.is_important } : n
        )
      );
      showToast("error", "중요 상태 변경에 실패했습니다.");
    }
  }, [showToast]);

  const handleToggleVisible = useCallback(async (notice: AdminNotice) => {
    const newVisible = !notice.is_visible;
    setNotices((prev) =>
      prev.map((n) =>
        n.id === notice.id ? { ...n, is_visible: newVisible } : n
      )
    );
    try {
      const res = await fetch(`/api/admin/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: newVisible }),
      });
      const json = await res.json();
      if (!json.success) {
        setNotices((prev) =>
          prev.map((n) =>
            n.id === notice.id ? { ...n, is_visible: notice.is_visible } : n
          )
        );
        showToast("error", json.error?.message ?? "노출 상태 변경에 실패했습니다.");
      }
    } catch {
      setNotices((prev) =>
        prev.map((n) =>
          n.id === notice.id ? { ...n, is_visible: notice.is_visible } : n
        )
      );
      showToast("error", "노출 상태 변경에 실패했습니다.");
    }
  }, [showToast]);

  // ─── 공지 저장 ────────────────────────────────────────────────────────────

  const handleSaveNotice = useCallback(
    async (data: SaveNoticeData) => {
      try {
        if (editTarget) {
          const res = await fetch(`/api/admin/notices/${editTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (json.success) {
            setNotices((prev) =>
              prev.map((n) => (n.id === editTarget.id ? json.data : n))
            );
            showToast("success", "공지사항이 수정되었습니다.");
          } else {
            showToast("error", json.error?.message ?? "공지사항 수정에 실패했습니다.");
          }
        } else {
          const res = await fetch("/api/admin/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (json.success) {
            setNotices((prev) => [json.data, ...prev]);
            showToast("success", "공지사항이 등록되었습니다.");
          } else {
            showToast("error", json.error?.message ?? "공지사항 등록에 실패했습니다.");
          }
        }
      } catch {
        showToast("error", "공지사항 저장 중 오류가 발생했습니다.");
      }
      setEditTarget(null);
    },
    [editTarget, showToast]
  );

  // ─── 공지 삭제 ────────────────────────────────────────────────────────────

  const handleDeleteNotice = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/notices/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setNotices((prev) => prev.filter((n) => n.id !== deleteTarget.id));
        showToast("success", "공지사항이 삭제되었습니다.");
      } else {
        showToast("error", json.error?.message ?? "공지사항 삭제에 실패했습니다.");
      }
    } catch {
      showToast("error", "공지사항 삭제 중 오류가 발생했습니다.");
    }
    setDeleteTarget(null);
    setIsDeleting(false);
  }, [deleteTarget, isDeleting, showToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">공지사항 목록을 불러오는 중...</p>
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
            <Megaphone size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">공지사항 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              공지사항을 등록, 수정, 삭제합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminCsvExportButton<AdminNotice>
            getData={() => filteredNotices as AdminNotice[]}
            columns={CSV_COLUMNS}
            filename="공지사항목록"
            label="CSV 내보내기"
            size="sm"
          />
          <Button
            size="sm"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[14px]"
          >
            <Plus size={15} />
            공지 등록
          </Button>
        </div>
      </div>

      {/* ── 검색 + 필터 패널 ──────────────────────────────────────── */}
      <AdminSearchFilterPanel
        searchPlaceholder="제목, 내용으로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={filteredNotices.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 카테고리 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">카테고리</label>
          <Select
            value={filters.category}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="일반">일반</SelectItem>
              <SelectItem value="이벤트">이벤트</SelectItem>
              <SelectItem value="점검">점검</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 2: 중요 여부 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">중요 여부</label>
          <Select
            value={filters.importance}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, importance: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="important">중요 공지</SelectItem>
              <SelectItem value="normal">일반 공지</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 3: 노출 여부 */}
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

        {/* 필터 4: 등록일 */}
        <AdminDateRangePicker
          label="등록일"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />
      </AdminSearchFilterPanel>

      {/* ── 데이터 테이블 ─────────────────────────────────────────── */}
      <AdminDataTable<NoticeRow>
        columns={columns}
        data={filteredNotices}
        emptyMessage="조건에 맞는 공지사항이 없습니다."
        rowKey={(row) => row.id}
        onRowClick={(row) => {
          setEditTarget(row as AdminNotice);
          setFormOpen(true);
        }}
        pageSizeOptions={[10, 20, 50]}
      />

      {/* ── 공지 등록/수정 모달 ──────────────────────────────────── */}
      <NoticeFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        notice={editTarget}
        onSave={handleSaveNotice}
      />

      {/* ── 공지 삭제 확인 다이얼로그 ────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>공지사항 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              해당 공지사항을 삭제하시겠습니까?
              <br />
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>
              <br />
              삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteNotice} disabled={isDeleting}>
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
