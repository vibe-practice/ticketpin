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
    <div className="w-full">
      {/* 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        취소된 상품권이에요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        결제가 취소되어 환불 처리되었습니다.
      </p>

      <ProductInfoCard voucher={voucher} />

      {/* 취소 정보 카드 */}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <XCircle size={16} className="text-error" />
          <span className="text-[15px] font-semibold text-foreground">취소 정보</span>
        </div>
        <div className="space-y-2 text-[15px]">
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
      <div className="mt-5 space-y-2">
        <Link
          href="/"
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-[16px] font-bold text-background hover:bg-foreground/80 transition-colors active:scale-[0.98]"
        >
          <Home size={15} />
          동일 상품 다시 구매하기
        </Link>
        <a
          href="tel:1811-0689"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Headset size={15} />
          고객센터 전화 (1811-0689)
        </a>
      </div>
    </div>
  );
}
