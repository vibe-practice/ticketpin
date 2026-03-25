"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, ChevronRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── 경로 → 타이틀 매핑 ────────────────────────────────────────────────────

const PATH_LABELS: Record<string, string[]> = {
  "/adminmaster": ["대시보드"],
  "/adminmaster/orders": ["주문관리"],
  "/adminmaster/members": ["회원관리"],
  "/adminmaster/products": ["상품권관리"],
  "/adminmaster/pins": ["핀번호관리"],
  "/adminmaster/gifts": ["선물이력"],
  "/adminmaster/refunds": ["취소/환불관리"],
  "/adminmaster/settlements": ["업체/정산 관리", "정산 관리"],
  "/adminmaster/settlements/overview": ["업체/정산 관리", "전체보기"],
  "/adminmaster/businesses": ["업체/정산 관리", "업체 관리"],
  "/adminmaster/faq": ["고객센터 관리", "FAQ 관리"],
  "/adminmaster/notices": ["고객센터 관리", "공지사항 관리"],
  "/adminmaster/categories": ["고객센터 관리", "카테고리 관리"],
  "/adminmaster/settings": ["설정"],
};

function getBreadcrumb(pathname: string): string[] {
  // 정확 매칭 우선
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname];

  // 가장 긴 접두사 매칭
  const match = Object.keys(PATH_LABELS)
    .filter((key) => key !== "/adminmaster" && pathname.startsWith(key + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return match ? PATH_LABELS[match] : ["대시보드"];
}

// ─── 관리자 정보 타입 ─────────────────────────────────────────────────────

interface AdminInfo {
  name: string;
  username: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

interface AdminTopBarProps {
  onMobileMenuClick: () => void;
}

export function AdminTopBar({ onMobileMenuClick }: AdminTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumb = getBreadcrumb(pathname);

  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  // 로그인한 관리자 정보 조회
  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          setAdminInfo({
            name: result.data.name,
            username: result.data.username,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/admin/logout", { method: "POST" });
    } catch {
      // 로그아웃 API 실패해도 로그인 페이지로 이동
    }
    router.push("/adminmaster/login");
    router.refresh();
  };

  // 아바타 이니셜: 이름 첫 글자 또는 기본 A
  const avatarInitial = adminInfo?.name?.[0]?.toUpperCase() || "A";

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
        <nav aria-label="관리자 브레드크럼" className="flex items-center gap-1.5 min-w-0">
          <div className="hidden lg:flex items-center gap-1 text-muted-foreground">
            <LayoutDashboard size={14} strokeWidth={1.75} />
            <span className="text-xs font-medium">관리자</span>
          </div>

          {breadcrumb.map((label, idx) => (
            <div key={idx} className="flex items-center gap-1.5 min-w-0">
              {/* 구분자 */}
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

      {/* ── 오른쪽: 관리자 정보 + 로그아웃 ─────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 관리자 뱃지 */}
        <div className="hidden sm:flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2">
          {/* 아바타 */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">
            {avatarInitial}
          </div>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold text-foreground">
              {adminInfo?.name || "관리자"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {adminInfo?.username || ""}
            </p>
          </div>
        </div>

        {/* 로그아웃 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-[14px] h-9"
        >
          <LogOut size={14} strokeWidth={2} />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    </header>
  );
}
