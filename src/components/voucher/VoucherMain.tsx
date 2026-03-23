"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Lock,
  RefreshCw,
  XCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn, isCancelableToday } from "@/lib/utils";
import { VOUCHER_MAX_ATTEMPTS, VOUCHER_MAX_REISSUE } from "@/lib/constants";
import VoucherCountdownTimer from "./VoucherCountdownTimer";
import TempPasswordInput from "./TempPasswordInput";
import PhishingWarning, { hasConfirmedPhishingWarning } from "./PhishingWarning";
import ProductInfoCard from "./ProductInfoCard";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import type { VoucherWithDetails } from "@/types";

interface VoucherMainProps {
  voucher: VoucherWithDetails;
  senderUsername?: string; // 선물받은 경우 보낸 사람 표시명 (아이디(이름) 형식)
  // 개발용: 만료 시간 ISO 문자열 (서버에서 계산하여 전달)
  expiresAt: string;
}

type PageState = "active" | "expired" | "locked";

export default function VoucherMain({
  voucher,
  senderUsername,
  expiresAt,
}: VoucherMainProps) {
  const router = useRouter();

  // 보이스피싱 주의 화면 확인 여부 (sessionStorage 기반)
  // lazy initializer로 클라이언트 마운트 시점에 sessionStorage를 읽어 초기값 설정
  const [showPhishingWarning, setShowPhishingWarning] = useState(
    () => typeof window !== "undefined" && !hasConfirmedPhishingWarning(voucher.code)
  );

  const isAlreadyLocked = voucher.is_password_locked;
  const initialAttempts = voucher.temp_password_attempts;
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>(
    isAlreadyLocked ? "locked" : "active"
  );
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", ""]);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [reissueCount, setReissueCount] = useState(voucher.reissue_count);
  const [currentExpiresAt, setCurrentExpiresAt] = useState(expiresAt);
  const [timerKey, setTimerKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReissuing, setIsReissuing] = useState(false);

  useBfcacheReload();

  const reissueRemaining = VOUCHER_MAX_REISSUE - reissueCount;

  const isLocked = pageState === "locked";
  const isExpired = pageState === "expired";

  // 결제취소 버튼 노출 조건: 비밀번호 미설정 + 선물이 아닌 직접구매 + 결제 당일
  const canCancelToday = isCancelableToday(voucher.order.created_at);
  const showCancelButton =
    !voucher.user_password_hash && !voucher.is_gift && !isLocked && !isExpired && canCancelToday;
  const showCancelExpiredNotice =
    !voucher.user_password_hash && !voucher.is_gift && !isLocked && !isExpired && !canCancelToday;

  const handleExpire = useCallback(() => {
    setPageState("expired");
    setErrorMessage(null);
  }, []);

  const handleVerify = async () => {
    const enteredPassword = pinDigits.join("");
    if (enteredPassword.length < 3) {
      setErrorMessage("임시 비밀번호 3자리를 모두 입력해주세요.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/verify-temp-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_password: enteredPassword }),
      });
      const data = await res.json();

      if (data.success) {
        // 성공: 비밀번호 설정 페이지로 이동
        router.replace(`/v/${voucher.code}/set-pw`);
      } else {
        if (data.error?.code === "VOUCHER_LOCKED" || data.data?.is_locked) {
          setPageState("locked");
          setErrorMessage(null);
        } else if (data.error?.code === "TEMP_PASSWORD_EXPIRED") {
          setPageState("expired");
          setErrorMessage(null);
        } else {
          const newAttempts = data.data?.attempts ?? attempts + 1;
          setAttempts(newAttempts);
          setPinDigits(["", "", ""]);
          setErrorMessage(data.error?.message ?? "임시 비밀번호가 올바르지 않습니다.");
          setTimeout(() => firstInputRef.current?.focus(), 50);
        }
      }
    } catch {
      setErrorMessage("서버 오류가 발생했습니다. 다시 시도해주세요.");
    }

    setIsVerifying(false);
  };

  const handleReissue = async () => {
    if (reissueRemaining <= 0) return;
    setIsReissuing(true);

    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/reissue`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setCurrentExpiresAt(data.data.temp_password_expires_at);
        setTimerKey((k) => k + 1);
        setAttempts(0);
        setReissueCount(data.data.reissue_count);
        setErrorMessage(null);
        setPinDigits(["", "", ""]);
        setPageState("active");
      } else {
        setErrorMessage(data.error?.message ?? "재발행에 실패했습니다.");
      }
    } catch {
      setErrorMessage("서버 오류가 발생했습니다. 다시 시도해주세요.");
    }

    setIsReissuing(false);
  };

  // ── 보이스피싱 주의 화면 (최초 접속 시) ──────────────
  if (showPhishingWarning) {
    return (
      <PhishingWarning
        voucherCode={voucher.code}
        onConfirm={() => setShowPhishingWarning(false)}
      />
    );
  }

  // ── 잠금 상태 화면 ───────────────────────────────
  if (isLocked) {
    return (
      <div className="w-full max-w-sm">
        <ProductInfoCard voucher={voucher} senderUsername={senderUsername} />
        <div className="mt-4 rounded-xl border border-error/20 bg-error-bg p-5 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
              <Lock size={22} className="text-error" />
            </div>
          </div>
          <h3 className="mb-1.5 text-base font-bold text-error">입력이 잠겼습니다</h3>
          <p className="text-sm text-foreground/70">고객센터에 문의해주세요.</p>
          <div className="mt-4 rounded-lg bg-error/5 px-4 py-3 text-left text-sm leading-relaxed">
            <p className="text-muted-foreground">
              주문번호: <span className="font-semibold text-foreground">{voucher.order.order_number}</span>
            </p>
            <p className="mt-1.5 text-muted-foreground">
              주문번호와 함께 고객센터에 문의해주세요.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href="/"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  // ── 만료 상태 화면 ───────────────────────────────
  if (isExpired) {
    return (
      <div className="w-full max-w-sm">
        <ProductInfoCard voucher={voucher} senderUsername={senderUsername} />
        <div className="mt-4 rounded-xl border border-warning/20 bg-warning-bg p-5 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <RefreshCw size={22} className="text-warning" />
            </div>
          </div>
          <h3 className="mb-1.5 text-base font-bold text-warning">인증 시간이 만료되었어요</h3>
          <p className="text-sm text-foreground/70">새 임시 비밀번호를 발급받아 다시 시도해주세요.</p>
        </div>

        {reissueRemaining > 0 ? (
          <div className="mt-4 space-y-2">
            <button
              onClick={handleReissue}
              disabled={isReissuing}
              className={cn(
                "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
                "bg-primary text-primary-foreground hover:bg-brand-primary-dark active:scale-[0.98]",
                isReissuing && "opacity-70 cursor-not-allowed"
              )}
            >
              {isReissuing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  발급 중...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  임시 비밀번호 재발행
                </>
              )}
            </button>
            <p className="text-center text-[13px] text-muted-foreground">
              재발행 가능 횟수:{" "}
              <span className="font-semibold text-foreground">{reissueRemaining}회</span> 남음
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-error/20 bg-error-bg p-4 text-center">
            <p className="text-sm font-semibold text-error">재발행 횟수({VOUCHER_MAX_REISSUE}회)를 모두 사용했습니다.</p>
            <p className="mt-1 text-[13px] text-foreground/70">고객센터에 문의해주세요.</p>
          </div>
        )}
      </div>
    );
  }

  // ── 정상(active) 상태 화면 ───────────────────────
  const isFilled = pinDigits.every((d) => d !== "");
  const hasError = !!errorMessage;

  return (
    <div className="w-full max-w-sm">
      {/* 상품 정보 카드 */}
      <ProductInfoCard voucher={voucher} senderUsername={senderUsername} />

      {/* 타이머 */}
      <div className="mt-4">
        <VoucherCountdownTimer
          key={timerKey}
          expiresAt={currentExpiresAt}
          onExpire={handleExpire}
        />
      </div>

      {/* 임시 비밀번호 입력 영역 */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-1.5">
          <ShieldCheck size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">임시 비밀번호 입력</span>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground leading-relaxed">
          구매 시 발송된 문자 메시지의 임시 비밀번호{" "}
          <strong className="text-foreground">3자리</strong>를 입력해주세요.
        </p>

        <TempPasswordInput
          value={pinDigits}
          onChange={setPinDigits}
          disabled={isVerifying}
          hasError={hasError}
          firstInputRef={firstInputRef}
        />

        {/* 실패 메시지 */}
        {hasError && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
            <p className="text-sm leading-snug text-error">{errorMessage}</p>
          </div>
        )}

        {/* 시도 횟수 표시 (1회 이상 실패 시) */}
        {attempts > 0 && !hasError && (
          <p className="mt-3 text-center text-[13px] text-muted-foreground">
            실패 {attempts}/{VOUCHER_MAX_ATTEMPTS}회
          </p>
        )}

        <button
          onClick={handleVerify}
          disabled={!isFilled || isVerifying}
          className={cn(
            "mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
            isFilled && !isVerifying
              ? "bg-primary text-primary-foreground hover:bg-brand-primary-dark active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {isVerifying ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              확인 중...
            </>
          ) : (
            <>
              확인
              <ArrowRight size={16} />
            </>
          )}
        </button>

      </div>

      {/* 결제취소 버튼 (조건부) */}
      {showCancelButton && (
        <div className="mt-3">
          <Link
            href={`/v/${voucher.code}/cancel`}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:border-error/40 hover:bg-error-bg hover:text-error transition-all"
          >
            <XCircle size={15} />
            결제 취소
          </Link>
          <p className="mt-1.5 text-center text-[13px] text-muted-foreground">
            비밀번호 설정 전에만 결제 취소가 가능합니다.
          </p>
        </div>
      )}

      {/* 결제취소 기한 초과 안내 */}
      {showCancelExpiredNotice && (
        <div className="mt-3">
          <p className="text-center text-[13px] text-muted-foreground">
            결제 취소는 결제 당일 자정까지만 가능합니다.
          </p>
        </div>
      )}

      {/* 홈으로 이동 */}
      <div className="mt-3">
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
