"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Ticket,
  ShoppingBag,
  Gift,
  Inbox,
  UserCog,
  ChevronRight,
  CalendarDays,
  Mail,
  Phone,
  BadgeCheck,
  CreditCard,
} from "lucide-react";
import { formatPrice, formatPhone } from "@/lib/utils";
import type { MyPageSummary } from "@/types";

function formatDate(isoString: string) {
  const d = new Date(isoString);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface StatCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  highlight?: boolean;
}

function StatCard({
  label,
  value,
  suffix,
  href,
  icon: Icon,
  iconBg,
  iconColor,
  highlight,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <ChevronRight
          size={16}
          className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150"
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix && (
            <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>
          )}
        </p>
      </div>
    </Link>
  );
}

interface QuickLinkProps {
  label: string;
  desc: string;
  href: string;
  icon: React.ElementType;
}

function QuickLink({ label, desc, href, icon: Icon }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/30 hover:bg-brand-primary-muted transition-all duration-150"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary-soft">
        <Icon size={17} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150"
      />
    </Link>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="max-w-4xl w-full space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded mt-2" />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="h-2 bg-muted" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-24 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !summary) {
    const isAuthError = error?.includes("로그인");
    return (
      <div className="max-w-4xl w-full flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground mb-4">{error ?? "데이터를 불러올 수 없습니다."}</p>
        {isAuthError ? (
          <Link
            href="/auth/login?redirect=/my"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            로그인하기
          </Link>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  const { user } = summary;

  const statCards: StatCardProps[] = [
    {
      label: "보유 상품권",
      value: summary.voucher_count,
      suffix: "개",
      href: "/my/vouchers",
      icon: Ticket,
      iconBg: "bg-brand-primary-soft",
      iconColor: "text-primary",
      highlight: true,
    },
    {
      label: "총 주문",
      value: summary.total_purchase_count,
      suffix: "건",
      href: "/my/orders",
      icon: ShoppingBag,
      iconBg: "bg-info-bg",
      iconColor: "text-info",
    },
    {
      label: "보낸 선물",
      value: summary.gift_sent_count,
      suffix: "건",
      href: "/my/gifts/sent",
      icon: Gift,
      iconBg: "bg-success-bg",
      iconColor: "text-success",
    },
    {
      label: "받은 선물",
      value: summary.gift_received_count,
      suffix: "건",
      href: "/my/gifts/received",
      icon: Inbox,
      iconBg: "bg-warning-bg",
      iconColor: "text-warning",
    },
  ];

  const quickLinks: QuickLinkProps[] = [
    {
      label: "회원정보 수정",
      desc: "비밀번호, 연락처 등 개인정보 변경",
      href: "/my/profile",
      icon: UserCog,
    },
    {
      label: "구매내역",
      desc: "최근 구매한 상품권 주문 내역 확인",
      href: "/my/orders",
      icon: ShoppingBag,
    },
    {
      label: "내 상품권",
      desc: "보유한 상품권 핀 번호 조회",
      href: "/my/vouchers",
      icon: Ticket,
    },
  ];

  return (
    <div className="max-w-4xl w-full space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">마이페이지</h1>
        <p className="text-sm text-muted-foreground mt-0.5">계정 정보와 이용 현황을 확인하세요.</p>
      </div>

      {/* 프로필 카드 */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* 헤더 배너 */}
        <div className="h-2 bg-gradient-to-r from-brand-primary-dark via-primary to-brand-primary-soft" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* 아바타 */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft ring-2 ring-primary/20">
                <span className="text-xl font-bold text-primary">
                  {user.name.charAt(0)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-foreground leading-tight">{user.name}</p>
                  {user.identity_verified && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-1.5 py-0.5 text-[13px] font-semibold text-success">
                      <BadgeCheck size={11} />
                      본인인증
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">@{user.username}</p>
              </div>
            </div>
            <Link
              href="/my/profile"
              aria-label="회원정보 수정"
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-brand-primary-muted transition-all duration-150"
            >
              수정
            </Link>
          </div>

          {/* 상세 정보 */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={13} className="shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={13} className="shrink-0" />
              <span>{formatPhone(user.phone)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays size={13} className="shrink-0" />
              <span>가입일 {formatDate(user.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard size={13} className="shrink-0" />
              <span>
                총 구매금액{" "}
                <strong className="font-semibold text-foreground">
                  {formatPrice(summary.total_purchase_amount)}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Card 그리드 */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">이용 현황</h2>
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card) => (
            <StatCard key={card.href} {...card} />
          ))}
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">빠른 메뉴</h2>
        <div className="flex flex-col gap-2">
          {quickLinks.map((link) => (
            <QuickLink key={link.href} {...link} />
          ))}
        </div>
      </div>
    </div>
  );
}
