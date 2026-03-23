import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Gift, Home, User } from "lucide-react";
import { getVoucherByCode } from "@/lib/supabase/queries";
import ProductInfoCard from "@/components/voucher/ProductInfoCard";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function VoucherGiftedPage({ params }: PageProps) {
  const { code } = await params;
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: gifted 상태만 허용
  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }
  if (voucher.status !== "gifted") {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      temp_verified: `/v/${code}/set-pw`,
      password_set: `/v/${code}/actions`,
      pin_revealed: `/v/${code}/actions`,
      cancelled: `/v/${code}/cancelled`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  const senderName = voucher.sender?.username ?? "알 수 없음";
  // receiver가 있으면 사용 (원본 바우처), 없으면 owner 사용 (새 바우처)
  const receiverName = voucher.receiver?.username ?? voucher.owner.username ?? "알 수 없음";

  return (
    <div className="w-full max-w-sm">
      <ProductInfoCard voucher={voucher} />

      {/* 선물완료 안내 카드 */}
      <div className="mt-4 rounded-xl border border-success/20 bg-success-bg p-5 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Gift size={22} className="text-success" />
          </div>
        </div>
        <h3 className="text-base font-bold text-success">
          선물이 완료된 상품권입니다
        </h3>

        {/* 보낸 사람 / 받은 사람 정보 */}
        <div className="mt-3 rounded-lg bg-success/5 px-4 py-3 text-left text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User size={13} />
              보낸 사람
            </span>
            <span className="font-medium text-foreground">{senderName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User size={13} />
              받은 사람
            </span>
            <span className="font-medium text-foreground">{receiverName}</span>
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="mt-4 space-y-2.5">
        <Link
          href="/my"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-brand-primary-dark transition-colors active:scale-[0.98]"
        >
          마이페이지로 이동
        </Link>
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Home size={15} />
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
