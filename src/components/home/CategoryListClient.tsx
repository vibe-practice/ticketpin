"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Check, Home, PackageSearch, X } from "lucide-react";
import type { Category, ProductWithCategory } from "@/types";
import { ProductCard } from "@/components/home/ProductCard";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type SortKey = "popular" | "newest" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "newest", label: "최근등록순" },
  { value: "price_asc", label: "낮은가격순" },
  { value: "price_desc", label: "높은가격순" },
];

const PAGE_SIZE = 16;

interface CategoryListClientProps {
  categories: Category[];
  allProducts: ProductWithCategory[];
  initialSlug: string | null;
  initialQuery?: string;
}

export function CategoryListClient({
  categories,
  allProducts,
  initialSlug,
  initialQuery = "",
}: CategoryListClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>("popular");
  const [currentPage, setCurrentPage] = useState(1);

  // 카테고리 탭 스크롤
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const activeCategory = categories.find((c) => c.slug === initialSlug) ?? null;

  const handleCategoryChange = useCallback(
    (slug: string | null) => {
      setCurrentPage(1);
      setQuery("");
      if (slug === null) {
        router.push("/category");
      } else {
        router.push(`/category/${slug}`);
      }
    },
    [router]
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setCurrentPage(1);
  };

  const handleSortChange = (val: SortKey) => {
    setSort(val);
    setCurrentPage(1);
  };

  const scrollTabs = (dir: "left" | "right") => {
    if (!tabScrollRef.current) return;
    tabScrollRef.current.scrollBy({
      left: dir === "left" ? -200 : 200,
      behavior: "smooth",
    });
  };

  // 필터 + 정렬된 상품 목록
  const filteredProducts = useMemo(() => {
    let list = allProducts.filter(
      (p) => p.status === "active" || p.status === "soldout"
    );

    if (activeCategory) {
      list = list.filter((p) => p.category_id === activeCategory.id);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.name.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "popular":
        return [...list].sort((a, b) => b.total_sales - a.total_sales);
      case "price_asc":
        return [...list].sort((a, b) => a.price - b.price);
      case "price_desc":
        return [...list].sort((a, b) => b.price - a.price);
      case "newest":
        return [...list].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [allProducts, activeCategory, query, sort]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const visibleCategories = categories
    .filter((c) => c.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  const pageTitle = activeCategory ? activeCategory.name : "전체상품";

  return (
    <div className="min-h-screen bg-background">
      {/* 브레드크럼 */}
      <div className="border-b border-border bg-white">
        <div className="container-main">
          <nav
            aria-label="브레드크럼"
            className="flex items-center gap-1.5 py-3 text-[14px]"
          >
            <Link
              href="/"
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Home size={14} strokeWidth={2} />
              <span>HOME</span>
            </Link>
            <ChevronRight size={13} className="text-muted-foreground" strokeWidth={2} />
            {activeCategory ? (
              <>
                <Link
                  href="/category"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  전체상품
                </Link>
                <ChevronRight size={13} className="text-muted-foreground" strokeWidth={2} />
                <span className="font-semibold text-foreground">
                  {activeCategory.name}
                </span>
              </>
            ) : (
              <span className="font-semibold text-foreground">전체상품</span>
            )}
          </nav>
        </div>
      </div>

      <div className="container-main py-6 lg:py-8">
        {/* 카테고리 탭 */}
        <div className="relative mb-6 flex items-center gap-2">
          {/* 왼쪽 화살표 — 모바일 숨김 */}
          <button
            onClick={() => scrollTabs("left")}
            aria-label="왼쪽으로 스크롤"
            className="hidden sm:flex flex-shrink-0 h-9 w-9 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-all hover:border-neutral-400 hover:shadow-md active:scale-95"
          >
            <ChevronLeft size={16} strokeWidth={2.5} className="text-secondary-foreground" />
          </button>

          {/* 탭 스크롤 영역 */}
          <div
            ref={tabScrollRef}
            className="flex flex-1 gap-2 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* 전체 탭 */}
            <button
              onClick={() => handleCategoryChange(null)}
              className={cn(
                "flex-shrink-0 h-9 px-5 rounded-full text-[14px] font-medium transition-all duration-150",
                activeCategory === null
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "border border-border bg-white text-secondary-foreground hover:border-neutral-400 hover:text-foreground"
              )}
            >
              전체
            </button>

            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={cn(
                  "flex-shrink-0 h-9 px-5 rounded-full text-[14px] font-medium transition-all duration-150",
                  activeCategory?.id === cat.id
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "border border-border bg-white text-secondary-foreground hover:border-neutral-400 hover:text-foreground"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* 오른쪽 화살표 — 모바일 숨김 */}
          <button
            onClick={() => scrollTabs("right")}
            aria-label="오른쪽으로 스크롤"
            className="hidden sm:flex flex-shrink-0 h-9 w-9 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-all hover:border-neutral-400 hover:shadow-md active:scale-95"
          >
            <ChevronRight size={16} strokeWidth={2.5} className="text-secondary-foreground" />
          </button>
        </div>

        {/* 결과 헤더 — 상품 수 + 검색 + 정렬 */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* 왼쪽: 상품 수 + 검색 */}
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-foreground">
              총{" "}
              <span className="text-[15px] font-bold text-foreground">
                {filteredProducts.length}
              </span>
              개의 상품
            </span>

            {/* 결과 내 재검색 */}
            <div className="relative w-[200px] sm:w-[240px]">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="결과 내 재검색"
                className="h-9 rounded-full border-border bg-neutral-50 pl-8 pr-8 text-[14px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-neutral-400"
              />
              {query && (
                <button
                  onClick={() => handleQueryChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="검색어 지우기"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 정렬 옵션 텍스트 버튼 */}
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((opt, i) => (
              <span key={opt.value} className="flex items-center">
                <button
                  onClick={() => handleSortChange(opt.value)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[14px] transition-colors",
                    sort === opt.value
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground hover:text-secondary-foreground"
                  )}
                >
                  {sort === opt.value && (
                    <Check size={12} strokeWidth={3} className="text-foreground" />
                  )}
                  {opt.label}
                </button>
                {i < SORT_OPTIONS.length - 1 && (
                  <span className="text-muted-foreground select-none">|</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* 상품 그리드 / 빈 상태 */}
        {pagedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {pagedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
              <PackageSearch size={28} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-[16px] font-semibold text-foreground">
              {query ? "검색 결과가 없습니다" : "상품이 없습니다"}
            </p>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              {query
                ? `"${query}"에 해당하는 상품권이 없습니다.`
                : `${pageTitle}에 등록된 상품이 없습니다.`}
            </p>
            {query && (
              <button
                onClick={() => handleQueryChange("")}
                className="mt-5 flex h-9 items-center gap-1.5 rounded-full border border-border px-5 text-[14px] font-medium text-secondary-foreground transition-colors hover:border-neutral-400 hover:text-foreground"
              >
                <X size={13} strokeWidth={2.5} />
                검색어 초기화
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
