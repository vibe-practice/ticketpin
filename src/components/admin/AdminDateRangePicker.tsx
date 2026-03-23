"use client";

import { useState, useCallback } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface DateRange {
  from: string | null; // "YYYY-MM-DD"
  to: string | null;   // "YYYY-MM-DD"
}

export interface QuickOption {
  label: string;
  days: number | null; // null = 전체 기간
}

export interface AdminDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function formatDisplay(range: DateRange): string {
  if (!range.from && !range.to) return "";
  if (range.from && range.to) {
    if (range.from === range.to) return range.from;
    return `${range.from} ~ ${range.to}`;
  }
  if (range.from) return `${range.from} ~`;
  return `~ ${range.to}`;
}

const QUICK_OPTIONS: QuickOption[] = [
  { label: "오늘", days: 0 },
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
  { label: "최근 90일", days: 90 },
];

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminDateRangePicker({
  value,
  onChange,
  placeholder = "기간 선택",
  className,
  label,
}: AdminDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [localRange, setLocalRange] = useState<DateRange>(
    value ?? { from: null, to: null }
  );
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  const currentRange = value ?? localRange;

  const updateRange = useCallback(
    (range: DateRange) => {
      setLocalRange(range);
      onChange?.(range);
    },
    [onChange]
  );

  const handleQuickSelect = (opt: QuickOption) => {
    setActiveQuick(opt.label);
    if (opt.days === null) {
      updateRange({ from: null, to: null });
    } else if (opt.days === 0) {
      const t = today();
      updateRange({ from: t, to: t });
    } else {
      updateRange({ from: daysAgo(opt.days), to: today() });
    }
  };

  const handleFromChange = (v: string) => {
    setActiveQuick(null);
    const newRange = { ...currentRange, from: v || null };
    // from > to 시 to 초기화
    if (newRange.from && newRange.to && newRange.from > newRange.to) {
      newRange.to = null;
    }
    updateRange(newRange);
  };

  const handleToChange = (v: string) => {
    setActiveQuick(null);
    const newRange = { ...currentRange, to: v || null };
    updateRange(newRange);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveQuick(null);
    updateRange({ from: null, to: null });
  };

  const displayText = formatDisplay(currentRange);
  const hasValue = !!(currentRange.from || currentRange.to);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full justify-between gap-2 px-3 text-left font-normal",
              !hasValue && "text-muted-foreground"
            )}
            aria-label="날짜 범위 선택"
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarDays size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">
                {displayText || placeholder}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {hasValue && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateRange({ from: null, to: null });
                    }
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-muted"
                  aria-label="날짜 초기화"
                >
                  <X size={11} />
                </span>
              )}
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="start">
          {/* 빠른 선택 */}
          <div className="border-b border-border px-3 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              빠른 선택
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleQuickSelect(opt)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all",
                    activeQuick === opt.label
                      ? "bg-primary text-white"
                      : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 직접 입력 */}
          <div className="p-3">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              직접 입력
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">
                  시작일
                </label>
                <input
                  type="date"
                  value={currentRange.from ?? ""}
                  max={currentRange.to ?? undefined}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <span className="mt-5 text-xs text-muted-foreground">~</span>
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-muted-foreground">
                  종료일
                </label>
                <input
                  type="date"
                  value={currentRange.to ?? ""}
                  min={currentRange.from ?? undefined}
                  max={today()}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* 선택된 기간 배지 */}
          {hasValue && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
              <Badge
                variant="outline"
                className="border-primary/20 bg-brand-primary-soft text-primary text-[11px]"
              >
                {displayText}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setActiveQuick(null);
                  updateRange({ from: null, to: null });
                }}
              >
                초기화
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
