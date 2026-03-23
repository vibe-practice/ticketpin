"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AllowedIpSection } from "./_components/AllowedIpSection";
import { AdminAccountsSection } from "./_components/AdminAccountsSection";

// ─── 공통 타입 ────────────────────────────────────────────────────────────────

export interface ServerMessage {
  type: "success" | "error";
  text: string;
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<string>("");

  // 현재 로그인한 관리자 ID 가져오기
  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.id) {
          setCurrentAdminId(result.data.id);
        }
      })
      .catch(() => {});
  }, []);

  // 메시지 자동 제거
  useEffect(() => {
    if (!serverMessage) return;
    const timer = setTimeout(() => setServerMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [serverMessage]);

  const handleMessage = useCallback((msg: ServerMessage) => {
    setServerMessage(msg);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          관리자 접속 IP 관리 및 시스템 설정
        </p>
      </div>

      {/* 서버 메시지 */}
      {serverMessage && (
        <div
          role="alert"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            serverMessage.type === "success"
              ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          {serverMessage.type === "success" ? (
            <CheckCircle2 size={15} className="shrink-0" />
          ) : (
            <AlertCircle size={15} className="shrink-0" />
          )}
          {serverMessage.text}
        </div>
      )}

      {/* 허용된 IP 관리 */}
      <AllowedIpSection onMessage={handleMessage} />

      {/* 관리자 계정 관리 */}
      <AdminAccountsSection
        currentAdminId={currentAdminId}
        onMessage={handleMessage}
      />
    </div>
  );
}
