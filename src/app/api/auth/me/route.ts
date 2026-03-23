import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "인증되지 않은 요청입니다.",
          },
        },
        { status: 401 }
      );
    }

    // auth_id로 users 테이블에서 프로필 조회 (admin client로 RLS 우회)
    const adminClient = createAdminClient();
    const { data: userData, error: queryError } = await adminClient
      .from("users")
      .select(
        "id, auth_id, username, email, name, phone, identity_verified, status, total_purchase_count, total_purchase_amount, created_at, updated_at"
      )
      .eq("auth_id", authUser.id)
      .single();

    if (queryError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "사용자 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // 비활성/정지 계정: 세션 정리 후 401 반환
    if (userData.status !== "active") {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACCOUNT_DISABLED",
            message: "비활성화된 계정입니다.",
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
