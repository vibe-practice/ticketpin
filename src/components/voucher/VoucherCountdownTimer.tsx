"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoucherCountdownTimerProps {
  expiresAt: string; // ISO 8601
  onExpire: () => void;
}

function getRemainingSeconds(expiresAt: string): number {
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function VoucherCountdownTimer({
  expiresAt,
  onExpire,
}: VoucherCountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(expiresAt));

  const isWarning = remaining <= 300; // 5분 이하

  useEffect(() => {
    if (getRemainingSeconds(expiresAt) <= 0) {
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      const secs = getRemainingSeconds(expiresAt);
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  // 경고 상태일 때 깜빡임 효과 (CSS 애니메이션 사용)

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-3 transition-all duration-300",
        isWarning
          ? "bg-error-bg border border-error/20"
          : "bg-brand-primary-muted border border-primary/10"
      )}
    >
      <Clock
        size={16}
        className={cn(
          "shrink-0 transition-colors duration-300",
          isWarning ? "text-error" : "text-primary"
        )}
      />
      <span
        className={cn(
          "text-[15px] font-medium transition-colors duration-300",
          isWarning ? "text-error/70" : "text-primary/60"
        )}
      >
        인증 남은 시간
      </span>
      <span
        className={cn(
          "ml-auto text-2xl font-bold tabular-nums leading-none tracking-wider transition-all duration-300",
          isWarning
            ? "text-error animate-pulse"
            : "text-primary"
        )}
      >
        {formatTime(remaining)}
      </span>
      {isWarning && (
        <span className="text-[14px] font-semibold text-error animate-pulse">
          시간 부족
        </span>
      )}
    </div>
  );
}
