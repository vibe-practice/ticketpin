import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherGift from "@/components/voucher/VoucherGift";

interface GiftPageProps {
  params: Promise<{ code: string }>;
}

export default async function GiftPage({ params }: GiftPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: password_set 상태만 선물하기 가능
  // pin_revealed 상태는 선물 불가 (핀 확인 후에는 선물 불가)
  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }
  if (voucher.status !== "password_set") {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      temp_verified: `/v/${code}/set-pw`,
      pin_revealed: `/v/${code}/actions`,
      cancelled: `/v/${code}/cancelled`,
      gifted: `/v/${code}/gifted`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  // 현재 바우처 소유자 ID를 currentUserId로 전달
  const currentUserId = voucher.owner_id;

  return (
    <VoucherGift
      voucher={voucher}
      currentUserId={currentUserId}
    />
  );
}
