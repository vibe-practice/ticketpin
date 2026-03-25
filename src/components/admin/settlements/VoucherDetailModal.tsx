"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  ArrowRight,
  CreditCard,
  ShieldCheck,
  KeyRound,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type {
  SettlementGiftItem,
  VerificationStatus,
  VoucherStatus,
  PinStatus,
} from "@/types";

// ─── 상태 맵 ──────────────────────────────────────────────────────────────────

const VERIFICATION_STATUS_STYLE: Record<VerificationStatus, string> = {
  verified: "bg-success-bg text-success",
  suspicious: "bg-neutral-100 text-neutral-600",
  rejected: "bg-error-bg text-error",
  pending: "bg-muted text-muted-foreground",
};

const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "정상",
  suspicious: "의심",
  rejected: "거부",
  pending: "대기",
};

const VOUCHER_STATUS_STYLE: Record<VoucherStatus, string> = {
  issued: "bg-info-bg text-info",
  temp_verified: "bg-neutral-100 text-neutral-600",
  password_set: "bg-brand-primary-soft text-primary",
  pin_revealed: "bg-success-bg text-success",
  gifted: "bg-neutral-100 text-neutral-600",
  cancelled: "bg-error-bg text-error",
};

const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  issued: "발급",
  temp_verified: "임시인증",
  password_set: "비번설정",
  pin_revealed: "핀확인",
  gifted: "선물",
  cancelled: "취소",
};

const PIN_STATUS_STYLE: Record<PinStatus, string> = {
  waiting: "bg-muted text-muted-foreground",
  assigned: "bg-info-bg text-info",
  consumed: "bg-success-bg text-success",
  returned: "bg-neutral-100 text-neutral-600",
};

const PIN_STATUS_LABEL: Record<PinStatus, string> = {
  waiting: "대기",
  assigned: "할당됨",
  consumed: "사용됨",
  returned: "반환",
};

// ─── 체인 노드 ──────────────────────────────────────────────────────────────

interface ChainNode {
  step: number;
  label: string;
  username: string;
  name: string;
  voucher_code: string;
  voucher_status: VoucherStatus;
}

