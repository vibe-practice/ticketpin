import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherActions from "@/components/voucher/VoucherActions";

interface ActionsPageProps {
  params: Promise<{ code: string }>;
}

export default async function ActionsPage({ params }: ActionsPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 상태 검증: password_set / pin_revealed만 접근 가능 (화이트리스트)
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

  // 선물받은 경우 보낸 사람 정보
  const sender = voucher.sender;
  const senderUsername = sender
    ? `${sender.username}(${sender.name})`
    : undefined;

  return (
    <VoucherActions
      voucher={voucher}
      senderUsername={senderUsername}
    />
  );
}
