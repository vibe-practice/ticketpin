"use client";

import { AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PinStockSummary } from "@/types";

const LOW_STOCK_THRESHOLD = 5;

interface DashboardPinStockProps {
  stocks: PinStockSummary[];
}

function StockBar({ waiting, assigned, total }: { waiting: number; assigned: number; total: number }) {
  const waitingPct = total > 0 ? (waiting / total) * 100 : 0;
  const assignedPct = total > 0 ? (assigned / total) * 100 : 0;
  const consumedPct = Math.max(0, 100 - waitingPct - assignedPct);

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="bg-success transition-all duration-300"
        style={{ width: `${waitingPct}%` }}
        title={`대기 ${waiting}개`}
      />
      <div
        className="bg-info transition-all duration-300"
        style={{ width: `${assignedPct}%` }}
        title={`할당 ${assigned}개`}
      />
      <div
        className="bg-muted-foreground/20 transition-all duration-300"
        style={{ width: `${consumedPct}%` }}
        title={`소진됨`}
      />
    </div>
  );
}

export function DashboardPinStock({ stocks }: DashboardPinStockProps) {
  const lowStockItems = stocks.filter((s) => s.waiting <= LOW_STOCK_THRESHOLD);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">핀 재고 현황</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">상품별 대기/할당/소진</p>
        </div>
        {lowStockItems.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-error-bg px-2 py-0.5 text-[11px] font-semibold text-error">
            <AlertTriangle size={11} />
            {lowStockItems.length}건 부족
          </span>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 border-b border-border px-5 py-2.5">
        {[
          { color: "bg-success", label: "대기" },
          { color: "bg-info", label: "할당" },
          { color: "bg-muted-foreground/20", label: "소진" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", item.color)} />
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 재고 목록 */}
      <div className="divide-y divide-border overflow-y-auto max-h-[340px]">
        {stocks.map((stock) => {
          const isLow = stock.waiting <= LOW_STOCK_THRESHOLD;

          return (
            <div
              key={stock.product_id}
              className={cn(
                "px-5 py-3 transition-colors",
                isLow ? "bg-error/5 hover:bg-error/10" : "hover:bg-muted/20"
              )}
            >
              {/* 상품명 + 경고 */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isLow ? (
                    <AlertTriangle size={12} className="flex-shrink-0 text-error" />
                  ) : (
                    <Package size={12} className="flex-shrink-0 text-muted-foreground" />
                  )}
                  <p
                    className={cn(
                      "truncate text-[13px] font-medium",
                      isLow ? "text-error" : "text-foreground"
                    )}
                    title={stock.product_name}
                  >
                    {stock.product_name}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">
                    대기{" "}
                    <span className={cn("font-semibold", isLow ? "text-error" : "text-success")}>
                      {stock.waiting}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    할당 <span className="font-semibold text-info">{stock.assigned}</span>
                  </span>
                </div>
              </div>

              {/* 막대 그래프 */}
              <StockBar
                waiting={stock.waiting}
                assigned={stock.assigned}
                total={stock.total}
              />

              {/* 총 개수 */}
              <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
                총 {stock.total}개 중 소진 {stock.consumed}개
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
