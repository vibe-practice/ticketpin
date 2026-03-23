import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderPageClient } from "./OrderPageClient";

export const metadata: Metadata = {
  title: "주문/결제 | 티켓핀",
  description: "상품권 구매 주문 및 결제 페이지",
};

function OrderPageFallback() {
  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<OrderPageFallback />}>
      <OrderPageClient />
    </Suspense>
  );
}
