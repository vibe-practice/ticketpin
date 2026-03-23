"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

const UTILITY_NAV = [
  { label: "이용방법", href: "/guide" },
  { label: "FAQ", href: "/support/faq" },
  { label: "공지사항", href: "/support/notice" },
];

interface CategoryNavProps {
  categories: Category[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const pathname = usePathname();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const visibleCategories = categories
    .filter((c) => c.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className="flex items-center gap-1 border-b border-neutral-100 pb-3 mb-4"
      aria-label="카테고리 네비게이션"
    >
      {/* 상품권 카테고리 드롭다운 */}
      <div ref={categoryRef} className="relative">
        <button
          type="button"
          onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors",
            isCategoryOpen
              ? "bg-neutral-100 text-foreground"
              : "text-secondary-foreground hover:bg-neutral-50 hover:text-foreground"
          )}
        >
          전체 카테고리
          <ChevronDown
            size={15}
            className={cn("transition-transform duration-200", isCategoryOpen ? "rotate-180" : "")}
          />
        </button>

        {isCategoryOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-neutral-200 bg-white py-2 shadow-lg z-30">
            <Link
              href="/category"
              onClick={() => setIsCategoryOpen(false)}
              className="flex items-center px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-neutral-50"
            >
              전체 상품권
            </Link>
            <div className="my-1.5 border-t border-neutral-100" />
            {visibleCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                onClick={() => setIsCategoryOpen(false)}
                className={cn(
                  "flex items-center px-4 py-2.5 text-[14px] transition-colors hover:bg-neutral-50",
                  pathname === `/category/${cat.slug}`
                    ? "font-semibold text-foreground"
                    : "font-medium text-secondary-foreground"
                )}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 유틸 네비 */}
      {UTILITY_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors",
            pathname === item.href || pathname.startsWith(item.href + "/")
              ? "text-foreground"
              : "text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
