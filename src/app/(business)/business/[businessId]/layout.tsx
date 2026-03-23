import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBusinessId } from "@/lib/business/auth";

interface BusinessIdLayoutProps {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}

export default async function BusinessIdLayout({
  children,
  params,
}: BusinessIdLayoutProps) {
  const { businessId: identifier } = await params;

  // login_id 또는 UUID로 실제 business_id 조회
  const businessId = await resolveBusinessId(identifier);
  if (!businessId) {
    notFound();
  }

  // 업체 상태 확인 — terminated이면 404
  const adminClient = createAdminClient();
  const { data: business } = await adminClient
    .from("businesses")
    .select("status")
    .eq("id", businessId)
    .single();

  if (!business || business.status !== "active") {
    notFound();
  }

  return <>{children}</>;
}
