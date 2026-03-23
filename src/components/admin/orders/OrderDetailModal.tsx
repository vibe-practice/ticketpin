"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  User,
  ShoppingBag,
  CreditCard,
  Ticket,
  Percent,
  Gift,
  MessageSquare,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Settings,
  Ban,
  Send,
  KeyRound,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type {
  AdminOrderListItem,
  OrderStatus,
  VoucherStatus,
  CancelStatus,
  SmsMessageType,
  SmsSendStatus,
  FeeType,
  CancellationReasonType,
} from "@/types";

// ─── 라벨/색상 맵 ──────────────────────────────────────────────────────────────

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; className: string }> = {
  paid: { label: "결제완료", className: "bg-info-bg text-info" },
  password_set: { label: "비밀번호 설정", className: "bg-brand-primary-soft text-primary" },
  pin_revealed: { label: "핀 확인", className: "bg-success-bg text-success" },
  gifted: { label: "선물", className: "bg-neutral-100 text-neutral-600" },
  cancelled: { label: "취소", className: "bg-error-bg text-error" },
};

const VOUCHER_STATUS_MAP: Record<VoucherStatus, { label: string; className: string }> = {
  issued: { label: "발급", className: "bg-info-bg text-info" },
  temp_verified: { label: "임시인증", className: "bg-neutral-100 text-neutral-600" },
  password_set: { label: "비번설정", className: "bg-brand-primary-soft text-primary" },
  pin_revealed: { label: "핀확인", className: "bg-success-bg text-success" },
  gifted: { label: "선물", className: "bg-neutral-100 text-neutral-600" },
  cancelled: { label: "취소", className: "bg-error-bg text-error" },
};

const FEE_TYPE_MAP: Record<FeeType, string> = {
  included: "포함",
  separate: "별도",
};

const CANCELLATION_REASON_MAP: Record<CancellationReasonType, string> = {
  simple_change: "단순 변심",
  wrong_purchase: "잘못된 구매",
  admin: "관리자 처리",
  duplicate_payment: "이중결제",
  other: "기타",
};

const CANCEL_STATUS_MAP: Record<CancelStatus, { label: string; icon: React.ReactNode; className: string }> = {
  completed: {
    label: "취소완료",
    icon: <CheckCircle2 size={13} />,
    className: "text-success",
  },
  failed: {
    label: "취소실패",
    icon: <AlertCircle size={13} />,
    className: "text-error",
  },
};

const SMS_TYPE_MAP: Record<SmsMessageType, string> = {
  purchase: "구매",
  reissue: "재발행",
  gift: "선물",
  cancel: "취소",
  admin_resend: "관리자 재발송",
  purchase_notify: "매입 알림",
};

const SMS_STATUS_MAP: Record<SmsSendStatus, { label: string; className: string }> = {
  pending: { label: "대기", className: "text-neutral-600" },
  sent: { label: "발송완료", className: "text-success" },
  failed: { label: "실패", className: "text-error" },
};

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  iconClassName,
}: {
  icon: React.ElementType;
  title: string;
  iconClassName?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded",
          iconClassName ?? "bg-muted text-muted-foreground"
        )}
      >
        <Icon size={13} />
      </div>
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// ─── 정보 행 ──────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-28 shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="flex-1 text-[13px] text-foreground">{children}</span>
    </div>
  );
}

// ─── 날짜 포맷 ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

// ─── 관리자 취소 사유 모달 ──────────────────────────────────────────────────────

interface CancelReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reasonType: CancellationReasonType, detail: string | null) => void;
  loading: boolean;
  orderNumber: string;
  isPasswordSet?: boolean;
  voucherStatus?: string | null;
  isGifted?: boolean;
}

