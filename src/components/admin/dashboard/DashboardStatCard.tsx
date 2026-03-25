"use client";

import type React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  title: string;
  value: string;
  subValue?: string;
  changeRate?: number; // 전일/전월 대비 증감률 (%)
  changeLabel?: string; // "전일 대비" | "전월 대비"
  icon: LucideIcon | React.ElementType;
  iconBg?: string; // tailwind bg 클래스
  iconColor?: string; // tailwind text 클래스
  variant?: "default" | "warning" | "danger";
}

export function DashboardStatCard({
  title,
  value,
  subValue,
  changeRate,
  changeLabel = "전일 대비",
  icon: Icon,
  iconBg = "bg-brand-primary-muted",
  iconColor = "text-primary",
  variant = "default",
}: DashboardStatCardProps) {
  const isPositive = changeRate !== undefined && changeRate > 0;
  const isNegative = changeRate !== undefined && changeRate < 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        variant === "warning" && "border-warning/30 bg-warning/5",
        variant === "danger" && "border-error/30 bg-error/5"
      )}
    >
      {/* 배경 장식 */}
      <div
        className={cn(
          "absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10",
          iconBg
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* 좌측: 수치 영역 */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-bold tracking-tight",
              variant === "warning" ? "text-warning" : variant === "danger" ? "text-error" : "text-foreground"
            )}
          >
            {value}
          </p>
          {subValue && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
          )}

          {/* 증감률 */}
          {changeRate !== undefined && (
            <div className="mt-2.5 flex items-center gap-1">
              {isPositive ? (
                <TrendingUp size={13} className="text-success" />
              ) : isNegative ? (
                <TrendingDown size={13} className="text-error" />
              ) : (
                <Minus size={13} className="text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-[14px] font-semibold",
                  isPositive ? "text-success" : isNegative ? "text-error" : "text-muted-foreground"
                )}
              >
                {isPositive ? "+" : ""}
                {Math.abs(changeRate).toFixed(1)}%
              </span>
              <span className="text-[11px] text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </div>

        {/* 우측: 아이콘 */}
        <div
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
            iconBg
          )}
        >
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
