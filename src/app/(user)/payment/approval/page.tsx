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
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-neutral-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-red-50 border border-red-100">
            <XCircle size={32} className="text-red-500" strokeWidth={1.5} />
          </div>
          <p className="text-[18px] font-bold text-foreground">결제 처리 실패</p>
          <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">{mobileError}</p>
          <button
            onClick={() => router.back()}
            className="mt-6 w-full h-[50px] rounded-xl bg-neutral-950 text-[15px] font-semibold text-white hover:bg-neutral-800 active:scale-[0.98] transition-all duration-150"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-neutral-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-neutral-950">
            <CheckCircle2 size={32} className="text-white" strokeWidth={2} />
          </div>
          <p className="text-[18px] font-bold text-foreground">결제가 완료되었습니다</p>
          <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
            이 창을 닫고 원래 페이지로 돌아가주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
        <p className="text-[15px] font-medium text-muted-foreground">결제 처리 중...</p>
        <p className="text-[13px] text-muted-foreground">잠시만 기다려주세요.</p>
      </div>
    </div>
  );
}

export default function PaymentApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ApprovalContent />
    </Suspense>
  );
}
