import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherPin from "@/components/voucher/VoucherPin";

interface PinPageProps {
  params: Promise<{ code: string }>;
}

export default async function PinPage({ params }: PinPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: password_set / pin_revealed만 접근 가능
  const ALLOWED_STATUSES = ["password_set", "pin_revealed"] as const;
  if (!ALLOWED_STATUSES.includes(voucher.status as (typeof ALLOWED_STATUSES)[number])) {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      temp_verified: `/v/${code}/set-pw`,
      cancelled: `/v/${code}/cancelled`,
      gifted: `/v/${code}/gifted`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  // 핀 번호는 unlock-pins API에서 복호화하여 제공
  // 서버 페이지에서는 빈 배열 전달 (클라이언트에서 API 호출)
  return (
    <VoucherPin
      voucher={voucher}
      pinNumbers={[]}
    />
  );
}
