"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardChartItem } from "@/types";

interface DashboardSalesChartProps {
  data: DashboardChartItem[];
}

type Period = 7 | 14 | 30;

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
];

// 날짜 포맷 (MM/DD)
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 금액 포맷 (K/M 단위)
function formatSalesAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// 커스텀 툴팁
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div role="tooltip" className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">
            {entry.name === "매출"
              ? `${entry.value.toLocaleString()}원`
              : `${entry.value.toLocaleString()}건`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardSalesChart({ data }: DashboardSalesChartProps) {
  const [period, setPeriod] = useState<Period>(14);

  const chartData = useMemo(() => {
    const sliced = data.slice(-period);
    return sliced.map((item) => ({
      ...item,
      date: formatDate(item.date),
    }));
  }, [data, period]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">매출 추이</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">일별 매출 및 주문 건수</p>
        </div>
        {/* 기간 선택 탭 */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "h-7 px-3 text-xs font-medium transition-all",
                period === opt.value
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <div className="p-5">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              yAxisId="sales"
              orientation="left"
              tickFormatter={formatSalesAxis}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              iconSize={10}
              formatter={(value: string) => (
                <span style={{ color: "hsl(var(--foreground))", fontSize: "12px" }}>{value}</span>
              )}
            />
            <Bar
              yAxisId="sales"
              dataKey="sales"
              name="매출"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="order_count"
              name="주문건수"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: "#f97316", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
