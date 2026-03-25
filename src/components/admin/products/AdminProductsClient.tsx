"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  GripVertical,
  Eye,
  EyeOff,
  AlertTriangle,
  Star,
  X,
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminDateRangePicker, type DateRange } from "@/components/admin/AdminDateRangePicker";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminNumberRange, type NumberRangeValue } from "@/components/admin/AdminNumberRange";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { ProductFormModal } from "@/components/admin/products/ProductFormModal";
import { cn, formatDateTime } from "@/lib/utils";
import type { SortDirection } from "@/components/admin/AdminDataTable";
import type { AdminProductListItem, Category, FeeUnit, PopularRankItem, ProductStatus } from "@/types";

// ─── 상태 라벨/색상 맵 ────────────────────────────────────────────────────────

const PRODUCT_STATUS_STYLE: Record<ProductStatus, string> = {
  active: "bg-success-bg text-success",
  inactive: "bg-muted text-muted-foreground",
  soldout: "bg-error-bg text-error",
};

const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: "판매중",
  inactive: "판매중지",
  soldout: "품절",
};


// ─── CSV 컬럼 ────────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminProductListItem>[] = [
  { key: "id", label: "상품ID" },
  { key: "name", label: "상품명" },
  { key: "category_name", label: "카테고리" },
  { key: "price", label: "판매가", format: (v) => `${Number(v).toLocaleString()}` },
  { key: "fee_rate", label: "수수료", format: (_v, row) => {
    const p = row as AdminProductListItem;
    return p.fee_unit === "percent" ? `${p.fee_rate}%` : `${p.fee_rate.toLocaleString()}원`;
  }},
  { key: "pin_stock_waiting", label: "대기 재고" },
  { key: "pin_stock_assigned", label: "할당 재고" },
  { key: "pin_stock_consumed", label: "소진" },
  { key: "total_sales", label: "총 판매" },
  {
    key: "status",
    label: "상태",
    format: (_v, row) => PRODUCT_STATUS_LABEL[(row as AdminProductListItem).status],
  },
  {
    key: "created_at",
    label: "등록일",
    format: (v) => formatDateTime(String(v)),
  },
];

// ─── 필터 상태 ────────────────────────────────────────────────────────────────

interface FilterState {
  categoryIds: string[];
  status: string; // "all" | "active" | "inactive" | "soldout"
  priceRange: NumberRangeValue;
  dateRange: DateRange;
}

const INITIAL_FILTERS: FilterState = {
  categoryIds: [],
  status: "all",
  priceRange: {},
  dateRange: { from: null, to: null },
};

// ─── 카테고리 인라인 편집 상태 ────────────────────────────────────────────────

interface CategoryEditState {
  id: string;
  name: string;
  subtitle: string;
  sort_order: number;
}

// ─── 저장 콜백 데이터 타입 ───────────────────────────────────────────────────

interface SaveProductData {
  name: string;
  category_id: string;
  price: number;
  fee_rate: number;
  fee_unit: FeeUnit;
  description?: string;
  status: ProductStatus;
  image_url?: string | null;
  image_file?: File | null;
}

// ─── API 쿼리 빌더 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10;

interface PaginationState {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function buildProductQueryParams(
  search: string,
  filters: FilterState,
  pagination: PaginationState
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(pagination.page));
  params.set("limit", String(pagination.pageSize));
  params.set("sort_by", pagination.sortBy);
  params.set("sort_order", pagination.sortOrder);

