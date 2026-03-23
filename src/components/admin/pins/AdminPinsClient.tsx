"use client";

import { useState, useMemo, useCallback, useRef, useEffect, useId } from "react";
import Image from "next/image";
import {
  KeyRound,
  Plus,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Package,
  Trash2,
  AlertTriangle,
  Search,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import type { AdminPinListItem, AdminProductListItem, PinStatus } from "@/types";

// ─── 상태 라벨/색상 ──────────────────────────────────────────────────────────

const PIN_STATUS_LABEL: Record<PinStatus, string> = {
  waiting: "미사용",
  assigned: "할당",
  consumed: "소진",
  returned: "반환",
};

const PIN_STATUS_STYLE: Record<PinStatus, string> = {
  waiting: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  assigned: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  consumed: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300",
  returned: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
};

type PinFilterTab = "all" | PinStatus;

const PINS_PER_PAGE = 20;

// ─── CSV 컬럼 정의 ──────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminPinListItem>[] = [
  { key: "pin_number", label: "핀 번호" },
  { key: "product_name", label: "상품명" },
  {
    key: "status",
    label: "상태",
    format: (v) => PIN_STATUS_LABEL[v as PinStatus] ?? String(v),
  },
  {
    key: "registration_method",
    label: "등록방식",
    format: (v) => (v === "manual" ? "수동" : "TXT"),
  },
  { key: "voucher_code", label: "교환권코드", format: (v) => String(v ?? "") },
  { key: "assigned_username", label: "할당 사용자 아이디", format: (v) => String(v ?? "") },
  { key: "assigned_user_name", label: "할당 사용자 이름", format: (v) => String(v ?? "") },
  {
    key: "created_at",
    label: "등록일",
    format: (v) => String(v).split("T")[0],
  },
  {
    key: "assigned_at",
    label: "할당일",
    format: (v) => (v ? String(v).split("T")[0] : ""),
  },
  {
    key: "consumed_at",
    label: "소진일",
    format: (v) => (v ? String(v).split("T")[0] : ""),
  },
  {
    key: "returned_at",
    label: "반환일",
    format: (v) => (v ? String(v).split("T")[0] : ""),
  },
];

// ─── TXT 템플릿 다운로드 ──────────────────────────────────────────────────────

