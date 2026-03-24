import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, Home, Headset } from "lucide-react";
import { getVoucherByCode } from "@/lib/supabase/queries";
import ProductInfoCard from "@/components/voucher/ProductInfoCard";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function VoucherLockedPage({ params }: PageProps) {
  const { code } = await params;
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: is_password_locked 상태만 허용
  if (!voucher.is_password_locked) {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      temp_verified: `/v/${code}/set-pw`,
      password_set: `/v/${code}/actions`,
      pin_revealed: `/v/${code}/actions`,
      cancelled: `/v/${code}/cancelled`,
      gifted: `/v/${code}/gifted`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  return (
    <div className="w-full">
      {/* 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        입력이 잠겼어요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        고객센터에 문의해주세요.
      </p>

      <ProductInfoCard voucher={voucher} />

      {/* 잠금 안내 카드 */}
      <div className="mt-5 rounded-xl border border-error/20 bg-error-bg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={18} className="text-error" />
          <span className="text-[16px] font-bold text-error">잠금 안내</span>
        </div>
        <div className="space-y-1.5 text-[15px]">
          <p className="text-muted-foreground">
            주문번호:{" "}
            <strong className="text-foreground">
              {voucher.order.order_number}
            </strong>
          </p>
          <p className="text-muted-foreground">
            주문번호와 함께 고객센터에 문의해주세요.
          </p>
        </div>
        <a
          href="tel:1811-0689"
          className="mt-3 inline-block text-[18px] font-bold text-foreground hover:underline"
        >
          1811-0689
        </a>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="mt-5 space-y-2">
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Home size={15} />
          홈으로 이동
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
