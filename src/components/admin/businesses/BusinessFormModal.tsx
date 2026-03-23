"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Search, Loader2 } from "lucide-react";
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
import { businessFormSchema, type BusinessFormData, BANK_LIST } from "@/lib/validations/business";
import type { AdminBusinessListItem } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BusinessFormModalProps {
  open: boolean;
  onClose: () => void;
  business?: AdminBusinessListItem | null;
  onSave: (data: BusinessFormData) => void;
}

// ─── 검색 결과 타입 ──────────────────────────────────────────────────────────

interface SearchUser {
  id: string;
  username: string;
  name: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function BusinessFormModal({ open, onClose, business, onSave }: BusinessFormModalProps) {
  const isEdit = !!business;
  const { toast } = useToast();

  // 회원 검색 상태
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<SearchUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(
    business ? { id: business.user_id, username: business.username, name: business.user_name } : null
  );

  // 수신 계정 검색 상태
  const [receivingSearchQuery, setReceivingSearchQuery] = useState("");
  const [receivingSearchResults, setReceivingSearchResults] = useState<SearchUser[]>([]);
  const [receivingSearchLoading, setReceivingSearchLoading] = useState(false);
  const [selectedReceiving, setSelectedReceiving] = useState<SearchUser | null>(
    business?.receiving_account_id
      ? { id: business.receiving_account_id, username: business.receiving_account_username ?? "", name: "" }
      : null
  );

  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      user_id: business?.user_id ?? "",
      business_name: business?.business_name ?? "",
      contact_person: business?.contact_person ?? "",
      contact_phone: business?.contact_phone ?? "",
      bank_name: business?.bank_name ?? "",
      account_number: business?.account_number ?? "",
      account_holder: business?.account_holder ?? "",
      commission_rate: business?.commission_rate ?? 96,
      receiving_account_id: business?.receiving_account_id ?? null,
      memo: business?.memo ?? null,
    },
  });

  // business prop 변경 시 폼 + 검색 state 동기화
  useEffect(() => {
    reset({
      user_id: business?.user_id ?? "",
      business_name: business?.business_name ?? "",
      contact_person: business?.contact_person ?? "",
      contact_phone: business?.contact_phone ?? "",
      bank_name: business?.bank_name ?? "",
      account_number: business?.account_number ?? "",
      account_holder: business?.account_holder ?? "",
      commission_rate: business?.commission_rate ?? 96,
      receiving_account_id: business?.receiving_account_id ?? null,
      memo: business?.memo ?? null,
    });
    setSelectedUser(
      business ? { id: business.user_id, username: business.username, name: business.user_name } : null
    );
    setSelectedReceiving(
      business?.receiving_account_id
        ? { id: business.receiving_account_id, username: business.receiving_account_username ?? "", name: "" }
        : null
    );
    setUserSearchQuery("");
    setUserSearchResults([]);
    setReceivingSearchQuery("");
    setReceivingSearchResults([]);
  }, [business, reset]);

  const handleUserSearch = useCallback(async () => {
    if (!userSearchQuery.trim()) return;
    setUserSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/search-user?q=${encodeURIComponent(userSearchQuery.trim())}`);
      const json = await res.json();
      if (json.success) {
        setUserSearchResults(json.data ?? []);
        if ((json.data ?? []).length === 0) {
          toast({ type: "info", title: "검색 결과가 없습니다." });
        }
      }
    } catch {
      toast({ type: "error", title: "회원 검색 중 오류가 발생했습니다." });
    } finally {
      setUserSearchLoading(false);
    }
  }, [userSearchQuery, toast]);

  const handleReceivingSearch = useCallback(async () => {
    if (!receivingSearchQuery.trim()) return;
    setReceivingSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/search-user?q=${encodeURIComponent(receivingSearchQuery.trim())}`);
      const json = await res.json();
      if (json.success) {
        setReceivingSearchResults(json.data ?? []);
        if ((json.data ?? []).length === 0) {
          toast({ type: "info", title: "검색 결과가 없습니다." });
        }
      }
    } catch {
      toast({ type: "error", title: "회원 검색 중 오류가 발생했습니다." });
    } finally {
      setReceivingSearchLoading(false);
    }
  }, [receivingSearchQuery, toast]);

  const selectUser = useCallback((user: SearchUser) => {
    setSelectedUser(user);
    setValue("user_id", user.id);
    setUserSearchResults([]);
    setUserSearchQuery("");
  }, [setValue]);

  const selectReceiving = useCallback((user: SearchUser) => {
    setSelectedReceiving(user);
    setValue("receiving_account_id", user.id);
    setReceivingSearchResults([]);
    setReceivingSearchQuery("");
  }, [setValue]);

  const onSubmit = async (data: BusinessFormData) => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/businesses/${business!.id}`
        : "/api/admin/businesses";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success) {
        if (json.warning) {
          toast({ type: "warning", title: json.warning });
        } else {
          toast({ type: "success", title: isEdit ? "업체 정보가 수정되었습니다" : "업체가 등록되었습니다" });
        }
        onSave(data);
      } else {
        toast({ type: "error", title: json.error?.message ?? "저장에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "업체 정보 수정" : "업체 등록"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
          {/* 회원 검색 */}
          <div className="space-y-1.5">
            <Label>업체 회원 계정 *</Label>
            <div className="flex gap-2">
              <Input
                placeholder="회원 아이디 입력"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUserSearch(); } }}
                disabled={isEdit}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleUserSearch} disabled={isEdit || userSearchLoading}>
                {userSearchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>
            {userSearchResults.length > 0 && (
              <div className="mt-1 rounded-md border border-border bg-card max-h-[120px] overflow-y-auto">
                {userSearchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted/50 transition-colors"
                    onClick={() => selectUser(u)}
                  >
                    {u.name} ({u.username})
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <p className="text-[12px] text-success">
                선택됨: {selectedUser.name} ({selectedUser.username})
              </p>
            )}
            {errors.user_id && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.user_id.message}
              </p>
            )}
          </div>

          {/* 업체명 */}
          <div className="space-y-1.5">
            <Label>업체명 *</Label>
            <Input {...register("business_name")} placeholder="업체명 입력" />
            {errors.business_name && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.business_name.message}
              </p>
            )}
          </div>

          {/* 담당자 + 연락처 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>담당자명 *</Label>
              <Input {...register("contact_person")} placeholder="담당자명" />
              {errors.contact_person && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> {errors.contact_person.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>연락처 *</Label>
              <Input {...register("contact_phone")} placeholder="01012345678" />
              {errors.contact_phone && (
                <p className="flex items-center gap-1 text-[13px] text-destructive">
                  <AlertCircle size={13} /> {errors.contact_phone.message}
                </p>
              )}
            </div>
          </div>

          {/* 은행 + 계좌 + 예금주 */}
          <div className="space-y-1.5">
            <Label>정산 계좌 정보 *</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={watch("bank_name") || ""}
                onValueChange={(v) => setValue("bank_name", v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="은행 선택" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_LIST.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input {...register("account_number")} placeholder="계좌번호" />
              <Input {...register("account_holder")} placeholder="예금주" />
            </div>
            {(errors.bank_name || errors.account_number || errors.account_holder) && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} />
                {errors.bank_name?.message || errors.account_number?.message || errors.account_holder?.message}
              </p>
            )}
          </div>

          {/* 수수료율 */}
          <div className="space-y-1.5">
            <Label>수수료율 (%) *</Label>
            <Input
              type="number"
              step="0.1"
              {...register("commission_rate", { valueAsNumber: true })}
              placeholder="96"
            />
            {errors.commission_rate && (
              <p className="flex items-center gap-1 text-[13px] text-destructive">
                <AlertCircle size={13} /> {errors.commission_rate.message}
              </p>
            )}
          </div>

          {/* 수신 계정 */}
          <div className="space-y-1.5">
            <Label>수신 계정 (선물 받을 계정)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="수신 계정 아이디 입력"
                value={receivingSearchQuery}
                onChange={(e) => setReceivingSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleReceivingSearch(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleReceivingSearch} disabled={receivingSearchLoading}>
                {receivingSearchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>
            {receivingSearchResults.length > 0 && (
              <div className="mt-1 rounded-md border border-border bg-card max-h-[120px] overflow-y-auto">
                {receivingSearchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted/50 transition-colors"
                    onClick={() => selectReceiving(u)}
                  >
                    {u.name} ({u.username})
                  </button>
                ))}
              </div>
            )}
            {selectedReceiving && (
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-success">
                  선택됨: {selectedReceiving.username}
                </p>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground underline"
                  onClick={() => {
                    setSelectedReceiving(null);
                    setValue("receiving_account_id", null);
                  }}
                >
                  해제
                </button>
              </div>
            )}
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              {...register("memo")}
              placeholder="메모 입력 (선택)"
              rows={3}
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              {isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
