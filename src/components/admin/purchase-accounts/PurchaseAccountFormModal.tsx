"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  purchaseAccountFormSchema,
  purchaseAccountUpdateSchema,
  type PurchaseAccountFormData,
  type PurchaseAccountUpdateData,
} from "@/lib/validations/purchase-account";
import type { AdminPurchaseAccountListItem } from "@/types";

interface PurchaseAccountFormModalProps {
  open: boolean;
  onClose: () => void;
  account?: AdminPurchaseAccountListItem | null;
  onSave: () => void;
}

export function PurchaseAccountFormModal({
  open,
  onClose,
  account,
  onSave,
}: PurchaseAccountFormModalProps) {
  const isEdit = !!account;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);

  // 생성 모드 폼
  const createForm = useForm<PurchaseAccountFormData>({
    resolver: zodResolver(purchaseAccountFormSchema),
    defaultValues: {
      account_name: "",
      username: "",
      password: "",
      notification_phone: null,
      memo: null,
    },
  });

  // 수정 모드 폼
  const updateForm = useForm<PurchaseAccountUpdateData>({
    resolver: zodResolver(purchaseAccountUpdateSchema),
    defaultValues: {
      account_name: account?.account_name ?? "",
      username: account?.username ?? "",
      status: account?.status ?? "active",
      notification_phone: account?.notification_phone ?? null,
      memo: account?.memo ?? null,
    },
  });

  // account prop 변경 시 폼 동기화
  useEffect(() => {
    setUsernameChecked(false);
    setUsernameAvailable(false);
    if (account) {
      updateForm.reset({
        account_name: account.account_name,
        username: account.username,
        status: account.status,
        notification_phone: account.notification_phone ?? null,
        memo: account.memo,
      });
    } else {
      createForm.reset({
        account_name: "",
        username: "",
        password: "",
        notification_phone: null,
        memo: null,
      });
    }
  }, [account, createForm, updateForm]);

  const checkUsername = async (newUsername: string) => {
    if (!newUsername || newUsername.length < 4) {
      toast({ type: "error", title: "로그인 아이디는 4자 이상이어야 합니다." });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      toast({ type: "error", title: "영문, 숫자, 밑줄만 사용 가능합니다." });
      return;
    }
    // 기존 아이디와 같으면 체크 불필요
    if (account && newUsername === account.username) {
      setUsernameChecked(true);
      setUsernameAvailable(true);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch("/api/admin/purchase-accounts/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername }),
      });
      const json = await res.json();
      if (json.success && json.available) {
        setUsernameChecked(true);
        setUsernameAvailable(true);
        toast({ type: "success", title: "사용 가능한 아이디입니다." });
      } else {
        setUsernameChecked(true);
        setUsernameAvailable(false);
        toast({ type: "error", title: json.error?.message ?? "이미 사용 중인 아이디입니다." });
      }
    } catch {
      toast({ type: "error", title: "중복확인 중 오류가 발생했습니다." });
    } finally {
      setCheckingUsername(false);
    }
  };

  const onCreateSubmit = async (data: PurchaseAccountFormData) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/purchase-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: "매입 아이디가 등록되었습니다" });
        onSave();
      } else {
        toast({ type: "error", title: json.error?.message ?? "등록에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "등록 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const onUpdateSubmit = async (data: PurchaseAccountUpdateData) => {
    if (!account) return;
    // username이 변경되었으면 중복확인 필수
    if (data.username && data.username !== account.username && (!usernameChecked || !usernameAvailable)) {
      toast({ type: "error", title: "로그인 아이디 중복확인을 해주세요." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/purchase-accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: "매입 아이디 정보가 수정되었습니다" });
        onSave();
      } else {
        toast({ type: "error", title: json.error?.message ?? "수정에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "수정 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  if (isEdit) {
    const { register, handleSubmit, watch, setValue, formState: { errors } } = updateForm;

    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-h-[85vh] max-w-[480px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>매입 아이디 수정</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onUpdateSubmit)} className="space-y-5 pt-2">
            {/* 로그인 아이디 */}
            <div className="space-y-1.5">
              <Label>로그인 아이디</Label>
              <div className="flex gap-2">
                <Input
                  {...register("username", {
                    onChange: () => { setUsernameChecked(false); setUsernameAvailable(false); },
                  })}
                  placeholder="영문, 숫자, 밑줄 (4~20자)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 px-3"
                  disabled={checkingUsername}
                  onClick={() => checkUsername(watch("username") ?? "")}
                >
                  {checkingUsername ? <Loader2 size={14} className="animate-spin" /> : "중복확인"}
                </Button>
              </div>
              {errors.username && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> {errors.username.message}
                </p>
              )}
              {usernameChecked && usernameAvailable && (
                <p className="flex items-center gap-1 text-[13px] text-neutral-600">
                  <CheckCircle2 size={13} /> 사용 가능한 아이디입니다
                </p>
              )}
              {usernameChecked && !usernameAvailable && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> 이미 사용 중인 아이디입니다
                </p>
              )}
              <p className="text-[12px] text-muted-foreground">손님이 선물 보낼 때 사용하는 아이디입니다</p>
            </div>

            {/* 아이디명 */}
            <div className="space-y-1.5">
              <Label>아이디명 *</Label>
              <Input {...register("account_name")} placeholder="아이디명 입력" />
              {errors.account_name && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> {errors.account_name.message}
                </p>
              )}
            </div>

            {/* 상태 */}
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select
                value={watch("status") ?? "active"}
                onValueChange={(v) => setValue("status", v as "active" | "suspended")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="suspended">중지</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 알림 연락처 */}
            <div className="space-y-1.5">
              <Label>알림 연락처</Label>
              <Input
                {...register("notification_phone", {
                  setValueAs: (v: string) => (v === "" ? null : v),
                })}
                placeholder="01012345678 (선물 수신 시 SMS 알림)"
                maxLength={11}
              />
              {errors.notification_phone && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> {errors.notification_phone.message}
                </p>
              )}
            </div>

            {/* 메모 */}
            <div className="space-y-1.5">
              <Label>메모</Label>
              <Textarea {...register("memo")} placeholder="메모 입력 (선택)" rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                수정
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // 생성 모드
  const { register, handleSubmit, formState: { errors } } = createForm;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-[480px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>매입 아이디 등록</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-5 pt-2">
          {/* 아이디명 */}
          <div className="space-y-1.5">
            <Label>아이디명 *</Label>
            <Input {...register("account_name")} placeholder="매입 아이디 이름 (예: 매입1호)" />
            {errors.account_name && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.account_name.message}
              </p>
            )}
          </div>

          {/* 로그인 아이디 */}
          <div className="space-y-1.5">
            <Label>로그인 아이디 *</Label>
            <Input {...register("username")} placeholder="영문, 숫자, 밑줄 (4~20자)" />
            {errors.username && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.username.message}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-1.5">
            <Label>비밀번호 *</Label>
            <Input type="password" {...register("password")} placeholder="6자 이상" />
            {errors.password && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.password.message}
              </p>
            )}
          </div>

          {/* 알림 연락처 */}
          <div className="space-y-1.5">
            <Label>알림 연락처</Label>
            <Input
              {...register("notification_phone", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
              placeholder="01012345678 (선물 수신 시 SMS 알림)"
              maxLength={11}
            />
            {errors.notification_phone && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.notification_phone.message}
              </p>
            )}
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea {...register("memo")} placeholder="메모 입력 (선택)" rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              등록
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
