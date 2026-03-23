import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

/**
 * POST /api/admin/purchase-accounts/check-username
 *
 * 매입 아이디 username 중복 확인 (관리자 전용)
 * 밑줄(_) 포함 가능 — 일반 회원가입 check-username과 규칙이 다름
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "올바른 JSON 형식이 아닙니다." } },
        { status: 400 },
      );
    }

    const { username } = body as { username?: unknown };

    if (
      !username ||
      typeof username !== "string" ||
      username.length < 4 ||
      username.length > 20 ||
      !/^[a-zA-Z0-9_]+$/.test(username)
    ) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "아이디는 4~20자의 영문, 숫자, 밑줄만 사용 가능합니다." } },
        { status: 400 },
      );
    }

    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    return NextResponse.json({ success: true, available: !existingUser });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
