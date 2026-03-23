"use client";

import { BusinessVerifyForm } from "@/components/business/auth/BusinessVerifyForm";
import { BusinessLoginForm } from "@/components/business/auth/BusinessLoginForm";
import { BusinessDashboardClient } from "@/components/business/dashboard/BusinessDashboardClient";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";
import { Loader2 } from "lucide-react";

// ─── 인증 전체 화면 ───────────────────────────────────────────────────────

function AuthFullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-neutral-200 blur-[100px] opacity-60" />
        <div className="absolute right-1/4 bottom-1/4 h-56 w-56 rounded-full bg-neutral-300 blur-[80px] opacity-50" />
      </div>

      <div className="relative w-full max-w-[420px] px-4">
        {/* 카드 */}
        <div className="rounded-2xl border border-border bg-card shadow-xl ring-1 ring-black/5">
          <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-800" />
          <div className="px-8 py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 로딩 화면 ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <AuthFullScreen>
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 size={32} className="text-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">세션 확인 중...</p>
      </div>
    </AuthFullScreen>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────

export default function BusinessDashboardPage() {
  const { step, setStep } = useBusinessAuth();

  // 세션 확인 중
  if (step === "loading") {
    return <LoadingScreen />;
  }

  // 대시보드 상태: 실제 대시보드 컴포넌트 표시 (레이아웃이 사이드바/상단바 렌더)
  if (step === "dashboard") {
    return <BusinessDashboardClient />;
  }

  // 인증 단계: 레이아웃이 사이드바를 숨기므로 전체 화면 인증 UI
  return (
    <AuthFullScreen>
      {step === "verify" && (
        <BusinessVerifyForm
          onVerified={() => setStep("login")}
        />
      )}
      {step === "login" && (
        <BusinessLoginForm
          onLoggedIn={() => setStep("dashboard")}
        />
      )}
    </AuthFullScreen>
  );
}
