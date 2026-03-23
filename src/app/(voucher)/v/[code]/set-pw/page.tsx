import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import SetPassword from "@/components/voucher/SetPassword";

interface SetPwPageProps {
  params: Promise<{ code: string }>;
}

export default async function SetPwPage({ params }: SetPwPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: temp_verified만 접근 가능
  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }

  if (voucher.status !== "temp_verified") {
    const redirectMap: Record<string, string> = {
      issued: `/v/${code}`,
      password_set: `/v/${code}/actions`,
      pin_revealed: `/v/${code}/actions`,
      gifted: `/v/${code}/gifted`,
      cancelled: `/v/${code}/cancelled`,
    };
    redirect(redirectMap[voucher.status] ?? `/v/${code}`);
  }

  return <SetPassword voucher={voucher} />;
}
