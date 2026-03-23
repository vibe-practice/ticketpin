"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MessageSquare, Home, User } from "lucide-react";
import { Suspense } from "react";

function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") ?? "";
  const totalAmount = Number(searchParams.get("totalAmount") ?? 0);
  const pinCount = Number(searchParams.get("pinCount") ?? 0);
  const productName = searchParams.get("productName") ?? "";

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* 체크 아이콘 */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 size={44} className="text-success" strokeWidth={1.5} />
        </div>

        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-foreground">주문이 완료되었습니다!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          주문 번호:{" "}
          <span className="font-semibold text-foreground">{orderNumber}</span>
        </p>

        {/* 주문 상세 정보 */}
        {productName && (
          <div className="mt-5 rounded-xl border border-border bg-card px-5 py-4 text-left">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <span className="text-sm text-muted-foreground">상품명</span>
              <span className="text-sm font-semibold text-foreground">{productName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <span className="text-sm text-muted-foreground">수량</span>
              <span className="text-sm font-semibold text-foreground">{pinCount}개</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">결제 금액</span>
              <span className="text-base font-bold text-primary">{totalAmount.toLocaleString()}원</span>
            </div>
          </div>
        )}

        {/* 문자 발송 안내 */}
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-brand-primary-muted border border-primary/20 px-5 py-4 text-left">
          <MessageSquare
            size={16}
            className="mt-0.5 shrink-0 text-primary"
            strokeWidth={1.75}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">문자 발송 안내</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              입력하신 수신 번호로 교환권 링크가 포함된 문자를 발송했습니다.
              잠시 후 문자를 확인해주세요.
            </p>
          </div>
        </div>

        {/* 이동 버튼 */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/my/vouchers"
            className="flex w-full sm:w-auto sm:flex-1 h-[52px] items-center justify-center gap-2 rounded-lg px-6 bg-primary text-[15px] font-semibold text-white transition-all duration-200 hover:bg-brand-primary-dark active:scale-[0.98]"
          >
            <User size={18} strokeWidth={1.75} />
            내 상품권 확인
          </Link>
          <Link
            href="/"
            className="flex w-full sm:w-auto sm:flex-1 h-[52px] items-center justify-center gap-2 rounded-lg px-6 border border-border bg-card text-[15px] font-semibold text-foreground transition-all duration-150 hover:bg-muted active:scale-[0.98]"
          >
            <Home size={18} strokeWidth={1.75} />
            메인으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <OrderCompleteContent />
    </Suspense>
  );
}
