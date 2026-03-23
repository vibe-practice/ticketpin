"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  ShieldAlert,
  Ticket,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

export default function AdminLoginPage() {
  const router = useRouter();
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

  const isLocked = lockRemaining > 0;

  // 잠금 카운트다운
  useEffect(() => {
    if (!isLocked) return;

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
  }, [isLocked]);

  const onSubmit = async (data: LoginFormData) => {
    if (isLocked) return;

    setServerError("");

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      if (res.ok) {
        router.push("/adminmaster");
        router.refresh();
        return;
      }

      const result = await res.json().catch(() => ({}));
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
          result.error?.message ||
            `아이디 또는 비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`
        );
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4">
      {/* 배경 효과 — 미묘한 그라데이션 오브 */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(115, 115, 115, 0.12) 0%, rgba(82, 82, 82, 0.04) 50%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(115, 115, 115, 0.06) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* 격자 패턴 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(163, 163, 163, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(163, 163, 163, 0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      {/* 로그인 카드 */}
      <div className="relative z-10 w-full max-w-md">
        {/* 로고 영역 */}
        <div className="mb-8 text-center">
          {/* 아이콘 + 글로우 */}
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(115, 115, 115, 0.35) 0%, transparent 70%)",
                filter: "blur(8px)",
              }}
              aria-hidden="true"
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-500/30 bg-gradient-to-br from-neutral-600/20 to-neutral-800/30 shadow-lg">
              <Ticket size={28} className="text-neutral-400" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            티켓핀
          </h1>
          <p className="mt-1.5 text-sm font-medium tracking-widest text-neutral-400 uppercase">
            Admin Console
          </p>
        </div>

        {/* 카드 본체 */}
        <div className="rounded-2xl border border-neutral-700/50 bg-neutral-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <p className="mb-6 text-center text-[13px] font-medium text-neutral-400">
            관리자 계정으로 로그인하세요
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* 잠금 알림 */}
            {isLocked && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3.5 text-sm text-red-400">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  로그인이 일시 잠금되었습니다.{" "}
                  <span className="font-bold text-red-300">{lockRemaining}초</span> 후
                  다시 시도해 주세요.
                </span>
              </div>
            )}

            {/* 서버 에러 (잠금 전) */}
            {!isLocked && serverError && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3.5 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* 아이디 */}
            <div className="space-y-2">
              <Label
                htmlFor="admin-username"
                className="text-[13px] font-medium text-neutral-300"
              >
                관리자 아이디
              </Label>
              <div className="relative">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  size={15}
                />
                <Input
                  id="admin-username"
                  type="text"
                  placeholder="관리자 아이디를 입력하세요"
                  autoComplete="username"
                  disabled={isLocked}
                  aria-invalid={!!errors.username}
                  {...register("username")}
                  className={cn(
                    "h-11 border-neutral-700 bg-neutral-800/80 pl-10 text-white placeholder:text-neutral-500",
                    "focus-visible:border-neutral-500/60 focus-visible:ring-neutral-500/20",
                    "disabled:opacity-50",
                    errors.username &&
                      "border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
                  )}
                />
              </div>
              {errors.username && (
                <p className="flex items-center gap-1.5 text-[12px] text-red-400">
                  <AlertCircle size={12} />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label
                htmlFor="admin-password"
                className="text-[13px] font-medium text-neutral-300"
              >
                비밀번호
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  size={15}
                />
                <Input
                  id="admin-password"
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  disabled={isLocked}
                  aria-invalid={!!errors.password}
                  {...register("password")}
                  className={cn(
                    "h-11 border-neutral-700 bg-neutral-800/80 pl-10 pr-11 text-white placeholder:text-neutral-500",
                    "focus-visible:border-neutral-500/60 focus-visible:ring-neutral-500/20",
                    "disabled:opacity-50",
                    errors.password &&
                      "border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-neutral-500 hover:bg-neutral-700/50 hover:text-neutral-300"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-[12px] text-red-400">
                  <AlertCircle size={12} />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* 로그인 버튼 */}
            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              className={cn(
                "relative mt-2 h-12 w-full overflow-hidden rounded-xl text-sm font-semibold",
                "bg-neutral-900 text-white",
                "shadow-lg shadow-neutral-900/40",
                "hover:bg-neutral-800",
                "active:scale-[0.98] transition-all duration-150",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size={15} />
                  로그인 중...
                </span>
              ) : isLocked ? (
                <span className="flex items-center justify-center gap-2">
                  <ShieldAlert size={15} />
                  {lockRemaining}초 후 재시도 가능
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={15} />
                  관리자 로그인
                </span>
              )}
            </Button>
          </form>

          {/* 구분선 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-700/60" />
            <span className="text-[11px] text-neutral-600">또는</span>
            <div className="h-px flex-1 bg-neutral-700/60" />
          </div>

          {/* 사용자 페이지 링크 */}
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-300"
          >
            사용자 페이지로 이동
          </Link>
        </div>

        {/* 하단 안내 */}
        <p className="mt-6 text-center text-[12px] text-neutral-600">
          이 페이지는 관리자 전용입니다. 권한이 없는 접근은 기록됩니다.
        </p>
      </div>
    </div>
  );
}
