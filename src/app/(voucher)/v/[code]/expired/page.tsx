import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherExpiredClient from "@/components/voucher/VoucherExpiredClient";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function VoucherExpiredPage({ params }: PageProps) {
  const { code } = await params;
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: issued 상태 + 만료된 경우만 허용
  // expired 페이지는 issued 상태이면서 temp_password_expires_at이 지난 경우에 표시
  const isExpired =
    voucher.status === "issued" &&
    voucher.temp_password_expires_at &&
    new Date(voucher.temp_password_expires_at) < new Date();

  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }
  if (!isExpired) {
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

  return <VoucherExpiredClient voucher={voucher} />;
}
