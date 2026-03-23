import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/auth/me
 * 현재 로그인한 관리자 정보 조회
 */
export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await auth.adminClient
      .from("admin_users")
      .select("id, username, name, created_at")
      .eq("id", auth.adminUserId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "관리자 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
