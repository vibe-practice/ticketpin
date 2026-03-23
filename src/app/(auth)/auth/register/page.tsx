"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  AlertCircle,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  registerSchema,
  type RegisterFormData,
  getPasswordStrength,
} from "@/lib/validations/auth";
import { useRegisterStore } from "@/store/registerStore";
import {
  IdentityVerificationModal,
  type VerificationResult,
} from "@/components/ui/identity-verification-modal";

// ── Step 1: 본인인증 ──────────────────────────────────────────
function Step1({ onVerified }: { onVerified: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setVerification } = useRegisterStore();

  const handleVerified = (result: VerificationResult) => {
    setIsModalOpen(false);
    setVerification({ name: result.name, phone: result.phone });
    onVerified();
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        {/* 로고 */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Ticket className="text-primary" size={26} strokeWidth={1.75} />
          </div>
          <span className="text-2xl font-bold text-primary">티켓핀</span>
        </div>

        <h1 className="mb-2 text-xl font-bold text-foreground">
          <span className="sm:hidden">
            티켓핀에 오신 것을
            <br />
            환영합니다.
          </span>
          <span className="hidden sm:inline">티켓핀에 오신 것을 환영합니다.</span>
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          회원가입을 위해 본인인증이 필요합니다.
        </p>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-12 w-full text-sm font-semibold"
        >
          <ShieldCheck size={16} />
          본인인증하기
        </Button>

        <p className="mt-6 text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-primary hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>

      <IdentityVerificationModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onVerified={handleVerified}
        purpose="register"
      />
    </>
  );
}

// ── Step 2: 정보 입력 (React Hook Form + Zod) ──────────────────
function Step2({ onSubmit }: { onSubmit: () => void }) {
  const router = useRouter();
  const { verification } = useRegisterStore();
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [serverError, setServerError] = useState("");
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      usernameChecked: false,
      password: "",
      passwordConfirm: "",
      email: "",
      agreePrivacy: false,
      agreeMarketing: false,
    },
  });

  const username = useWatch({ control, name: "username" }) ?? "";
  const password = useWatch({ control, name: "password" }) ?? "";
  const passwordConfirm = useWatch({ control, name: "passwordConfirm" }) ?? "";
  const usernameChecked = useWatch({ control, name: "usernameChecked" });

  const pwStrength = getPasswordStrength(password);
  const pwMatch = passwordConfirm.length > 0 && password === passwordConfirm;
  const pwMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleUsernameCheck = async (username: string) => {
    if (username.length < 4) return;
    setUsernameCheckLoading(true);
    try {
      const res = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const result = await res.json();
      if (result.available) {
        setValue("usernameChecked", true, { shouldValidate: true });
        setServerError("");
      } else {
        setValue("usernameChecked", false, { shouldValidate: true });
        setServerError("이미 사용 중인 아이디입니다.");
      }
    } catch {
      setServerError("중복 확인 중 오류가 발생했습니다.");
    } finally {
      setUsernameCheckLoading(false);
    }
  };

  const onFormSubmit = async (formData: RegisterFormData) => {
    setServerError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: verification?.name ?? "미인증",
          phone: verification?.phone ?? "00000000000",
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error?.message || "회원가입에 실패했습니다.");
        return;
      }

      onSubmit();
    } catch {
      setServerError("서버 오류가 발생했습니다.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* 본인인증 완료 배너 */}
      <div className="flex items-center gap-2.5 bg-green-50 border-b border-green-200 px-6 py-3.5">
        <CheckCircle2
          className="text-green-600 shrink-0"
          size={18}
          strokeWidth={2}
        />
        <span className="text-sm font-semibold text-green-700">
          본인인증 완료
        </span>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
        <div className="p-6">
          <h2 className="mb-1 text-xl font-bold text-foreground">
            회원 정보 입력
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            서비스 이용에 필요한 정보를 입력해 주세요.
          </p>

          <div className="space-y-5">
            {/* 서버 에러 */}
            {serverError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle size={16} className="shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* 아이디 */}
            <div className="space-y-1.5">
              <Label>
                아이디 <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <div className="relative flex-1">
                      <User
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size={16}
                      />
                      <Input
                        type="text"
                        placeholder="영문·숫자 4~20자"
                        value={field.value}
                        onChange={(e) => {
                          const filtered = e.target.value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .slice(0, 20);
                          field.onChange(filtered);
                          setValue("usernameChecked", false, {
                            shouldValidate: false,
                          });
                        }}
                        aria-invalid={!!errors.username || !!errors.usernameChecked}
                        className={`h-11 pl-9 ${
                          usernameChecked
                            ? "border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/20"
                            : errors.username || errors.usernameChecked
                              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                              : ""
                        }`}
                      />
                    </div>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleUsernameCheck(username)}
                  disabled={username.length < 4 || usernameChecked || usernameCheckLoading}
                  className="h-11 shrink-0 border-primary text-primary hover:bg-primary/5"
                >
                  {usernameCheckLoading ? "확인 중..." : "중복 확인"}
                </Button>
              </div>
              {usernameChecked && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 size={13} />
                  사용 가능한 아이디입니다.
                </p>
              )}
              {errors.username && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.username.message}
                </p>
              )}
              {!errors.username && errors.usernameChecked && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.usernameChecked.message}
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <Label>
                비밀번호 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상, 영문·숫자·특수문자 조합"
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
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          pwStrength.level >= lv
                            ? pwStrength.color
                            : "bg-gray-200"
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
                  aria-label={
                    showPwConfirm ? "비밀번호 숨기기" : "비밀번호 보기"
                  }
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
              {!errors.passwordConfirm && pwMatch && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 size={13} />
                  비밀번호가 일치합니다.
                </p>
              )}
            </div>

            {/* 이메일 */}
            <div className="space-y-1.5">
              <Label>
                이메일 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  type="email"
                  placeholder="example@email.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                  className={`h-11 pl-9 ${
                    errors.email
                      ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                      : ""
                  }`}
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.email.message}
                </p>
              )}
              {!errors.email && (
                <p className="text-sm text-muted-foreground">
                  계정 복구 및 서비스 안내에 사용됩니다.
                </p>
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-3 rounded-xl border border-border p-4">
              <Controller
                name="agreePrivacy"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">
                        개인정보 수집 및 이용 동의
                        <span className="ml-1 text-sm font-semibold text-destructive">
                          (필수)
                        </span>
                      </span>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        서비스 제공을 위한 필수 개인정보를 수집·이용합니다.{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          내용 보기
                        </Link>
                      </p>
                    </div>
                  </label>
                )}
              />

              {errors.agreePrivacy && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle size={13} />
                  {errors.agreePrivacy.message}
                </p>
              )}

              <div className="border-t border-border" />

              <Controller
                name="agreeMarketing"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">
                        서비스의 유용한 소식 받기
                        <span className="ml-1 text-sm text-muted-foreground">
                          (선택)
                        </span>
                      </span>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        이벤트, 혜택, 신상품 안내 등 마케팅 정보를 수신합니다.
                      </p>
                    </div>
                  </label>
                )}
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="mt-8 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="h-12 flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 flex-[2]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  처리 중...
                </span>
              ) : (
                "확인"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Step 3: 완료 ──────────────────────────────────────────────
function Step3() {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="text-primary" size={40} strokeWidth={1.5} />
      </div>

      <h2 className="mb-2 text-2xl font-bold text-foreground">
        회원가입이 완료되었습니다.
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        티켓핀 회원이 되신 것을 환영합니다.
        <br />
        로그인하여 서비스를 이용해 주세요.
      </p>

      <Button
        onClick={() => router.push("/auth/login")}
        className="h-12 w-full text-sm font-semibold"
      >
        로그인하러 가기
      </Button>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function RegisterPage() {
  const { step, setStep, reset } = useRegisterStore();

  // 페이지 마운트 시 항상 1단계로 초기화
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="w-full">
      {step === 1 && <Step1 onVerified={() => setStep(2)} />}
      {step === 2 && <Step2 onSubmit={() => setStep(3)} />}
      {step === 3 && <Step3 />}
    </div>
  );
}
