"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  ArrowLeft,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
  getPasswordStrength,
} from "@/lib/validations/auth";
import {
  IdentityVerificationModal,
  type VerificationResult,
} from "@/components/ui/identity-verification-modal";
import { maskUsername } from "@/lib/utils";

// Stepper 컴포넌트
const STEPS = [
  { num: "01", label: "본인인증" },
  { num: "02", label: "비밀번호 재설정" },
  { num: "03", label: "완료" },
];

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mb-8 flex">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;

        return (
          <div key={step.num} className="relative flex flex-1 flex-col items-center">
            {/* 원형 인디케이터 */}
            <div
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                isDone
                  ? "bg-neutral-200 text-foreground"
                  : isActive
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-muted-foreground"
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={15} strokeWidth={2.5} />
              ) : (
                step.num
              )}
            </div>

            {/* 레이블 */}
            <span
              className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                isActive
                  ? "text-foreground"
                  : isDone
                  ? "text-secondary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>

            {/* 연결선 (마지막 스텝 제외) */}
            {idx < STEPS.length - 1 && (
              <div className="absolute top-4 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-px bg-neutral-200 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-neutral-950 transition-all duration-500 ${
                    current > stepNum ? "w-full" : "w-0"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step 1: 본인인증
function Step1({ onVerified }: { onVerified: (result: VerificationResult) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">비밀번호 재설정</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          본인인증 후 새 비밀번호를 설정할 수 있습니다.
        </p>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99]"
        >
          <ShieldCheck size={17} />
          본인인증하기
        </Button>

        <div className="mt-7 flex items-center justify-center gap-5 text-sm text-muted-foreground">
          <Link
            href="/auth/find-id"
            className="hover:text-foreground transition-colors duration-150"
          >
            아이디 찾기
          </Link>
          <span className="text-muted-foreground select-none">|</span>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            로그인으로 돌아가기
          </Link>
        </div>
      </div>

      <IdentityVerificationModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        purpose="reset-password"
        onVerified={(result) => {
          setIsModalOpen(false);
          onVerified(result);
        }}
      />
    </>
  );
}

// Step 2: 새 비밀번호 설정 (React Hook Form + Zod)
function Step2({
  verification,
  onSubmit,
}: {
  verification: VerificationResult;
  onSubmit: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const passwordConfirm = useWatch({ control, name: "passwordConfirm" }) ?? "";

  const pwStrength = getPasswordStrength(password);
  const pwMatch = passwordConfirm.length > 0 && password === passwordConfirm && !errors.passwordConfirm;
  const pwMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const onFormSubmit = async (formData: ResetPasswordFormData) => {
    setServerError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken: verification.resetToken,
          newPassword: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error?.message || "비밀번호 재설정에 실패했습니다.");
        return;
      }

      onSubmit();
    } catch {
      setServerError("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* 본인인증 완료 배너 */}
      <div className="flex items-center gap-2.5 bg-neutral-950 px-6 py-3.5">
        <CheckCircle2 className="text-white shrink-0" size={16} strokeWidth={2.5} />
        <span className="text-sm font-semibold text-white">본인인증 완료</span>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
        <div className="px-8 py-8">
          <h2 className="mb-1 text-xl font-bold text-foreground">새 비밀번호 설정</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            사용할 새 비밀번호를 입력해 주세요.
          </p>

          {/* 서버 에러 */}
          {serverError && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
              <AlertCircle size={15} className="shrink-0 text-destructive" />
              <span className="text-sm text-destructive">{serverError}</span>
            </div>
          )}

          {/* 인증된 계정 표시 */}
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200">
              <span className="text-xs font-bold text-foreground">ID</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">비밀번호를 재설정할 계정</p>
              <p className="text-sm font-semibold tracking-wider text-foreground">
                {verification.username
                  ? maskUsername(verification.username)
                  : verification.name}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 새 비밀번호 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                새 비밀번호 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상, 영문·숫자 포함"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                  className={`h-[52px] rounded-xl border-neutral-300 bg-white pl-9 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-0 ${
                    errors.password
                      ? "border-destructive focus-visible:border-destructive"
                      : ""
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  {errors.password.message}
                </p>
              )}
              {password && !errors.password && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((lv) => (
                      <div
                        key={lv}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          pwStrength.level >= lv
                            ? lv === 1
                              ? "bg-red-400"
                              : lv === 2
                                ? "bg-neutral-400"
                                : "bg-neutral-900"
                            : "bg-neutral-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-sm ${
                      pwStrength.level === 1
                        ? "text-destructive"
                        : pwStrength.level === 2
                        ? "text-secondary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    비밀번호 강도: {pwStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                비밀번호 확인 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <Input
                  type={showPwConfirm ? "text" : "password"}
                  placeholder="비밀번호를 다시 입력해 주세요"
                  autoComplete="new-password"
                  aria-invalid={!!errors.passwordConfirm || pwMismatch}
                  {...register("passwordConfirm")}
                  className={`h-[52px] rounded-xl border-neutral-300 bg-white pl-9 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-0 ${
                    errors.passwordConfirm || pwMismatch
                      ? "border-destructive focus-visible:border-destructive"
                      : pwMatch
                      ? "border-neutral-950"
                      : ""
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  aria-label={showPwConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  {showPwConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
              {errors.passwordConfirm && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} />
                  {errors.passwordConfirm.message}
                </p>
              )}
              {pwMatch && (
                <p className="flex items-center gap-1.5 text-sm text-secondary-foreground">
                  <CheckCircle2 size={14} />
                  비밀번호가 일치합니다.
                </p>
              )}
            </div>
          </div>

          {/* 확인 버튼 */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Spinner />
                처리 중...
              </>
            ) : (
              "비밀번호 재설정"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Step 3: 완료
function Step3() {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-12 shadow-sm text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
        <CheckCircle2 className="text-foreground" size={40} strokeWidth={1.5} />
      </div>

      <h2 className="mb-2 text-2xl font-bold text-foreground">
        비밀번호가 재설정되었습니다.
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        새 비밀번호로 로그인해 주세요.
      </p>

      <Button
        onClick={() => router.push("/auth/login")}
        className="h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99]"
      >
        <LogIn size={17} />
        로그인하기
      </Button>
    </div>
  );
}

// 메인 페이지
export default function ResetPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  return (
    <div className="w-full">
      {/* Stepper */}
      <Stepper current={step} />

      {/* 단계별 콘텐츠 */}
      <div
        key={step}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {step === 1 && (
          <Step1
            onVerified={(result) => {
              setVerification(result);
              setStep(2);
            }}
          />
        )}
        {step === 2 && verification && (
          <Step2 verification={verification} onSubmit={() => setStep(3)} />
        )}
        {step === 3 && <Step3 />}
      </div>
    </div>
  );
}
