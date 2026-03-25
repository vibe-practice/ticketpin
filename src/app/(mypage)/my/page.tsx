"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Ticket,
  ShoppingBag,
  Gift,
  Inbox,
  ChevronRight,
  BadgeCheck,
  ArrowUpRight,
  KeyRound,
  UserCog,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import type { MyPageSummary } from "@/types";

// ── Skeleton ────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="w-full space-y-5">
      {/* 프로필 바 */}
      <div className="border border-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted skeleton-shimmer" />
            <div className="space-y-2">
              <div className="h-5 w-28 bg-muted rounded skeleton-shimmer" />
              <div className="h-4 w-40 bg-muted rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <div className="h-3 w-16 bg-muted rounded skeleton-shimmer ml-auto" />
            <div className="h-6 w-24 bg-muted rounded skeleton-shimmer ml-auto" />
          </div>
        </div>
      </div>

      {/* 빠른 메뉴 4칸 */}
      <div className="grid grid-cols-4 border border-border rounded-xl overflow-hidden divide-x divide-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center py-8 gap-3">
            <div className="h-7 w-7 bg-muted rounded skeleton-shimmer" />
            <div className="h-7 w-10 bg-muted rounded skeleton-shimmer" />
            <div className="h-4 w-14 bg-muted rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
        {[1, 2].map((i) => (
          <div key={i} className="bg-background p-5">
            <div className="h-4 w-24 bg-muted rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Error State ────────────────────────────────────────────────
function ErrorState({ error }: { error: string }) {
  const isAuthError = error.includes("로그인");
  return (
    <div className="w-full flex flex-col items-start justify-center py-20">
      <p className="text-2xl font-bold text-foreground mb-2">접근할 수 없습니다</p>
      <p className="text-[15px] text-muted-foreground mb-8">{error}</p>
      {isAuthError ? (
        <Link
          href="/auth/login?redirect=/my"
          className="group inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-[15px] font-semibold rounded-md hover:bg-foreground/80 transition-colors duration-150"
        >
          로그인하기
          <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150" />
        </Link>
      ) : (
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[15px] font-medium text-foreground rounded-md hover:bg-muted transition-colors duration-150"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

// ── Quick Menu Item ────────────────────────────────────────────────
interface QuickMenuItem {
  label: string;
  value: number;
  href: string;
  icon: React.ElementType;
}

function QuickMenuCard({ item }: { item: QuickMenuItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex flex-col items-center justify-center py-5 sm:py-8 hover:bg-muted/50 transition-colors duration-150"
    >
      <Icon size={24} strokeWidth={1.5} className="text-foreground mb-2 sm:mb-3 sm:!w-8 sm:!h-8" />
      <p className="text-xl sm:text-3xl font-bold text-foreground tabular-nums leading-none">
        {item.value.toLocaleString()}
      </p>
      <p className="text-[14px] sm:text-[16px] text-muted-foreground mt-1.5 sm:mt-2">{item.label}</p>
    </Link>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function MyPage() {
  const [summary, setSummary] = useState<MyPageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("/api/mypage/summary");
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.error?.message ?? "데이터를 불러오는데 실패했습니다.");
          return;
        }

        setSummary(json.data);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSummary();
  }, []);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !summary) return <ErrorState error={error ?? "데이터를 불러올 수 없습니다."} />;

  const { user } = summary;

  const quickMenus: QuickMenuItem[] = [
    { label: "구매내역", value: summary.total_purchase_count, href: "/my/orders", icon: ShoppingBag },
    { label: "내 상품권", value: summary.voucher_count, href: "/my/vouchers", icon: Ticket },
    { label: "보낸 선물", value: summary.gift_sent_count, href: "/my/gifts/sent", icon: Gift },
    { label: "받은 선물", value: summary.gift_received_count, href: "/my/gifts/received", icon: Inbox },
  ];

  const quickLinks = [
    { label: "회원정보 수정", href: "/my/profile", icon: UserCog },
    { label: "비밀번호 변경", href: "/my/profile", icon: KeyRound },
  ];

  return (
    <div className="w-full">

      {/* ── 프로필 바 ── */}
      <div className="border border-border rounded-xl px-5 py-5 sm:px-8 sm:py-6">
        {/* 모바일: 세로 스택 / 데스크탑: 가로 배치 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* 좌측: 아바타 + 유저 정보 */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-foreground flex items-center justify-center">
                <span className="text-lg sm:text-xl font-bold text-background">
                  {user.name.charAt(0)}
                </span>
              </div>
              {user.identity_verified && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border"
                  title="본인인증 완료"
                >
                  <BadgeCheck size={13} className="text-foreground" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">
                  {user.name}님
                </p>
                {user.identity_verified && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[14px] sm:text-[14px] font-medium text-muted-foreground">
                    <BadgeCheck size={12} strokeWidth={2} />
                    본인인증 완료
                  </span>
                )}
              </div>
              <p className="text-[14px] sm:text-[16px] text-muted-foreground mt-0.5">@{user.username}</p>
            </div>
          </div>

          {/* 우측(모바일에서는 하단): 총 구매금액 */}
          <div className="shrink-0 flex items-center justify-between sm:block sm:text-right border-t border-border pt-3 sm:border-0 sm:pt-0">
            <p className="text-[14px] text-muted-foreground sm:mb-1">총 구매금액</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums tracking-tight">
              {formatPrice(summary.total_purchase_amount)}
            </p>
          </div>
        </div>
      </div>

      {/* ── 빠른 메뉴 그리드 (모바일 2x2, 데스크탑 4x1) ── */}
      <div className="mt-4 sm:mt-5 rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {quickMenus.map((item, i) => (
            <div
              key={item.href}
              className={cn(
                // 세로 구분선: 홀수 인덱스 왼쪽 보더 (모바일 2칸 기준 1,3번째 / 데스크탑 4칸 기준 1,2,3번째)
                i % 2 !== 0 && "border-l border-border",
                "sm:border-l-0",
                i > 0 && "sm:border-l sm:border-border",
                // 가로 구분선: 모바일에서 3,4번째 아이템 상단
                i >= 2 && "border-t border-border",
                "sm:border-t-0",
              )}
            >
              <QuickMenuCard item={item} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 빠른 링크 ── */}
      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              className="group flex items-center justify-between bg-background px-5 py-4 hover:bg-muted/50 transition-colors duration-150"
            >
              <div className="flex items-center gap-2.5">
                <Icon size={18} strokeWidth={1.75} className="text-muted-foreground" />
                <span className="text-[15px] sm:text-[16px] font-medium text-foreground">{link.label}</span>
              </div>
              <ChevronRight
                size={16}
                className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-150"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
