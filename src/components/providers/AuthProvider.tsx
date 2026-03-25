"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

// 인증이 필요한 경로 접두사
const PROTECTED_PATHS = ["/my"];

// 인증 fetch가 불필요한 경로 접두사 (관리자, 업체, 바우처 독립 페이지)
const SKIP_AUTH_PATHS = ["/adminmaster", "/business", "/v/"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // pathname이 바뀔 때 ref를 갱신 (리렌더링 없이 최신 경로 참조)
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 현재 경로가 인증 fetch를 건너뛸 경로인지 판별
  const shouldSkip = SKIP_AUTH_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // 관리자·업체·바우처 페이지에서는 /api/auth/me를 호출하지 않음
    if (shouldSkip) {
      setUser(null);
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");

        if (!res.ok) {
          setUser(null);
          // 비활성 계정(403)이면 보호된 경로에서 로그인으로 리다이렉트
          if (
            res.status === 403 &&
            PROTECTED_PATHS.some((p) => pathnameRef.current.startsWith(p))
          ) {
            router.replace("/auth/login");
          }
          return;
        }

        const data = await res.json();

        if (data.success && data.data) {
          setUser(data.data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [setUser, setLoading, router, shouldSkip]);

  return <>{children}</>;
}
