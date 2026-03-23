"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode;
}

export interface AdminDataTableProps<T extends Record<string, unknown>> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  /** 전체 건수 (서버 페이징 시) */
  total?: number;
  /** 외부에서 페이지/사이즈 제어 시 사용 (controlled 모드) */
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** 정렬 변경 콜백 (서버사이드 정렬 시 사용) */
  onSort?: (key: string, direction: SortDirection) => void;
  /** 체크박스 활성화 */
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  rowKey?: (row: T) => string;
  /** 행 클릭 핸들러 */
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
  /** 페이지 사이즈 옵션 */
  pageSizeOptions?: number[];
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

// ─── 정렬 아이콘 ──────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc") return <ChevronUp size={14} className="text-primary" />;
  if (direction === "desc") return <ChevronDown size={14} className="text-primary" />;
  return <ChevronsUpDown size={14} className="text-muted-foreground/50" />;
}

// ─── 스켈레톤 로우 ────────────────────────────────────────────────────────────

function SkeletonRows({ count, colCount }: { count: number; colCount: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: colCount }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────────────────────

function EmptyState({ message, colCount }: { message: string; colCount: number }) {
  return (
    <tr>
      <td colSpan={colCount} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ChevronsUpDown size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  total,
  page: externalPage,
  pageSize: externalPageSize,
  onPageChange: externalOnPageChange,
  onPageSizeChange: externalOnPageSizeChange,
  onSort: externalOnSort,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  rowKey,
  onRowClick,
  className,
  emptyMessage = "데이터가 없습니다.",
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: AdminDataTableProps<T>) {
  // 내부 상태 (uncontrolled 모드)
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSizeOptions[0]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  // controlled vs uncontrolled
  const isControlled = externalPage !== undefined;
  const currentPage = isControlled ? externalPage! : internalPage;
  const currentPageSize = externalPageSize ?? internalPageSize;

  const handlePageChange = useCallback(
    (p: number) => {
      if (isControlled) {
        externalOnPageChange?.(p);
      } else {
        setInternalPage(p);
      }
    },
    [isControlled, externalOnPageChange]
  );

  const handlePageSizeChange = useCallback(
    (s: number) => {
      if (isControlled) {
        externalOnPageSizeChange?.(s);
        externalOnPageChange?.(1);
      } else {
        setInternalPageSize(s);
        setInternalPage(1);
      }
    },
    [isControlled, externalOnPageSizeChange, externalOnPageChange]
  );

  // 클라이언트 사이드 정렬 + 페이징 (uncontrolled 모드)
  const processedData = useMemo(() => {
    if (isControlled) return data;

    const sorted = [...data];
    if (sortKey && sortDir) {
      sorted.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    const start = (currentPage - 1) * currentPageSize;
    return sorted.slice(start, start + currentPageSize);
  }, [data, sortKey, sortDir, currentPage, currentPageSize, isControlled]);

  const totalItems = total ?? data.length;
  const totalPages = Math.ceil(totalItems / currentPageSize);

  // 정렬 토글
  const handleSort = useCallback(
    (key: string) => {
      let nextKey: string | null;
      let nextDir: SortDirection;

      if (sortKey !== key) {
        nextKey = key;
        nextDir = "asc";
      } else if (sortDir === "asc") {
        nextKey = key;
        nextDir = "desc";
      } else {
        nextKey = null;
        nextDir = null;
      }

      setSortKey(nextKey);
      setSortDir(nextDir);
      externalOnSort?.(nextKey ?? "", nextDir);
    },
    [sortKey, sortDir, externalOnSort]
  );

  // 체크박스
  const allKeys = useMemo(
    () => processedData.map((row, i) => (rowKey ? rowKey(row) : String(i))),
    [processedData, rowKey]
  );
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  const someSelected = allKeys.some((k) => selectedKeys.includes(k));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.(selectedKeys.filter((k) => !allKeys.includes(k)));
    } else {
      const merged = Array.from(new Set([...selectedKeys, ...allKeys]));
      onSelectionChange?.(merged);
    }
  };

  const handleSelectRow = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectionChange?.(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange?.([...selectedKeys, key]);
    }
  };

  const colCount = columns.length + (selectable ? 1 : 0);
  const startItem = (currentPage - 1) * currentPageSize + 1;
  const endItem = Math.min(currentPage * currentPageSize, totalItems);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 테이블 영역 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-max text-sm">
          {/* 헤더 */}
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {selectable && (
                <th className="w-10 px-4 py-3 text-left">
                  <div
                    role="checkbox"
                    aria-checked={allSelected ? true : someSelected ? "mixed" : false}
                    tabIndex={0}
                    onClick={handleSelectAll}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleSelectAll();
                      }
                    }}
                    className={cn(
                      "flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 transition-all",
                      allSelected
                        ? "border-primary bg-primary"
                        : someSelected
                          ? "border-primary bg-primary/30"
                          : "border-border"
                    )}
                  >
                    {(allSelected || someSelected) && (
                      <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                        <path
                          d={allSelected ? "M1 4L3.5 6.5L9 1" : "M1 4H9"}
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold text-muted-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.sortable && "cursor-pointer select-none hover:text-foreground"
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디 */}
          <tbody className="divide-y divide-border">
            {loading ? (
              <SkeletonRows count={8} colCount={colCount} />
            ) : processedData.length === 0 ? (
              <EmptyState message={emptyMessage} colCount={colCount} />
            ) : (
              processedData.map((row, rowIndex) => {
                const key = rowKey ? rowKey(row) : String((currentPage - 1) * currentPageSize + rowIndex);
                const isSelected = selectedKeys.includes(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "h-[52px] transition-colors duration-100",
                      onRowClick && "cursor-pointer",
                      isSelected
                        ? "bg-brand-primary-muted/50"
                        : "hover:bg-muted/30"
                    )}
                  >
                    {selectable && (
                      <td
                        className="w-10 px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRow(key);
                        }}
                      >
                        <div
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              handleSelectRow(key);
                            }
                          }}
                          className={cn(
                            "flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 transition-all",
                            isSelected ? "border-primary bg-primary" : "border-border"
                          )}
                        >
                          {isSelected && (
                            <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                              <path
                                d="M1 4L3.5 6.5L9 1"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-2.5 text-sm text-foreground",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {col.render
                          ? col.render(row[col.key], row, rowIndex)
                          : row[col.key] != null
                            ? String(row[col.key])
                            : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 페이지네이션 */}
      {totalItems > 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* 건수 정보 */}
          <p className="text-sm text-muted-foreground">
            전체{" "}
            <span className="font-semibold text-foreground">
              {totalItems.toLocaleString()}
            </span>
            건 중{" "}
            <span className="font-semibold text-foreground">
              {startItem.toLocaleString()}
            </span>
            –
            <span className="font-semibold text-foreground">
              {endItem.toLocaleString()}
            </span>
            번
          </p>

          <div className="flex items-center gap-4">
            {/* 페이지 사이즈 셀렉트 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">페이지당</span>
              <Select
                value={String(currentPageSize)}
                onValueChange={(v) => handlePageSizeChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((s) => (
                    <SelectItem key={s} value={String(s)} className="text-xs">
                      {s}건
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 페이지 버튼 */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                aria-label="첫 페이지"
              >
                <ChevronsLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
              >
                <ChevronLeft size={14} />
              </Button>

              <span className="min-w-[80px] text-center text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{currentPage}</span>
                {" / "}
                {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
              >
                <ChevronRight size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="마지막 페이지"
              >
                <ChevronsRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
