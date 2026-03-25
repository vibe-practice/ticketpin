"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { getPasswordStrength } from "@/lib/validations/auth";
import { adminCreateMemberFormSchema, type AdminCreateMemberFormInput } from "@/lib/validations/admin";
import { cn } from "@/lib/utils";

// ─── Props ──────────────────────────────────────────────────────────────────────

interface MemberAddModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function MemberAddModal({ open, onClose, onSuccess }: MemberAddModalProps) {
  const { toast } = useToast();
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<AdminCreateMemberFormInput>({
    resolver: zodResolver(adminCreateMemberFormSchema),
    defaultValues: {
      username: "",
      password: "",
      passwordConfirm: "",
      name: "",
      email: "",
      phone: "",
    },
  });

  const watchPassword = watch("password");
  const watchUsername = watch("username");
  const pwStrength = getPasswordStrength(watchPassword || "");

  // 아이디 중복 확인
  const handleCheckUsername = useCallback(async () => {
    if (!watchUsername || watchUsername.length < 4 || !/^[a-zA-Z0-9]+$/.test(watchUsername)) {
      setError("username", { message: "아이디는 4자 이상의 영문, 숫자만 사용 가능합니다." });
      return;
    }

    setUsernameStatus("checking");
    try {
      const res = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: watchUsername }),
      });
      const data = await res.json();

      if (data.available) {
        setUsernameStatus("available");
        clearErrors("username");
      } else {
        setUsernameStatus("taken");
        setError("username", { message: "이미 사용 중인 아이디입니다." });
      }
    } catch {
      setUsernameStatus("idle");
      toast({ type: "error", title: "중복 확인 실패", description: "잠시 후 다시 시도해주세요." });
    }
  }, [watchUsername, setError, clearErrors, toast]);

  // 폼 제출
  const onSubmit = async (data: AdminCreateMemberFormInput) => {
    if (usernameStatus !== "available") {
      setError("username", { message: "아이디 중복 확인이 필요합니다." });
      return;
    }

    setSubmitting(true);
    try {
      // passwordConfirm은 서버에 보내지 않음
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordConfirm: _, ...payload } = data;
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        const errorMsg = result.error?.message ?? "회원 추가에 실패했습니다.";

        // 중복 에러 시 해당 필드에 에러 표시
        if (result.error?.code === "DUPLICATE_USERNAME") {
          setError("username", { message: errorMsg });
          setUsernameStatus("taken");
        } else if (result.error?.code === "DUPLICATE_EMAIL") {
          setError("email", { message: errorMsg });
        } else {
          toast({ type: "error", title: "회원 추가 실패", description: errorMsg });
        }
        return;
      }

      toast({
        type: "success",
        title: "회원 추가 완료",
        description: `${data.name}(${data.username}) 회원이 추가되었습니다.`,
      });
      handleClose();
      onSuccess();
    } catch {
      toast({ type: "error", title: "회원 추가 실패", description: "서버 오류가 발생했습니다." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setUsernameStatus("idle");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-describedby="member-add-desc"
      >
        <DialogHeader className="border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary-soft">
              <UserPlus size={14} className="text-primary" />
            </div>
            회원 추가
          </DialogTitle>
          <p id="member-add-desc" className="sr-only">
            관리자가 직접 회원을 추가합니다.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* 아이디 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-username" className="text-[14px] font-medium text-foreground">
                아이디 <span className="text-error">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="admin-member-username"
                  placeholder="4~20자 영문, 숫자"
                  className="h-10 text-sm flex-1"
                  {...register("username", {
                    onChange: () => {
                      if (usernameStatus !== "idle") setUsernameStatus("idle");
                    },
                  })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 text-[14px] shrink-0"
                  onClick={handleCheckUsername}
                  disabled={usernameStatus === "checking"}
                >
                  {usernameStatus === "checking" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "중복 확인"
                  )}
                </Button>
              </div>
              {errors.username && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.username.message}
                </p>
              )}
              {usernameStatus === "available" && !errors.username && (
                <p className="flex items-center gap-1 text-[14px] text-neutral-600">
                  <CheckCircle2 size={11} />
                  사용 가능한 아이디입니다.
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-password" className="text-[14px] font-medium text-foreground">
                비밀번호 <span className="text-error">*</span>
              </Label>
              <Input
                id="admin-member-password"
                type="password"
                placeholder="8자 이상 (영문 + 숫자 포함)"
                className="h-10 text-sm"
                {...register("password")}
              />
              {watchPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          pwStrength.level >= level ? pwStrength.color : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  {pwStrength.label && (
                    <span className="text-[11px] text-muted-foreground">{pwStrength.label}</span>
                  )}
                </div>
              )}
              {errors.password && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-password-confirm" className="text-[14px] font-medium text-foreground">
                비밀번호 확인 <span className="text-error">*</span>
              </Label>
              <Input
                id="admin-member-password-confirm"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                className="h-10 text-sm"
                {...register("passwordConfirm")}
              />
              {errors.passwordConfirm && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>

            {/* 이름 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-name" className="text-[14px] font-medium text-foreground">
                이름 <span className="text-error">*</span>
              </Label>
              <Input
                id="admin-member-name"
                placeholder="이름을 입력하세요"
                className="h-10 text-sm"
                {...register("name")}
              />
              {errors.name && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* 이메일 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-email" className="text-[14px] font-medium text-foreground">
                이메일 <span className="text-error">*</span>
              </Label>
              <Input
                id="admin-member-email"
                type="email"
                placeholder="email@example.com"
                className="h-10 text-sm"
                {...register("email")}
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* 전화번호 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-member-phone" className="text-[14px] font-medium text-foreground">
                전화번호 <span className="text-error">*</span>
              </Label>
              <Input
                id="admin-member-phone"
                type="tel"
                placeholder="01012345678 (하이픈 없이)"
                className="h-10 text-sm"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* 안내 문구 */}
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                관리자가 직접 추가한 회원은 본인인증이 미완료 상태로 생성됩니다.
                회원은 로그인 후 본인인증을 별도로 진행할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 sticky bottom-0 bg-card">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="h-9 px-5 text-[14px]"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || usernameStatus !== "available"}
              className="h-9 px-6 text-[14px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  추가 중...
                </>
              ) : (
                "회원 추가"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
