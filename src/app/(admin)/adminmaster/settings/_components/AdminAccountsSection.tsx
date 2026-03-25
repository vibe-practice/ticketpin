"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAdminAccountSchema, type AddAdminAccountInput } from "@/lib/validations/admin";
import type { ServerMessage } from "../page";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface AdminAccount {
  id: string;
  username: string;
  name: string;
  created_at: string;
}

interface AdminAccountsSectionProps {
  currentAdminId: string;
  onMessage: (msg: ServerMessage) => void;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function AdminAccountsSection({ currentAdminId, onMessage }: AdminAccountsSectionProps) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const {
    register: registerAccount,
    handleSubmit: handleSubmitAccount,
    reset: resetAccount,
    formState: { errors: accountErrors, isSubmitting: isSubmittingAccount },
  } = useForm<AddAdminAccountInput>({
    resolver: zodResolver(addAdminAccountSchema),
    defaultValues: { username: "", password: "", name: "" },
  });

  // 계정 목록 조회
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/accounts");
      const result = await res.json();
      if (result.success) {
        setAccounts(result.data);
      }
    } catch {
      onMessage({ type: "error", text: "계정 목록을 불러올 수 없습니다." });
    } finally {
      setAccountsLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 계정 추가
  const onAddAccount = async (data: AddAdminAccountInput) => {
    try {
      const res = await fetch("/api/admin/settings/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        onMessage({ type: "success", text: "관리자 계정이 추가되었습니다." });
        resetAccount();
        fetchAccounts();
      } else {
        onMessage({
          type: "error",
          text: result.error?.message || "계정 추가에 실패했습니다.",
        });
      }
    } catch {
      onMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    }
  };

  // 계정 삭제
  const handleDeleteAccount = async (id: string) => {
    if (!confirm("이 관리자 계정을 삭제하시겠습니까?")) return;

    setDeletingAccountId(id);

    try {
      const res = await fetch("/api/admin/settings/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();

      if (result.success) {
        onMessage({ type: "success", text: "관리자 계정이 삭제되었습니다." });
        fetchAccounts();
      } else {
        onMessage({
          type: "error",
          text: result.error?.message || "계정 삭제에 실패했습니다.",
        });
      }
    } catch {
      onMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setDeletingAccountId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users size={18} className="text-primary" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-foreground">관리자 계정 관리</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        관리자 페이지에 로그인할 수 있는 계정을 관리합니다.
      </p>

      {/* 계정 추가 폼 */}
      <form
        onSubmit={handleSubmitAccount(onAddAccount)}
        className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4"
      >
        <h3 className="text-[14px] font-semibold text-foreground mb-3">계정 추가</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="account_username" className="text-xs text-muted-foreground">
              아이디
            </Label>
            <Input
              id="account_username"
              placeholder="예: admin2"
              {...registerAccount("username")}
              className="h-9 text-sm font-mono"
            />
            {accountErrors.username && (
              <p className="flex items-center gap-1 text-[14px] text-destructive">
                <AlertCircle size={11} />
                {accountErrors.username.message}
              </p>
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="account_password" className="text-xs text-muted-foreground">
              비밀번호
            </Label>
            <Input
              id="account_password"
              type="password"
              placeholder="8자 이상"
              {...registerAccount("password")}
              className="h-9 text-sm"
            />
            {accountErrors.password && (
              <p className="flex items-center gap-1 text-[14px] text-destructive">
                <AlertCircle size={11} />
                {accountErrors.password.message}
              </p>
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="account_name" className="text-xs text-muted-foreground">
              이름
            </Label>
            <Input
              id="account_name"
              placeholder="예: 홍길동"
              {...registerAccount("name")}
              className="h-9 text-sm"
            />
            {accountErrors.name && (
              <p className="flex items-center gap-1 text-[14px] text-destructive">
                <AlertCircle size={11} />
                {accountErrors.name.message}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingAccount}
              className="h-9 gap-1.5"
            >
              {isSubmittingAccount ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              추가
            </Button>
          </div>
        </div>
      </form>

      {/* 계정 목록 */}
      {accountsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          등록된 관리자 계정이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const isSelf = account.id === currentAdminId;
            return (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Users size={15} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground">
                      {account.username}
                      {isSelf && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          본인
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.name}
                      <span className="ml-2 text-muted-foreground/60">
                        {new Date(account.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </p>
                  </div>
                </div>
                {!isSelf && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAccount(account.id)}
                    disabled={deletingAccountId === account.id}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`${account.username} 삭제`}
                  >
                    {deletingAccountId === account.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
