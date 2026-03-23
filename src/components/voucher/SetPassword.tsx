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
    <div className="w-full max-w-sm">
      {/* 상품 정보 카드 */}
      <ProductInfoCard voucher={voucher} />

      {/* 비밀번호 설정 영역 */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-1.5">
          <Lock size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">비밀번호 설정</span>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground leading-relaxed">
          상품권을 안전하게 보호할 비밀번호를 설정해주세요.
        </p>

        {/* 비밀번호 입력 */}
        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-medium text-foreground">
            비밀번호 (숫자 4자리)
          </label>
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
        <div className="mb-4">
          <label className="mb-2 block text-[13px] font-medium text-foreground">
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
          <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
            <p className="text-sm leading-snug text-error">{errorMessage}</p>
          </div>
        )}

        {/* 일치 메시지 */}
        {isMatched && (
          <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-success-bg px-3 py-2">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" />
            <p className="text-sm leading-snug text-success">비밀번호가 일치합니다.</p>
          </div>
        )}

        {/* 설정 완료 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!isMatched || isSubmitting}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
            isMatched && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-brand-primary-dark active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              설정 중...
            </>
          ) : (
            <>
              설정 완료
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* 경고 텍스트 */}
      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2.5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[13px] leading-relaxed text-warning">
          비밀번호를 설정하면 <strong>결제 취소가 불가</strong>합니다. 취소를 원하시면 아래 결제취소 버튼을 이용해주세요.
        </p>
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
            비밀번호 설정 전 마지막 취소 기회입니다.
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