function CancelReasonDialog({ open, onClose, onConfirm, loading, orderNumber, isPasswordSet, voucherStatus, isGifted }: CancelReasonDialogProps) {
  const [reasonType, setReasonType] = useState<CancellationReasonType>("admin");
  const [detail, setDetail] = useState("");

  const handleConfirm = () => {
    onConfirm(reasonType, reasonType === "other" && detail.trim() ? detail.trim() : null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setReasonType("admin");
      setDetail("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ban size={16} className="text-error" />
            주문 취소
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">주문번호: </span>
            <span className="font-mono font-medium">{orderNumber}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">취소 사유</Label>
            <RadioGroup
              value={reasonType}
              onValueChange={(v) => setReasonType(v as CancellationReasonType)}
              className="space-y-2"
            >
              {(
                [
                  ["simple_change", "단순 변심"],
                  ["wrong_purchase", "잘못된 구매"],
                  ["admin", "관리자 처리"],
                  ["other", "기타"],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`cancel-reason-${value}`} />
                  <Label htmlFor={`cancel-reason-${value}`} className="text-[13px] font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reasonType === "other" && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium">상세 사유</Label>
              <Textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="취소 사유를 입력해주세요"
                className="h-20 resize-none text-[13px]"
              />
            </div>
          )}

          {(isPasswordSet || voucherStatus === "pin_revealed" || isGifted) && (
            <div className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[12px] text-warning space-y-1">
              {isGifted && (
                <p>이 주문은 선물이 완료되었습니다. 취소 시 선물 수신자의 바우처도 함께 취소됩니다.</p>
              )}
              {voucherStatus === "pin_revealed" ? (
                <p>이 주문은 핀 번호가 이미 확인되었습니다. 취소 시 확인된 핀이 재고로 복구되어 다른 사용자에게 재배정될 수 있습니다.</p>
              ) : isPasswordSet ? (
                <p>이 주문은 비밀번호가 설정되었습니다. 취소 시 바우처가 비활성화되고 핀이 재고로 복구됩니다.</p>
              ) : null}
            </div>
          )}

          <div className="rounded-lg border border-error/20 bg-error-bg px-3 py-2 text-[12px] text-error">
            주문을 취소하면 PG 환불이 진행되며, 바우처가 비활성화되고 핀이 재고로 복구됩니다.
            이 작업은 되돌릴 수 없습니다.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
              닫기
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirm}
              disabled={loading || (reasonType === "other" && !detail.trim())}
            >
              {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Ban size={14} className="mr-1.5" />}
              취소 처리
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 모달 ────────────────────────────────────────────────────────────────

interface OrderDetailModalProps {
  order: AdminOrderListItem | null;
  open: boolean;
  onClose: () => void;
  onOrderUpdate?: (updatedOrder: AdminOrderListItem) => void;
}

export function OrderDetailModal({ order, open, onClose, onOrderUpdate }: OrderDetailModalProps) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 모달 열릴 때 상세 API에서 전체 gift_chain 가져오기
  useEffect(() => {
    if (!open || !order) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          onOrderUpdate?.(json.data);
        }
      } catch {
        // 실패해도 기존 데이터로 표시
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  if (!order) return null;

  const fetchUpdatedOrder = async (): Promise<AdminOrderListItem | null> => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  };

  const isNotCancelled = order.status !== "cancelled";
  const canAdminCancel = isNotCancelled;
  const canResetPassword = order.is_password_set && isNotCancelled;
  const canResendSms = !!order.voucher_id && isNotCancelled;
  const canAdminReissue = isNotCancelled && order.reissue_count >= 5;

  // 관리자 취소 처리
  const handleCancelOrder = async (reasonType: CancellationReasonType, detail: string | null) => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason_type: reasonType, reason_detail: detail }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "취소 처리 실패");
      }

      const updated = await fetchUpdatedOrder();
      if (updated && updated.id === order.id) onOrderUpdate?.(updated);

      toast({ type: "success", title: "주문이 취소되었습니다", description: `${order.order_number} — 환불이 진행됩니다.` });
      setCancelDialogOpen(false);
    } catch (err) {
      toast({ type: "error", title: "취소 처리 실패", description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요." });
    } finally {
      setCancelLoading(false);
    }
  };

  // SMS 재발송
  const handleResendSms = async () => {
    const ok = await confirm({
      title: "SMS 재발송",
      description: `${order.buyer_name}(${formatPhone(order.buyer_phone)})에게 바우처 안내 SMS를 다시 발송합니다.`,
      confirmLabel: "발송",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setActionLoading("sms");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/resend-sms`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "SMS 발송 실패");
      }

      const updated = await fetchUpdatedOrder();
      if (updated && updated.id === order.id) onOrderUpdate?.(updated);

      toast({ type: "success", title: "SMS가 재발송되었습니다" });
    } catch (err) {
      toast({ type: "error", title: "SMS 발송 실패", description: err instanceof Error ? err.message : undefined });
    } finally {
      setActionLoading(null);
    }
  };

  // 사용자 비밀번호 초기화
  const handleResetPassword = async () => {
    const ok = await confirm({
      title: "사용자 비밀번호 초기화",
      description: `${order.buyer_name}의 바우처 비밀번호(4자리)를 초기화합니다. 잠금이 해제되고 새 임시 비밀번호가 SMS로 발송됩니다.`,
      confirmLabel: "초기화",
      cancelLabel: "취소",
      variant: "destructive",
    });
    if (!ok) return;

    setActionLoading("resetPw");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/reset-password`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "비밀번호 초기화 실패");
      }

      const updated = await fetchUpdatedOrder();
      if (updated && updated.id === order.id) onOrderUpdate?.(updated);

      toast({ type: "success", title: "비밀번호가 초기화되었습니다", description: "새 임시 비밀번호가 SMS로 발송되었습니다." });
    } catch (err) {
      toast({ type: "error", title: "비밀번호 초기화 실패", description: err instanceof Error ? err.message : undefined });
    } finally {
      setActionLoading(null);
    }
  };

  // 관리자 임시 비밀번호 재발행 (5회 제한 무시 — resend-sms 엔드포인트 사용)
  const handleAdminReissue = async () => {
    const ok = await confirm({
      title: "임시 비밀번호 재발행",
      description: `재발행 횟수(${order.reissue_count}/5)가 소진되었습니다. 관리자 권한으로 5회 제한을 무시하고 새 임시 비밀번호를 발급합니다.`,
      confirmLabel: "재발행",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setActionLoading("reissue");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/resend-sms`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "재발행 실패");
      }

      const updated = await fetchUpdatedOrder();
      if (updated && updated.id === order.id) onOrderUpdate?.(updated);

      toast({ type: "success", title: "임시 비밀번호가 재발행되었습니다", description: "SMS로 발송되었습니다." });
    } catch (err) {
      toast({ type: "error", title: "재발행 실패", description: err instanceof Error ? err.message : undefined });
    } finally {
      setActionLoading(null);
    }
  };

  const hasAnyAction = canAdminCancel || canResendSms || canResetPassword || canAdminReissue;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          {/* 헤더 */}
          <DialogHeader className="border-b border-border bg-card px-6 py-4">
            <DialogTitle className="flex items-center gap-3 text-base">
              <span className="font-bold text-foreground">{order.order_number}</span>
              <span
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                  ORDER_STATUS_MAP[order.status]?.className
                )}
              >
                {ORDER_STATUS_MAP[order.status]?.label}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-0 divide-y divide-border">
            {/* 1. 구매자 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={User}
                title="구매자 정보"
                iconClassName="bg-brand-primary-soft text-primary"
              />
              <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
                <InfoRow label="아이디">{order.buyer_username}</InfoRow>
                <InfoRow label="이름">{order.buyer_name}</InfoRow>
                <InfoRow label="전화번호">{formatPhone(order.buyer_phone)}</InfoRow>
              </div>
            </section>

            {/* 2. 상품 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={ShoppingBag}
                title="상품 정보"
                iconClassName="bg-neutral-100 text-neutral-600"
              />
              <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
                {order.product_image_url && (
                  <Image
                    src={order.product_image_url}
                    alt={order.product_name}
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">{order.product_name}</p>
                  <div className="mt-1.5 flex items-center gap-4 text-[12px] text-muted-foreground">
                    <span>단가 <span className="font-medium text-foreground">{order.product_price.toLocaleString()}원</span></span>
                    <span>수량 <span className="font-medium text-foreground">{order.quantity}개</span></span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. 결제 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={CreditCard}
                title="결제 정보"
                iconClassName="bg-success-bg text-success"
              />
              <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
                <InfoRow label="총 결제금액">
                  <span className="font-semibold text-primary">{order.total_amount.toLocaleString()}원</span>
                </InfoRow>
                <InfoRow label="카드사">
                  {order.card_company_name ?? "—"}
                </InfoRow>
                <InfoRow label="카드번호">
                  <span className="font-mono text-[12px]">{order.card_no ?? "—"}</span>
                </InfoRow>
                <InfoRow label="할부">
                  {order.installment_months === 0 ? "일시불" : `${order.installment_months}개월`}
                </InfoRow>
                <InfoRow label="승인번호">
                  <span className="font-mono text-[12px]">{order.approval_no ?? "—"}</span>
                </InfoRow>
                <InfoRow label="PG 거래번호">
                  <span className="font-mono text-[12px]">{order.pg_ref_no ?? "—"}</span>
                </InfoRow>
                <InfoRow label="결제일시">{formatDate(order.created_at)}</InfoRow>
              </div>
            </section>

            {/* 4. 바우처 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={Ticket}
                title="바우처 정보"
                iconClassName="bg-info-bg text-info"
              />
              {order.voucher_code ? (
                <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
                  <InfoRow label="바우처 코드">
                    <span className="break-all font-mono text-[11px]">{order.voucher_code}</span>
                  </InfoRow>
                  <InfoRow label="바우처 상태">
                    {order.voucher_status && (
                      <span
                        className={cn(
                          "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                          VOUCHER_STATUS_MAP[order.voucher_status]?.className
                        )}
                      >
                        {VOUCHER_STATUS_MAP[order.voucher_status]?.label}
                      </span>
                    )}
                  </InfoRow>
                  <InfoRow label="핀 수량">{order.pin_count}개</InfoRow>
                  <InfoRow label="비밀번호 설정">
                    {order.is_password_set ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 size={13} /> 설정됨
                      </span>
                    ) : (
                      <span className="text-muted-foreground">미설정</span>
                    )}
                  </InfoRow>
                  {order.is_password_locked && (
                    <InfoRow label="잠금 상태">
                      <span className="flex items-center gap-1 text-error">
                        <AlertCircle size={13} /> 잠김
                      </span>
                    </InfoRow>
                  )}
                  <InfoRow label="재발행 횟수">
                    <span className={cn(order.reissue_count >= 5 && "font-semibold text-error")}>
                      {order.reissue_count}/5회
                      {order.reissue_count >= 5 && " (소진)"}
                    </span>
                  </InfoRow>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[13px] text-muted-foreground">
                  바우처 정보 없음
                </div>
              )}
            </section>

            {/* 5. 수수료 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={Percent}
                title="수수료 정보"
                iconClassName="bg-muted text-muted-foreground"
              />
              <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
                <InfoRow label="수수료 방식">
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                      order.fee_type === "included"
                        ? "bg-brand-primary-soft text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {FEE_TYPE_MAP[order.fee_type]}
                  </span>
                </InfoRow>
                <InfoRow label="수수료 금액">
                  <span className="font-semibold">
                    {(order.fee_amount * order.quantity).toLocaleString()}원
                    {order.quantity > 1 && (
                      <span className="ml-1 text-muted-foreground font-normal text-[12px]">
                        ({order.fee_amount.toLocaleString()}원 × {order.quantity}장)
                      </span>
                    )}
                  </span>
                </InfoRow>
                {order.fee_type === "separate" && (
                  <>
                    <InfoRow label="수수료 결제">
                      {order.fee_paid ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 size={13} /> 결제완료
                          {order.voucher_fee_amount != null && (
                            <span className="ml-1 text-foreground font-medium">
                              ({order.voucher_fee_amount.toLocaleString()}원)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">미결제</span>
                      )}
                    </InfoRow>
                    {order.fee_paid && order.fee_pg_transaction_id && (
                      <InfoRow label="수수료 PG 거래번호">
                        <span className="font-mono text-[12px]">{order.fee_pg_transaction_id}</span>
                      </InfoRow>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* 6. 선물 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={Gift}
                title="선물 정보"
                iconClassName="bg-neutral-100 text-neutral-600"
              />
              {order.gift_chain && order.gift_chain.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-4 space-y-3">
                  {/* 체인 시각화: 보낸이 → 받는이 → 받는이 ... */}
                  <div className="flex flex-wrap items-center gap-1 text-[13px]">
                    <span className="font-medium text-foreground">
                      {order.gift_chain[0].sender_username}
                    </span>
                    {order.gift_chain.map((link, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <span className="text-muted-foreground mx-0.5">&rarr;</span>
                        <span className="font-medium text-foreground">
                          {link.receiver_username}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* 각 단계의 선물 일시 */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                    {order.gift_chain.map((link, idx) => (
                      <span key={idx}>
                        {formatDate(link.created_at)}
                      </span>
                    ))}
                  </div>

                  {/* 요약 */}
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground pt-1 border-t border-border/50">
                    <span>총 {order.gift_chain.length}회 선물</span>
                    {order.gift_chain.some((link) => link.auto_recycled) && (
                      <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                        업체 수신 계정 자동회수
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[13px] text-muted-foreground">
                  선물 없음
                </div>
              )}
            </section>

            {/* 7. SMS 발송 이력 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={MessageSquare}
                title="SMS 발송 이력"
                iconClassName="bg-brand-primary-soft text-primary"
              />
              {order.sms_logs.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">발송 유형</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">상태</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">발송 일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-muted/20">
                      {order.sms_logs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2.5 text-foreground">
                            {SMS_TYPE_MAP[log.message_type] ?? log.message_type}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "font-medium",
                                SMS_STATUS_MAP[log.send_status]?.className
                              )}
                            >
                              {SMS_STATUS_MAP[log.send_status]?.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {formatDate(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[13px] text-muted-foreground">
                  SMS 발송 이력 없음
                </div>
              )}
            </section>

            {/* 8. 취소/환불 정보 */}
            <section className="px-6 py-5">
              <SectionHeader
                icon={XCircle}
                title="취소/환불 정보"
                iconClassName="bg-error-bg text-error"
              />
              {order.cancellation ? (
                <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
                  <InfoRow label="취소 사유">
                    {CANCELLATION_REASON_MAP[order.cancellation.reason_type] ?? order.cancellation.reason_type}
                  </InfoRow>
                  <InfoRow label="취소 상태">
                    <span
                      className={cn(
                        "flex items-center gap-1 font-medium",
                        CANCEL_STATUS_MAP[order.cancellation.refund_status]?.className
                      )}
                    >
                      {CANCEL_STATUS_MAP[order.cancellation.refund_status]?.icon}
                      {CANCEL_STATUS_MAP[order.cancellation.refund_status]?.label}
                    </span>
                  </InfoRow>
                  <InfoRow label="취소 금액">
                    <span className="font-semibold">{order.cancellation.refund_amount.toLocaleString()}원</span>
                  </InfoRow>
                  <InfoRow label="취소 일시">{formatDate(order.cancellation.created_at)}</InfoRow>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[13px] text-muted-foreground">
                  취소 없음
                </div>
              )}
            </section>

            {/* 9. 관리자 액션 */}
            {hasAnyAction && (
              <section className="px-6 py-5">
                <SectionHeader
                  icon={Settings}
                  title="관리자 액션"
                  iconClassName="bg-brand-primary-soft text-primary"
                />
                <div className="flex flex-wrap gap-2">
                  {/* 관리자 취소 */}
                  {canAdminCancel && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={!!actionLoading}
                    >
                      <Ban size={14} />
                      주문 취소
                    </Button>
                  )}

                  {/* SMS 재발송 */}
                  {canResendSms && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleResendSms}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === "sms" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      SMS 재발송
                    </Button>
                  )}

                  {/* 사용자 비밀번호 초기화 */}
                  {canResetPassword && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-700"
                      onClick={handleResetPassword}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === "resetPw" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <KeyRound size={14} />
                      )}
                      비밀번호 초기화
                    </Button>
                  )}

                  {/* 관리자 임시 비밀번호 재발행 (5회 소진 시) */}
                  {canAdminReissue && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-primary/30 text-primary hover:border-primary/50 hover:bg-brand-primary-soft hover:text-primary"
                      onClick={handleAdminReissue}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === "reissue" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      임시 비밀번호 재발행
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 취소 사유 모달 */}
      <CancelReasonDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelOrder}
        loading={cancelLoading}
        orderNumber={order.order_number}
        isPasswordSet={order.is_password_set}
        voucherStatus={order.voucher_status}
        isGifted={!!order.gift_chain && order.gift_chain.length > 0}
      />
    </>
  );
}
