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
    <div className="mb-6 flex">
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
                  ? "bg-primary/15 text-primary"
                  : isActive
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "bg-gray-100 text-gray-400"
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
              className={`mt-1.5 text-sm font-medium transition-colors duration-300 ${
                isActive
                  ? "text-primary"
                  : isDone
                  ? "text-primary/70"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </span>

            {/* 연결선 (마지막 스텝 제외) */}
            {idx < STEPS.length - 1 && (
              <div className="absolute top-4 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-px bg-gray-200 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-primary transition-all duration-500 ${
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
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="text-primary" size={26} strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-bold text-foreground">비밀번호 재설정</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            본인인증 후 새 비밀번호를 설정할 수 있습니다.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="group relative h-12 w-full overflow-hidden text-sm font-semibold"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"
          />
          <ShieldCheck size={16} />
          본인인증하기
        </Button>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/auth/find-id"
            className="hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            아이디 찾기
          </Link>
          <span className="select-none text-gray-300">|</span>
          <Link
            href="/auth/login"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} />
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
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* 본인인증 완료 배너 */}
      <div className="flex items-center gap-2.5 bg-green-50 border-b border-green-200 px-6 py-3.5">
        <CheckCircle2 className="text-green-600 shrink-0" size={18} strokeWidth={2} />
        <span className="text-sm font-semibold text-green-700">본인인증 완료</span>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
        <div className="p-6">
          <h2 className="mb-1 text-xl font-bold text-foreground">새 비밀번호 설정</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            사용할 새 비밀번호를 입력해 주세요.
          </p>

          {/* 서버 에러 */}
          {serverError && (
            <div className="mb-5 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={16} className="shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* 인증된 계정 표시 */}
          <div className="mb-5 flex items-center gap-2.5 rounded-lg bg-gray-100 px-4 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-bold text-primary">ID</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">비밀번호를 재설정할 계정</p>
              <p className="text-sm font-semibold tracking-wider text-foreground">
                {verification.username
                  ? maskUsername(verification.username)
                  : verification.name}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 새 비밀번호 */}
            <div className="space-y-1.5">
              <Label>
                새 비밀번호 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상, 영문·숫자 포함"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                  className={`h-11 pl-9 pr-10 ${
                    errors.password
                      ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                      : ""
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.password.message}
                </p>
              )}
              {password && !errors.password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((lv) => (
                      <div
                        key={lv}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          pwStrength.level >= lv ? pwStrength.color : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-sm ${
                      pwStrength.level === 1
                        ? "text-red-500"
                        : pwStrength.level === 2
                        ? "text-amber-600"
                        : "text-green-600"
                    }`}
                  >
                    비밀번호 강도: {pwStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-1.5">
              <Label>
                비밀번호 확인 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  type={showPwConfirm ? "text" : "password"}
                  placeholder="비밀번호를 다시 입력해 주세요"
                  autoComplete="new-password"
                  aria-invalid={!!errors.passwordConfirm || pwMismatch}
                  {...register("passwordConfirm")}
                  className={`h-11 pl-9 pr-10 ${
                    errors.passwordConfirm || pwMismatch
                      ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                      : pwMatch
                      ? "border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/20"
                      : ""
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  aria-label={showPwConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errors.passwordConfirm && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.passwordConfirm.message}
                </p>
              )}
              {pwMatch && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 size={13} />
                  비밀번호가 일치합니다.
                </p>
              )}
            </div>
          </div>

          {/* 확인 버튼 */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="group relative mt-8 h-12 w-full overflow-hidden text-sm font-semibold"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"
            />
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
    <div className="rounded-2xl border border-border bg-card p-10 shadow-sm text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
        <CheckCircle2 className="text-green-500" size={40} strokeWidth={1.5} />
      </div>

      <h2 className="mb-2 text-2xl font-bold text-foreground">
        비밀번호가 재설정되었습니다.
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        새 비밀번호로 로그인해 주세요.
      </p>

      <Button
        onClick={() => router.push("/auth/login")}
        className="group relative h-12 w-full overflow-hidden text-sm font-semibold"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"
        />
        <LogIn size={16} />
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
