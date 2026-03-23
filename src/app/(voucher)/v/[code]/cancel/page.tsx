import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherCancel from "@/components/voucher/VoucherCancel";

interface CancelPageProps {
  params: Promise<{ code: string }>;
}

export default async function CancelPage({ params }: CancelPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 접근 제한: 비밀번호 설정 전 + 직접 구매만 접근 가능
  // 선물받은 바우처는 취소 불가
  if (voucher.is_gift) {
    redirect(`/v/${code}`);
  }

  // 화이트리스트: issued, temp_verified만 취소 접근 가능
  if (voucher.status !== "issued" && voucher.status !== "temp_verified") {
    redirect(`/v/${code}`);
  }

  return <VoucherCancel voucher={voucher} />;
}
