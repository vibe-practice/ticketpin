import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverFindIdSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

const FIND_ID_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `find-id:${ip}`,
      FIND_ID_RATE_LIMIT,
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429 },
      );
    }

    // JSON 파싱
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON 형식이 아닙니다." } },
        { status: 400 },
      );
    }

    // 입력 검증
    const parsed = serverFindIdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다." } },
        { status: 400 },
      );
    }

    const { name, phone } = parsed.data;

    // Admin client로 사용자 조회 (RLS 우회)
    const adminClient = createAdminClient();
    const { data: userData, error: queryError } = await adminClient
      .from("users")
      .select("username, created_at")
      .eq("name", name)
      .eq("phone", phone)
      .eq("status", "active")
      .single();

    if (queryError || !userData) {
      // 보안: 사용자 존재 여부를 유추할 수 없도록 일반적인 메시지 반환
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    // 가입일 포맷팅
    const joinedAt = new Date(userData.created_at).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return NextResponse.json({
      success: true,
      data: {
        username: userData.username,
        joinedAt,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
