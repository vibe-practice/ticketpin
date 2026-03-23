"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, PackageSearch } from "lucide-react";
import type { Category, ProductWithCategory } from "@/types";
import { ProductCard } from "@/components/home/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SortKey = "popular" | "price_asc" | "price_desc" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "price_asc", label: "낮은 가격순" },
  { value: "price_desc", label: "높은 가격순" },
  { value: "newest", label: "최신순" },
];

interface CategoryListClientProps {
  categories: Category[];
  allProducts: ProductWithCategory[];
  initialSlug: string | null; // null = "전체"
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

  // URL의 q 파라미터가 변경되면 검색어 state 동기화
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const activeCategory = categories.find((c) => c.slug === initialSlug) ?? null;

  const handleCategoryChange = (slug: string | null) => {
    if (slug === null) {
      router.push("/category");
    } else {
      router.push(`/category/${slug}`);
    }
  };

  const filteredProducts = useMemo(() => {
    let list = allProducts.filter((p) => p.status === "active" || p.status === "soldout");

    // 카테고리 필터
    if (activeCategory) {
      list = list.filter((p) => p.category_id === activeCategory.id);
    }

    // 검색 필터
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.name.toLowerCase().includes(q)
      );
    }

    // 정렬
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

  return (
    <div className="px-4 py-6 lg:px-6">
      {/* 페이지 제목 */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">
          {activeCategory ? activeCategory.name : "상품권 전체"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          총 {filteredProducts.length}개 상품
        </p>
      </div>

      {/* 카테고리 탭 (ChipGroup) */}
      <div className="mb-5 -mx-4 lg:-mx-6">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 lg:px-6 scrollbar-hide">
          {/* 전체 탭 */}
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            onClick={() => handleCategoryChange(null)}
            className="flex-shrink-0 rounded-full px-4 py-2 h-auto text-sm font-medium"
          >
            전체
          </Button>

          {categories
            .filter((c) => c.is_visible)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory?.id === cat.id ? "default" : "outline"}
                onClick={() => handleCategoryChange(cat.slug)}
                className="flex-shrink-0 rounded-full px-4 py-2 h-auto text-sm font-medium"
              >
                {cat.name}
              </Button>
            ))}
        </div>
      </div>

      {/* 검색 + 정렬 컨트롤 */}
      <div className="mb-5 flex gap-3">
        {/* 검색 바 */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품권 검색..."
            className="h-10 pl-9"
          />
        </div>

        {/* 정렬 Select */}
        <div className="relative flex-shrink-0">
          <SlidersHorizontal
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 appearance-none rounded-lg border border-border bg-card pl-8 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 상품 그리드 / 빈 상태 */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageSearch size={48} className="mb-4 text-muted-foreground/40" />
          <p className="text-base font-medium text-foreground">
            검색 결과가 없습니다
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? `"${query}"에 해당하는 상품권이 없습니다.`
              : "해당 카테고리에 상품이 없습니다."}
          </p>
          {query && (
            <Button
              variant="outline"
              onClick={() => setQuery("")}
              className="mt-4 rounded-full"
            >
              검색어 초기화
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
