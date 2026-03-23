"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, User, AlertCircle, LogIn, ShieldAlert } from "lucide-react";
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

  // 잠금 카운트다운
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

      // 서버 Rate Limit 응답 처리
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
      {/* 헤딩 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">티켓핀에 오신 것을 환영합니다.</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-5">
          {/* 잠금 알림 */}
          {isLocked && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                로그인이 일시 잠금되었습니다.{" "}
                <span className="font-bold">{lockRemaining}초</span> 후 다시 시도해 주세요.
              </span>
            </div>
          )}

          {/* 서버 에러 (잠금 전) */}
          {!isLocked && serverError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={16} className="shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* 아이디 */}
          <div className="space-y-1.5">
            <Label htmlFor="username">아이디</Label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                id="username"
                type="text"
                placeholder="아이디를 입력해 주세요"
                autoComplete="username"
                disabled={isLocked}
                aria-invalid={!!errors.username}
                {...register("username")}
                className={`h-11 pl-9 ${
                  errors.username
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : ""
                }`}
              />
            </div>
            {errors.username && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle size={13} />
                {errors.username.message}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                disabled={isLocked}
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
          </div>
        </div>

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          disabled={isSubmitting || isLocked}
          className="mt-6 h-12 w-full text-sm font-semibold"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Spinner />
              로그인 중...
            </span>
          ) : isLocked ? (
            <span>{lockRemaining}초 후 재시도</span>
          ) : (
            <>
              <LogIn size={16} />
              로그인
            </>
          )}
        </Button>

        {/* 링크 영역 */}
        <div className="mt-5 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/auth/find-id"
            className="hover:text-foreground hover:underline underline-offset-2"
          >
            아이디 찾기
          </Link>
          <span className="select-none">|</span>
          <Link
            href="/auth/reset-password"
            className="hover:text-foreground hover:underline underline-offset-2"
          >
            비밀번호 재설정
          </Link>
          <span className="select-none">|</span>
          <Link
            href="/auth/register"
            className="font-medium text-primary hover:underline underline-offset-2"
          >
            회원가입
          </Link>
        </div>
      </form>
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
