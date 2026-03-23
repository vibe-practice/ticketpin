"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

function ApprovalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showFallback, setShowFallback] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);

  useEffect(() => {
    const aid = searchParams.get("aid") ?? "";
    const authToken = searchParams.get("authToken") ?? "";
    const payType = searchParams.get("payType") ?? "";
    const merchantData = searchParams.get("merchantData") ?? "";

    // PC 팝업 모드: 부모 창에 결과 전달
    if (window.opener) {
      window.opener.postMessage(
        {
          type: "MAINPAY_APPROVAL",
          aid,
          authToken,
          payType,
          merchantData,
        },
        window.location.origin
      );

      window.close();

      // window.close() 실패 시 fallback 표시
      const timer = setTimeout(() => setShowFallback(true), 1000);
      return () => clearTimeout(timer);
    }

    // 모바일 리다이렉트 모드: 직접 결제 승인 처리
    const handleMobileApproval = async () => {
      // sessionStorage에서 결제 정보 복원 (주문 결제)
      const pendingRaw = sessionStorage.getItem("mainpay_pending");
      // sessionStorage에서 결제 정보 복원 (수수료 결제)
      const feePendingRaw = sessionStorage.getItem("mainpay_fee_pending");

      if (pendingRaw) {
        // ── 주문 결제 승인 ──
        sessionStorage.removeItem("mainpay_pending");
        try {
          const pending = JSON.parse(pendingRaw);
          const userRes = await fetch("/api/auth/me");
          const userData = await userRes.json();
          const receiverPhone = userData?.data?.phone?.replace(/-/g, "") ?? "";

          if (!receiverPhone) {
            setMobileError("전화번호 정보가 없습니다. 마이페이지에서 등록해 주세요.");
            return;
          }

          const payRes = await fetch("/api/payment/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aid: pending.aid,
              authToken,
              mbrRefNo: pending.mbrRefNo,
              amount: pending.amount,
              receiverPhone,
            }),
          });

          const payData = await payRes.json();

          if (!payData.success) {
            setMobileError(payData.error?.message ?? "결제 처리에 실패했습니다.");
            return;
          }

          const completeParams = new URLSearchParams({
            orderNumber: payData.data.order_number ?? "",
            totalAmount: String(payData.data.total_amount ?? 0),
            pinCount: String(pending.pinCount ?? payData.data.pin_count ?? 0),
            productName: pending.productName ?? "",
          });
          router.replace(`/order/complete?${completeParams.toString()}`);
        } catch (err) {
          console.error("[PaymentApproval] 모바일 주문 결제 승인 오류:", err);
          setMobileError("결제 처리 중 오류가 발생했습니다.");
        }
      } else if (feePendingRaw) {
        // ── 수수료 결제 승인 ──
        const voucherCode = sessionStorage.getItem("mainpay_fee_voucher_code");

        // 처리 시작 시점에서 즉시 sessionStorage 정리 (모든 에러 경로에서 누락 방지)
        sessionStorage.removeItem("mainpay_fee_pending");
        sessionStorage.removeItem("mainpay_fee_voucher_code");

        try {
          const pending = JSON.parse(feePendingRaw);

          if (!voucherCode) {
            setMobileError("바우처 정보를 찾을 수 없습니다. 바우처 페이지에서 다시 시도해 주세요.");
            return;
          }

          const confirmRes = await fetch(`/api/vouchers/${voucherCode}/fee-payment/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_key: pending.paymentKey,
              amount: pending.amount,
              auth_token: authToken,
              mbr_ref_no: pending.mbrRefNo,
              password: pending.password,
            }),
          });

          const confirmData = await confirmRes.json();

          if (!confirmData.success) {
            setMobileError(confirmData.error?.message ?? "수수료 결제 처리에 실패했습니다.");
            return;
          }

          // 결제 성공 시 핀 번호를 sessionStorage에 저장하여 pin 페이지에서 바로 표시
          if (confirmData.data?.pins) {
            sessionStorage.setItem("fee_revealed_pins", JSON.stringify(confirmData.data.pins));
          }

          router.replace(`/v/${voucherCode}/pin`);
        } catch (err) {
          console.error("[PaymentApproval] 모바일 수수료 결제 승인 오류:", err);
          setMobileError("수수료 결제 처리 중 오류가 발생했습니다.");
        }
      } else {
        // sessionStorage에 결제 정보 없음
        setShowFallback(true);
      }
    };

    handleMobileApproval();
  }, [searchParams, router]);

  if (mobileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <XCircle size={40} className="text-destructive" />
        <p className="text-base font-semibold text-foreground">결제 처리 실패</p>
        <p className="text-sm text-muted-foreground">{mobileError}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <CheckCircle2 size={40} className="text-success" />
        <p className="text-base font-semibold text-foreground">결제가 완료되었습니다</p>
        <p className="text-sm text-muted-foreground">
          이 창을 닫고 원래 페이지로 돌아가주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 size={32} className="animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">결제 처리 중...</p>
    </div>
  );
}

export default function PaymentApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <ApprovalContent />
    </Suspense>
  );
}
