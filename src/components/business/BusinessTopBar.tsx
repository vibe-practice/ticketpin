"use client";

import { usePathname, useParams } from "next/navigation";
import {
  Menu,
  LogOut,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";

// ─── 경로 → 타이틀 매핑 ────────────────────────────────────────────────────

function getBreadcrumb(pathname: string, businessId: string): string[] {
  const base = `/business/${businessId}`;

  if (pathname === base) return ["대시보드"];
  if (pathname === `${base}/gifts` || pathname.startsWith(`${base}/gifts/`))
    return ["매입상세"];
  if (
    pathname === `${base}/settlements` ||
    pathname.startsWith(`${base}/settlements/`)
  )
    return ["정산내역"];
  if (pathname === `${base}/info` || pathname.startsWith(`${base}/info/`))
    return ["업체정보"];
  if (pathname === `${base}/logs` || pathname.startsWith(`${base}/logs/`))
    return ["접근로그"];

  return ["대시보드"];
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

interface BusinessTopBarProps {
  businessName?: string;
  onMobileMenuClick: () => void;
}

export function BusinessTopBar({
  businessName = "",
  onMobileMenuClick,
}: BusinessTopBarProps) {
  const pathname = usePathname();
  const params = useParams();
  const businessId = (params?.businessId as string) ?? "";
  const { logout } = useBusinessAuth();

  const breadcrumb = getBreadcrumb(pathname, businessId);

  // 업체명 이니셜 (첫 글자)
  const initial = businessName?.[0] ?? "B";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between",
        "border-b border-border bg-card/95 backdrop-blur-sm",
        "px-4 lg:px-6 shrink-0"
      )}
    >
      {/* ── 왼쪽: 햄버거(모바일) + 브레드크럼 ──────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* 모바일 햄버거 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          className="lg:hidden shrink-0"
          aria-label="메뉴 열기"
        >
          <Menu size={22} strokeWidth={2} />
        </Button>

        {/* 브레드크럼 */}
        <nav aria-label="업체 포털 브레드크럼" className="flex items-center gap-1.5 min-w-0">
          <div className="hidden lg:flex items-center gap-1 text-muted-foreground">
            <Briefcase size={13} strokeWidth={1.75} />
            <span className="text-xs font-medium">업체 포털</span>
          </div>

          {breadcrumb.map((label, idx) => (
            <div key={idx} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight
                size={13}
                strokeWidth={2}
                className={cn(
                  "shrink-0 text-muted-foreground",
                  idx === 0 ? "hidden lg:block" : ""
                )}
              />
              <span
                className={cn(
                  "truncate text-sm",
                  idx === breadcrumb.length - 1
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground font-medium"
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </nav>
      </div>

      {/* ── 오른쪽: 업체 정보 + 로그아웃 ────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 업체 뱃지 */}
        <div className="hidden sm:flex items-center gap-2.5 rounded-lg bg-brand-primary-muted px-3 py-2 border border-brand-primary-soft">
          {/* 아바타 */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 border border-neutral-200 text-foreground text-xs font-bold shrink-0">
            {initial}
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-foreground">
              {businessName}
            </p>
            <p className="text-[11px] text-muted-foreground">업체 포털</p>
          </div>
        </div>

        {/* 로그아웃 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="gap-1.5 text-[13px] h-9"
        >
          <LogOut size={14} strokeWidth={2} />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    </header>
  );
}
