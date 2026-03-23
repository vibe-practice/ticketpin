"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MessageSquare, Home, Package, ArrowRight } from "lucide-react";
import { Suspense } from "react";

function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") ?? "";
  const totalAmount = Number(searchParams.get("totalAmount") ?? 0);
  const pinCount = Number(searchParams.get("pinCount") ?? 0);
  const productName = searchParams.get("productName") ?? "";

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-neutral-50 px-6 py-16">
      <div className="w-full max-w-[520px]">

        {/* 완료 카드 */}
        <div className="rounded-2xl border border-neutral-300 bg-white overflow-hidden shadow-sm">

          {/* 상단: 성공 아이콘 + 타이틀 */}
          <div className="flex flex-col items-center py-10 px-8 border-b border-neutral-300">
            <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-neutral-950">
              <CheckCircle2 size={36} className="text-white" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-bold text-foreground tracking-tight">결제가 완료되었습니다</h1>
            {orderNumber && (
              <p className="mt-2 text-[14px] text-muted-foreground">
                주문번호:{" "}
                <span className="font-semibold text-secondary-foreground font-mono">{orderNumber}</span>
              </p>
            )}
          </div>

          {/* 주문 상세 */}
          {productName && (
            <div className="px-6 py-5 border-b border-neutral-300">
              <div className="flex items-center gap-2.5 mb-4">
                <Package size={15} className="text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[14px] font-semibold text-secondary-foreground">주문 내역</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[14px] text-muted-foreground shrink-0">상품명</span>
                  <span className="text-[14px] font-semibold text-foreground text-right">{productName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                  <span className="text-[14px] text-muted-foreground">수량</span>
                  <span className="text-[14px] font-semibold text-foreground">{pinCount}개</span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                  <span className="text-[14px] text-muted-foreground">결제 금액</span>
                  <span className="text-[22px] font-bold text-foreground">{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            </div>
          )}

          {/* 문자 발송 안내 */}
          <div className="px-6 py-5 border-b border-neutral-300">
            <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 shrink-0 mt-0.5">
                <MessageSquare size={14} className="text-secondary-foreground" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">문자 발송 안내</p>
                <p className="mt-1 text-[14px] text-muted-foreground leading-relaxed">
                  입력하신 수신 번호로 교환권 링크가 포함된 문자를 발송했습니다. 잠시 후 문자를 확인해주세요.
                </p>
              </div>
            </div>
          </div>

          {/* 이동 버튼 */}
          <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/my/vouchers"
              className="flex w-full h-[52px] items-center justify-center gap-2 rounded-xl bg-neutral-950 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-neutral-800 active:scale-[0.98]"
            >
              내 상품권 확인
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
            <Link
              href="/"
              className="flex w-full h-[52px] items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-[15px] font-semibold text-secondary-foreground transition-all duration-150 hover:bg-neutral-50 active:scale-[0.98]"
            >
              <Home size={16} strokeWidth={1.75} />
              메인으로
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
      </div>
    }>
      <OrderCompleteContent />
    </Suspense>
  );
}
