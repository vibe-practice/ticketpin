"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";

// ─── Zod 스키마 ────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────

interface BusinessLoginFormProps {
  onLoggedIn: () => void;
}

export function BusinessLoginForm({ onLoggedIn }: BusinessLoginFormProps) {
  const { businessId } = useBusinessAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/auth/business/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessId,
          loginId: data.username,
          password: data.password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setIsLoading(false);
        setLoginError(json.error?.message || "로그인에 실패했습니다.");
        return;
      }

      setIsLoading(false);
      onLoggedIn();
    } catch {
      setIsLoading(false);
      setLoginError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 border border-violet-200/80 shadow-sm">
          <LogIn size={26} className="text-violet-600" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">업체 로그인</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            SMS 인증이 완료되었습니다.
            <br />
            업체 계정으로 로그인해 주세요.
          </p>
        </div>
      </div>

      {/* SMS 인증 완료 배지 */}
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle2 size={16} className="text-green-600 shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-medium text-green-700">SMS 본인 인증 완료</span>
      </div>

      {/* 로그인 폼 */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* 아이디 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            아이디
          </label>
          <div className="relative">
            <User
              size={15}
              strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="아이디 입력"
              aria-invalid={!!errors.username}
              {...register("username")}
              className={cn(
                "h-11 pl-9 text-sm",
                errors.username && "border-destructive focus-visible:ring-destructive/20"
              )}
            />
          </div>
          {errors.username && (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={13} strokeWidth={2} className="text-destructive shrink-0" />
              <span className="text-[13px] text-destructive">{errors.username.message}</span>
            </div>
          )}
        </div>

        {/* 비밀번호 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            비밀번호
          </label>
          <div className="relative">
            <Lock
              size={15}
              strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호 입력"
              aria-invalid={!!errors.password}
              {...register("password")}
              className={cn(
                "h-11 pl-9 pr-10 text-sm",
                errors.password && "border-destructive focus-visible:ring-destructive/20"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={1.75} />
              ) : (
                <Eye size={16} strokeWidth={1.75} />
              )}
            </button>
          </div>
          {errors.password && (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={13} strokeWidth={2} className="text-destructive shrink-0" />
              <span className="text-[13px] text-destructive">{errors.password.message}</span>
            </div>
          )}
        </div>

        {/* 로그인 에러 */}
        {loginError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" strokeWidth={2} />
            <span className="text-[13px] text-destructive leading-relaxed">{loginError}</span>
          </div>
        )}

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          disabled={isLoading}
          className={cn(
            "mt-1 h-12 w-full rounded-xl font-bold text-[15px] transition-all duration-200",
            "bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              로그인 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <LogIn size={16} strokeWidth={2.2} />
              로그인
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
