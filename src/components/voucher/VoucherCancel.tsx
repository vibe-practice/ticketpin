"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  CreditCard,
  Clock,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ProductInfoCard from "./ProductInfoCard";
import type { VoucherWithDetails, CancellationReasonType } from "@/types";

interface VoucherCancelProps {
  voucher: VoucherWithDetails;
}

type CancelStep = "form" | "complete";

const REASON_OPTIONS: { value: CancellationReasonType; label: string }[] = [
  { value: "simple_change", label: "단순 변심" },
  { value: "wrong_purchase", label: "잘못 구매" },
  { value: "other", label: "기타" },
];

export default function VoucherCancel({ voucher }: VoucherCancelProps) {
  const router = useRouter();
  const [step, setStep] = useState<CancelStep>("form");
  const [reason, setReason] = useState<CancellationReasonType | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 환불 금액 계산 (수수료 포함: 전액, 수수료 별도: 상품 금액만)
  const refundAmount =
    voucher.order.fee_type === "included"
      ? voucher.order.total_amount
      : voucher.order.product_price;

  const canSubmit = reason !== "" && (reason !== "other" || reasonDetail.trim().length > 0);

  const handleCancelRequest = () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    setShowConfirmDialog(true);
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${voucher.order_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason_type: reason,
          reason_detail: reason === "other" ? reasonDetail.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setShowConfirmDialog(false);
        setStep("complete");
      } else {
        setShowConfirmDialog(false);
        setErrorMessage(data.error?.message ?? "취소 처리에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setShowConfirmDialog(false);
      setErrorMessage("취소 처리에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsCancelling(false);
    }
  };

  // ── 취소 완료 화면 ──────────────────────────────
  if (step === "complete") {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg">
              <CheckCircle2 size={28} className="text-success" />
            </div>
          </div>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            결제가 취소되었습니다
          </h2>
          <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
            환불은 결제 수단에 따라 즉시 또는
            <br />
            영업일 기준 <strong className="text-foreground">3~5일 이내</strong>에
            처리됩니다.
          </p>

          {/* 취소 요약 */}
          <div className="mb-5 rounded-lg bg-muted/50 px-4 py-3 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">주문번호</span>
              <span className="font-semibold text-foreground">
                {voucher.order.order_number}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">상품명</span>
              <span className="font-medium text-foreground">
                {voucher.product?.name ?? "(삭제된 상품)"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">환불 금액</span>
              <span className="font-bold text-primary">
                {formatPrice(refundAmount)}
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="flex h-14 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-brand-primary-dark active:scale-[0.98]"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  // ── 취소 폼 화면 ──────────────────────────────
  return (
    <div className="w-full max-w-sm">
      {/* 뒤로가기 */}
      <button
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push(`/v/${voucher.code}`);
          }
        }}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        돌아가기
      </button>

      {/* 취소 안내 Alert */}
      <div className="rounded-xl border border-error/30 bg-error-bg p-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error/10">
            <AlertTriangle size={14} className="text-error" />
          </div>
          <div>
            <p className="text-sm font-semibold text-error">결제 취소 안내</p>
            <p className="mt-1 text-[13px] text-foreground/70 leading-relaxed">
              결제를 취소하면 상품권이 회수되며 환불 처리됩니다.
              <br />
              취소 후에는 <strong className="text-error">복구할 수 없습니다.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 취소 대상 정보 Card */}
      <div className="mt-4">
        <ProductInfoCard voucher={voucher} />
      </div>

      {/* 취소 사유 선택 */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">
          취소 사유를 선택해주세요
        </p>
        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as CancellationReasonType)}
        >
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all",
                reason === opt.value
                  ? "border-primary/40 bg-brand-primary-muted"
                  : "border-border bg-card hover:border-primary/20"
              )}
            >
              <RadioGroupItem value={opt.value} />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>

        {/* 기타 사유 입력 */}
        {reason === "other" && (
          <div className="mt-3">
            <Textarea
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="취소 사유를 입력해주세요"
              className="min-h-[80px] resize-none text-sm"
              maxLength={200}
            />
            <p className="mt-1 text-right text-[13px] text-muted-foreground">
              {reasonDetail.length}/200
            </p>
          </div>
        )}
      </div>

      {/* 환불 안내 */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">환불 안내</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <CreditCard size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-[13px] text-muted-foreground leading-relaxed">
              <p>
                환불 금액:{" "}
                <strong className="text-foreground">
                  {formatPrice(refundAmount)}
                </strong>
              </p>
              {voucher.order.fee_type === "included" ? (
                <p className="mt-0.5">
                  (상품 {formatPrice(voucher.order.product_price)} + 수수료{" "}
                  {formatPrice(voucher.order.fee_amount)} 전액 환불)
                </p>
              ) : (
                <p className="mt-0.5">
                  (상품 금액만 환불, 수수료는 미결제 상태)
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              결제 수단에 따라 즉시 또는 영업일 기준{" "}
              <strong className="text-foreground">3~5일 이내</strong> 환불
            </p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
          <p className="text-sm leading-snug text-error">{errorMessage}</p>
        </div>
      )}

      {/* 결제취소 버튼 */}
      <div className="mt-4">
        <button
          onClick={handleCancelRequest}
          disabled={!canSubmit}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
            canSubmit
              ? "bg-error text-white hover:bg-error/90 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          <XCircle size={16} />
          결제 취소
        </button>
      </div>

      {/* 확인 모달 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-xs rounded-xl" showCloseButton={false}>
          <DialogHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-bg">
                <AlertTriangle size={22} className="text-error" />
              </div>
            </div>
            <DialogTitle className="text-center text-base">
              정말 결제를 취소하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-center text-[13px] leading-relaxed">
              취소 후에는 복구할 수 없으며,
              <br />
              상품권이 회수됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className={cn(
                "flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold transition-all",
                isCancelling
                  ? "cursor-not-allowed bg-error/70 text-white"
                  : "bg-error text-white hover:bg-error/90 active:scale-[0.98]"
              )}
            >
              {isCancelling ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  취소 처리 중...
                </>
              ) : (
                "결제 취소하기"
              )}
            </button>
            <button
              onClick={() => setShowConfirmDialog(false)}
              disabled={isCancelling}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              돌아가기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
