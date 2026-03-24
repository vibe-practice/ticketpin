"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  XCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn, isCancelableToday } from "@/lib/utils";
import PinInput from "./PinInput";
import ProductInfoCard from "./ProductInfoCard";
import VoucherProgressBar from "./VoucherProgressBar";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import type { VoucherWithDetails } from "@/types";

interface SetPasswordProps {
  voucher: VoucherWithDetails;
}

const PIN_LENGTH = 4;

export default function SetPassword({ voucher }: SetPasswordProps) {
  const router = useRouter();
  useBfcacheReload();
  const confirmFirstInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [confirmPassword, setConfirmPassword] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMatched, setIsMatched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 결제취소 버튼 노출 조건: 비밀번호 미설정 + 선물이 아닌 직접구매 + 결제 당일
  const showCancelButton = !voucher.user_password_hash && !voucher.is_gift && isCancelableToday(voucher.order.created_at);

  const passwordFilled = password.every((d) => d !== "");

  // 두 PinInput 모두 4자리 입력 완료 시 자동 비교
  const checkMatch = (pw: string[], confirm: string[]) => {
    if (!pw.every((d) => d !== "") || !confirm.every((d) => d !== "")) return;
    const pwStr = pw.join("");
    const confirmStr = confirm.join("");
    if (pwStr === confirmStr) {
      setIsMatched(true);
      setErrorMessage(null);
    } else {
      setIsMatched(false);
      setErrorMessage("비밀번호가 일치하지 않습니다. 다시 입력해주세요.");
      setConfirmPassword(Array(PIN_LENGTH).fill(""));
      setTimeout(() => confirmFirstInputRef.current?.focus(), 50);
    }
  };

  const handlePasswordChange = (value: string[]) => {
    setPassword(value);
    setIsMatched(false);
    setErrorMessage(null);
    checkMatch(value, confirmPassword);
  };

  const handleConfirmChange = (value: string[]) => {
    setConfirmPassword(value);
    setIsMatched(false);
    setErrorMessage(null);
    checkMatch(password, value);
  };

  const handleSubmit = async () => {
    if (!isMatched) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.join("") }),
      });
      const data = await res.json();

      if (data.success) {
        router.replace(`/v/${voucher.code}/actions`);
      } else {
        setIsSubmitting(false);
        setErrorMessage(data.error?.message ?? "비밀번호 설정에 실패했습니다.");
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage("서버 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="w-full">
      {/* 프로세스 바 */}
      <VoucherProgressBar currentStep={2} />

      {/* 큰 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        4자리 비밀번호를{"\n"}설정해주세요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        이 비밀번호로 핀 번호를 확인하거나 선물할 수 있습니다.
      </p>

      {/* 상품 정보 카드 */}
      <ProductInfoCard voucher={voucher} />

      {/* 비밀번호 입력 */}
      <div className="mt-5">
        <div className="mb-1 flex items-center gap-1.5">
          <Lock size={14} className="text-muted-foreground" />
          <label className="text-[14px] font-medium text-foreground">
            비밀번호 (숫자 4자리)
          </label>
        </div>
        <PinInput
          length={PIN_LENGTH}
          value={password}
          onChange={handlePasswordChange}
          disabled={isSubmitting}
          hasError={false}
          autoFocus
          label="비밀번호"
          type="password"
        />
      </div>

      {/* 비밀번호 확인 */}
      <div className="mt-5">
        <label className="mb-1 block text-[14px] font-medium text-foreground">
          비밀번호 확인
        </label>
        <PinInput
          length={PIN_LENGTH}
          value={confirmPassword}
          onChange={handleConfirmChange}
          disabled={isSubmitting || !passwordFilled}
          hasError={!!errorMessage}
          label="비밀번호 확인"
          type="password"
          firstInputRef={confirmFirstInputRef}
        />
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
          <p className="text-[15px] leading-snug text-error">{errorMessage}</p>
        </div>
      )}

      {/* 일치 메시지 */}
      {isMatched && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-success-bg px-3 py-2">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" />
          <p className="text-[15px] leading-snug text-success">비밀번호가 일치합니다.</p>
        </div>
      )}

      {/* 경고 텍스트 */}
      <div className="mt-4 flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2.5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[14px] leading-relaxed text-warning">
          비밀번호를 설정하면 <strong>결제 취소가 불가</strong>합니다. 취소를 원하시면 아래 결제취소 버튼을 이용해주세요.
        </p>
      </div>

      {/* 설정 완료 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!isMatched || isSubmitting}
        className={cn(
          "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition-all",
          isMatched && !isSubmitting
            ? "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {isSubmitting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            설정 중...
          </>
        ) : (
          <>
            설정 완료
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {/* 결제취소 버튼 (조건부) */}
      {showCancelButton && (
        <div className="mt-3">
          <Link
            href={`/v/${voucher.code}/cancel`}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-[15px] font-medium text-muted-foreground hover:border-error/40 hover:bg-error-bg hover:text-error transition-all"
          >
            <XCircle size={15} />
            결제 취소
          </Link>
          <p className="mt-1.5 text-center text-[14px] text-muted-foreground">
            비밀번호 설정 전 마지막 취소 기회입니다.
          </p>
        </div>
      )}

      {/* 홈으로 이동 */}
      <Link
        href="/"
        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-border text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
      >
        홈으로 이동
      </Link>
    </div>
  );
}
