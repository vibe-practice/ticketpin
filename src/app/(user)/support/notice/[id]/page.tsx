import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

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

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: notice } = await supabase
    .from("notices")
    .select("title")
    .eq("id", id)
    .single();

  if (!notice) return { title: "공지사항 | 티켓핀" };
  return { title: `${notice.title} | 티켓핀` };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}년 ${mm}월 ${dd}일`;
}

export default async function NoticeDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 공지사항 상세 조회
  const { data: notice, error } = await supabase
    .from("notices")
    .select("id, title, content, category, is_important, created_at")
    .eq("id", id)
    .single();

  if (error || !notice) {
    notFound();
  }

  // 이전글 (현재보다 오래된 공지 중 가장 최신)
  const { data: prevNotice } = await supabase
    .from("notices")
    .select("id, title")
    .lt("created_at", notice.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // 다음글 (현재보다 새로운 공지 중 가장 오래된)
  const { data: nextNotice } = await supabase
    .from("notices")
    .select("id, title")
    .gt("created_at", notice.created_at)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* 뒤로가기 브레드크럼 */}
      <div className="border-b border-border bg-card">
        <div className="container-main py-3">
          <Link
            href="/support/notice"
            className="inline-flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ChevronLeft size={16} />
            공지사항 목록
          </Link>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="max-w-3xl space-y-6">

          {/* 공지 본문 카드 */}
          <article aria-labelledby="notice-title" className="rounded-xl border border-border bg-card overflow-hidden">

            {/* 공지 헤더 */}
            <div className="border-b border-border px-6 py-6 space-y-3">
              {/* 카테고리 뱃지 */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-sm px-2.5 py-0.5 text-[13px] font-semibold",
                    NOTICE_CATEGORY_STYLES[notice.category]
                  )}
                >
                  {NOTICE_CATEGORY_LABELS[notice.category]}
                </span>
              </div>

              {/* 제목 */}
              <h1 id="notice-title" className="text-2xl font-bold text-foreground leading-snug">
                {notice.title}
              </h1>

              {/* 메타 정보 */}
              <div className="flex items-center gap-4">
                <span className="text-[15px] text-muted-foreground">
                  {formatDate(notice.created_at)}
                </span>
              </div>
            </div>

            {/* 본문 */}
            <div className="px-6 py-6">
              <p className="whitespace-pre-line text-[16px] leading-relaxed text-muted-foreground">
                {notice.content}
              </p>
            </div>
          </article>

          {/* 이전글 / 다음글 네비게이션 */}
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {nextNotice ? (
              <Link
                href={`/support/notice/${nextNotice.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 text-[14px] font-semibold text-foreground">
                    다음글
                  </span>
                  <span className="text-[15px] text-muted-foreground group-hover:text-foreground transition-colors duration-150 line-clamp-1">
                    {nextNotice.title}
                  </span>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors duration-150" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="shrink-0 text-[14px] font-semibold text-muted-foreground/50">
                  다음글
                </span>
                <span className="text-[15px] text-muted-foreground/50">
                  다음 공지사항이 없습니다.
                </span>
              </div>
            )}

            {prevNotice ? (
              <Link
                href={`/support/notice/${prevNotice.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
                    이전글
                  </span>
                  <span className="text-[15px] text-muted-foreground group-hover:text-foreground transition-colors duration-150 line-clamp-1">
                    {prevNotice.title}
                  </span>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors duration-150" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="shrink-0 text-[14px] font-semibold text-muted-foreground/50">
                  이전글
                </span>
                <span className="text-[15px] text-muted-foreground/50">
                  이전 공지사항이 없습니다.
                </span>
              </div>
            )}
          </div>

          {/* 목록으로 버튼 */}
          <div className="flex justify-center">
            <Link
              href="/support/notice"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[15px] font-medium text-muted-foreground shadow-sm hover:border-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all duration-150"
            >
              <ListFilter size={16} />
              목록으로
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