  if (search) params.set("search", search);
  if (filters.categoryIds.length > 0) params.set("category_ids", filters.categoryIds.join(","));
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.priceRange.min != null) params.set("price_min", String(filters.priceRange.min));
  if (filters.priceRange.max != null) params.set("price_max", String(filters.priceRange.max));
  if (filters.dateRange.from) params.set("date_from", filters.dateRange.from);
  if (filters.dateRange.to) params.set("date_to", filters.dateRange.to);

  return params;
}

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type ProductRow = AdminProductListItem & Record<string, unknown>;

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminProductsClient() {
  // 상품 상태
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 페이징/정렬 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 카테고리 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCountByCategory, setProductCountByCategory] = useState<Record<string, number>>({});

  // 검색/필터
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminProductListItem | null>(null);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AdminProductListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 토스트
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 카테고리 관리
  const [categoryEditState, setCategoryEditState] = useState<CategoryEditState | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<Category | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  // 인기 상품 관리
  const [popularRanks, setPopularRanks] = useState<(PopularRankItem | null)[]>([null, null, null, null, null]);
  const [popularSaving, setPopularSaving] = useState(false);
  const [allProductsForPopular, setAllProductsForPopular] = useState<{ id: string; name: string; price: number; image_url: string | null; status: ProductStatus }[]>([]);

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

  // ─── API: 상품 목록 조회 ──────────────────────────────────────────────────

  const fetchProducts = useCallback(async (
    searchVal: string,
    filterVal: FilterState,
    pagination: PaginationState
  ) => {
    setLoading(true);
    try {
      const params = buildProductQueryParams(searchVal, filterVal, pagination);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setProducts(json.data.data);
        setTotalCount(json.data.total);
      } else {
        showToast("error", json.error?.message ?? "상품 목록 조회 실패");
      }
    } catch {
      showToast("error", "상품 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ─── API: 카테고리 목록 조회 ──────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();

      if (json.success) {
        setCategories(json.data);
        // 카테고리별 상품 수 (API에서 product_count 포함)
        const countMap: Record<string, number> = {};
        for (const cat of json.data) {
          countMap[cat.id] = cat.product_count ?? 0;
        }
        setProductCountByCategory(countMap);
      } else {
      }
    } catch {
    }
  }, []);

  // ─── API: 인기 상품 순위 조회 ──────────────────────────────────────────
  const fetchPopularRanks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products/popular");
      const json = await res.json();
      if (json.success) {
        const slots: (PopularRankItem | null)[] = [null, null, null, null, null];
        for (const item of json.data as PopularRankItem[]) {
          const idx = item.popular_rank - 1;
          if (idx >= 0 && idx < 5) slots[idx] = item;
        }
        setPopularRanks(slots);
      }
    } catch {
    }
  }, []);

  // ─── API: 전체 상품 목록 (인기 상품 선택용) ───────────────────────────────
  // NOTE: 500개 상한. 상품 500개 초과 시 전용 경량 API로 전환 필요
  const fetchAllProductsForPopular = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", limit: "500", sort_by: "name", sort_order: "asc" });
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAllProductsForPopular(
          (json.data.data as AdminProductListItem[])
            .filter((p) => p.status === "active" || p.status === "soldout")
            .map((p) => ({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, status: p.status }))
        );
      }
    } catch {
    }
  }, []);

  // ─── API: 인기 상품 순위 저장 ──────────────────────────────────────────
  const handleSavePopularRanks = useCallback(async () => {
    setPopularSaving(true);
    try {
      const ranks = popularRanks
        .map((item, idx) => item ? { product_id: item.id, rank: idx + 1 } : null)
        .filter((r): r is { product_id: string; rank: number } => r !== null);

      const res = await fetch("/api/admin/products/popular", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranks }),
      });
      const json = await res.json();

      if (json.success) {
        showToast("success", "인기 상품 순위가 저장되었습니다.");
      } else {
        showToast("error", json.error?.message ?? "인기 상품 순위 저장 실패");
      }
    } catch {
      showToast("error", "인기 상품 순위 저장 중 오류가 발생했습니다");
    } finally {
      setPopularSaving(false);
    }
  }, [popularRanks, showToast]);

  // ─── 초기 로드 ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProducts("", INITIAL_FILTERS, {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: "created_at",
      sortOrder: "desc",
    });
    fetchCategories();
    fetchPopularRanks();
    fetchAllProductsForPopular();
  }, [fetchProducts, fetchCategories, fetchPopularRanks, fetchAllProductsForPopular]);

  // ─── 필터 적용 ───────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
    setPage(1);
    fetchProducts(search, filters, { page: 1, pageSize, sortBy, sortOrder });
  }, [filters, search, fetchProducts, pageSize, sortBy, sortOrder]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
    setSortBy("created_at");
    setSortOrder("desc");
    fetchProducts("", INITIAL_FILTERS, { page: 1, pageSize, sortBy: "created_at", sortOrder: "desc" });
  }, [fetchProducts, pageSize]);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
    setPage(1);
    fetchProducts(value, appliedFilters, { page: 1, pageSize, sortBy, sortOrder });
  }, [appliedFilters, fetchProducts, pageSize, sortBy, sortOrder]);

  // ─── 활성 필터 칩 ─────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.categoryIds.length > 0) {
      chips.push({
        key: "category",
        label: "카테고리",
        value: appliedFilters.categoryIds
          .map((id) => categories.find((c) => c.id === id)?.name ?? id)
          .join(", "),
        onRemove: () => {
          const next = { ...appliedFilters, categoryIds: [] };
          setAppliedFilters(next);
          setPage(1);
          fetchProducts(appliedSearch, next, { page: 1, pageSize, sortBy, sortOrder });
        },
      });
    }

    if (appliedFilters.status !== "all") {
      chips.push({
        key: "status",
        label: "상태",
        value: PRODUCT_STATUS_LABEL[appliedFilters.status as ProductStatus],
        onRemove: () => {
          const next = { ...appliedFilters, status: "all" };
          setAppliedFilters(next);
          setPage(1);
          fetchProducts(appliedSearch, next, { page: 1, pageSize, sortBy, sortOrder });
        },
      });
    }

    if (appliedFilters.priceRange.min != null || appliedFilters.priceRange.max != null) {
      const min = appliedFilters.priceRange.min;
      const max = appliedFilters.priceRange.max;
      chips.push({
        key: "price",
        label: "가격",
        value:
          min != null && max != null
            ? `${min.toLocaleString()}~${max.toLocaleString()}원`
            : min != null
              ? `${min.toLocaleString()}원 이상`
              : `${max!.toLocaleString()}원 이하`,
        onRemove: () => {
          const next = { ...appliedFilters, priceRange: {} };
          setAppliedFilters(next);
          setPage(1);
          fetchProducts(appliedSearch, next, { page: 1, pageSize, sortBy, sortOrder });
        },
      });
    }

    if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) {
      const from = appliedFilters.dateRange.from ?? "";
      const to = appliedFilters.dateRange.to ?? "";
      chips.push({
        key: "date",
        label: "등록일",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () => {
          const next = { ...appliedFilters, dateRange: { from: null, to: null } };
          setAppliedFilters(next);
          setPage(1);
          fetchProducts(appliedSearch, next, { page: 1, pageSize, sortBy, sortOrder });
        },
      });
    }

    return chips;
  }, [appliedFilters, appliedSearch, categories, fetchProducts, pageSize, sortBy, sortOrder]);

  // ─── 테이블 컬럼 ─────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
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
        key: "name",
        label: "상품명",
        sortable: true,
        align: "center" as const,
        width: "260px",
        render: (v: unknown, row: ProductRow) => (
          <div className="flex items-center gap-2.5">
            {row.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(row.image_url)}
                alt={String(v)}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Ticket size={14} className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-[14px] font-medium text-foreground" title={String(v)}>
                {String(v)}
              </p>
              <p className="text-[11px] text-muted-foreground">{String(row.category_name)}</p>
            </div>
          </div>
        ),
      },
      {
        key: "price",
        label: "판매가",
        sortable: true,
        align: "center" as const,
        width: "90px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-semibold text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
      {
        key: "fee_rate",
        label: "수수료",
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: ProductRow) => {
          const p = row as AdminProductListItem;
          return (
            <span className="whitespace-nowrap text-[14px] text-foreground">
              {p.fee_unit === "percent" ? `${p.fee_rate}%` : `${p.fee_rate.toLocaleString()}원`}
            </span>
          );
        },
      },
      {
        key: "pin_stock_waiting",
        label: "대기재고",
        sortable: true,
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => {
          const waiting = Number(v);
          const isLow = waiting > 0 && waiting <= 5;
          return (
            <span
              className={cn(
                "whitespace-nowrap text-[14px] font-semibold",
                waiting === 0
                  ? "text-error"
                  : isLow
                    ? "text-warning"
                    : "text-foreground"
              )}
            >
              {waiting}
              {isLow && (
                <span className="ml-1 text-[10px] font-normal text-warning">⚠</span>
              )}
            </span>
          );
        },
      },
      {
        key: "total_sales",
        label: "총 판매",
        sortable: true,
        align: "center" as const,
        width: "70px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-foreground">
            {Number(v).toLocaleString()}
          </span>
        ),
      },
      {
        key: "status",
        label: "상태",
        align: "center" as const,
        width: "70px",
        render: (_v: unknown, row: ProductRow) => {
          const ds = (row as AdminProductListItem).status;
          return (
            <span
              className={cn(
                "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                PRODUCT_STATUS_STYLE[ds]
              )}
            >
              {PRODUCT_STATUS_LABEL[ds]}
            </span>
          );
        },
      },
      {
        key: "_actions",
        label: "액션",
        align: "center" as const,
        width: "80px",
        render: (_v: unknown, row: ProductRow) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditTarget(row as AdminProductListItem);
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
                setDeleteTarget(row as AdminProductListItem);
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
    []
  );

  // ─── API: 이미지 업로드 ─────────────────────────────────────────────────

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/products/upload", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();

    if (json.success) {
      return json.data.url;
    }
    throw new Error(json.error?.message ?? "이미지 업로드 실패");
  }, []);

  // ─── API: 상품 저장 (등록/수정) ─────────────────────────────────────────

  const handleSaveProduct = useCallback(
    async (data: SaveProductData) => {
      try {
        // 1) 이미지 업로드 (새 파일이 있는 경우)
        let imageUrl = data.image_url ?? null;
        if (data.image_file) {
          imageUrl = await uploadImage(data.image_file);
        }

        // 2) 상품 등록/수정 API 호출
        const body = {
          name: data.name,
          category_id: data.category_id,
          price: data.price,
          fee_rate: data.fee_rate,
          fee_unit: data.fee_unit,
          description: data.description || undefined,
          status: data.status,
          image_url: imageUrl,
        };

        if (editTarget) {
          // 수정
          const res = await fetch(`/api/admin/products/${editTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();

          if (!json.success) {
            throw new Error(json.error?.message ?? "상품 수정 실패");
          }
          showToast("success", "상품이 수정되었습니다.");
        } else {
          // 등록
          const res = await fetch("/api/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();

          if (!json.success) {
            throw new Error(json.error?.message ?? "상품 등록 실패");
          }
          showToast("success", "상품이 등록되었습니다.");
        }

        // 3) 목록 재조회
        setEditTarget(null);
        await fetchProducts(appliedSearch, appliedFilters, { page, pageSize, sortBy, sortOrder });
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "상품 저장 중 오류가 발생했습니다");
        throw err; // 모달이 닫히지 않도록
      }
    },
    [editTarget, showToast, fetchProducts, appliedSearch, appliedFilters, uploadImage, page, pageSize, sortBy, sortOrder]
  );

  // ─── API: 상품 삭제 ────────────────────────────────────────────────────

  const handleDeleteProduct = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        showToast("error", json.error?.message ?? "상품 삭제 실패");
        return;
      }

      setDeleteTarget(null);
      showToast("success", "상품이 삭제되었습니다.");
      await fetchProducts(appliedSearch, appliedFilters, { page, pageSize, sortBy, sortOrder });
    } catch {
      showToast("error", "상품 삭제 중 오류가 발생했습니다");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, showToast, fetchProducts, appliedSearch, appliedFilters, page, pageSize, sortBy, sortOrder]);

  // ─── API: 카테고리 추가 ───────────────────────────────────────────────

  const handleAddCategory = useCallback(async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCategorySaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();

      if (!json.success) {
        showToast("error", json.error?.message ?? "카테고리 추가 실패");
        return;
      }

      setNewCategoryName("");
      showToast("success", "카테고리가 추가되었습니다.");
      await fetchCategories();
    } catch {
      showToast("error", "카테고리 추가 중 오류가 발생했습니다");
    } finally {
      setCategorySaving(false);
    }
  }, [newCategoryName, showToast, fetchCategories]);

  // ─── API: 카테고리 표시/숨김 토글 ──────────────────────────────────────

  const handleToggleCategoryVisible = useCallback(async (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    // 낙관적 업데이트
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, is_visible: !c.is_visible } : c))
    );

    try {
      const res = await fetch(`/api/admin/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !cat.is_visible }),
      });
      const json = await res.json();

      if (!json.success) {
        // 롤백
        setCategories((prev) =>
          prev.map((c) => (c.id === catId ? { ...c, is_visible: cat.is_visible } : c))
        );
        showToast("error", json.error?.message ?? "카테고리 수정 실패");
      }
    } catch {
      // 롤백
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, is_visible: cat.is_visible } : c))
      );
      showToast("error", "카테고리 수정 중 오류가 발생했습니다");
    }
  }, [categories, showToast]);

  // ─── API: 카테고리 수정 저장 ──────────────────────────────────────────

  const handleSaveCategoryEdit = useCallback(async () => {
    if (!categoryEditState) return;
    setCategorySaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${categoryEditState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryEditState.name,
          subtitle: categoryEditState.subtitle,
          sort_order: categoryEditState.sort_order,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        showToast("error", json.error?.message ?? "카테고리 수정 실패");
        return;
      }

      setCategoryEditState(null);
      showToast("success", "카테고리가 수정되었습니다.");
      await fetchCategories();
      // 상품 목록도 재조회 (카테고리명 변경 반영)
      await fetchProducts(appliedSearch, appliedFilters, { page, pageSize, sortBy, sortOrder });
    } catch {
      showToast("error", "카테고리 수정 중 오류가 발생했습니다");
    } finally {
      setCategorySaving(false);
    }
  }, [categoryEditState, showToast, fetchCategories, fetchProducts, appliedSearch, appliedFilters, page, pageSize, sortBy, sortOrder]);

  // ─── API: 카테고리 삭제 ───────────────────────────────────────────────

  const handleDeleteCategory = useCallback(async () => {
    if (!categoryDeleteTarget) return;
    setCategorySaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${categoryDeleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        showToast("error", json.error?.message ?? "카테고리 삭제 실패");
        setCategoryDeleteTarget(null);
        return;
      }

      setCategoryDeleteTarget(null);
      showToast("success", "카테고리가 삭제되었습니다.");
      await fetchCategories();
    } catch {
      showToast("error", "카테고리 삭제 중 오류가 발생했습니다");
    } finally {
      setCategorySaving(false);
    }
  }, [categoryDeleteTarget, showToast, fetchCategories]);

  // ─── 페이징/정렬 핸들러 ───────────────────────────────────────────────────

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    fetchProducts(appliedSearch, appliedFilters, { page: newPage, pageSize, sortBy, sortOrder });
  }, [fetchProducts, appliedSearch, appliedFilters, pageSize, sortBy, sortOrder]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    fetchProducts(appliedSearch, appliedFilters, { page: 1, pageSize: newSize, sortBy, sortOrder });
  }, [fetchProducts, appliedSearch, appliedFilters, sortBy, sortOrder]);

  const handleSortChange = useCallback((key: string, direction: SortDirection) => {
    const newSortBy = direction ? key : "created_at";
    const newSortOrder: "asc" | "desc" = direction ?? "desc";
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
    fetchProducts(appliedSearch, appliedFilters, { page: 1, pageSize, sortBy: newSortBy, sortOrder: newSortOrder });
  }, [fetchProducts, appliedSearch, appliedFilters, pageSize]);

  // 카테고리 멀티셀렉 옵션
  const categoryOpts = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

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
            <Ticket size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">상품권 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              상품권 상품을 등록, 수정, 삭제합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminCsvExportButton<AdminProductListItem>
            getData={async () => {
              const params = buildProductQueryParams(appliedSearch, appliedFilters, {
                page: 1,
                pageSize: 2000,
                sortBy,
                sortOrder,
              });
              const res = await fetch(`/api/admin/products?${params.toString()}`);
              const json = await res.json();
              return json.success ? json.data.data : products;
            }}
            columns={CSV_COLUMNS}
            filename="상품권목록"
            label="CSV 내보내기"
            size="sm"
          />
          <Button
            size="sm"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[14px]"
          >
            <Plus size={15} />
            상품 등록
          </Button>
        </div>
      </div>

      {/* ── 검색 + 필터 패널 ──────────────────────────────────────── */}
      <AdminSearchFilterPanel
        searchPlaceholder="상품명, 상품ID로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={totalCount}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 카테고리 */}
        <AdminMultiSelect
          label="카테고리"
          options={categoryOpts}
          value={filters.categoryIds}
          onChange={(v) => setFilters((prev) => ({ ...prev, categoryIds: v }))}
          placeholder="전체"
        />

        {/* 필터 2: 상태 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">상태</label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="active">판매중</SelectItem>
              <SelectItem value="soldout">품절</SelectItem>
              <SelectItem value="inactive">판매중지</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 3: 가격 범위 */}
        <AdminNumberRange
          label="가격 범위"
          value={filters.priceRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, priceRange: v }))}
          unit="원"
          min={0}
        />

        {/* 필터 4: 등록일 */}
        <AdminDateRangePicker
          label="등록일"
          value={filters.dateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, dateRange: v }))}
        />
      </AdminSearchFilterPanel>

      {/* ── 데이터 테이블 ─────────────────────────────────────────── */}
      <AdminDataTable<ProductRow>
          columns={columns}
          data={products as ProductRow[]}
          total={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSort={handleSortChange}
          loading={loading}
          emptyMessage="조건에 맞는 상품이 없습니다."
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            setEditTarget(row as AdminProductListItem);
            setFormOpen(true);
          }}
          pageSizeOptions={[10, 20, 50]}
        />

      {/* ── 인기 상품 관리 SubSection ──────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">인기 상품 관리</h2>
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              홈 슬라이더에 표시
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSavePopularRanks}
            disabled={popularSaving}
            className="h-8 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[14px]"
          >
            {popularSaving ? "저장 중..." : "순위 저장"}
          </Button>
        </div>

        <div className="divide-y divide-border">
          {popularRanks.map((item, idx) => {
            // 이미 선택된 상품 ID 목록 (현재 슬롯 제외)
            const usedIds = popularRanks
              .filter((_, i) => i !== idx)
              .filter((r): r is PopularRankItem => r !== null)
              .map((r) => r.id);

            const availableProducts = allProductsForPopular.filter((p) => !usedIds.includes(p.id));

            return (
              <div key={`slot-${idx}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                {/* 순위 번호 */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary-soft text-[14px] font-bold text-primary">
                  {idx + 1}
                </span>

                {/* 상품 선택 */}
                <Select
                  value={item?.id ?? "none"}
                  onValueChange={(value) => {
                    setPopularRanks((prev) => {
                      const next = [...prev];
                      if (value === "none") {
                        next[idx] = null;
                      } else {
                        const product = allProductsForPopular.find((p) => p.id === value);
                        if (product) {
                          next[idx] = { ...product, popular_rank: idx + 1 };
                        }
                      }
                      return next;
                    });
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 text-sm">
                    <SelectValue placeholder="상품을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">선택 안 함</span>
                    </SelectItem>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {p.price.toLocaleString()}원
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 선택된 상품 미리보기 */}
                {item && (
                  <div className="flex shrink-0 items-center gap-2">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-8 w-8 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Ticket size={14} className="text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPopularRanks((prev) => {
                          const next = [...prev];
                          next[idx] = null;
                          return next;
                        });
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
                      aria-label="제거"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 카테고리 관리 SubSection ──────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderTree size={16} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">카테고리 관리</h2>
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {categories.length}개
            </span>
          </div>
        </div>

        {/* 카테고리 목록 */}
        <div className="divide-y divide-border">
          {categories.map((cat) => {
            const isEditing = categoryEditState?.id === cat.id;
            const productCount = productCountByCategory[cat.id] ?? 0;

            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* 정렬 아이콘 */}
                <GripVertical size={15} className="shrink-0 text-muted-foreground/40" />

                {/* 정렬 순서 */}
                {isEditing ? (
                  <Input
                    type="number"
                    value={categoryEditState.sort_order}
                    onChange={(e) =>
                      setCategoryEditState((prev) =>
                        prev ? { ...prev, sort_order: Number(e.target.value) } : null
                      )
                    }
                    className="h-7 w-14 text-center text-[14px]"
                  />
                ) : (
                  <span className="w-14 text-center text-[14px] font-mono text-muted-foreground">
                    {String(cat.sort_order).padStart(2, "0")}
                  </span>
                )}

                {/* 카테고리 이름 + 서브타이틀 */}
                {isEditing ? (
                  <div className="flex flex-1 gap-2">
                    <Input
                      value={categoryEditState.name}
                      onChange={(e) =>
                        setCategoryEditState((prev) =>
                          prev ? { ...prev, name: e.target.value } : null
                        )
                      }
                      placeholder="카테고리 이름"
                      className="h-7 flex-1 text-[14px]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveCategoryEdit();
                        if (e.key === "Escape") setCategoryEditState(null);
                      }}
                    />
                    <Input
                      value={categoryEditState.subtitle}
                      onChange={(e) =>
                        setCategoryEditState((prev) =>
                          prev ? { ...prev, subtitle: e.target.value } : null
                        )
                      }
                      placeholder="서브타이틀 (영문)"
                      className="h-7 w-52 text-[14px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveCategoryEdit();
                        if (e.key === "Escape") setCategoryEditState(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground">
                      {cat.name}
                    </span>
                    {cat.subtitle && (
                      <span className="text-[11px] text-muted-foreground">
                        ({cat.subtitle})
                      </span>
                    )}
                  </div>
                )}

                {/* 상품 수 뱃지 */}
                <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  상품 {productCount}개
                </span>

                {/* 표시 여부 토글 */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={cat.is_visible}
                    onCheckedChange={() => handleToggleCategoryVisible(cat.id)}
                    aria-label={cat.is_visible ? "표시 중" : "숨김"}
                  />
                  {cat.is_visible ? (
                    <Eye size={13} className="text-success" />
                  ) : (
                    <EyeOff size={13} className="text-muted-foreground" />
                  )}
                </div>

                {/* 편집/삭제 */}
                {isEditing ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      onClick={handleSaveCategoryEdit}
                      disabled={categorySaving}
                      className="h-7 px-3 text-[14px] bg-primary text-white hover:bg-brand-primary-dark"
                    >
                      {categorySaving ? "저장 중..." : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCategoryEditState(null)}
                      className="h-7 px-3 text-[14px]"
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryEditState({
                          id: cat.id,
                          name: cat.name,
                          subtitle: cat.subtitle || "",
                          sort_order: cat.sort_order,
                        })
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-brand-primary-soft hover:text-primary transition-colors"
                      aria-label="카테고리 수정"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryDeleteTarget(cat)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
                      aria-label="카테고리 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 카테고리 추가 */}
        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="새 카테고리 이름"
            className="h-9 flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddCategory}
            disabled={!newCategoryName.trim() || categorySaving}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark text-[14px]"
          >
            <Plus size={14} />
            {categorySaving ? "추가 중..." : "추가"}
          </Button>
        </div>
      </section>

      {/* ── 상품 등록/수정 모달 ──────────────────────────────────── */}
      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        product={editTarget}
        categories={categories}
        onSave={handleSaveProduct}
      />

      {/* ── 상품 삭제 확인 다이얼로그 ────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>상품 삭제</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                &ldquo;{deleteTarget?.name}&rdquo; 상품을 삭제하시겠습니까?
                {deleteTarget && (deleteTarget.pin_stock_waiting + deleteTarget.pin_stock_assigned + deleteTarget.pin_stock_consumed + deleteTarget.pin_stock_returned) > 0 && (
                  <p className="mt-2 text-destructive font-medium">
                    등록된 핀 {deleteTarget.pin_stock_waiting + deleteTarget.pin_stock_assigned + deleteTarget.pin_stock_consumed + deleteTarget.pin_stock_returned}개가 함께 삭제됩니다.
                  </p>
                )}
                <p className="mt-1 text-muted-foreground">연결된 주문/선물 이력의 상품 정보가 해제됩니다. 삭제 후 복구할 수 없습니다.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteProduct} disabled={deleteLoading}>
              {deleteLoading ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 카테고리 삭제 확인 다이얼로그 ──────────────────────── */}
      <AlertDialog open={!!categoryDeleteTarget} onOpenChange={(v) => { if (!v) setCategoryDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>카테고리 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{categoryDeleteTarget?.name}&rdquo; 카테고리를 삭제하시겠습니까?
              <br />
              소속 상품이 있으면 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryDeleteTarget(null)} disabled={categorySaving}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteCategory} disabled={categorySaving}>
              {categorySaving ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
