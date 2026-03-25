"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
  Loader2,
  AlertTriangle,
  UserX,
  KeyRound,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
  getPasswordStrength,
} from "@/lib/validations/auth";
import { cn, formatPhone } from "@/lib/utils";
import type { MyPageSummary } from "@/types";

function formatDate(isoString: string) {
  const d = new Date(isoString);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ── 비밀번호 강도 표시 ──────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((bar) => (
          <div key={bar} className={cn("h-1 flex-1 rounded-full transition-all duration-300", strength.level >= bar ? strength.color : "bg-border")} />
        ))}
      </div>
      {strength.label && (
        <p className={cn("text-[14px] font-medium", strength.level === 1 && "text-error", strength.level === 2 && "text-warning", strength.level === 3 && "text-success")}>
          비밀번호 강도: {strength.label}
        </p>
      )}
    </div>
  );
}

// ── 스켈레톤 ───────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse">
      <div><div className="h-7 w-28 bg-muted rounded" /><div className="h-5 w-48 bg-muted rounded mt-2" /></div>
      <div className="rounded-xl border border-border overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-14 border-b border-border bg-muted/30" />))}
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (<div key={i} className="h-12 bg-muted rounded" />))}
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<MyPageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onChange",
  });
  const newPasswordValue = useWatch({ control, name: "newPassword", defaultValue: "" });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/mypage/summary");
        const json = await res.json();
        if (!res.ok || !json.success) { setFetchError(json.error?.message ?? "프로필 정보를 불러오는데 실패했습니다."); return; }
        setSummary(json.data);
      } catch { setFetchError("네트워크 오류가 발생했습니다."); } finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  const onPasswordSubmit = async (data: ChangePasswordFormData) => {
    setIsSubmittingPassword(true);
    setPasswordChangeError(null);
    try {
      const res = await fetch("/api/mypage/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setPasswordChangeError(json.error?.message ?? "비밀번호 변경에 실패했습니다."); return; }
      setPasswordChangeSuccess(true);
      reset();
      setTimeout(() => setPasswordChangeSuccess(false), 4000);
    } catch { setPasswordChangeError("네트워크 오류가 발생했습니다."); } finally { setIsSubmittingPassword(false); }
  };

  if (isLoading) return <ProfileSkeleton />;
  if (fetchError || !summary) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <AlertCircle size={24} className="text-muted-foreground mb-3" />
        <p className="text-[16px] text-muted-foreground">{fetchError ?? "데이터를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  const { user } = summary;
  const hasActiveVouchers = summary.voucher_count > 0;

  return (
    <div className="w-full space-y-10">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">회원정보 수정</h1>
        <p className="text-[16px] text-muted-foreground mt-1">개인정보 및 계정 보안을 관리하세요.</p>
      </div>

      {/* ── 1. 기본 정보: 테이블형 ─────────────────────────── */}
      <section>
        <h2 className="text-[18px] font-bold text-foreground mb-4">기본 정보</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-border">
                <td className="bg-muted/40 px-5 py-4 text-[14px] font-semibold text-muted-foreground w-[140px] sm:w-[180px] whitespace-nowrap">아이디</td>
                <td className="px-5 py-4 text-[15px] text-foreground">{user.username}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="bg-muted/40 px-5 py-4 text-[14px] font-semibold text-muted-foreground whitespace-nowrap">이름</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] text-foreground font-medium">{user.name}</span>
                    {user.identity_verified && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-2 py-0.5 text-[14px] font-semibold text-success">
                        <BadgeCheck size={11} />본인인증 완료
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="bg-muted/40 px-5 py-4 text-[14px] font-semibold text-muted-foreground whitespace-nowrap">이메일</td>
                <td className="px-5 py-4 text-[15px] text-foreground">{user.email}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="bg-muted/40 px-5 py-4 text-[14px] font-semibold text-muted-foreground whitespace-nowrap">휴대폰 번호</td>
                <td className="px-5 py-4 text-[15px] text-foreground tabular-nums">{formatPhone(user.phone)}</td>
              </tr>
              <tr>
                <td className="bg-muted/40 px-5 py-4 text-[14px] font-semibold text-muted-foreground whitespace-nowrap">가입일</td>
                <td className="px-5 py-4 text-[15px] text-foreground">{formatDate(user.created_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. 비밀번호 변경 ──────────────────────────────── */}
      <section>
        <h2 className="text-[18px] font-bold text-foreground mb-4">비밀번호 변경</h2>
        <p className="text-[15px] text-muted-foreground mb-5">
          주기적으로 비밀번호를 변경하면 계정을 더 안전하게 보호할 수 있습니다.
        </p>

        {passwordChangeSuccess && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-success/20 bg-success-bg px-4 py-3">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            <p className="text-[14px] font-medium text-success">비밀번호가 성공적으로 변경되었습니다.</p>
          </div>
        )}
        {passwordChangeError && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-error/20 bg-error-bg px-4 py-3">
            <AlertCircle size={16} className="text-error shrink-0" />
            <p className="text-[14px] font-medium text-error">{passwordChangeError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onPasswordSubmit)} className="max-w-md space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-[15px] font-medium text-foreground">
              현재 비밀번호 <span className="text-error">*</span>
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                placeholder="현재 비밀번호를 입력해 주세요"
                autoComplete="current-password"
                aria-invalid={!!errors.currentPassword}
                className={cn("h-11 pr-10 text-[15px]", errors.currentPassword && "border-error focus-visible:border-error focus-visible:ring-error/20")}
                {...register("currentPassword")}
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? "비밀번호 숨기기" : "비밀번호 보기"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="flex items-center gap-1 text-[14px] text-error"><AlertCircle size={14} />{errors.currentPassword.message}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-[15px] font-medium text-foreground">
              새 비밀번호 <span className="text-error">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                placeholder="영문 + 숫자 조합 8자 이상"
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                className={cn("h-11 pr-10 text-[15px]", errors.newPassword && "border-error focus-visible:border-error focus-visible:ring-error/20")}
                {...register("newPassword")}
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "비밀번호 숨기기" : "비밀번호 보기"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPasswordValue && !errors.newPassword && <PasswordStrengthBar password={newPasswordValue} />}
            {errors.newPassword && (
              <p className="flex items-center gap-1 text-[14px] text-error"><AlertCircle size={14} />{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPasswordConfirm" className="text-[15px] font-medium text-foreground">
              새 비밀번호 확인 <span className="text-error">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPasswordConfirm"
                type={showConfirm ? "text" : "password"}
                placeholder="새 비밀번호를 한번 더 입력해 주세요"
                autoComplete="new-password"
                aria-invalid={!!errors.newPasswordConfirm}
                className={cn("h-11 pr-10 text-[15px]", errors.newPasswordConfirm && "border-error focus-visible:border-error focus-visible:ring-error/20")}
                {...register("newPasswordConfirm")}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "비밀번호 숨기기" : "비밀번호 보기"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPasswordConfirm && (
              <p className="flex items-center gap-1 text-[14px] text-error"><AlertCircle size={14} />{errors.newPasswordConfirm.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmittingPassword}
            className="h-11 w-full rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/80 transition-all duration-150"
          >
            {isSubmittingPassword ? (<><Loader2 size={16} className="animate-spin" />변경 중...</>) : (<><KeyRound size={16} />비밀번호 변경</>)}
          </Button>
        </form>
      </section>

      {/* ── 3. 회원 탈퇴 ──────────────────────────────── */}
      <section className="border-t border-border pt-10">
        <h2 className="text-[18px] font-bold text-error mb-2">회원 탈퇴</h2>
        <p className="text-[15px] text-muted-foreground mb-5">
          탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
        </p>

        <ul className="space-y-2 mb-5">
          {[
            "탈퇴 후 동일한 아이디로 재가입이 불가합니다.",
            "보유한 상품권 및 주문 내역이 모두 삭제됩니다.",
            "탈퇴 처리 후에는 데이터를 복구할 수 없습니다.",
          ].map((text) => (
            <li key={text} className="flex items-start gap-2 text-[14px] text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              {text}
            </li>
          ))}
        </ul>

        {hasActiveVouchers && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 mb-5">
            <Ticket size={16} className="text-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">보유 상품권이 있어 탈퇴할 수 없습니다.</p>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                현재 <strong className="font-bold text-foreground">{summary.voucher_count}개</strong>의 상품권을 보유 중입니다.
              </p>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={hasActiveVouchers}
          onClick={() => setWithdrawDialogOpen(true)}
          className={cn(
            "h-10 gap-2 border-error/30 text-error hover:bg-error-bg hover:border-error/50 font-medium text-[14px]",
            hasActiveVouchers && "opacity-40 cursor-not-allowed"
          )}
        >
          <UserX size={15} />
          회원 탈퇴
        </Button>
      </section>

      {/* ── 회원 탈퇴 확인 Dialog ────────────────────────── */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-error-bg">
                <AlertTriangle className="text-error" size={17} />
              </div>
              <DialogTitle>정말 탈퇴하시겠습니까?</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-muted-foreground text-[14px] leading-relaxed">
              탈퇴 시 계정과 관련된 모든 데이터(주문 내역, 상품권, 선물 내역 등)가
              <strong className="text-foreground font-semibold"> 영구적으로 삭제</strong>되며 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-error/20 bg-error-bg/40 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
              <p className="text-[14px] text-error/90">
                탈퇴 후 동일 아이디(<span className="font-semibold">{user.username}</span>)로는 재가입이 불가합니다.
              </p>
            </div>
          </div>

          {withdrawError && (
            <div className="rounded-lg border border-error/20 bg-error-bg px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                <p className="text-[14px] text-error font-medium">{withdrawError}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setWithdrawDialogOpen(false)} className="flex-1">취소</Button>
            <Button
              type="button"
              disabled={isWithdrawing}
              onClick={async () => {
                setIsWithdrawing(true); setWithdrawError(null);
                try {
                  const res = await fetch("/api/mypage/profile", { method: "DELETE" });
                  const json = await res.json();
                  if (!res.ok || !json.success) { setWithdrawError(json.error?.message ?? "탈퇴 처리에 실패했습니다."); return; }
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.push("/"); router.refresh();
                } catch { setWithdrawError("네트워크 오류가 발생했습니다."); } finally { setIsWithdrawing(false); }
              }}
              className="flex-1 bg-error text-white hover:bg-error/90 font-semibold"
            >
              {isWithdrawing ? (<><Loader2 size={15} className="animate-spin" />처리 중...</>) : (<><UserX size={15} />탈퇴하기</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