function getChainNodeStyle(index: number, total: number): string {
  if (index === 0) return "border-border bg-muted/40";
  if (index === total - 1) return "border-primary/30 bg-brand-primary-soft";
  return "border-neutral-300 bg-neutral-100";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoucherDetailModalProps {
  open: boolean;
  onClose: () => void;
  giftItem: (SettlementGiftItem & { settlement_id?: string; item_id?: string; voucher_id?: string }) | null;
  commissionRate: number;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function VoucherDetailModal({
  open,
  onClose,
  giftItem,
  commissionRate,
}: VoucherDetailModalProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    giftItem?.verification_status ?? "verified"
  );
  const [verificationMemo, setVerificationMemo] = useState(giftItem?.verification_memo ?? "");
  const [pinRecycled, setPinRecycled] = useState(false);
  const [recycleLoading, setRecycleLoading] = useState(false);
  const [verificationSaving, setVerificationSaving] = useState(false);

  // 체인 데이터 상태
  const [chain, setChain] = useState<ChainNode[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  // giftItem 변경 시 state 동기화 + 체인 API 호출
  useEffect(() => {
    setVerificationStatus(giftItem?.verification_status ?? "verified");
    setVerificationMemo(giftItem?.verification_memo ?? "");
    setPinRecycled(false);
    setChain([]);

    const extGiftItem = giftItem as (SettlementGiftItem & { voucher_id?: string }) | null;
    if (!extGiftItem?.voucher_id || !open) return;

    const fetchChain = async () => {
      setChainLoading(true);
      try {
        const res = await fetch(`/api/admin/vouchers/${extGiftItem.voucher_id}/chain`);
        const json = await res.json();
        if (json.success && json.data?.chain) {
          setChain(json.data.chain as ChainNode[]);
        }
      } catch {
        // 체인 로드 실패 시 빈 배열 유지
      } finally {
        setChainLoading(false);
      }
    };
    fetchChain();
  }, [giftItem, open]);

  // 체인 드래그 스크롤
  const chainScrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = chainScrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const el = chainScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (chainScrollRef.current) chainScrollRef.current.style.cursor = "grab";
  }, []);

  if (!giftItem) return null;

  const extItem = giftItem as SettlementGiftItem & { settlement_id?: string; item_id?: string; voucher_id?: string };

  const handleVerificationSave = async () => {
    if (!extItem.settlement_id || !extItem.item_id) {
      toast({ type: "info", title: "검증 상태가 저장되었습니다 (로컬)" });
      return;
    }

    setVerificationSaving(true);
    try {
      const res = await fetch(
        `/api/admin/settlements/${extItem.settlement_id}/items/${extItem.item_id}/verify`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verification_status: verificationStatus, verification_memo: verificationMemo }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast({ type: "success", title: `검증 상태가 '${VERIFICATION_STATUS_LABEL[verificationStatus]}'(으)로 변경되었습니다` });
      } else {
        toast({ type: "error", title: json.error?.message ?? "검증 상태 변경 실패" });
      }
    } catch {
      toast({ type: "error", title: "검증 상태 변경 중 오류가 발생했습니다." });
    } finally {
      setVerificationSaving(false);
    }
  };

  const handlePinRecycle = async () => {
    if (!extItem.settlement_id || !extItem.item_id) {
      toast({ type: "info", title: "핀이 복원되었습니다 (로컬)" });
      setPinRecycled(true);
      return;
    }

    const ok = await confirm({
      title: "핀 재고로 복원",
      description: `이 교환권의 핀을 재고(waiting)로 복원하시겠습니까? 복원 후 해당 핀은 다시 상품 재고로 사용됩니다.`,
      confirmLabel: "복원",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setRecycleLoading(true);
    try {
      const res = await fetch(
        `/api/admin/settlements/${extItem.settlement_id}/items/${extItem.item_id}/recycle`,
        { method: "POST" }
      );
      const json = await res.json();
      if (json.success) {
        setPinRecycled(true);
        toast({ type: "success", title: `핀 ${json.data?.recycled_pin_count ?? 0}개가 재고로 복원되었습니다` });
      } else {
        toast({ type: "error", title: json.error?.message ?? "핀 복원 실패" });
      }
    } catch {
      toast({ type: "error", title: "핀 복원 중 오류가 발생했습니다." });
    } finally {
      setRecycleLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-[1100px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 size={18} className="text-primary" />
            교환권 상세
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* 1. 교환권 체인 */}
          <section>
            <SectionHeader icon={Link2} title={`교환권 체인 (${chain.length}단계)`} />
            {chainLoading ? (
              <div className="mt-2 flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-[14px] text-muted-foreground">체인 추적 중...</span>
              </div>
            ) : chain.length === 0 ? (
              <div className="mt-2 rounded-md border border-border bg-muted/20 py-6 text-center">
                <p className="text-[14px] text-muted-foreground">체인 정보를 불러올 수 없습니다.</p>
              </div>
            ) : (
              <div
                ref={chainScrollRef}
                className="mt-2 overflow-x-auto pb-2 cursor-grab select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="flex items-center gap-2 min-w-max">
                  {chain.map((node, idx) => (
                    <div key={node.step} className="flex items-center gap-2">
                      {idx > 0 && <ArrowRight size={14} className="shrink-0 text-muted-foreground" />}
                      <div className={cn("rounded-md border px-3 py-2 min-w-[140px]", getChainNodeStyle(idx, chain.length))}>
                        <p className="text-[10px] font-medium text-muted-foreground">{node.label}</p>
                        <p className="text-[14px] font-medium text-foreground">
                          {node.name}
                          <span className="ml-1 text-[11px] text-muted-foreground">({node.username})</span>
                        </p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground" title={node.voucher_code}>
                          {node.voucher_code.slice(0, 16)}...
                        </p>
                        <span className={cn("mt-1 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold", VOUCHER_STATUS_STYLE[node.voucher_status])}>
                          {VOUCHER_STATUS_LABEL[node.voucher_status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 2. 결제 정보 */}
          <section>
            <SectionHeader icon={CreditCard} title="결제 정보 (최초 주문)" />
            <div className="mt-2 rounded-md border border-border bg-card p-3 grid grid-cols-3 gap-3 text-[14px]">
              <div>
                <span className="text-[11px] text-muted-foreground">주문번호</span>
                <p className="font-medium text-foreground">{giftItem.original_order_number || "-"}</p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">구매자</span>
                <p className="font-medium text-foreground">
                  {giftItem.original_buyer_name || "-"} {giftItem.original_buyer_username ? `(${giftItem.original_buyer_username})` : ""}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">상품</span>
                <p className="font-medium text-foreground">{giftItem.product_name}</p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">금액</span>
                <p className="font-medium text-foreground">
                  {giftItem.product_price.toLocaleString()}원 x {giftItem.quantity}개 = {giftItem.total_amount.toLocaleString()}원
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">정산금액</span>
                <p className="font-bold text-primary">
                  {giftItem.settlement_per_item.toLocaleString()}원
                  <span className="ml-1 font-normal text-[11px] text-muted-foreground">({commissionRate}% 적용)</span>
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">결제수단</span>
                <p className="font-medium text-foreground">{giftItem.payment_method || "-"}</p>
              </div>
            </div>
          </section>

          {/* 3. 교환권 검증 */}
          <section>
            <SectionHeader icon={ShieldCheck} title="교환권 검증" />
            <div className="mt-2 rounded-md border border-border bg-card p-3 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-muted-foreground w-20">현재 상태</span>
                <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-semibold", VERIFICATION_STATUS_STYLE[giftItem.verification_status])}>
                  {VERIFICATION_STATUS_LABEL[giftItem.verification_status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[14px]">검증 상태 변경</Label>
                  <Select value={verificationStatus} onValueChange={(v) => setVerificationStatus(v as VerificationStatus)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="verified">정상</SelectItem>
                      <SelectItem value="suspicious">의심</SelectItem>
                      <SelectItem value="rejected">거부 (정산 제외)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[14px]">검증 메모</Label>
                  <Textarea value={verificationMemo} onChange={(e) => setVerificationMemo(e.target.value)} placeholder="검증 메모 입력" rows={1} className="text-sm" />
                </div>
              </div>

              <Button size="sm" onClick={handleVerificationSave} disabled={verificationSaving}>
                {verificationSaving && <Loader2 size={14} className="animate-spin mr-1" />}
                검증 저장
              </Button>
            </div>
          </section>

          {/* 4. 핀 정보 + 재활용 */}
          <section>
            <SectionHeader icon={KeyRound} title="핀 정보" />
            <div className="mt-2 rounded-md border border-border bg-card p-3 space-y-3">
              {giftItem.pin_ids.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-[40px]">#</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">핀 ID</th>
                        <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {giftItem.pin_ids.map((pinId, idx) => (
                        <tr key={pinId} className="border-b border-border last:border-b-0">
                          <td className="px-2 py-1.5 text-center text-[14px] text-muted-foreground">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-[14px] text-foreground">
                            {pinRecycled ? "—" : pinId.slice(0, 8) + "..."}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", pinRecycled ? PIN_STATUS_STYLE.waiting : PIN_STATUS_STYLE[giftItem.pin_statuses[idx]])}>
                              {pinRecycled ? PIN_STATUS_LABEL.waiting : PIN_STATUS_LABEL[giftItem.pin_statuses[idx]]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[14px] text-muted-foreground py-2">핀 정보가 없습니다 (자동 복원된 선물일 수 있습니다).</p>
              )}

              {/* 핀 재활용 */}
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <RefreshCcw size={14} className="text-primary shrink-0" />
                <span className="text-[14px] text-muted-foreground">
                  핀을 재고(waiting)로 복원하면 해당 상품의 판매 가능 재고로 다시 사용됩니다.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePinRecycle}
                  disabled={pinRecycled || recycleLoading || giftItem.pin_ids.length === 0}
                  className="ml-auto shrink-0"
                >
                  {recycleLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCcw size={14} className="mr-1" />}
                  {pinRecycled ? "복원 완료" : "핀 재고로 복원"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 유틸 컴포넌트 ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-primary" />
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
    </div>
  );
}
