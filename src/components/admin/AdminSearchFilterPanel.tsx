"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Filter, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface AdminSearchFilterPanelProps {
  /** 검색 Input placeholder */
  searchPlaceholder?: string;
  /** 검색어 */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  /** 필터 영역 children */
  children?: React.ReactNode;
  /** 적용된 필터 칩 목록 */
  activeFilters?: ActiveFilterChip[];
  /** 결과 건수 */
  resultCount?: number;
  /** 필터 적용 버튼 */
  onApply?: () => void;
  /** 초기화 버튼 */
  onReset?: () => void;
  /** 초기 펼침 상태 */
  defaultOpen?: boolean;
  className?: string;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminSearchFilterPanel({
  searchPlaceholder = "검색어를 입력하세요",
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  children,
  activeFilters = [],
  resultCount,
  onApply,
  onReset,
  defaultOpen = false,
  className,
}: AdminSearchFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 searchValue 동기화
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchChange = (v: string) => {
    setLocalSearch(v);
    onSearchChange?.(v);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchSubmit?.(localSearch);
    }
  };

  const hasActiveFilters = activeFilters.length > 0;
  const hasChildren = !!children;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* 상단: 검색 + 토글 버튼 */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* 검색 인풋 */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-9 pl-9 text-sm"
          />
        </div>

        {/* 검색 버튼 */}
        <Button
          size="sm"
          className="h-9 px-4"
          onClick={() => onSearchSubmit?.(localSearch)}
        >
          <Search size={14} className="mr-1.5" />
          검색
        </Button>

        {/* 필터 토글 (children이 있을 때만) */}
        {hasChildren && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-1.5 px-3 transition-colors",
              isOpen && "border-primary text-primary"
            )}
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
          >
            <Filter size={14} />
            <span className="text-xs font-medium">필터</span>
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {activeFilters.length}
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        )}
      </div>

      {/* 필터 패널 */}
      <div
        className={cn(
          "transition-all duration-200",
          isOpen ? "max-h-[600px] opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden"
        )}
        aria-hidden={!isOpen}
      >
        <div className="border-t border-border px-4 pb-4 pt-4">
          {/* 필터 children */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {children}
          </div>

          {/* 버튼 영역 */}
          {(onApply || onReset) && (
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
              {onReset && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onReset}
                >
                  <RotateCcw size={13} />
                  초기화
                </Button>
              )}
              {onApply && (
                <Button size="sm" className="h-8 gap-1.5 px-4 text-xs" onClick={onApply}>
                  <Check size={13} />
                  필터 적용
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 적용된 필터 칩 + 결과 건수 */}
      {(hasActiveFilters || resultCount !== undefined) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-4 py-2.5",
            isOpen
              ? "border-t border-dashed border-border/60"
              : "border-t border-border"
          )}
        >
          {/* 결과 건수 */}
          {resultCount !== undefined && (
            <span className="text-xs text-muted-foreground">
              검색결과{" "}
              <span className="font-semibold text-primary">
                {resultCount.toLocaleString()}
              </span>
              건
            </span>
          )}

          {/* 구분 */}
          {hasActiveFilters && resultCount !== undefined && (
            <span className="text-border">|</span>
          )}

          {/* 필터 칩 */}
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-brand-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary"
            >
              <span className="text-primary/60">{filter.label}:</span>
              {filter.value}
              <button
                type="button"
                onClick={filter.onRemove}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                aria-label={`${filter.label} 필터 제거`}
              >
                <svg viewBox="0 0 8 8" width="8" height="8" fill="none">
                  <path
                    d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ))}

          {/* 전체 초기화 */}
          {hasActiveFilters && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => activeFilters.forEach((f) => f.onRemove())}
            >
              전체 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
