"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Ticket,
  Gift,
  Inbox,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "홈",
    href: "/my",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "구매내역",
    href: "/my/orders",
    icon: ShoppingBag,
    exact: false,
  },
  {
    label: "내 상품권",
    href: "/my/vouchers",
    icon: Ticket,
    exact: false,
  },
  {
    label: "보낸 선물",
    href: "/my/gifts/sent",
    icon: Gift,
    exact: false,
  },
  {
    label: "받은 선물",
    href: "/my/gifts/received",
    icon: Inbox,
    exact: false,
  },
  {
    label: "회원정보 수정",
    href: "/my/profile",
    icon: UserCog,
    exact: false,
  },
];

export function MyPageSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* 데스크탑 사이드 탭 */}
      <aside className="hidden lg:flex flex-col w-[200px] shrink-0">
        <div className="sticky top-[57px] pt-6">
          <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">
            마이페이지
          </p>
          <nav aria-label="마이페이지 메뉴" className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-brand-primary-muted text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      "shrink-0 transition-colors duration-150",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* 모바일 가로 스크롤 탭 */}
      <nav aria-label="마이페이지 메뉴" className="lg:hidden sticky top-[57px] z-10 bg-background border-b border-border">
        <div className="flex overflow-x-auto scrollbar-hide px-4 gap-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-brand-primary-muted text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
