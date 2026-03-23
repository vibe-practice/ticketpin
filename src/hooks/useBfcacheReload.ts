import { useEffect } from "react";

/**
 * bfcache 방어 훅: 뒤로가기/모바일 잠금해제로 bfcache에서 복원되면 페이지 리로드.
 * 서버 컴포넌트의 상태 검증을 다시 실행하여 stale 화면 방지.
 */
export function useBfcacheReload() {
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
}
