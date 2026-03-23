"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BusinessSidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from "@/components/business/BusinessSidebar";
import { BusinessTopBar } from "@/components/business/BusinessTopBar";
import { BusinessAuthProvider, useBusinessAuth } from "@/components/business/BusinessAuthContext";

function BusinessLayoutInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, businessId, step } = useBusinessAuth();

  // businessId가 유효한 경우에만 서브 페이지 여부 판단
  const basePath = businessId ? `/business/${businessId}` : null;
  const isSubPage = basePath
    ? pathname !== basePath && pathname.startsWith(basePath + "/")
    : false;

  // 미인증 상태에서 서브 페이지 접근 시 루트로 리다이렉트
  useEffect(() => {
    if (step === "loading") return; // 세션 확인 중에는 대기
    if (!isAuthenticated && basePath && isSubPage) {
      router.replace(basePath);
    }
  }, [isAuthenticated, basePath, isSubPage, pathname, router, step]);

  // 업체 로그인 페이지 또는 미인증 상태 → 사이드바/상단바 없이 children만 렌더
  // 서브 페이지일 경우 리다이렉트 중이므로 빈 화면 표시
  if (pathname === "/business/login" || !isAuthenticated) {
    if (isSubPage) {
      return null; // 리다이렉트 중 — 깨진 UI 노출 방지
    }
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 */}
      <BusinessSidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* 사이드바 너비만큼 spacer (데스크탑) */}
      <div
        className="hidden lg:block shrink-0 transition-[width] duration-200 ease-out"
        style={{
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }}
        aria-hidden="true"
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <BusinessTopBar
          onMobileMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BusinessAuthProvider>
      <BusinessLayoutInner>{children}</BusinessLayoutInner>
    </BusinessAuthProvider>
  );
}
