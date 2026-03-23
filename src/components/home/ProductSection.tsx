"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProductWithCategory, Category } from "@/types";
import { cn } from "@/lib/utils";

interface ProductSectionProps {
  title: string;
  subtitle: string;
  products: ProductWithCategory[];
  viewAllHref?: string;
  viewAllLabel?: string;
  categories?: Pick<Category, "id" | "name" | "slug">[];
}

export function ProductSection({
  title,
  subtitle,
  products,
  viewAllHref,
  viewAllLabel = "전체보기",
  categories = [],
}: ProductSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (products.length === 0) return null;

  const tabs = [
    { id: null, name: "전체" },
    ...categories.map((c) => ({ id: c.id, name: c.name })),
  ];

  const filtered = activeCategory
    ? products.filter((p) => p.category.id === activeCategory)
    : products;

  return (
    <section className="py-8 lg:py-10">
      {/* 섹션 헤더 */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="mb-1 text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {subtitle}
          </p>
          <h2 className="text-[20px] font-bold tracking-[-0.025em] text-foreground lg:text-[22px]">
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-0.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {viewAllLabel}
            <ChevronRight size={14} strokeWidth={2} />
          </Link>
        )}
      </div>

      {/* 카테고리 탭 (다중 카테고리일 때만 표시) */}
      {tabs.length > 1 && categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id ?? "all"}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-all duration-150",
                activeCategory === tab.id
                  ? "bg-neutral-950 text-white"
                  : "border border-neutral-200 bg-white text-secondary-foreground hover:bg-neutral-100"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* 상품 그리드 4개/줄 */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-[15px] text-muted-foreground">
          해당 카테고리에 상품이 없습니다.
        </div>
      )}

      {/* 전체 보기 버튼 */}
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mt-5 flex items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white py-3 text-[15px] font-semibold text-secondary-foreground transition-all hover:border-neutral-400 hover:text-foreground"
        >
          전체 보기
          <ChevronRight size={15} strokeWidth={2} />
        </Link>
      )}
    </section>
  );
}
