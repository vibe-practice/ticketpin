"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  Gift,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import ProductInfoCard from "./ProductInfoCard";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import type { VoucherWithDetails } from "@/types";

interface VoucherActionsProps {
  voucher: VoucherWithDetails;
  senderUsername?: string;
}

export default function VoucherActions({
  voucher,
  senderUsername,
}: VoucherActionsProps) {
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<"pin" | "gift" | null>(null);

  useBfcacheReload();

  const isPinRevealed = voucher.status === "pin_revealed";
  const isPasswordSet = voucher.status === "password_set";

  const handlePinAction = () => {
    setNavigatingTo("pin");
    router.replace(`/v/${voucher.code}/pin`);
  };

  const handleGiftAction = () => {
    setNavigatingTo("gift");
    router.replace(`/v/${voucher.code}/gift`);
  };

  return (
    <div className="w-full max-w-sm">
      {/* 상품 정보 카드 */}
      <ProductInfoCard voucher={voucher} senderUsername={senderUsername} />

      {/* 상태 Badge */}
      <div className="mt-4 flex items-center justify-center">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2",
            isPinRevealed
              ? "bg-success-bg text-success"
              : "bg-brand-primary-muted text-primary"
          )}
        >
          {isPinRevealed ? (
            <>
              <CheckCircle2 size={15} />
              <span className="text-sm font-semibold">핀 번호 확인 완료</span>
            </>
          ) : (
            <>
              <ShieldCheck size={15} />
              <span className="text-sm font-semibold">비밀번호 설정 완료</span>
            </>
          )}
        </div>
      </div>

      {/* 액션 버튼 영역 */}
      <div className="mt-4 space-y-3">
        {/* 핀 번호 확인/다시 보기 */}
        <button
          onClick={handlePinAction}
          disabled={navigatingTo !== null}
          aria-busy={navigatingTo === "pin"}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
            "bg-primary text-primary-foreground hover:bg-brand-primary-dark active:scale-[0.98]",
            navigatingTo !== null && "opacity-70 cursor-not-allowed"
          )}
        >
          {navigatingTo === "pin" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : isPinRevealed ? (
            <>
              <Eye size={18} />
              핀 번호 다시 보기
            </>
          ) : (
            <>
              <KeyRound size={18} />
              핀 번호 확인하기
            </>
          )}
        </button>

        {/* 선물하기 */}
        {!isPinRevealed && (
          <button
            onClick={handleGiftAction}
            disabled={navigatingTo !== null}
            aria-busy={navigatingTo === "gift"}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-all",
              "hover:border-primary/40 hover:bg-brand-primary-muted",
              navigatingTo !== null && "opacity-70 cursor-not-allowed"
            )}
          >
            <Gift size={16} className="text-primary" />
            선물하기
          </button>
        )}
      </div>

      {/* 수수료 별도 안내 (password_set + 수수료 별도인 경우) */}
      {isPasswordSet && voucher.order.fee_type === "separate" && !voucher.fee_paid && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <p className="text-[13px] leading-relaxed text-info">
            핀 번호 확인 시 수수료{" "}
            <strong>{formatPrice(voucher.order.fee_amount)}</strong>
            이 별도 결제됩니다.
          </p>
        </div>
      )}

      {/* 취소 불가 안내 */}
      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2.5">
        <ShieldOff size={14} className="mt-0.5 shrink-0 text-error" />
        <p className="text-[13px] leading-relaxed text-error">
          비밀번호가 설정된 상품권은 <strong>결제 취소가 불가</strong>합니다.
          {!isPinRevealed && " 핀 번호 확인 후에는 선물하기도 불가합니다."}
        </p>
      </div>

      {/* 핀 확인 이력 (pin_revealed인 경우) */}
      {isPinRevealed && voucher.pin_revealed_at && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">핀 확인 일시</span>
            <span className="font-medium text-foreground">
              {new Date(voucher.pin_revealed_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}

      {/* 플로우 탈출 링크 */}
      <div className="mt-4 space-y-2">
        <Link
          href="/my"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          마이페이지로 이동
        </Link>
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
