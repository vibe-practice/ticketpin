import { notFound, redirect } from "next/navigation";
import { getVoucherByCode } from "@/lib/supabase/queries";
import VoucherMain from "@/components/voucher/VoucherMain";

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

interface VoucherPageProps {
  params: Promise<{ code: string }>;
}

export default async function VoucherPage({ params }: VoucherPageProps) {
  const { code } = await params;

  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    notFound();
  }

  // 취소/선물완료/핀확인 완료 상태이면 해당 전용 페이지로 리디렉션
  if (voucher.status === "cancelled") {
    redirect(`/v/${code}/cancelled`);
  }

  if (voucher.status === "gifted") {
    redirect(`/v/${code}/gifted`);
  }

  // 잠금 상태: 임시 비밀번호 5회 실패
  if (voucher.is_password_locked) {
    redirect(`/v/${code}/locked`);
  }

  // issued 상태에서 서버 시간 기준 이미 만료인 경우
  if (voucher.status === "issued" && voucher.temp_password_expires_at) {
    if (isExpired(voucher.temp_password_expires_at)) {
      redirect(`/v/${code}/expired`);
    }
  }

  if (voucher.status === "temp_verified") {
    redirect(`/v/${code}/set-pw`);
  }

  if (voucher.status === "password_set" || voucher.status === "pin_revealed") {
    redirect(`/v/${code}/actions`);
  }

  // 선물받은 경우 보낸 사람 정보
  const sender = voucher.sender;
  const senderDisplayName = sender
    ? `${sender.username}(${sender.name})`
    : undefined;

  const expiresAt = voucher.temp_password_expires_at ?? new Date(0).toISOString();

  return (
    <VoucherMain
      voucher={voucher}
      senderUsername={senderDisplayName}
      expiresAt={expiresAt}
    />
  );
}
