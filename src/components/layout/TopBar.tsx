"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, LogIn, LogOut, Menu, Search, User as UserIcon, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── 최근 검색어 유틸 ──────────────────────────────────────────────────────────

const RECENT_SEARCH_KEY = "ticketpin_recent_searches";
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function addRecentSearch(keyword: string) {
  try {
    const trimmed = keyword.slice(0, 100);
    const searches = getRecentSearches().filter((s) => s !== trimmed);
    searches.unshift(trimmed);
    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch { /* ignore */ }
}

function removeRecentSearch(keyword: string) {
  try {
    const searches = getRecentSearches().filter((s) => s !== keyword);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(searches));
  } catch { /* ignore */ }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCH_KEY);
  } catch { /* ignore */ }
}

// ─── TopBar ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, isLoading } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const openSearch = useCallback(() => {
    setRecentSearches(getRecentSearches());
    setIsSearchOpen(true);
  }, []);

  const executeSearch = useCallback(
    (keyword: string) => {
      const q = keyword.trim();
      if (!q) return;
      addRecentSearch(q);
      setSearchQuery("");
      setIsSearchOpen(false);
      router.push(`/category?q=${encodeURIComponent(q)}`);
    },
    [router]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      executeSearch(searchQuery);
    },
    [searchQuery, executeSearch]
  );

  const handleRemoveRecent = useCallback((keyword: string) => {
    removeRecentSearch(keyword);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearAll = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isSearchOpen, closeSearch]);

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-12">
        {/* 왼쪽: 햄버거(모바일) + 검색바(데스크탑) */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="메뉴 열기"
          >
            <Menu size={26} strokeWidth={2.5} />
          </Button>

          <form onSubmit={handleSearch} className="relative hidden w-72 max-w-[50vw] sm:w-80 lg:block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="상품권을 검색하세요..."
              aria-label="상품권 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
        </div>

        {/* 가운데: 로고(모바일만) */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-primary lg:hidden"
        >
          티켓핀
        </Link>

        {/* 오른쪽 */}
        <div className="flex shrink-0 items-center gap-2">
          {/* 모바일: 검색 아이콘 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openSearch}
            className="lg:hidden"
            aria-label="검색"
          >
            <Search size={26} strokeWidth={2.5} />
          </Button>

          {/* 데스크탑: 인증 상태에 따른 UI */}
          {!isLoading && (
            user ? (
              <>
                <Link
                  href="/my"
                  className="hidden h-10 items-center gap-2 rounded-md px-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
                >
                  <UserIcon size={20} />
                  마이페이지
                </Link>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="hidden lg:flex"
                >
                  <LogOut size={18} />
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="hidden h-10 items-center gap-2 rounded-md px-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
                >
                  <UserPlus size={20} />
                  회원가입
                </Link>
                <Button asChild className="hidden lg:flex">
                  <Link href="/auth/login">
                    <LogIn size={18} />
                    로그인
                  </Link>
                </Button>
              </>
            )
          )}
        </div>
      </header>

      {/* 검색 모달 (모바일) */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="상품권 검색"
        >
          {/* 블러 배경 */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={closeSearch}
          >
            {/* 패널 — 클릭 버블 차단 */}
            <div
              className="animate-in fade-in zoom-in-95 duration-200 mx-4 w-full max-w-sm rounded-3xl bg-card shadow-2xl px-5 pt-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
            {/* 상단: 닫기 */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">검색</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closeSearch}
                className="rounded-full bg-accent"
                aria-label="닫기"
              >
                <X size={16} />
              </Button>
            </div>

            {/* 검색 입력창 */}
            <form onSubmit={handleSearch} className="relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-primary"
              />
              <Input
                type="search"
                placeholder="상품권을 검색하세요..."
                aria-label="상품권 검색"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 rounded-2xl border-2 border-primary/30 pl-12 text-base focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
              />
            </form>

            {/* 최근 검색어 */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                  <Clock size={13} />
                  최근 검색어
                </p>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[12px] text-muted-foreground/70 hover:text-destructive transition-colors"
                  >
                    전체 삭제
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground/60">
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
                      className="group inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-brand-primary-muted"
                    >
                      <span className="hover:text-primary transition-colors">
                        {keyword}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRecent(keyword);
                        }}
                        className="ml-0.5 rounded-full p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`${keyword} 삭제`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
