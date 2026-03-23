"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Bell, Pin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import type { NoticeCategory, Notice } from "@/types";

const NOTICE_CATEGORIES: NoticeCategory[] = [
  "전체",
  "일반",
  "이벤트",
  "점검",
];

const NOTICE_CATEGORY_LABELS: Record<string, string> = {
  일반: "일반",
  이벤트: "이벤트",
  점검: "점검",
};

const NOTICE_CATEGORY_STYLES: Record<string, string> = {
  일반: "bg-info-bg text-info",
  이벤트: "bg-brand-primary-soft text-primary",
  점검: "bg-warning-bg text-warning",
};

const ITEMS_PER_PAGE = 10;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

interface NoticeApiResponse {
  success: boolean;
  data: Notice[];
  categoryCounts: Record<string, number>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: { code: string; message: string };
}

export default function NoticePage() {
  const [activeCategory, setActiveCategory] = useState<NoticeCategory>("전체");
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<Notice[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotices = useCallback(async (category: NoticeCategory, page: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "전체") {
        params.set("category", category);
      }
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));

      const res = await fetch(`/api/notices?${params.toString()}`);
      const json: NoticeApiResponse = await res.json();

      if (json.success) {
        setItems(json.data);
        setCategoryCounts(json.categoryCounts);
        setTotalPages(json.totalPages);
        setTotalCount(json.total);
      }
    } catch {
      // 에러 시 빈 목록 유지
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices(activeCategory, currentPage);
  }, [activeCategory, currentPage, fetchNotices]);

  function handleCategoryChange(cat: NoticeCategory) {
    setActiveCategory(cat);
    setCurrentPage(1);
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-8 lg:px-12">
          <h1 className="text-xl font-bold text-foreground">공지사항</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            티켓핀의 서비스 공지, 이벤트, 점검 안내를 확인하세요.
          </p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="px-6 py-8 lg:px-12">
        <div className="max-w-3xl space-y-6">

          {/* 카테고리 필터 탭 */}
          <div className="flex flex-wrap gap-2">
            {NOTICE_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-brand-primary-muted"
                  )}
                >
                  {cat}
                  <span
                    className={cn(
                      "inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {categoryCounts[cat] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 로딩 상태 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Loader2 size={32} className="mb-4 animate-spin text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Bell size={44} className="mb-4 text-muted-foreground/40" />
              <p className="text-[15px] font-semibold text-foreground">
                등록된 공지사항이 없습니다
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                다른 카테고리를 선택하거나 나중에 다시 확인해 주세요.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* 결과 카운트 헤더 */}
              <div className="border-b border-border px-5 py-3 bg-muted/30">
                <span className="text-[13px] text-muted-foreground">
                  총{" "}
                  <span className="font-semibold text-foreground">
                    {totalCount}
                  </span>
                  건의 공지사항
                </span>
              </div>

              <div className="divide-y divide-border">
                {items.map((notice) => (
                  <Link
                    key={notice.id}
                    href={`/support/notice/${notice.id}`}
                    className={cn(
                      "group flex items-start justify-between gap-4 px-5 py-4 transition-colors duration-150",
                      notice.is_important
                        ? "bg-error-bg/40 hover:bg-error-bg/60"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {notice.is_important && (
                        <Pin size={13} className="mt-1 shrink-0 text-destructive rotate-45" />
                      )}
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                          NOTICE_CATEGORY_STYLES[notice.category]
                        )}
                      >
                        {NOTICE_CATEGORY_LABELS[notice.category]}
                      </span>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[14px] leading-snug group-hover:text-primary transition-colors duration-150 line-clamp-1",
                          notice.is_important
                            ? "font-bold text-destructive"
                            : "font-medium text-foreground"
                        )}>
                          {notice.title}
                        </p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-[12px] text-muted-foreground tabular-nums">
                            {formatDate(notice.created_at)}
                          </span>


                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors duration-150" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 페이지네이션 */}
          {!isLoading && totalPages > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}

        </div>
      </div>
    </div>
  );
}
