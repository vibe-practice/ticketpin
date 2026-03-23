"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";

export default function PaymentClosePage() {
  const router = useRouter();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // 부모 창에 결제창 닫힘 전달 (PC 팝업 모드)
    if (window.opener) {
      window.opener.postMessage(
        { type: "MAINPAY_CLOSE" },
        window.location.origin
      );

      // 팝업 닫기 시도
      window.close();
    }

    // 모바일 리다이렉트 모드: sessionStorage 확인 후 적절한 페이지로 복귀
    if (!window.opener) {
      const feePendingRaw = sessionStorage.getItem("mainpay_fee_pending");
      const feeVoucherCode = sessionStorage.getItem("mainpay_fee_voucher_code");
      const pendingRaw = sessionStorage.getItem("mainpay_pending");

      if (feePendingRaw && feeVoucherCode) {
        // 수수료 결제 취소 → 바우처 핀 페이지로 복귀
        sessionStorage.removeItem("mainpay_fee_pending");
        sessionStorage.removeItem("mainpay_fee_voucher_code");
        router.replace(`/v/${feeVoucherCode}/pin`);
        return;
      }

      if (pendingRaw) {
        // 일반 결제 취소 → 홈으로 복귀
        sessionStorage.removeItem("mainpay_pending");
        router.replace("/");
        return;
      }
    }

    // window.close() 실패 또는 sessionStorage에도 정보 없는 경우 fallback 표시
    const timer = setTimeout(() => setShowFallback(true), 1000);
    return () => clearTimeout(timer);
  }, [router]);

  if (showFallback) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <XCircle size={40} className="text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">결제가 취소되었습니다</p>
        <p className="text-sm text-muted-foreground">
          이 창을 닫고 원래 페이지로 돌아가주세요.
        </p>
        <Link
          href="/"
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 size={32} className="animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">처리 중...</p>
    </div>
  );
}
