"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ChevronRight, Bell, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notice } from "@/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

interface NoticeApiResponse {
  success: boolean;
  data: Notice[];
}

export function NoticePreview() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/notices?limit=5&page=1");
      const json: NoticeApiResponse = await res.json();
      if (json.success) {
        setNotices(json.data.slice(0, 5));
      }
    } catch {
      // 조용히 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  return (
    <section className="py-6 lg:py-8">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} strokeWidth={2} className="text-muted-foreground" />
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">
            공지사항
          </h2>
        </div>
        <Link
          href="/support/notice"
          className="flex items-center gap-0.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          더보기
          <ChevronRight size={14} strokeWidth={2} />
        </Link>
      </div>

      {/* 목록 */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-neutral-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div className="h-3.5 w-3/5 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-10 animate-pulse rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[14px] text-muted-foreground">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/support/notice/${notice.id}`}
                className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {notice.is_important && (
                    <Pin size={14} strokeWidth={2} className="shrink-0 text-destructive rotate-45" />
                  )}
                  <span
                    className={cn(
                      "truncate text-[15px] leading-snug transition-colors group-hover:text-foreground",
                      notice.is_important
                        ? "font-semibold text-foreground"
                        : "font-medium text-secondary-foreground"
                    )}
                  >
                    {notice.title}
                  </span>
                </div>
                <span className="shrink-0 text-[14px] tabular-nums text-muted-foreground">
                  {formatDate(notice.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
