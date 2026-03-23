"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Home,
  Tag,
  BookOpen,
  Headphones,
  ChevronDown,
  LogIn,
  LogOut,
  UserPlus,
  User as UserIcon,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";

function buildNavItems(categories: Category[]) {
  const categoryItems = categories
    .filter((c) => c.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ label: c.name, href: `/category/${c.slug}` }));

  return [
    {
      label: "홈",
      href: "/",
      icon: Home,
    },
    {
      label: "상품권 종류",
      icon: Tag,
      items: [...categoryItems, { label: "전체보기", href: "/category" }],
    },
    {
      label: "이용안내",
      icon: BookOpen,
      items: [
        { label: "이용방법", href: "/guide" },
        { label: "선물하기 안내", href: "/guide/gift" },
      ],
    },
    {
      label: "고객센터",
      icon: Headphones,
      items: [
        { label: "자주 묻는 질문", href: "/support/faq" },
        { label: "공지사항", href: "/support/notice" },
      ],
    },
  ] as const;
}

type LeafNavItem = { label: string; href: string; icon: React.ElementType };
type GroupNavItem = {
  label: string;
  icon: React.ElementType;
  items: readonly { label: string; href: string }[];
};
type NavItem = LeafNavItem | GroupNavItem;

function isGroup(item: NavItem): item is GroupNavItem {
  return "items" in item;
}

function NavItemRow({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose?: () => void;
}) {
  const isGroupItem = isGroup(item);
  const isActive = isGroupItem
    ? item.items.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + "/"))
    : pathname === item.href;

  const [open, setOpen] = useState(isActive);
  const Icon = item.icon;

  useEffect(() => {
    setOpen(isActive);
  }, [isActive]);

  if (!isGroupItem) {
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-3 rounded-lg pl-4 pr-4 py-3 text-base font-medium transition-colors ${
          isActive
            ? "bg-accent text-primary"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        <Icon size={20} />
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 justify-start px-4 has-[>svg]:px-4 py-3 h-auto text-base font-medium ${
          isActive
            ? "bg-accent text-primary hover:bg-accent"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        <Icon className="size-5" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <div className="ml-8 mt-1 space-y-1">
          {item.items.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              onClick={onClose}
              className={`block rounded-md px-4 py-3 text-base font-medium transition-colors ${
                pathname === sub.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: Category[];
}

export function Sidebar({ isOpen, onClose, categories = [] }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  const navItems = buildNavItems(categories);

  const handleLogout = async () => {
    onClose();
    await useAuthStore.getState().logout();
    router.push("/");
    router.refresh();
  };

  // ESC 키로 모바일 사이드바 닫기
  const handleEscKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [handleEscKey]);

  // 모바일 사이드바 열림 시 body scroll 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* 모바일 오버레이 배경 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="메인 내비게이션"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-card transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* 로고 */}
        <div className="flex h-[100px] items-center justify-between pl-7 pr-5">
          <Link
            href="/"
            onClick={onClose}
            className="text-2xl font-bold text-primary"
          >
            티켓핀
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="lg:hidden"
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </Button>
        </div>

        {/* 모바일 전용: 인증 상태에 따른 UI */}
        <div className="border-b border-border px-6 py-3 lg:hidden">
          {!isLoading && (
            user ? (
              <div className="space-y-2">
                <Link
                  href="/my"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent/80"
                >
                  <UserIcon size={18} />
                  마이페이지
                </Link>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full"
                >
                  <LogOut size={18} />
                  로그아웃
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/auth/register" onClick={onClose}>
                    <UserPlus size={18} />
                    회원가입
                  </Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/auth/login" onClick={onClose}>
                    <LogIn size={18} />
                    로그인
                  </Link>
                </Button>
              </div>
            )
          )}
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-6 py-2">
          {navItems.map((item) => (
            <NavItemRow
              key={item.label}
              item={item as NavItem}
              pathname={pathname}
              onClose={onClose}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
