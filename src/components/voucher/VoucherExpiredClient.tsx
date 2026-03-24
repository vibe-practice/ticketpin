"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle, Headset } from "lucide-react";
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
    <div className="w-full">
      {/* 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        임시 비밀번호가{"\n"}만료되었어요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        새 임시 비밀번호를 발급받아 다시 시도해주세요.
      </p>

      <ProductInfoCard voucher={voucher} />

      {/* 재발행 가능 */}
      {reissueRemaining > 0 ? (
        <div className="mt-5 space-y-2">
          <button
            onClick={handleReissue}
            disabled={isReissuing}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition-all",
              "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]",
              isReissuing && "opacity-70 cursor-not-allowed"
            )}
          >
            {isReissuing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                발급 중...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                임시 비밀번호 재발행
              </>
            )}
          </button>
          <p className="text-center text-[14px] text-muted-foreground">
            재발행 가능 횟수:{" "}
            <span className="font-semibold text-foreground">
              {reissueRemaining}회
            </span>{" "}
            남음
          </p>
        </div>
      ) : (
        /* 재발행 횟수 초과 */
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
                <AlertCircle size={20} className="text-error" />
              </div>
            </div>
            <p className="text-[15px] font-semibold text-error">
              재발행 횟수({VOUCHER_MAX_REISSUE}회)를 모두 사용했습니다.
            </p>
            <p className="mt-1 text-[14px] text-foreground/70">
              고객센터에 문의해주세요.
            </p>
            <div className="mt-3 rounded-lg bg-error/5 px-4 py-2.5 text-left text-[15px]">
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
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Headset size={15} />
            고객센터 문의
          </Link>
        </div>
      )}
    </div>
  );
}
