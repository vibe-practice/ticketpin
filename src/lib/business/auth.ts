import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessAccessAction } from "@/types";

// 세션 쿠키 이름
export const BUSINESS_SESSION_COOKIE = "business_session";

// 세션 만료 시간 (4시간)
export const BUSINESS_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

/**
 * API Route에서 업체 세션을 검증하는 공통 헬퍼.
 * 인증 실패 시 적절한 에러 응답을 반환하고,
 * 성공 시 businessId와 adminClient를 반환한다.
 */
export async function getAuthenticatedBusiness() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(BUSINESS_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_UNAUTHORIZED",
            message: "업체 로그인이 필요합니다.",
          },
        },
        { status: 401 }
      ),
    };
  }

  const adminClient = createAdminClient();

  // 세션 토큰으로 유효한 세션 조회
  const { data: session, error: sessionError } = await adminClient
    .from("business_sessions")
    .select("id, business_id, expires_at")
    .eq("token", sessionToken)
    .single();

  if (sessionError || !session) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_SESSION_INVALID",
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
      .from("business_sessions")
      .delete()
      .eq("id", session.id);

    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_SESSION_EXPIRED",
            message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
          },
        },
        { status: 401 }
      ),
    };
  }

  return {
    businessId: session.business_id as string,
    adminClient,
  };
}

/**
 * URL의 login_id(또는 UUID)로 실제 business_id(UUID)를 조회한다.
 * - UUID 형식이면 businesses 테이블에서 존재 여부 확인 후 반환
 * - 아니면 business_accounts.login_id로 조회하여 business_id 반환
 */
export async function resolveBusinessId(identifier: string): Promise<string | null> {
  const adminClient = createAdminClient();

  // UUID 형식 체크
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    // UUID 형식이어도 실제 존재하는 업체인지 확인
    const { data, error } = await adminClient
      .from("businesses")
      .select("id")
      .eq("id", identifier)
      .single();

    if (error || !data) return null;
    return identifier;
  }

  // login_id로 business_id 조회
  const { data, error } = await adminClient
    .from("business_accounts")
    .select("business_id")
    .eq("login_id", identifier)
    .single();

  if (error || !data) return null;
  return data.business_id as string;
}

/**
 * 업체 접근 로그를 기록한다 (fire-and-forget).
 */
export async function logBusinessAccess(params: {
  businessId: string;
  ipAddress: string;
  action: BusinessAccessAction;
  userAgent: string | null;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from("business_access_logs").insert({
      business_id: params.businessId,
      ip_address: params.ipAddress,
      action: params.action,
      user_agent: params.userAgent,
    });
  } catch {
    // 로깅 실패는 무시 (핵심 플로우를 차단하지 않음)
    console.error("[business-access-log] 로그 기록 실패:", params.action);
  }
}
