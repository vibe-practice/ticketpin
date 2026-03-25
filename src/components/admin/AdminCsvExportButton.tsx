"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface CsvColumnDef<T> {
  key: keyof T | string;
  label: string;
  format?: (value: unknown, row: T) => string;
}

export interface AdminCsvExportButtonProps<T> {
  /** 데이터 반환 함수 (비동기 지원) */
  getData: () => T[] | Promise<T[]>;
  /** CSV 컬럼 정의 */
  columns: CsvColumnDef<T>[];
  /** 다운로드 파일명 (확장자 제외) */
  filename?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 버튼 레이블 */
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
}

// ─── CSV 생성 유틸 ────────────────────────────────────────────────────────────

function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  // 쉼표, 줄바꿈, 큰따옴표 포함 시 따옴표로 감싸기
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv<T>(
  data: T[],
  columns: CsvColumnDef<T>[]
): string {
  // BOM: Excel에서 한글 깨짐 방지
  const BOM = "\uFEFF";

  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = (row as Record<string, unknown>)[col.key as string];
        const formatted = col.format ? col.format(value, row) : value;
        return escapeCsvCell(formatted);
      })
      .join(",")
  );

  return BOM + [header, ...rows].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminCsvExportButton<T>({
  getData,
  columns,
  filename = "export",
  disabled = false,
  label = "CSV 내보내기",
  className,
  variant = "outline",
  size = "default",
}: AdminCsvExportButtonProps<T>) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading || disabled) return;

    setLoading(true);
    try {
      const data = await getData();

      if (!data || data.length === 0) {
        // 데이터 없음 — 조용히 종료
        return;
      }

      const csv = generateCsv(data, columns);
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      downloadCsv(csv, `${filename}_${today}.csv`);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "gap-2",
        variant === "outline" &&
          "border-border text-muted-foreground hover:border-primary hover:text-primary",
        className
      )}
      disabled={disabled || loading}
      onClick={handleExport}
      aria-label="CSV 파일로 내보내기"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      <span>{loading ? "처리 중..." : label}</span>
    </Button>
  );
}
