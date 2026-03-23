"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

function LoginForm() {
  const searchParams = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockRemaining, setLockRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (lockRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setLockRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setAttempts(0);
          setServerError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [lockRemaining]);

  const isLocked = lockRemaining > 0;

  const onSubmit = async (data: LoginFormData) => {
    if (isLocked) return;

    setServerError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      if (res.ok) {
        const redirectTo = searchParams.get("redirect") || "/";
        window.location.assign(redirectTo);
        return;
      }

      const result = await res.json();

      if (res.status === 429) {
        setServerError(result.error?.message || "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockRemaining(LOCK_SECONDS);
        setServerError(
          `로그인 시도가 ${MAX_ATTEMPTS}회 초과되었습니다. ${LOCK_SECONDS}초 후 다시 시도해 주세요.`
        );
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setServerError(
          result.error?.message || `아이디 또는 비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`
        );
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    }
  };

  return (
    <div className="w-full">
      {/* 카드 */}
      <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-foreground">로그인</h1>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* 잠금 알림 */}
          {isLocked && (
            <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-foreground" />
              <span className="text-sm text-foreground">
                로그인이 일시 잠금되었습니다.{" "}
                <span className="font-bold">{lockRemaining}초</span> 후 다시 시도해 주세요.
              </span>
            </div>
          )}

          {/* 서버 에러 */}
          {!isLocked && serverError && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
              <AlertCircle size={15} className="shrink-0 text-destructive" />
              <span className="text-sm text-destructive">{serverError}</span>
            </div>
          )}

          {/* 아이디 */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-foreground">
              아이디
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="아이디를 입력해 주세요"
              autoComplete="username"
              disabled={isLocked}
              aria-invalid={!!errors.username}
              {...register("username")}
              className={`h-[52px] rounded-xl border-neutral-300 bg-white px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-0 ${
                errors.username
                  ? "border-destructive focus-visible:border-destructive"
                  : ""
              }`}
            />
            {errors.username && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle size={14} />
                {errors.username.message}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              비밀번호
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                disabled={isLocked}
                aria-invalid={!!errors.password}
                {...register("password")}
                className={`h-[52px] rounded-xl border-neutral-300 bg-white px-4 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-0 ${
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
          </div>

          {/* 로그인 버튼 */}
          <Button
            type="submit"
            disabled={isSubmitting || isLocked}
            className="mt-2 h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner />
                로그인 중...
              </span>
            ) : isLocked ? (
              <span>{lockRemaining}초 후 재시도</span>
            ) : (
              "로그인"
            )}
          </Button>
        </form>

        {/* 하단 링크 */}
        <div className="mt-7 flex items-center justify-center gap-5 text-sm text-muted-foreground">
          <Link
            href="/auth/find-id"
            className="hover:text-foreground transition-colors duration-150"
          >
            아이디 찾기
          </Link>
          <span className="text-neutral-300 select-none">|</span>
          <Link
            href="/auth/reset-password"
            className="hover:text-foreground transition-colors duration-150"
          >
            비밀번호 재설정
          </Link>
          <span className="text-neutral-300 select-none">|</span>
          <Link
            href="/auth/register"
            className="font-semibold text-foreground hover:opacity-70 transition-opacity duration-150"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
