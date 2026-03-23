"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

type AuthStep = "loading" | "verify" | "login" | "dashboard";

interface BusinessAuthContextValue {
  step: AuthStep;
  setStep: (step: AuthStep) => void;
  isAuthenticated: boolean;
  businessId: string;
  businessName: string;
  logout: () => Promise<void>;
}

const BusinessAuthContext = createContext<BusinessAuthContextValue | null>(null);

export function BusinessAuthProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId as string) ?? "";
  const [step, setStepRaw] = useState<AuthStep>("loading");
  const [businessName, setBusinessName] = useState("");
  const checkedRef = useRef(false);

  const setStep = useCallback((s: AuthStep) => setStepRaw(s), []);

  // 마운트 시 기존 세션 확인
  useEffect(() => {
    if (checkedRef.current || !businessId) return;
    checkedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/business/me", { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            // 세션의 businessId 또는 loginId와 URL의 identifier 일치 확인
            if (json.data.id === businessId || json.data.loginId === businessId) {
              setBusinessName(json.data.businessName ?? "");
              setStepRaw("dashboard");
              return;
            }
          }
        }
      } catch {
        // 세션 확인 실패 시 인증 단계로
      }

      setStepRaw("verify");
    })();
  }, [businessId]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/business/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // 로그아웃 API 실패해도 클라이언트 상태는 초기화
    }
    setBusinessName("");
    setStepRaw("verify");
    // 서브 페이지에서 로그아웃 시 루트 페이지로 이동
    if (businessId) {
      router.replace(`/business/${businessId}`);
    }
  }, [businessId, router]);

  return (
    <BusinessAuthContext.Provider
      value={{
        step,
        setStep,
        isAuthenticated: step === "dashboard",
        businessId,
        businessName,
        logout,
      }}
    >
      {children}
    </BusinessAuthContext.Provider>
  );
}

export function useBusinessAuth() {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error("useBusinessAuth must be inside BusinessAuthProvider");
  return ctx;
}
