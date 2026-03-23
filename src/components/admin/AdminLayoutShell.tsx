"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

interface AdminLayoutShellProps {
  children: React.ReactNode;
}

export function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // 관리자 로그인 페이지는 독립 레이아웃 (사이드바/상단바 없음)
  if (pathname === "/adminmaster/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 */}
      <AdminSidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* 사이드바 너비만큼 마진 (데스크탑) */}
      <div
        className="hidden lg:block shrink-0 transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? 72 : 240 }}
        aria-hidden="true"
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar
          onMobileMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto p-2 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
