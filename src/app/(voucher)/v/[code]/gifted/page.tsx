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
    <div className="w-full">
      {/* 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        선물이 완료된{"\n"}상품권이에요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        수신자에게 새로운 URL이 발급되었습니다.
      </p>

      <ProductInfoCard voucher={voucher} />

      {/* 선물 정보 카드 */}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-success" />
          <span className="text-[15px] font-semibold text-foreground">선물 정보</span>
        </div>
        <div className="space-y-2 text-[15px]">
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
      <div className="mt-5 space-y-2">
        <Link
          href="/my"
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-[16px] font-bold text-background hover:bg-foreground/80 transition-colors active:scale-[0.98]"
        >
          마이페이지로 이동
        </Link>
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Home size={15} />
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
