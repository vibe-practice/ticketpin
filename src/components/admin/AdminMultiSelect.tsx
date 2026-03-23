"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
  /** 옵션 비활성화 */
  disabled?: boolean;
}

export interface AdminMultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  /** 최대 선택 수 */
  maxSelect?: number;
  disabled?: boolean;
  className?: string;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminMultiSelect({
  options,
  value = [],
  onChange,
  placeholder = "항목을 선택하세요",
  searchPlaceholder = "검색...",
  label,
  maxSelect,
  disabled = false,
  className,
}: AdminMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // 외부 클릭 시 닫기 (search 초기화도 이벤트 핸들러에서 직접 처리)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 열릴 때 검색 인풋 포커스 (setState 없이 DOM 조작만)
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // 열기/닫기 — 닫을 때 search 초기화를 이벤트에서 직접 처리
  const handleToggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) {
        // 닫히는 경우 — 동일 이벤트에서 search도 초기화
        setSearch("");
      }
      return !prev;
    });
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  const toggle = useCallback(
    (optValue: string) => {
      if (value.includes(optValue)) {
        onChange?.(value.filter((v) => v !== optValue));
      } else {
        if (maxSelect && value.length >= maxSelect) return;
        onChange?.([...value, optValue]);
      }
    },
    [value, onChange, maxSelect]
  );

  const removeChip = useCallback(
    (optValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(value.filter((v) => v !== optValue));
    },
    [value, onChange]
  );

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.([]);
    },
    [onChange]
  );

  const selectedOptions = useMemo(
    () => options.filter((opt) => value.includes(opt.value)),
    [options, value]
  );

  const hasValue = value.length > 0;
  const reachedMax = maxSelect != null && value.length >= maxSelect;

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={containerRef}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}

      {/* 트리거 */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        aria-label={label ?? placeholder}
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
          if (e.key === "Escape") handleClose();
        }}
        className={cn(
          "relative min-h-9 w-full cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-all",
          "flex flex-wrap items-center gap-1.5",
          open && "border-primary ring-1 ring-primary/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {/* 선택된 칩들 */}
        {hasValue ? (
          <>
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-brand-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => removeChip(opt.value, e)}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                  aria-label={`${opt.label} 제거`}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}

        {/* 우측 버튼들 */}
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          {hasValue && (
            <button
              type="button"
              onClick={clearAll}
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="전체 해제"
            >
              <X size={11} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </span>
      </div>

      {/* 드롭다운 */}
      {open && (
        <div className="relative z-50">
          <div className="absolute top-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {/* 검색 */}
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 pl-7 text-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* 최대 선택 안내 */}
            {reachedMax && (
              <div className="border-b border-border px-3 py-1.5">
                <p className="text-[11px] text-warning">
                  최대 {maxSelect}개까지 선택 가능합니다
                </p>
              </div>
            )}

            {/* 옵션 목록 */}
            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              aria-label={label ?? placeholder}
              className="max-h-48 overflow-y-auto py-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  검색 결과가 없습니다
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  const isDisabled = opt.disabled || (!isSelected && reachedMax);

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) toggle(opt.value);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                        isSelected && "bg-brand-primary-muted text-primary",
                        !isSelected && !isDisabled && "hover:bg-muted/60",
                        isDisabled && "cursor-not-allowed opacity-40"
                      )}
                    >
                      {/* 체크 아이콘 */}
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-border"
                        )}
                      >
                        {isSelected && (
                          <Check size={10} strokeWidth={3} className="text-white" />
                        )}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </li>
                  );
                })
              )}
            </ul>

            {/* 하단 상태 바 */}
            {hasValue && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-primary">{value.length}</span>개 선택됨
                  {maxSelect && (
                    <span className="text-muted-foreground/60"> / 최대 {maxSelect}개</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => clearAll(e)}
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  전체 해제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
