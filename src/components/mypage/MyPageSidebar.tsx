"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "마이쇼핑",
    items: [
      { label: "마이쇼핑 홈", href: "/my", exact: true },
      { label: "구매내역", href: "/my/orders", exact: false },
      { label: "내 상품권", href: "/my/vouchers", exact: false },
      { label: "보낸 선물", href: "/my/gifts/sent", exact: false },
      { label: "받은 선물", href: "/my/gifts/received", exact: false },
    ],
  },
  {
    title: "계정 관리",
    items: [
      { label: "회원정보 수정", href: "/my/profile", exact: false },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function MyPageSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden lg:block w-[180px] shrink-0">
        <nav aria-label="마이페이지 메뉴" className="sticky top-[73px] pt-8">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && "mt-7")}>
              <p className="text-[16px] font-bold text-foreground mb-3">
                {group.title}
              </p>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "block py-1.5 text-[16px] transition-colors duration-150",
                          active
                            ? "font-bold text-foreground"
                            : "font-normal text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* 모바일 가로 스크롤 탭 */}
      <nav
        aria-label="마이페이지 메뉴"
        className="lg:hidden sticky top-[57px] z-10 bg-background border-b border-border -mx-4 sm:-mx-6 px-4 sm:px-6"
      >
        <div className="flex overflow-x-auto scrollbar-hide gap-0">
          {ALL_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 px-3 py-3 text-[14px] transition-colors duration-150 border-b-2",
                  active
                    ? "font-bold text-foreground border-foreground"
                    : "font-normal text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
