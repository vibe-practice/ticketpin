import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { XCircle, Home, Headset } from "lucide-react";
import { getVoucherByCode } from "@/lib/supabase/queries";
import ProductInfoCard from "@/components/voucher/ProductInfoCard";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function VoucherCancelledPage({ params }: PageProps) {
  const { code } = await params;
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: cancelled 상태만 허용
  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }
  if (voucher.status !== "cancelled") {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      temp_verified: `/v/${code}/set-pw`,
      password_set: `/v/${code}/actions`,
      pin_revealed: `/v/${code}/actions`,
      gifted: `/v/${code}/gifted`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  return (
    <div className="w-full max-w-sm">
      <ProductInfoCard voucher={voucher} />

      {/* 취소 안내 카드 */}
      <div className="mt-4 rounded-xl border border-error/20 bg-error-bg p-5 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
            <XCircle size={22} className="text-error" />
          </div>
        </div>
        <h3 className="text-base font-bold text-error">
          취소된 상품권이에요
        </h3>
        <div className="mt-3 rounded-lg bg-error/5 px-4 py-2.5 text-left text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">주문번호</span>
            <span className="font-semibold text-foreground">
              {voucher.order.order_number}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">환불 상태</span>
            <span className="font-semibold text-foreground">환불 완료</span>
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="mt-4 space-y-2">
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-brand-primary-dark transition-colors"
        >
          <Home size={15} />
          동일 상품 다시 구매하기
        </Link>
        <a
          href="tel:1811-0689"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Headset size={15} />
          고객센터 전화 (1811-0689)
        </a>
      </div>
    </div>
  );
}