function downloadTxtTemplate() {
  const lines = [
    "1234-5678-9012-3456",
    "2345-6789-0123-4567",
    "3456-7890-1234-5678",
  ].join("\r\n");
  const blob = new Blob([lines], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "핀번호_등록_템플릿.txt";
  link.click();
  URL.revokeObjectURL(url);
}

// ─── 재고 데이터 타입 ──────────────────────────────────────────────────────

interface StockItem {
  product_id: string;
  product_name: string;
  category_name: string;
  waiting: number;
  assigned: number;
  consumed: number;
  returned: number;
  total: number;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────

export function AdminPinsClient() {
  const fileInputId = useId();

  // ── 데이터 상태 ──
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── 모달 상태 ──
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pinFilterTab, setPinFilterTab] = useState<PinFilterTab>("all");
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [pinPage, setPinPage] = useState(1);
  const [modalPins, setModalPins] = useState<AdminPinListItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTotal, setModalTotal] = useState(0);

  // ── 개별 등록 ──
  const [pinInput, setPinInput] = useState("");
  const [pinProductId, setPinProductId] = useState("");
  const [pinInputError, setPinInputError] = useState("");
  const [addingPin, setAddingPin] = useState(false);

  // ── TXT 대량 등록 ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [txtFileName, setTxtFileName] = useState<string | null>(null);
  const [txtError, setTxtError] = useState("");
  const [txtProductId, setTxtProductId] = useState("");
  const [uploadingTxt, setUploadingTxt] = useState(false);

  // ── 삭제 확인 ──
  const [deleteTarget, setDeleteTarget] = useState<AdminPinListItem | null>(null);
  const [deletingPin, setDeletingPin] = useState(false);

  // ── 토스트 ──
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
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

  // ─── 데이터 로드 ──────────────────────────────────────────────────────

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pins/stock");
      const json = await res.json();
      if (json.success) {
        setStockItems(json.data.summary ?? []);
      }
    } catch {
      console.error("[AdminPinsClient] Failed to fetch stock");
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products?limit=100&sort_by=name&sort_order=asc");
      const json = await res.json();
      if (json.success) {
        const items = json.data.data ?? json.data ?? [];
        setProducts(items);
        if (items.length > 0) {
          setPinProductId((prev) => prev || items[0].id);
          setTxtProductId((prev) => prev || items[0].id);
        }
      }
    } catch {
      console.error("[AdminPinsClient] Failed to fetch products");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchStock(), fetchProducts()]);
      setLoading(false);
    }
    init();
  }, [fetchStock, fetchProducts]);

  // ─── 재고 현황 그룹핑 ──────────────────────────────────────────────────

  const categoryGroups = useMemo(() => {
    // products에서 이미지/카테고리 정보를 가져오기 위한 맵
    const productMap = new Map(products.map((p) => [p.id, p]));

    const enriched = stockItems.map((item) => ({
      ...item,
      product: productMap.get(item.product_id) ?? null,
    }));

    const groupMap = new Map<string, typeof enriched>();
    for (const item of enriched) {
      const catName = item.category_name;
      if (!groupMap.has(catName)) groupMap.set(catName, []);
      groupMap.get(catName)!.push(item);
    }

    return Array.from(groupMap.entries()).map(([categoryName, items]) => ({ categoryName, items }));
  }, [stockItems, products]);

  // ─── 모달 핀 목록 로드 ──────────────────────────────────────────────────

  const fetchModalPins = useCallback(async (productId: string, tab: PinFilterTab, search: string, page: number) => {
    setModalLoading(true);
    try {
      const params = new URLSearchParams({
        product_id: productId,
        page: String(page),
        limit: String(PINS_PER_PAGE),
        sort_by: "created_at",
        sort_order: "desc",
      });
      if (tab !== "all") params.set("status", tab);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/pins?${params}`);
      const json = await res.json();
      if (json.success) {
        setModalPins(json.data.data ?? []);
        setModalTotal(json.data.total ?? 0);
      }
    } catch {
      console.error("[AdminPinsClient] Failed to fetch modal pins");
    } finally {
      setModalLoading(false);
    }
  }, []);

  // 모달에서 상태별 건수 (서버에서 가져온 stock 데이터 활용)
  const modalStockCounts = useMemo(() => {
    if (!selectedProductId) return { all: 0, waiting: 0, assigned: 0, consumed: 0, returned: 0 };
    const stock = stockItems.find((s) => s.product_id === selectedProductId);
    if (!stock) return { all: 0, waiting: 0, assigned: 0, consumed: 0, returned: 0 };
    return {
      all: stock.total,
      waiting: stock.waiting,
      assigned: stock.assigned,
      consumed: stock.consumed,
      returned: stock.returned,
    };
  }, [selectedProductId, stockItems]);

  const totalPages = Math.max(1, Math.ceil(modalTotal / PINS_PER_PAGE));

  const handleOpenModal = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setPinFilterTab("all");
    setPinSearchQuery("");
    setPinPage(1);
    fetchModalPins(productId, "all", "", 1);
  }, [fetchModalPins]);

  const handleCloseModal = useCallback(() => {
    setSelectedProductId(null);
    setPinFilterTab("all");
    setPinSearchQuery("");
    setPinPage(1);
    setModalPins([]);
    setModalTotal(0);
  }, []);

  // 필터/검색/페이지 변경 시 재요청
  const handleFilterChange = useCallback((tab: PinFilterTab) => {
    setPinFilterTab(tab);
    setPinPage(1);
    if (selectedProductId) fetchModalPins(selectedProductId, tab, pinSearchQuery, 1);
  }, [selectedProductId, pinSearchQuery, fetchModalPins]);

  const handleSearchChange = useCallback((value: string) => {
    setPinSearchQuery(value);
    setPinPage(1);
    if (selectedProductId) fetchModalPins(selectedProductId, pinFilterTab, value, 1);
  }, [selectedProductId, pinFilterTab, fetchModalPins]);

  const handlePageChange = useCallback((page: number) => {
    setPinPage(page);
    if (selectedProductId) fetchModalPins(selectedProductId, pinFilterTab, pinSearchQuery, page);
  }, [selectedProductId, pinFilterTab, pinSearchQuery, fetchModalPins]);

  // ─── 핀 삭제 ─────────────────────────────────────────────────────────────

  const handleDeletePin = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingPin(true);
    try {
      const res = await fetch(`/api/admin/pins/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("success", "핀 번호가 삭제되었습니다.");
        // 재고 새로고침
        fetchStock();
        // 모달 열려있으면 갱신
        if (selectedProductId) {
          fetchModalPins(selectedProductId, pinFilterTab, pinSearchQuery, pinPage);
        }
      } else {
        showToast("error", json.error?.message ?? "삭제에 실패했습니다.");
      }
    } catch {
      showToast("error", "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingPin(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, showToast, fetchStock, selectedProductId, pinFilterTab, pinSearchQuery, pinPage, fetchModalPins]);

  // ─── 개별 핀 등록 ────────────────────────────────────────────────────────

  const handleAddPin = useCallback(async () => {
    const trimmed = pinInput.trim();
    if (!trimmed) {
      setPinInputError("핀 번호를 입력해 주세요.");
      return;
    }
    if (!pinProductId) {
      setPinInputError("상품을 선택해 주세요.");
      return;
    }

    setAddingPin(true);
    setPinInputError("");
    try {
      const res = await fetch("/api/admin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pinProductId, pin_number: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("success", "핀 번호가 등록되었습니다.");
        setPinInput("");
        fetchStock();
        if (selectedProductId === pinProductId) {
          fetchModalPins(selectedProductId, pinFilterTab, pinSearchQuery, pinPage);
        }
      } else {
        setPinInputError(json.error?.message ?? "등록에 실패했습니다.");
      }
    } catch {
      setPinInputError("등록 중 오류가 발생했습니다.");
    } finally {
      setAddingPin(false);
    }
  }, [pinInput, pinProductId, showToast, fetchStock, selectedProductId, pinFilterTab, pinSearchQuery, pinPage, fetchModalPins]);

  // ─── TXT 업로드 ───────────────────────────────────────────────────────────

  const handleTxtUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!txtProductId) {
        setTxtError("상품을 먼저 선택해 주세요.");
        return;
      }

      setTxtError("");
      setTxtFileName(file.name);
      setUploadingTxt(true);

      try {
        const formData = new FormData();
        formData.append("product_id", txtProductId);
        formData.append("file", file);

        const res = await fetch("/api/admin/pins/upload", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();

        if (json.success) {
          const { total_success, total_duplicate, total_failed } = json.data;
          const parts: string[] = [`${total_success}개 핀 번호가 등록되었습니다.`];
          if (total_duplicate > 0) parts.push(`중복 ${total_duplicate}개 제외`);
          if (total_failed > 0) parts.push(`실패 ${total_failed}개`);
          showToast("success", parts.join(" "));
          setTxtFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          fetchStock();
          if (selectedProductId === txtProductId) {
            fetchModalPins(selectedProductId, pinFilterTab, pinSearchQuery, pinPage);
          }
        } else {
          setTxtError(json.error?.message ?? "업로드에 실패했습니다.");
        }
      } catch {
        setTxtError("업로드 중 오류가 발생했습니다.");
      } finally {
        setUploadingTxt(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [txtProductId, showToast, fetchStock, selectedProductId, pinFilterTab, pinSearchQuery, pinPage, fetchModalPins]
  );

  // ─── CSV 내보내기용 전체 핀 로드 ──────────────────────────────────────────

  const fetchAllPinsForCsv = useCallback(async (): Promise<AdminPinListItem[]> => {
    try {
      const res = await fetch("/api/admin/pins?limit=10000&sort_by=created_at&sort_order=desc");
      const json = await res.json();
      if (json.success) return json.data.data ?? [];
    } catch {
      // ignore
    }
    return [];
  }, []);

  // ─── 로딩 상태 ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">데이터를 불러오는 중...</p>
      </div>
    );
  }

  // ─── 선택된 상품 정보 ──────────────────────────────────────────────────────

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 인라인 토스트 */}
      {toastMsg && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg text-[13px] font-medium transition-all",
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
            <KeyRound size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">핀 번호 관리</h1>
            <p className="text-[12px] text-muted-foreground">
              상품별 핀 재고 현황을 확인하고, 핀 번호를 등록합니다.
            </p>
          </div>
        </div>

        <AdminCsvExportButton<AdminPinListItem>
          getData={fetchAllPinsForCsv}
          columns={CSV_COLUMNS}
          filename="핀번호목록"
          label="CSV 내보내기"
          size="sm"
        />
      </div>

      {/* ── 카테고리별 핀 재고 현황 ──────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Package size={16} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">상품별 핀 재고 현황</h2>
          <span className="ml-auto text-[12px] text-muted-foreground">
            {categoryGroups.length}개 카테고리 · {stockItems.length}개 상품
          </span>
        </div>

        <div className="flex flex-col gap-0">
          {categoryGroups.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
              등록된 상품이 없습니다.
            </div>
          ) : (
            categoryGroups.map(({ categoryName, items }) => (
              <div key={categoryName}>
                {/* 카테고리 헤더 */}
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2.5">
                  <span className="text-[13px] font-semibold text-foreground">{categoryName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {items.length}개 상품
                  </span>
                </div>

                {/* 상품 카드 그리드 */}
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <button
                      key={item.product_id}
                      type="button"
                      onClick={() => handleOpenModal(item.product_id)}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/30 hover:shadow-sm"
                    >
                      {/* 상품 헤더 */}
                      <div className="flex items-center gap-3">
                        {item.product?.image_url ? (
                          <Image
                            src={item.product.image_url}
                            alt={item.product_name}
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                            <Package size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">
                            {item.product_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            총 {item.total.toLocaleString()}개
                          </p>
                        </div>
                        <Search size={14} className="shrink-0 text-muted-foreground" />
                      </div>

                      {/* 재고 바 */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        {item.total > 0 && (
                          <div className="flex h-full">
                            <div
                              className="bg-blue-500 transition-all"
                              style={{ width: `${(item.waiting / item.total) * 100}%` }}
                            />
                            <div
                              className="bg-amber-400 transition-all"
                              style={{ width: `${(item.assigned / item.total) * 100}%` }}
                            />
                            <div
                              className="bg-gray-400 transition-all"
                              style={{ width: `${(item.consumed / item.total) * 100}%` }}
                            />
                            {item.returned > 0 && (
                              <div
                                className="bg-green-500 transition-all"
                                style={{ width: `${(item.returned / item.total) * 100}%` }}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* 수치 */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="flex flex-col items-center gap-0.5 rounded-md bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30">
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">미사용</span>
                          <span className="text-[14px] font-bold text-blue-700 dark:text-blue-300">
                            {item.waiting.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">할당</span>
                          <span className="text-[14px] font-bold text-amber-700 dark:text-amber-300">
                            {item.assigned.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 rounded-md bg-gray-100 px-2 py-1.5 dark:bg-gray-800/50">
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">소진</span>
                          <span className="text-[14px] font-bold text-gray-600 dark:text-gray-300">
                            {item.consumed.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 rounded-md bg-green-50 px-2 py-1.5 dark:bg-green-950/30">
                          <span className="text-[10px] font-medium text-green-600 dark:text-green-400">반환</span>
                          <span className="text-[14px] font-bold text-green-700 dark:text-green-300">
                            {item.returned.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── 핀 등록 영역 ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Plus size={16} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">핀 번호 등록</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          {/* ── 개별 등록 ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-brand-primary-soft text-[11px] font-bold text-primary">
                1
              </span>
              <p className="text-[13px] font-semibold text-foreground">개별 등록</p>
            </div>
            <p className="text-[12px] text-muted-foreground">
              핀 번호를 직접 입력하여 하나씩 등록합니다.
            </p>

            {/* 상품 선택 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">상품 선택</label>
              <Select value={pinProductId} onValueChange={setPinProductId}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="상품을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 핀 번호 입력 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">핀 번호</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinInputError) setPinInputError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPin();
                    }}
                    placeholder="예: 1234-5678-9012-3456"
                    className={cn(
                      "h-10 font-mono text-[13px]",
                      pinInputError && "border-error focus-visible:ring-error/30"
                    )}
                    aria-describedby={pinInputError ? "pin-input-error" : undefined}
                    disabled={addingPin}
                  />
                  {pinInputError && (
                    <p
                      id="pin-input-error"
                      className="mt-1 flex items-center gap-1 text-[12px] text-error"
                    >
                      <AlertCircle size={11} />
                      {pinInputError}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleAddPin}
                  disabled={!pinInput.trim() || !pinProductId || addingPin}
                  className="h-10 shrink-0 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[13px]"
                >
                  {addingPin ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  등록
                </Button>
              </div>
            </div>
          </div>

          {/* ── TXT 대량 등록 ───────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-success-bg text-[11px] font-bold text-success">
                2
              </span>
              <p className="text-[13px] font-semibold text-foreground">TXT 대량 등록</p>
            </div>
            <p className="text-[12px] text-muted-foreground">
              TXT 파일로 여러 핀 번호를 한 번에 등록합니다. 한 줄에 핀 번호 하나씩 입력하세요.
            </p>

            {/* 상품 선택 */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">등록할 상품</label>
              <Select value={txtProductId} onValueChange={setTxtProductId}>
                <SelectTrigger className="h-9 w-full text-[13px]">
                  <SelectValue placeholder="상품 선택" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 템플릿 다운로드 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTxtTemplate}
              className="h-9 w-fit gap-1.5 text-[12px]"
            >
              <Download size={13} />
              TXT 템플릿 다운로드
            </Button>

            {/* 파일 업로드 영역 */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={fileInputId}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2",
                  "rounded-lg border-2 border-dashed border-border",
                  "bg-muted/20 px-4 py-6 text-center",
                  "transition-colors hover:border-primary/40 hover:bg-brand-primary-muted/30",
                  txtError && "border-error/40 bg-error/5",
                  uploadingTxt && "pointer-events-none opacity-60"
                )}
              >
                {uploadingTxt ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <span className="text-[13px] font-medium text-foreground">업로드 중...</span>
                  </div>
                ) : txtFileName ? (
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-success" />
                    <span className="text-[13px] font-medium text-foreground">{txtFileName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTxtFileName(null);
                        setTxtError("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
                      aria-label="파일 제거"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={22} className="text-muted-foreground" />
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        TXT 파일을 클릭하여 업로드
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        .txt 형식 (한 줄에 핀 번호 하나)
                      </p>
                    </div>
                  </>
                )}
              </label>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".txt"
                onChange={handleTxtUpload}
                className="sr-only"
                aria-label="TXT 파일 업로드"
                disabled={uploadingTxt}
              />
              {txtError && (
                <p className="flex items-center gap-1 text-[12px] text-error">
                  <AlertCircle size={11} />
                  {txtError}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 핀 목록 모달 ──────────────────────────────────────────── */}
      <Dialog open={!!selectedProductId} onOpenChange={(v) => { if (!v) handleCloseModal(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
          {/* 모달 헤더 */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              {selectedProduct?.image_url ? (
                <Image
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <Package size={18} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <DialogTitle className="text-[15px]">
                  {selectedProduct?.name ?? "핀 목록"}
                </DialogTitle>
                <DialogDescription className="text-[12px]">
                  핀 번호 목록을 확인하고 관리합니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* 필터 탭 + 검색 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all" as PinFilterTab, label: "전체", count: modalStockCounts.all },
                  { key: "waiting" as PinFilterTab, label: "미사용", count: modalStockCounts.waiting },
                  { key: "assigned" as PinFilterTab, label: "할당", count: modalStockCounts.assigned },
                  { key: "consumed" as PinFilterTab, label: "소진", count: modalStockCounts.consumed },
                  { key: "returned" as PinFilterTab, label: "반환", count: modalStockCounts.returned },
                ] as const
              ).map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleFilterChange(key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    pinFilterTab === key
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pinSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="핀 번호 검색..."
                  className="h-8 w-48 pl-8 text-[12px]"
                />
              </div>
            </div>
          </div>

          {/* 핀 테이블 */}
          <div className="flex-1 overflow-auto min-h-0">
            {modalLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : modalPins.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-muted/50 z-10">
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">핀 번호</th>
                    <th className="px-4 py-2.5 text-center font-medium">상태</th>
                    <th className="px-4 py-2.5 text-left font-medium">사용자</th>
                    <th className="px-4 py-2.5 text-center font-medium">등록방식</th>
                    <th className="px-4 py-2.5 text-center font-medium">교환권코드</th>
                    <th className="px-4 py-2.5 text-center font-medium">등록일</th>
                    <th className="px-4 py-2.5 text-center font-medium">처리일</th>
                    <th className="w-[50px] px-4 py-2.5 text-center font-medium">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {modalPins.map((pin) => (
                    <tr key={pin.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[12px] font-medium tracking-wider text-foreground">
                          {pin.pin_number}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={cn(
                            "inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                            PIN_STATUS_STYLE[pin.status]
                          )}
                        >
                          {PIN_STATUS_LABEL[pin.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {pin.assigned_username ? (
                          <div className="flex flex-col">
                            <span className="text-[12px] font-medium text-foreground">{pin.assigned_user_name}</span>
                            <span className="text-[11px] text-muted-foreground">{pin.assigned_username}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">
                        {pin.registration_method === "manual" ? "수동" : "TXT"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {pin.voucher_code ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {pin.voucher_code.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-center text-muted-foreground">
                        {pin.created_at.split("T")[0]}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-center text-muted-foreground">
                        {pin.returned_at
                          ? pin.returned_at.split("T")[0]
                          : pin.consumed_at
                            ? pin.consumed_at.split("T")[0]
                            : pin.assigned_at
                              ? pin.assigned_at.split("T")[0]
                              : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {pin.status === "waiting" ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(pin)}
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-error-bg hover:text-error"
                            aria-label="삭제"
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                {pinSearchQuery.trim()
                  ? "검색 결과가 없습니다."
                  : pinFilterTab === "all"
                    ? "등록된 핀 번호가 없습니다."
                    : `${PIN_STATUS_LABEL[pinFilterTab as PinStatus]} 상태의 핀이 없습니다.`}
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-[12px] text-muted-foreground">
                총 {modalTotal.toLocaleString()}개 중 {((pinPage - 1) * PINS_PER_PAGE) + 1}~{Math.min(pinPage * PINS_PER_PAGE, modalTotal)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, pinPage - 1))}
                  disabled={pinPage <= 1}
                  className="h-7 px-2.5 text-[11px]"
                >
                  이전
                </Button>
                <span className="px-2 text-[12px] text-muted-foreground">
                  {pinPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(totalPages, pinPage + 1))}
                  disabled={pinPage >= totalPages}
                  className="h-7 px-2.5 text-[11px]"
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 삭제 확인 다이얼로그 ──────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>핀 번호 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{deleteTarget?.pin_number}</span> 핀 번호를 삭제하시겠습니까?
              <br />
              삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={deletingPin}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeletePin} disabled={deletingPin}>
              {deletingPin ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
