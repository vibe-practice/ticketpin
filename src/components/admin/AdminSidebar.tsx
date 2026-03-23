"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Ticket,
  KeyRound,
  Gift,
  RotateCcw,
  Building2,
  Calculator,
  TrendingUp,
  Headphones,
  HelpCircle,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 메뉴 정의 ────────────────────────────────────────────────────────────────

type NavLeaf = {
  type: "leaf";
  label: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  type: "group";
  label: string;
  icon: React.ElementType;
  children: { label: string; href: string; icon: React.ElementType }[];
};

type NavItem = NavLeaf | NavGroup;

// 그룹 메뉴 경로는 NAV_ITEMS 내에서 관리

const NAV_ITEMS: NavItem[] = [
  { type: "leaf", label: "대시보드", href: "/adminmaster", icon: LayoutDashboard },
  { type: "leaf", label: "주문관리", href: "/adminmaster/orders", icon: ShoppingCart },
  { type: "leaf", label: "회원관리", href: "/adminmaster/members", icon: Users },
  { type: "leaf", label: "상품권관리", href: "/adminmaster/products", icon: Ticket },
  { type: "leaf", label: "카테고리관리", href: "/adminmaster/categories", icon: FolderOpen },
  { type: "leaf", label: "핀번호관리", href: "/adminmaster/pins", icon: KeyRound },
  { type: "leaf", label: "선물이력", href: "/adminmaster/gifts", icon: Gift },
  { type: "leaf", label: "취소/환불관리", href: "/adminmaster/refunds", icon: RotateCcw },
  {
    type: "group",
    label: "업체/정산 관리",
    icon: Building2,
    children: [
      { label: "업체 관리", href: "/adminmaster/businesses", icon: Building2 },
      { label: "정산 관리", href: "/adminmaster/settlements", icon: Calculator },
      { label: "전체보기", href: "/adminmaster/settlements/overview", icon: TrendingUp },
    ],
  },
  {
    type: "group",
    label: "매입관리",
    icon: Wallet,
    children: [
      { label: "매입 아이디", href: "/adminmaster/purchase-accounts", icon: Wallet },
      { label: "매입 내역", href: "/adminmaster/purchase-accounts/history", icon: ClipboardList },
    ],
  },
  {
    type: "group",
    label: "고객센터 관리",
    icon: Headphones,
    children: [
      { label: "FAQ 관리", href: "/adminmaster/faq", icon: HelpCircle },
      { label: "공지사항 관리", href: "/adminmaster/notices", icon: Megaphone },
    ],
  },
  { type: "leaf", label: "설정", href: "/adminmaster/settings", icon: Settings },
];

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  // 그룹 메뉴 열림/닫힘 상태 (그룹 label 기준)
  const getInitialOpenGroups = useCallback(() => {
    const open: Record<string, boolean> = {};
    for (const item of NAV_ITEMS) {
      if (item.type === "group") {
        const isActive = item.children.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + "/")
        );
        open[item.label] = isActive;
      }
    }
    return open;
  }, [pathname]);

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(getInitialOpenGroups);

  // 접힌 상태에서 그룹 메뉴 클릭 시 강제 펼침
  const handleGroupClick = (label: string) => {
    if (collapsed) {
      onCollapse(false);
      setGroupOpen((prev) => ({ ...prev, [label]: true }));
    } else {
      setGroupOpen((prev) => ({ ...prev, [label]: !prev[label] }));
    }
  };

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

  // 같은 그룹 내 다른 메뉴의 prefix가 되는 경우를 방지하기 위해
  // 그룹 children의 다른 href에 더 구체적으로 매칭되면 false 반환
  const isChildActive = (href: string, siblings: { href: string }[]) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // 더 구체적인 sibling이 매칭되면 이 항목은 비활성
    return !siblings.some(
      (s) => s.href !== href && s.href.startsWith(href + "/") && pathname.startsWith(s.href)
    );
  };

  const isLeafActive = (href: string) => {
    if (href === "/adminmaster") return pathname === "/adminmaster";
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
        aria-label="관리자 내비게이션"
        className={cn(
          // 기본: fixed + 다크 배경
          "fixed left-0 top-0 z-50 flex h-screen flex-col",
          "bg-slate-900 border-r border-slate-700/60",
          // 너비 트랜지션
          "transition-[width] duration-200 ease-out overflow-hidden",
          collapsed ? "w-[72px]" : "w-[240px]",
          // 모바일: 기본 숨김, mobileOpen 시 노출
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── 로고 영역 ────────────────────────────────────────── */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-700/60 shrink-0",
            collapsed ? "justify-center px-0" : "px-5 gap-3"
          )}
        >
          {/* 아이콘 로고 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-[0_0_12px_rgb(124_58_237/0.4)]">
            <Ticket size={16} className="text-white" strokeWidth={2} />
          </div>

          {/* 텍스트 로고 */}
          <div
            className={cn(
              "overflow-hidden transition-[width,opacity] duration-200 ease-out",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="whitespace-nowrap text-sm font-bold text-white leading-tight">
              티켓핀
            </p>
            <p className="whitespace-nowrap text-[11px] font-medium text-slate-400 leading-tight">
              관리자 콘솔
            </p>
          </div>
        </div>

        {/* ── 메뉴 영역 ────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              if (item.type === "leaf") {
                const active = isLeafActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg transition-all duration-150",
                      collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 gap-3 px-3",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    {/* 활성 좌측 바 */}
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
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
                      <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              }

              // 그룹 메뉴
              const Icon = item.icon;
              const isGroupActive = item.children.some(
                (c) => pathname === c.href || pathname.startsWith(c.href + "/")
              );
              const isOpen = !!groupOpen[item.label];

              return (
                <div key={item.label}>
                  {/* 그룹 헤더 */}
                  <button
                    type="button"
                    onClick={() => handleGroupClick(item.label)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex w-full items-center rounded-lg transition-all duration-150 cursor-pointer",
                      collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 gap-3 px-3",
                      isGroupActive
                        ? "bg-primary/15 text-primary"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    {isGroupActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={isGroupActive ? 2.2 : 1.75}
                      className="shrink-0"
                    />
                    <span
                      className={cn(
                        "flex-1 overflow-hidden whitespace-nowrap text-left text-sm font-medium transition-[width,opacity] duration-200 ease-out",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "shrink-0 transition-[transform,opacity] duration-200",
                        collapsed ? "opacity-0 w-0" : "opacity-100",
                        isOpen ? "rotate-180" : "rotate-0"
                      )}
                    />

                    {/* 접힌 상태 툴팁 */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
                        {item.label}
                      </span>
                    )}
                  </button>

                  {/* 서브메뉴 */}
                  {!collapsed && isOpen && (
                    <div className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-700/60 pl-4">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isChildActive(child.href, item.children);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                              childActive
                                ? "text-primary"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            )}
                          >
                            <ChildIcon
                              size={14}
                              strokeWidth={childActive ? 2.2 : 1.75}
                              className="shrink-0"
                            />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── 하단: 접기/펼치기 버튼 ───────────────────────────── */}
        <div className="shrink-0 border-t border-slate-700/60 p-2">
          <button
            type="button"
            onClick={() => onCollapse(!collapsed)}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2.5 text-slate-400",
              "hover:bg-slate-800 hover:text-slate-100 transition-all duration-150",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            {collapsed ? (
              <ChevronRight size={16} strokeWidth={2} />
            ) : (
              <>
                <ChevronLeft size={16} strokeWidth={2} />
                <span className="text-[13px] font-medium">메뉴 접기</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
