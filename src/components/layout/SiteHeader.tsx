"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  User as UserIcon,
  LogIn,
  LogOut,
  UserPlus,
  Menu,
  X,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

// ─── 최근 검색어 유틸 ───────────────────────────────────────────────

const RECENT_SEARCH_KEY = "ticketpin_recent_searches";
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch { return []; }
}

function addRecentSearch(keyword: string) {
  try {
    const trimmed = keyword.slice(0, 100);
    const searches = getRecentSearches().filter((s) => s !== trimmed);
    searches.unshift(trimmed);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)));
  } catch { /* ignore */ }
}

function removeRecentSearch(keyword: string) {
  try {
    const searches = getRecentSearches().filter((s) => s !== keyword);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(searches));
  } catch { /* ignore */ }
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCH_KEY); } catch { /* ignore */ }
}

// ─── 네비 데이터 ──────────────────────────────────────────────────────

const UTILITY_NAV = [
  { label: "이용방법", href: "/guide" },
  { label: "FAQ", href: "/support/faq" },
  { label: "공지사항", href: "/support/notice" },
];

// ─── SiteHeader ──────────────────────────────────────────────────────

interface SiteHeaderProps {
  categories?: Category[];
  isScrolled?: boolean;
  isVisible?: boolean;
}

export function SiteHeader({ categories = [], isScrolled = false, isVisible = true }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();

  // 검색
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 모바일 메뉴
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 카테고리 드롭다운
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const visibleCategories = categories
    .filter((c) => c.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  // 카테고리 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 검색 열기/닫기
  const openSearch = useCallback(() => {
    setRecentSearches(getRecentSearches());
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
  }, []);

  const executeSearch = useCallback((keyword: string) => {
    const q = keyword.trim();
    if (!q) return;
    addRecentSearch(q);
    setSearchQuery("");
    closeSearch();
    router.push(`/category?q=${encodeURIComponent(q)}`);
  }, [router, closeSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  const handleRemoveRecent = useCallback((keyword: string) => {
    removeRecentSearch(keyword);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearAll = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // ESC 키
  useEffect(() => {
    if (!isSearchOpen && !isMobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isSearchOpen, isMobileMenuOpen, closeSearch]);

  // 모바일 메뉴 body scroll 잠금
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await useAuthStore.getState().logout();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* ─── 메인 헤더 ─────────────────────────────────────── */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300",
          isScrolled ? "border-b border-neutral-200 shadow-[0_1px_8px_0_rgb(0_0_0/0.06)]" : "border-b border-neutral-100",
          isVisible ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="container-main flex h-[60px] items-center justify-between gap-4">
          {/* 로고 */}
          <Link
            href="/"
            className="flex-shrink-0 text-[24px] font-bold tracking-[-0.04em] text-foreground transition-opacity hover:opacity-70"
          >
            티켓핀
          </Link>

          {/* 중앙: 검색창 (데스크탑) */}
          <form
            onSubmit={handleSearch}
            className="hidden lg:flex flex-1 max-w-xl mx-6"
          >
            <div className="relative w-full">
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="상품권을 검색하세요"
                aria-label="상품권 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={openSearch}
                className="h-10 w-full rounded-full border-neutral-200 bg-neutral-50 pl-11 pr-4 text-[15px] focus-visible:border-neutral-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-neutral-400"
              />
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </form>

          {/* 우측: 검색(모바일) + 인증 (데스크탑) + 모바일 버튼들 */}
          <div className="flex items-center gap-1.5">
            {/* 검색 버튼 (모바일) */}
            <button
              type="button"
              onClick={openSearch}
              aria-label="검색"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground lg:hidden"
            >
              <Search size={18} strokeWidth={2} />
            </button>

            {/* 데스크탑 인증 UI */}
            {!isLoading && (
              <div className="hidden lg:flex items-center gap-1">
                {user ? (
                  <>
                    <Link
                      href="/my"
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold transition-colors",
                        pathname.startsWith("/my")
                          ? "bg-neutral-100 text-foreground"
                          : "text-secondary-foreground hover:bg-neutral-50 hover:text-foreground"
                      )}
                    >
                      <UserIcon size={16} strokeWidth={2} />
                      마이페이지
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="h-9 rounded-full px-3.5 text-[14px] font-semibold text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
                    >
                      <LogOut size={15} />
                      로그아웃
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/register"
                      className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold text-secondary-foreground transition-colors hover:bg-neutral-50 hover:text-foreground"
                    >
                      <UserPlus size={16} strokeWidth={2} />
                      회원가입
                    </Link>
                    <Button
                      asChild
                      className="h-9 rounded-full px-4 text-[15px] font-semibold"
                    >
                      <Link href="/auth/login">
                        <LogIn size={15} />
                        로그인
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* 모바일 햄버거 */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground lg:hidden"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 검색 오버레이 ──────────────────────────────────── */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="상품권 검색"
        >
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={closeSearch}
          />

          {/* 검색 패널 */}
          <div className="animate-in fade-in zoom-in-95 duration-150 relative mx-4 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            {/* 닫기 */}
            <button
              type="button"
              onClick={closeSearch}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-muted-foreground transition-colors hover:bg-neutral-200"
              aria-label="닫기"
            >
              <X size={14} strokeWidth={2} />
            </button>

            {/* 검색 입력 */}
            <form onSubmit={handleSearch} className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="상품권을 검색하세요..."
                aria-label="상품권 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-xl border-neutral-200 pl-11 pr-4 text-base focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-900"
              />
            </form>

            {/* 최근 검색어 */}
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock size={14} />
                  최근 검색어
                </p>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[14px] text-muted-foreground transition-colors hover:text-secondary-foreground"
                  >
                    전체 삭제
                  </button>
                )}
              </div>

              {recentSearches.length === 0 ? (
                <p className="py-3 text-center text-[14px] text-muted-foreground">
                  최근 검색어가 없습니다
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((keyword) => (
                    <span
                      key={keyword}
                      role="button"
                      tabIndex={0}
                      onClick={() => executeSearch(keyword)}
                      onKeyDown={(e) => { if (e.key === "Enter") executeSearch(keyword); }}
                      className="group inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[14px] text-secondary-foreground transition-all hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveRecent(keyword); }}
                        className="ml-0.5 text-muted-foreground transition-colors hover:text-secondary-foreground"
                        aria-label={`${keyword} 삭제`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 모바일 풀스크린 메뉴 ──────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="모바일 메뉴"
        >
          {/* 배경 */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* 슬라이드인 패널 */}
          <div className="animate-in slide-in-from-right duration-200 absolute right-0 top-0 h-full w-full max-w-[320px] bg-white shadow-2xl flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[22px] font-bold tracking-[-0.04em] text-foreground"
              >
                티켓핀
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="메뉴 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-muted-foreground"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* 인증 영역 */}
            <div className="px-6 py-4 border-b border-neutral-100">
              {!isLoading && (
                user ? (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/my"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-3 text-[15px] font-semibold text-foreground"
                    >
                      <UserIcon size={16} strokeWidth={2} />
                      마이페이지
                    </Link>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="w-full rounded-lg text-[15px] font-semibold"
                    >
                      <LogOut size={15} />
                      로그아웃
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" asChild className="flex-1 rounded-lg text-[15px]">
                      <Link href="/auth/register" onClick={() => setIsMobileMenuOpen(false)}>
                        <UserPlus size={15} />
                        회원가입
                      </Link>
                    </Button>
                    <Button asChild className="flex-1 rounded-lg text-[15px]">
                      <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <LogIn size={15} />
                        로그인
                      </Link>
                    </Button>
                  </div>
                )
              )}
            </div>

            {/* 네비게이션 */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {/* 상품권 카테고리 */}
              <p className="px-3 pb-1.5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
                상품권
              </p>
              <Link
                href="/category"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center rounded-lg px-3 py-3 text-[15px] font-semibold transition-colors",
                  pathname === "/category" ? "bg-neutral-100 text-foreground" : "text-secondary-foreground hover:bg-neutral-50 hover:text-foreground"
                )}
              >
                전체 상품권
              </Link>
              {visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-3 text-[15px] font-medium transition-colors",
                    pathname === `/category/${cat.slug}` ? "bg-neutral-100 text-foreground font-semibold" : "text-secondary-foreground hover:bg-neutral-50 hover:text-foreground"
                  )}
                >
                  {cat.name}
                </Link>
              ))}

              <div className="my-3 border-t border-neutral-100" />

              {/* 유틸 네비 */}
              <p className="px-3 pb-1.5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
                정보
              </p>
              {UTILITY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-3 text-[15px] font-medium transition-colors",
                    pathname === item.href ? "bg-neutral-100 text-foreground font-semibold" : "text-secondary-foreground hover:bg-neutral-50 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
