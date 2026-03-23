import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * API Route에서 인증된 사용자 정보를 확인하는 공통 헬퍼.
 * 인증 실패 시 적절한 에러 응답을 반환하고, 성공 시 userId와 adminClient를 반환한다.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
          },
        },
        { status: 401 }
      ),
    };
  }

  const adminClient = createAdminClient();
  const { data: userData, error: userError } = await adminClient
    .from("users")
    .select("id, status")
    .eq("auth_id", authUser.id)
    .single();

  if (userError || !userData) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "사용자 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      ),
    };
  }

  if (userData.status !== "active") {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_INACTIVE",
            message: "비활성화된 계정입니다.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    userId: userData.id as string,
    adminClient,
  };
}
