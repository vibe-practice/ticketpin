import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 세션 쿠키 이름
export const ADMIN_SESSION_COOKIE = "admin_session";

// 세션 만료 시간 (8시간)
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

/**
 * API Route에서 관리자 세션을 검증하는 공통 헬퍼.
 * 인증 실패 시 적절한 에러 응답을 반환하고,
 * 성공 시 adminUserId와 adminClient를 반환한다.
 */
export async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ADMIN_UNAUTHORIZED",
            message: "관리자 로그인이 필요합니다.",
          },
        },
        { status: 401 }
      ),
    };
  }

  const adminClient = createAdminClient();

  // 세션 토큰으로 유효한 세션 조회
  const { data: session, error: sessionError } = await adminClient
    .from("admin_sessions")
    .select("id, admin_user_id, expires_at")
    .eq("token", sessionToken)
    .single();

  if (sessionError || !session) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ADMIN_SESSION_INVALID",
            message: "유효하지 않은 세션입니다. 다시 로그인해 주세요.",
          },
        },
        { status: 401 }
      ),
    };
  }

  // 세션 만료 체크
  if (new Date(session.expires_at) < new Date()) {
    // 만료된 세션 삭제
    await adminClient
      .from("admin_sessions")
      .delete()
      .eq("id", session.id);

    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ADMIN_SESSION_EXPIRED",
            message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
          },
        },
        { status: 401 }
      ),
    };
  }

  return {
    adminUserId: session.admin_user_id as string,
    adminClient,
  };
}

