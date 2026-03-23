"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useScrollSlider } from "@/hooks/useScrollSlider";
import { ProductCard } from "./ProductCard";
import { Button } from "@/components/ui/button";
import type { ProductWithCategory } from "@/types";

interface PopularSliderProps {
  products: ProductWithCategory[];
}

export function PopularSlider({ products }: PopularSliderProps) {
  const { scrollRef, canScrollLeft, canScrollRight, scroll } = useScrollSlider();

  if (products.length === 0) return null;

  return (
    <section className="py-10 sm:py-12">
      <div className="mb-6 flex items-end justify-between sm:mb-7">
        <div>
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            MOST POPULAR
          </p>
          <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
            지금 가장 인기있는 상품권
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {(canScrollLeft || canScrollRight) && (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="이전"
                className="rounded-full shadow-sm hover:border-primary hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="다음"
                className="rounded-full shadow-sm hover:border-primary hover:text-primary disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <Link
            href="/category"
            className="flex items-center gap-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            전체보기
            <ChevronRight size={15} strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth sm:gap-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            className="flex-shrink-0 w-[calc(50%-6px)] sm:w-[calc(33.333%-10.667px)] lg:w-[calc(20%-12.8px)]"
          />
        ))}
      </div>
    </section>
  );
}
