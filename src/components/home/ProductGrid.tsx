"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProductWithCategory } from "@/types";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  title: string;
  products: ProductWithCategory[];
  viewAllHref: string;
}

export function ProductGrid({ title, products, viewAllHref }: ProductGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll, products]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("a")?.offsetWidth ?? 250;
    const scrollAmount = cardWidth + 20;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-8 lg:py-10">
      {/* 섹션 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-[-0.025em] text-foreground">
          {title}
        </h2>

        {/* 좌우 스크롤 버튼 — 항상 표시, 스크롤 가능 시 활성화 */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="이전 상품"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                canScrollLeft
                  ? "border-neutral-300 text-secondary-foreground hover:bg-neutral-100 hover:border-neutral-400"
                  : "border-neutral-100 text-muted-foreground cursor-default"
              )}
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="다음 상품"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                canScrollRight
                  ? "border-neutral-300 text-secondary-foreground hover:bg-neutral-100 hover:border-neutral-400"
                  : "border-neutral-100 text-muted-foreground cursor-default"
              )}
            >
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
      </div>

      {/* 상품 가로 스크롤 — 4개/줄 기준, 넘치면 스크롤 */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide sm:gap-5"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[calc(50%-8px)] flex-shrink-0 sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* 하단 전체보기 버튼 */}
      <Link
        href={viewAllHref}
        className="mt-6 flex items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white py-3.5 text-[15px] font-semibold text-secondary-foreground transition-all hover:border-neutral-400 hover:text-foreground"
      >
        전체보기
        <ChevronRight size={16} strokeWidth={2} />
      </Link>
    </section>
  );
}
