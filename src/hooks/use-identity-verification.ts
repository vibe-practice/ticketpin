"use client";

// ============================================================
// 다날 본인인증 커스텀 훅
// - Ready API 호출 → 팝업 열기 → form submit → postMessage 수신 → 결과 조회
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { VerificationResult } from "@/components/ui/identity-verification-modal";

interface UseIdentityVerificationOptions {
  purpose?: "register" | "find-id" | "reset-password";
  onVerified: (result: VerificationResult) => void;
  onExistingUser?: (username: string) => void;
  onNotFound?: () => void;
  onError?: (message: string) => void;
}

interface UseIdentityVerificationReturn {
  startVerification: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useIdentityVerification({
  purpose = "register",
  onVerified,
  onExistingUser,
  onNotFound,
  onError,
}: UseIdentityVerificationOptions): UseIdentityVerificationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const purposeRef = useRef(purpose);
  // Keep latest callbacks in refs to avoid stale closures
  const onVerifiedRef = useRef(onVerified);
  const onExistingUserRef = useRef(onExistingUser);
  const onNotFoundRef = useRef(onNotFound);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onExistingUserRef.current = onExistingUser;
    onNotFoundRef.current = onNotFound;
    onErrorRef.current = onError;
  }, [onVerified, onExistingUser, onNotFound, onError]);

  const fetchResult = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch("/api/auth/identity/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, purpose: purposeRef.current }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        sessionIdRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
        setError(null);

        // 이미 가입된 계정이 있으면 onExistingUser 콜백 호출
        if (json.data.existingUsername) {
          onExistingUserRef.current?.(json.data.existingUsername);
          return;
        }

        // 비밀번호 재설정: 계정을 찾지 못하면 notFound 콜백
        if (purposeRef.current === "reset-password" && !json.data.resetToken) {
          onNotFoundRef.current?.();
          return;
        }

        onVerifiedRef.current({
          name: json.data.name,
          phone: json.data.phone,
          verified: true,
          ...(json.data.username && { username: json.data.username }),
          ...(json.data.resetToken && { resetToken: json.data.resetToken }),
        });
      } else {
        isLoadingRef.current = false;
        setIsLoading(false);
        const msg = json.error?.message || "인증 결과를 가져올 수 없습니다.";
        setError(msg);
        onErrorRef.current?.(msg);
      }
    } catch {
      isLoadingRef.current = false;
      setIsLoading(false);
      const msg = "인증 결과 조회 중 오류가 발생했습니다.";
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, []);

  // postMessage 리스너
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // origin 검증
      const appUrl = window.location.origin;
      if (event.origin !== appUrl) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "DANAL_IDENTITY_VERIFIED" && data.sessionId) {
        // 결과 조회 API 호출
        fetchResult(data.sessionId);
      } else if (data.type === "DANAL_IDENTITY_ERROR") {
        isLoadingRef.current = false;
        setIsLoading(false);
        const msg = data.message || "본인인증에 실패했습니다.";
        setError(msg);
        onErrorRef.current?.(msg);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchResult]);

  // 팝업 닫힘 감지 (인증 취소 케이스)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isLoading && popupRef.current) {
      interval = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          // 팝업이 닫혔는데 결과가 없으면 취소로 처리
          if (sessionIdRef.current) {
            isLoadingRef.current = false;
            setIsLoading(false);
            // 사용자가 직접 닫은 경우 — 에러가 아닌 조용한 취소
          }
          if (interval) clearInterval(interval);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const startVerification = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Ready API 호출
      const res = await fetch("/api/auth/identity/ready", { method: "POST" });
      const json = await res.json();

      if (!json.success || !json.data) {
        const msg = json.error?.message || "본인인증 준비에 실패했습니다.";
        isLoadingRef.current = false;
        setIsLoading(false);
        setError(msg);
        onErrorRef.current?.(msg);
        return;
      }

      const { sessionId, formAction, formFields } = json.data;
      sessionIdRef.current = sessionId;

      // 2. 팝업 열기
      const popup = window.open(
        "about:blank",
        "danal_identity",
        "width=480,height=700,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        isLoadingRef.current = false;
        setIsLoading(false);
        const msg = "팝업이 차단되었습니다. 팝업 차단을 해제한 후 다시 시도해 주세요.";
        setError(msg);
        onErrorRef.current?.(msg);
        return;
      }

      popupRef.current = popup;

      // 3. 팝업 내에 hidden form 생성 후 submit
      const doc = popup.document;
      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>본인인증</title></head>
<body>
<form id="danalForm" method="POST" action="${escapeHtml(formAction)}">
${Object.entries(formFields)
  .map(
    ([key, value]) =>
      `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value as string)}" />`
  )
  .join("\n")}
</form>
<script>document.getElementById("danalForm").submit();</script>
</body>
</html>`);
      doc.close();
    } catch {
      isLoadingRef.current = false;
      setIsLoading(false);
      const msg = "본인인증 요청 중 오류가 발생했습니다.";
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, []);

  return { startVerification, isLoading, error };
}

/** HTML attribute value escaping */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
