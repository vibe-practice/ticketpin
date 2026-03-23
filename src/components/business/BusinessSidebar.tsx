"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Building2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 메뉴 정의 ────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: (businessId: string) => string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "대시보드",
    href: (id) => `/business/${id}`,
    icon: LayoutDashboard,
  },
  {
    label: "매입상세",
    href: (id) => `/business/${id}/gifts`,
    icon: PackageSearch,
  },
  {
    label: "정산내역",
    href: (id) => `/business/${id}/settlements`,
    icon: ReceiptText,
  },
  {
    label: "업체정보",
    href: (id) => `/business/${id}/info`,
    icon: Building2,
  },
  {
    label: "접근로그",
    href: (id) => `/business/${id}/logs`,
    icon: ClipboardList,
  },
];

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

interface BusinessSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function BusinessSidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: BusinessSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const businessId = (params?.businessId as string) ?? "";

  // ESC 키로 모바일 사이드바 닫기
  const handleEscKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) onMobileClose();
    },
    [mobileOpen, onMobileClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [handleEscKey]);

  const isActive = (item: NavItem) => {
    const href = item.href(businessId);
    // 대시보드는 정확히 일치할 때만 활성
    if (href === `/business/${businessId}`) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 본체 */}
      <aside
        aria-label="업체 포털 내비게이션"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col",
          // 관리자(slate-900)와 구분: 인디고/청보라 계열 짙은 배경
          "bg-[#1a1033] border-r border-violet-900/40",
          "transition-[width] duration-200 ease-out overflow-hidden",
          collapsed ? "w-[72px]" : "w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── 로고 + 접기/펼치기 영역 ──────────────────────────────── */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-violet-900/40 shrink-0",
            collapsed ? "justify-center px-0" : "px-5 justify-between"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "" : "gap-3")}>
            {/* 아이콘 */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30 shadow-[0_0_10px_rgb(139_92_246/0.25)]">
              <Briefcase size={15} className="text-violet-300" strokeWidth={2} />
            </div>

            {/* 텍스트 */}
            <div
              className={cn(
                "overflow-hidden transition-[width,opacity] duration-200 ease-out",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              <p className="whitespace-nowrap text-sm font-bold text-white leading-tight">
                티켓핀
              </p>
              <p className="whitespace-nowrap text-[11px] font-medium text-violet-400 leading-tight">
                업체 포털
              </p>
            </div>
          </div>

          {/* 접기/펼치기 버튼 */}
          <button
            type="button"
            onClick={() => onCollapse(!collapsed)}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md h-7 w-7",
              "text-violet-400/70 hover:bg-violet-500/10 hover:text-violet-300",
              "transition-all duration-150",
              collapsed ? "mx-auto" : ""
            )}
          >
            {collapsed ? (
              <ChevronRight size={16} strokeWidth={2} />
            ) : (
              <ChevronLeft size={16} strokeWidth={2} />
            )}
          </button>
        </div>

        {/* ── 메뉴 영역 ─────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              const href = item.href(businessId);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg transition-all duration-150",
                    collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 gap-3 px-3",
                    active
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-violet-300/50 hover:bg-violet-500/10 hover:text-violet-200"
                  )}
                >
                  {/* 활성 좌측 바 */}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-400" />
                  )}

                  <Icon
                    size={18}
                    strokeWidth={active ? 2.2 : 1.75}
                    className="shrink-0"
                  />

                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap text-sm font-medium transition-[width,opacity] duration-200 ease-out",
                      collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* 접힌 상태 툴팁 */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#1a1033] border border-violet-900/40 px-2.5 py-1.5 text-xs font-medium text-violet-200 shadow-lg group-hover:block">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

      </aside>
    </>
  );
}

// 사이드바 너비 상수 (layout.tsx에서 사용)
export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
