"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, RefreshCw, AlertCircle, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOUCHER_MAX_REISSUE } from "@/lib/constants";
import ProductInfoCard from "@/components/voucher/ProductInfoCard";
import type { VoucherWithDetails } from "@/types";

interface VoucherExpiredClientProps {
  voucher: VoucherWithDetails;
}

export default function VoucherExpiredClient({ voucher }: VoucherExpiredClientProps) {
  const router = useRouter();
  const code = voucher.code;

  const initialReissueCount = voucher.reissue_count;
  const [reissueCount, setReissueCount] = useState(initialReissueCount);
  const reissueRemaining = VOUCHER_MAX_REISSUE - reissueCount;

  const [isReissuing, setIsReissuing] = useState(false);

  const handleReissue = async () => {
    if (reissueRemaining <= 0) return;
    setIsReissuing(true);

    try {
      const res = await fetch(`/api/vouchers/${code}/reissue`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setReissueCount((c) => c + 1);
        router.replace(`/v/${code}`);
      } else {
        // 에러 처리: 재발행 횟수 초과 등
        if (data.error?.code === "REISSUE_LIMIT_EXCEEDED") {
          setReissueCount(VOUCHER_MAX_REISSUE);
        }
        setIsReissuing(false);
      }
    } catch {
      setIsReissuing(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <ProductInfoCard voucher={voucher} />

      {/* 만료 안내 카드 */}
      <div className="mt-4 rounded-xl border border-warning/20 bg-warning-bg p-5 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <Clock size={22} className="text-warning" />
          </div>
        </div>
        <h3 className="mb-1.5 text-base font-bold text-warning">
          인증 시간이 만료되었어요
        </h3>
        <p className="text-sm text-foreground/70">
          새 임시 비밀번호를 발급받아 다시 시도해주세요.
        </p>
      </div>

      {/* 재발행 가능 */}
      {reissueRemaining > 0 ? (
        <div className="mt-4 space-y-2">
          <button
            onClick={handleReissue}
            disabled={isReissuing}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
              "bg-primary text-primary-foreground hover:bg-brand-primary-dark active:scale-[0.98]",
              isReissuing && "opacity-70 cursor-not-allowed"
            )}
          >
            {isReissuing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                발급 중...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                임시 비밀번호 재발행
              </>
            )}
          </button>
          <p className="text-center text-[13px] text-muted-foreground">
            재발행 가능 횟수:{" "}
            <span className="font-semibold text-foreground">
              {reissueRemaining}회
            </span>{" "}
            남음
          </p>
        </div>
      ) : (
        /* 재발행 횟수 초과 */
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
                <AlertCircle size={20} className="text-error" />
              </div>
            </div>
            <p className="text-sm font-semibold text-error">
              재발행 횟수({VOUCHER_MAX_REISSUE}회)를 모두 사용했습니다.
            </p>
            <p className="mt-1 text-[13px] text-foreground/70">
              고객센터에 문의해주세요.
            </p>
            <div className="mt-3 rounded-lg bg-error/5 px-4 py-2.5 text-left text-sm">
              <p className="text-muted-foreground">
                주문번호:{" "}
                <span className="font-semibold text-foreground">
                  {voucher.order.order_number}
                </span>
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Headset size={15} />
            고객센터 문의
          </Link>
        </div>
      )}
    </div>
  );
}
