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
    <div className="w-full max-w-sm">
      <ProductInfoCard voucher={voucher} />

      {/* 잠금 안내 카드 */}
      <div className="mt-4 rounded-xl border border-error/20 bg-error-bg p-5 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
            <Lock size={22} className="text-error" />
          </div>
        </div>
        <h3 className="mb-1.5 text-base font-bold text-error">
          입력이 잠겼습니다
        </h3>
        <p className="text-sm text-foreground/70">
          고객센터에 문의해주세요.
        </p>
        <a
          href="tel:1811-0689"
          className="mt-2 inline-block text-lg font-bold text-primary"
        >
          1811-0689
        </a>
        <div className="mt-3 rounded-lg bg-error/5 px-4 py-2.5 text-left text-sm space-y-1.5">
          <p className="text-muted-foreground">
            주문번호:{" "}
            <span className="font-semibold text-foreground">
              {voucher.order.order_number}
            </span>
          </p>
          <p className="text-muted-foreground">
            주문번호와 함께 고객센터에 문의해주세요.
          </p>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="mt-4 space-y-2">
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Home size={15} />
          홈으로 이동
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
