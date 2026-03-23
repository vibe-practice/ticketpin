import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { getClientIp } from "@/lib/utils/ip";

/**
 * GET /api/admin/settings/current-ip
 * 현재 접속 IP 반환 (서버 측에서 정확한 IP 제공)
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);

  return NextResponse.json({
    success: true,
    data: { ip },
  });
}
