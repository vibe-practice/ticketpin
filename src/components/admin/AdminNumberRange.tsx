"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

export interface AdminNumberRangeProps {
  value?: NumberRangeValue;
  onChange?: (value: NumberRangeValue) => void;
  label?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  /** 입력 단위 표시 (예: "원", "건") */
  unit?: string;
  /** 최솟값 하한 */
  min?: number;
  /** 최댓값 상한 */
  max?: number;
  className?: string;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function parseNum(v: string): number | undefined {
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return isNaN(n) || v === "" ? undefined : n;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminNumberRange({
  value,
  onChange,
  label,
  minPlaceholder = "최솟값",
  maxPlaceholder = "최댓값",
  unit,
  min,
  max,
  className,
}: AdminNumberRangeProps) {
  const [localMin, setLocalMin] = useState(
    value?.min != null ? String(value.min) : ""
  );
  const [localMax, setLocalMax] = useState(
    value?.max != null ? String(value.max) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const current = value ?? {
    min: parseNum(localMin),
    max: parseNum(localMax),
  };

  const validate = useCallback(
    (minVal?: number, maxVal?: number): string | null => {
      if (minVal != null && maxVal != null && minVal > maxVal) {
        return "최솟값이 최댓값보다 클 수 없습니다";
      }
      if (min != null && minVal != null && minVal < min) {
        return `최솟값은 ${min} 이상이어야 합니다`;
      }
      if (max != null && maxVal != null && maxVal > max) {
        return `최댓값은 ${max} 이하여야 합니다`;
      }
      return null;
    },
    [min, max]
  );

  const handleMinChange = (raw: string) => {
    setLocalMin(raw);
    const minVal = parseNum(raw);
    const maxVal = parseNum(localMax) ?? current.max;
    const err = validate(minVal, maxVal);
    setError(err);
    if (!err) onChange?.({ min: minVal, max: maxVal });
  };

  const handleMaxChange = (raw: string) => {
    setLocalMax(raw);
    const maxVal = parseNum(raw);
    const minVal = parseNum(localMin) ?? current.min;
    const err = validate(minVal, maxVal);
    setError(err);
    if (!err) onChange?.({ min: minVal, max: maxVal });
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}

      <div className="flex items-center gap-1.5">
        {/* 최소 */}
        <div className="relative flex-1">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={minPlaceholder}
            value={localMin}
            min={min}
            max={current.max}
            onChange={(e) => handleMinChange(e.target.value)}
            className={cn(
              "h-9 text-sm",
              unit && "pr-8",
              error && "border-error focus-visible:ring-error/30"
            )}
          />
          {unit && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        {/* 구분자 */}
        <span className="shrink-0 text-sm font-medium text-muted-foreground">~</span>

        {/* 최대 */}
        <div className="relative flex-1">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={maxPlaceholder}
            value={localMax}
            min={current.min}
            max={max}
            onChange={(e) => handleMaxChange(e.target.value)}
            className={cn(
              "h-9 text-sm",
              unit && "pr-8",
              error && "border-error focus-visible:ring-error/30"
            )}
          />
          {unit && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* 유효성 에러 */}
      {error && (
        <p className="text-[11px] text-error">{error}</p>
      )}
    </div>
  );
}
