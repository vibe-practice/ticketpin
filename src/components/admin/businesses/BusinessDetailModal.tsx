"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Receipt,
  Calculator,
  Phone,
  CreditCard,
  Percent,
  User,
  Calendar,
  Loader2,
  Pencil,
  RefreshCcw,
  Trash2,
  Smartphone,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import {
  SETTLEMENT_STATUS_STYLE,
  SETTLEMENT_STATUS_LABEL,
  BUSINESS_STATUS_STYLE,
  BUSINESS_STATUS_LABEL,
} from "@/lib/admin-constants";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import type {
  AdminBusinessListItem,
  AdminSettlementListItem,
  VoucherStatus,
} from "@/types";

const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  issued: "발급",
  temp_verified: "임시인증",
  password_set: "비번설정",
  pin_revealed: "핀확인",
  gifted: "선물",
  cancelled: "취소",
};

// ─── 매입내역 아이템 타입 ─────────────────────────────────────────────────────

interface GiftItem {
  id: string;
  product_name: string;
  product_price: number;
  order_quantity: number;
  total_amount: number;
  new_voucher_status: VoucherStatus;
  created_at: string;
  auto_recycled?: boolean;
}

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────

type TabKey = "info" | "gifts" | "settlements";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "info", label: "기본 정보", icon: Building2 },
  { key: "gifts", label: "매입 내역", icon: Receipt },
  { key: "settlements", label: "정산 내역", icon: Calculator },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BusinessDetailModalProps {
  open: boolean;
  onClose: () => void;
  business: AdminBusinessListItem | null;
  onDelete?: () => void;
  onEdit: () => void;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function BusinessDetailModal({ open, onClose, business, onDelete, onEdit }: BusinessDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  if (!business) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-[900px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            {business.business_name}
            <span
              className={cn(
                "ml-2 rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                BUSINESS_STATUS_STYLE[business.status]
              )}
            >
              {BUSINESS_STATUS_LABEL[business.status]}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-[14px] font-medium transition-colors border-b-2 -mb-px",
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="pt-4">
          {activeTab === "info" && <InfoTab business={business} onDelete={onDelete} onEdit={onEdit} />}
          {activeTab === "gifts" && <GiftsTab businessId={business.id} />}
          {activeTab === "settlements" && <SettlementsTab businessId={business.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 기본 정보 탭 ─────────────────────────────────────────────────────────────

function AuthPhoneSection({ business }: { business: AdminBusinessListItem }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [currentAuthPhone, setCurrentAuthPhone] = useState(business.auth_phone ?? business.contact_phone);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // business prop 변경 시 currentAuthPhone 동기화
  useEffect(() => {
    setCurrentAuthPhone(business.auth_phone ?? business.contact_phone);
  }, [business.id, business.auth_phone, business.contact_phone]);

  // 타이머 cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 타이머 카운트다운
  useEffect(() => {
    if (timer <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [timer]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  };

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(digits)) {
      toast({ type: "error", title: "올바른 휴대폰 번호를 입력해 주세요." });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/phone/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const json = await res.json();

      if (json.success) {
        toast({ type: "success", title: `${json.data.maskedPhone}으로 인증번호를 발송했습니다.` });
        setStep(2);
        setCode("");
        // 타이머 시작
        const seconds = json.data.expiresInSeconds ?? 180;
        setTimer(seconds);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) return 0;
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({ type: "error", title: json.error?.message ?? "인증번호 발송에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "인증번호 발송 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ type: "error", title: "인증번호 6자리를 입력해 주세요." });
      return;
    }

    const digits = phone.replace(/\D/g, "");
    setVerifying(true);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/phone/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, code }),
      });
      const json = await res.json();

      if (json.success) {
        toast({ type: "success", title: "SMS 인증 휴대폰 번호가 변경되었습니다." });
        setCurrentAuthPhone(digits);
        setEditing(false);
        setStep(1);
        setPhone("");
        setCode("");
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        toast({ type: "error", title: json.error?.message ?? "인증에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "인증 확인 중 오류가 발생했습니다." });
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setStep(1);
    setPhone("");
    setCode("");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-start gap-3">
      <Smartphone size={14} className="shrink-0 text-muted-foreground mt-0.5" />
      <span className="text-[14px] text-muted-foreground w-24 shrink-0 mt-0.5">SMS 인증 휴대폰</span>
      <div className="flex-1 space-y-2">
        {!editing ? (
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-foreground">
              {formatPhone(currentAuthPhone)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setEditing(true)}
            >
              변경
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {step === 1 && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-8 w-40 text-[14px]"
                  maxLength={11}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-[14px]"
                  onClick={handleSendCode}
                  disabled={sending || phone.replace(/\D/g, "").length < 10}
                >
                  {sending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
                  인증번호 발송
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[14px] text-muted-foreground"
                  onClick={handleCancel}
                >
                  <X size={12} />
                </Button>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                  <span>{formatPhone(phone)}으로 인증번호 발송됨</span>
                  {timer > 0 && (
                    <span className={cn(
                      "font-mono font-semibold",
                      timer <= 30 ? "text-destructive" : "text-primary"
                    )}>
                      {formatTimer(timer)}
                    </span>
                  )}
                  {timer <= 0 && (
                    <span className="text-destructive font-semibold">만료됨</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="인증번호 6자리"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="h-8 w-32 text-[14px]"
                    maxLength={6}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-[14px]"
                    onClick={handleVerify}
                    disabled={verifying || code.length !== 6 || timer <= 0}
                  >
                    {verifying ? <Loader2 size={12} className="animate-spin mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                    확인
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[14px] text-muted-foreground"
                    onClick={() => { setStep(1); setCode(""); }}
                  >
                    재발송
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[14px] text-muted-foreground"
                    onClick={handleCancel}
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTab({ business, onDelete, onEdit }: { business: AdminBusinessListItem; onDelete?: () => void; onEdit: () => void }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    const ok = await confirm({
      title: "업체 활성화",
      description: `'${business.business_name}' 업체를 다시 활성화하시겠습니까?`,
      confirmLabel: "활성화",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setActivating(true);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}`, { method: "PUT" });
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: "업체가 활성화되었습니다" });
        onDelete?.();
      } else {
        toast({ type: "error", title: json.error?.message ?? "업체 활성화에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "업체 활성화 중 오류가 발생했습니다." });
    } finally {
      setActivating(false);
    }
  };

  const handleTerminate = async () => {
    const ok = await confirm({
      title: "업체 해지",
      description: `'${business.business_name}' 업체를 정말 해지하시겠습니까? 해지 후에도 데이터는 보존됩니다.`,
      confirmLabel: "해지",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: "업체가 해지되었습니다" });
        onDelete?.();
      } else {
        toast({ type: "error", title: json.error?.message ?? "업체 해지에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "업체 해지 중 오류가 발생했습니다." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="총 매입건수" value={`${business.total_gift_count.toLocaleString()}건`} />
        <SummaryCard label="총 매입금액" value={`${business.total_gift_amount.toLocaleString()}원`} />
        <SummaryCard label="정산 완료" value={`${business.total_settled_amount.toLocaleString()}원`} />
        <SummaryCard label="미정산" value={`${business.pending_settlement_amount.toLocaleString()}원`} className="text-error" />
      </div>

      {/* 상세 정보 */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <InfoRow icon={User} label="회원 아이디" value={`${business.user_name} (${business.username})`} />
        <InfoRow icon={Building2} label="업체명" value={business.business_name} />
        <InfoRow icon={Phone} label="담당자 / 연락처" value={`${business.contact_person} / ${business.contact_phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")}`} />
        <AuthPhoneSection business={business} />
        <InfoRow icon={CreditCard} label="정산 계좌" value={`${business.bank_name} ${business.account_number} (${business.account_holder})`} />
        <InfoRow icon={Percent} label="수수료율" value={`${business.commission_rate}%`} />
        <InfoRow icon={User} label="수신 계정" value={business.receiving_account_username ?? "미지정"} />
        <InfoRow icon={Calendar} label="등록일" value={formatDateTime(business.created_at)} />
        {business.memo && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground mb-1">메모</p>
            <p className="text-[14px] text-foreground">{business.memo}</p>
          </div>
        )}
      </div>

      {/* 업체 액션 버튼 */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          <Pencil size={14} className="mr-1" />
          정보 수정
        </Button>
        {business.status === "terminated" ? (
          <Button
            variant="outline"
            size="sm"
            className="text-success border-success/30 hover:bg-success/10 hover:text-success"
            onClick={handleActivate}
            disabled={activating}
          >
            {activating ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCcw size={14} className="mr-1" />}
            업체 활성화
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleTerminate}
            disabled={deleting}
          >
            {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
            업체 해지
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-[15px] font-bold text-foreground mt-0.5", className)}>{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <span className="text-[14px] text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-[14px] text-foreground">{value}</span>
    </div>
  );
}

// ─── 매입 내역 탭 ─────────────────────────────────────────────────────────────

function GiftsTab({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchGifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/gifts?page=${page}&limit=20`);
      const json = await res.json();
      if (json.success) {
        setGifts(json.data?.data ?? []);
        setTotalPages(json.data?.total_pages ?? 1);
      }
    } catch {
      toast({ type: "error", title: "매입 내역 조회 실패" });
    } finally {
      setLoading(false);
    }
  }, [businessId, page, toast]);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  return (
    <div className="space-y-3">
      <p className="text-[14px] text-muted-foreground">
        수신 계정으로 들어온 선물 내역
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : gifts.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted-foreground">매입 내역이 없습니다</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">일시</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">상품명</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">수량</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">금액</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">상태</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">자동복원</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((gift) => (
                  <tr key={gift.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(gift.created_at)}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{gift.product_name}</td>
                    <td className="px-3 py-2 text-center">{gift.order_quantity}개</td>
                    <td className="px-3 py-2 text-right font-medium">{gift.total_amount.toLocaleString()}원</td>
                    <td className="px-3 py-2 text-center">
                      <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                        {VOUCHER_STATUS_LABEL[gift.new_voucher_status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {gift.auto_recycled && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-1.5 py-0.5 text-[11px] font-semibold text-success">
                          <RefreshCcw size={10} /> 자동복원
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

// ─── 정산 내역 탭 ─────────────────────────────────────────────────────────────

function SettlementsTab({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [settlements, setSettlements] = useState<AdminSettlementListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settlements?business_id=${businessId}&page_size=50`);
      const json = await res.json();
      if (json.success) {
        setSettlements(json.data ?? []);
      }
    } catch {
      toast({ type: "error", title: "정산 내역 조회 실패" });
    } finally {
      setLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const totalAmount = useMemo(
    () => settlements.reduce((sum, s) => sum + s.settlement_amount, 0),
    [settlements]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-muted-foreground">해당 업체의 정산 내역</p>
        <p className="text-[14px] font-semibold text-primary">
          총 정산액: {totalAmount.toLocaleString()}원
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : settlements.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted-foreground">정산 내역이 없습니다</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">대상일</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">건수</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">총액</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">수수료율</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">정산금액</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">상태</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((stl) => (
                <tr key={stl.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-foreground">{stl.settlement_date}</td>
                  <td className="px-3 py-2 text-center">{stl.gift_count}건</td>
                  <td className="px-3 py-2 text-right">{stl.gift_total_amount.toLocaleString()}원</td>
                  <td className="px-3 py-2 text-center">{stl.commission_rate}%</td>
                  <td className="px-3 py-2 text-right font-bold text-primary">{stl.settlement_amount.toLocaleString()}원</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                        SETTLEMENT_STATUS_STYLE[stl.status]
                      )}
                    >
                      {SETTLEMENT_STATUS_LABEL[stl.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
