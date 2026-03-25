"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ShieldCheck, Smartphone, Clock, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface BusinessVerifyFormProps {
  onVerified: () => void;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const TIMER_SECONDS = 3 * 60; // 3분
const CODE_LENGTH = 6;

// ─── 타이머 포맷 유틸 ──────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────

export function BusinessVerifyForm({ onVerified }: BusinessVerifyFormProps) {
  const { businessId } = useBusinessAuth();

  // 인증번호 6자리 — 각 자리별 입력
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isSent, setIsSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(CODE_LENGTH).fill(null));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 타이머 정지
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 타이머 시작
  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(TIMER_SECONDS);
    setIsExpired(false);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // 인증번호 발송
  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    setDigits(Array(CODE_LENGTH).fill(""));

    try {
      const res = await fetch("/api/auth/business/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || "인증번호 발송에 실패했습니다.");
        setIsSending(false);
        return;
      }

      setMaskedPhone(json.data.maskedPhone);
      setIsSending(false);
      setIsSent(true);
      startTimer();

      // 첫 번째 입력칸 포커스
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      setIsSending(false);
    }
  };

  // 자리별 입력 핸들러
  const handleDigitChange = (idx: number, value: string) => {
    // 숫자만 허용
    const digit = value.replace(/\D/g, "").slice(-1);
    if (!digit && value !== "") return;

    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError(null);

    if (digit && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  // 키보드 이동 (BackSpace / Arrow)
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  // 붙여넣기 처리
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!text) return;

    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    setError(null);

    // 마지막으로 채워진 칸 다음으로 포커스
    const focusIdx = Math.min(text.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  // 인증 확인
  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setError("인증번호 6자리를 모두 입력해 주세요.");
      return;
    }
    if (isExpired) {
      setError("인증 시간이 만료되었습니다. 인증번호를 다시 발송해 주세요.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/business/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, code }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setIsVerifying(false);
        setError(json.error?.message || "인증에 실패했습니다.");
        return;
      }

      setIsVerifying(false);
      stopTimer();
      onVerified();
    } catch {
      setIsVerifying(false);
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  const code = digits.join("");
  const isCodeComplete = code.length === CODE_LENGTH;
  const isTimeCritical = timeLeft > 0 && timeLeft <= 60; // 1분 이하 빨간 경고

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200/80 shadow-sm">
          <ShieldCheck size={26} className="text-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">SMS 인증</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            업체 등록 연락처로 인증번호를 발송합니다
          </p>
        </div>
      </div>

      {/* 연락처 표시 (발송 후 마스킹된 번호 표시) */}
      {maskedPhone && (
        <div className="flex items-center justify-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Smartphone size={15} className="text-muted-foreground shrink-0" strokeWidth={1.75} />
          <span className="font-mono text-sm font-semibold tracking-widest text-foreground">
            {maskedPhone}
          </span>
        </div>
      )}

      {/* 발송 버튼 */}
      <Button
        type="button"
        onClick={handleSend}
        disabled={isSending || isVerifying}
        className={cn(
          "h-11 w-full rounded-xl font-semibold text-[15px] transition-all duration-200",
          "bg-black hover:bg-neutral-800 active:scale-[0.98] text-white shadow-sm",
          isSent && "bg-muted/60 text-muted-foreground hover:bg-muted/80 shadow-none border border-border"
        )}
      >
        {isSending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            발송 중...
          </span>
        ) : isSent ? (
          <span className="flex items-center gap-2">
            <RotateCcw size={15} strokeWidth={2} />
            인증번호 재발송
          </span>
        ) : (
          "인증번호 발송"
        )}
      </Button>

      {/* 인증번호 입력 영역 (발송 후 표시) */}
      {isSent && (
        <div className="flex flex-col gap-4">
          {/* 6자리 입력 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">인증번호 6자리</label>

              {/* 타이머 */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums transition-colors",
                  isExpired
                    ? "bg-destructive/10 text-destructive"
                    : isTimeCritical
                    ? "bg-red-50 text-red-600 animate-pulse"
                    : "bg-neutral-50 text-foreground"
                )}
                aria-live="polite"
                aria-label={`남은 시간 ${formatTime(timeLeft)}`}
              >
                <Clock size={13} strokeWidth={2} className="shrink-0" />
                {isExpired ? "만료됨" : formatTime(timeLeft)}
              </div>
            </div>

            {/* 자리별 입력 박스 */}
            <div className="grid grid-cols-6 gap-2" role="group" aria-label="6자리 인증번호 입력">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={isExpired || isVerifying}
                  aria-label={`인증번호 ${idx + 1}번째 자리`}
                  className={cn(
                    "w-full h-14 rounded-xl border-2 text-center text-2xl font-bold tabular-nums",
                    "transition-all duration-150 outline-none",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    // 기본 상태
                    digit
                      ? "border-neutral-400 bg-neutral-50 text-foreground shadow-sm"
                      : "border-border bg-background text-foreground",
                    // 포커스 상태
                    "focus:border-neutral-900 focus:ring-3 focus:ring-neutral-900/20 focus:bg-neutral-50/50",
                    // 에러 상태
                    error && !digit && "border-destructive/50",
                    // 만료 상태
                    isExpired && "border-border bg-muted/30"
                  )}
                />
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5" role="alert">
              <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" strokeWidth={2} />
              <span className="text-[14px] text-destructive leading-relaxed">{error}</span>
            </div>
          )}

          {/* 만료 안내 */}
          {isExpired && !error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5" role="alert">
              <AlertCircle size={14} className="text-destructive shrink-0" strokeWidth={2} />
              <span className="text-[14px] text-destructive">인증 시간이 만료되었습니다. 인증번호를 다시 발송해 주세요.</span>
            </div>
          )}

          {/* 확인 버튼 */}
          <Button
            type="button"
            onClick={handleVerify}
            disabled={!isCodeComplete || isExpired || isVerifying}
            className={cn(
              "h-12 w-full rounded-xl font-bold text-[15px] transition-all duration-200",
              "bg-black hover:bg-neutral-800 active:scale-[0.98] text-white",
              "disabled:bg-muted/50 disabled:text-muted-foreground disabled:shadow-none"
            )}
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                확인 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} strokeWidth={2.2} />
                인증 확인
              </span>
            )}
          </Button>

          {/* 안내 문구 */}
          <p className="text-center text-[14px] text-muted-foreground leading-relaxed">
            인증번호가 오지 않는 경우, 관리자에게 문의하거나
            <br />
            위 &apos;재발송&apos; 버튼을 눌러주세요.
          </p>
        </div>
      )}
    </div>
  );
}
