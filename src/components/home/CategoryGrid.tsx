"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Gift,
  Gamepad2,
  ShoppingBag,
  ShoppingCart,
  Coffee,
  Film,
  Music,
  BookOpen,
  CreditCard,
  Ticket,
  Tag,
  Globe,
  Smartphone,
  Utensils,
  Plane,
  HeartPulse,
  Zap,
  Star,
  Package,
} from "lucide-react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  Gift, Gamepad2, ShoppingBag, ShoppingCart, Coffee, Film, Music,
  BookOpen, CreditCard, Ticket, Tag, Globe, Smartphone, Utensils,
  Plane, HeartPulse, Zap, Star, Package, default: Tag,
};

function CategoryIcon({ iconName, imageUrl, name }: { iconName: string; imageUrl?: string | null; name: string }) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={88}
        height={88}
        className="h-[88px] w-[88px] rounded-full object-cover"
      />
    );
  }
  const IconComponent = ICON_MAP[iconName] ?? ICON_MAP.default;
  return (
    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-neutral-100 text-secondary-foreground transition-all duration-200 group-hover:bg-neutral-900 group-hover:text-white">
      <IconComponent size={36} strokeWidth={1.75} />
    </div>
  );
}

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const visible = categories
    .filter((c) => c.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

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
  }, [checkScroll, visible.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = 120;
    el.scrollBy({
      left: direction === "left" ? -itemWidth : itemWidth,
      behavior: "smooth",
    });
  };

  if (visible.length === 0) return null;

  return (
    <section className="py-6 lg:py-8">
      {/* 섹션 헤더 */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">
          카테고리
        </h2>
        <Link
          href="/category"
          className="flex items-center gap-0.5 text-[15px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          전체보기
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
      </div>

      {/* 카테고리 가로 스크롤 + 좌우 버튼 */}
      <div className="relative flex items-center">
        {/* 좌 버튼 — 모바일에서 숨김 */}
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          aria-label="이전 카테고리"
          className={cn(
            "hidden sm:flex flex-shrink-0 h-10 w-10 items-center justify-center rounded-full border transition-all mr-3",
            canScrollLeft
              ? "border-neutral-300 text-secondary-foreground hover:bg-neutral-100"
              : "border-neutral-100 text-muted-foreground cursor-default"
          )}
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>

        {/* 스크롤 영역 */}
        <div
          ref={scrollRef}
          className="flex flex-1 overflow-x-auto scrollbar-hide"
        >
          {/* 전체 카테고리 */}
          <Link
            href="/category"
            className="group flex w-[calc(100%/3)] sm:w-[calc(100%/4)] lg:w-[calc(100%/6)] flex-shrink-0 flex-col items-center gap-3 py-2"
          >
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-neutral-950 text-white transition-transform duration-200 group-hover:scale-110">
              <Tag size={36} strokeWidth={1.75} />
            </div>
            <span className="whitespace-nowrap text-center text-[14px] font-semibold text-foreground">
              전체
            </span>
          </Link>

          {visible.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group flex w-[calc(100%/3)] sm:w-[calc(100%/4)] lg:w-[calc(100%/6)] flex-shrink-0 flex-col items-center gap-3 py-2"
            >
              <CategoryIcon
                iconName={cat.icon}
                imageUrl={"image_url" in cat ? (cat as unknown as { image_url?: string | null }).image_url : null}
                name={cat.name}
              />
              <span className="whitespace-nowrap text-center text-[14px] font-semibold text-foreground">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

        {/* 우 버튼 — 모바일에서 숨김 */}
        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="다음 카테고리"
          className={cn(
            "hidden sm:flex flex-shrink-0 h-10 w-10 items-center justify-center rounded-full border transition-all ml-3",
            canScrollRight
              ? "border-neutral-300 text-secondary-foreground hover:bg-neutral-100"
              : "border-neutral-100 text-muted-foreground cursor-default"
          )}
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}
