import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverResetPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateAndConsumeResetToken } from "@/lib/danal/session";
import { getClientIp } from "@/lib/utils/ip";

const RESET_PW_RATE_LIMIT = { maxAttempts: 3, windowMs: 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (비밀번호 변경은 더 엄격하게)
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `reset-pw:${ip}`,
      RESET_PW_RATE_LIMIT,
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
    const parsed = serverResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다." } },
        { status: 400 },
      );
    }

    const { resetToken, newPassword } = parsed.data;

    // 본인인증 토큰 검증 (일회용: 검증 후 자동 삭제)
    const tokenData = await validateAndConsumeResetToken(resetToken);
    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "인증이 만료되었습니다. 본인인증을 다시 진행해 주세요." } },
        { status: 400 },
      );
    }

    // Admin client로 사용자 조회 (RLS 우회)
    const adminClient = createAdminClient();
    const { data: userData, error: queryError } = await adminClient
      .from("users")
      .select("auth_id, username")
      .eq("username", tokenData.username)
      .eq("phone", tokenData.phone)
      .eq("status", "active")
      .single();

    if (queryError || !userData) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    // Supabase Admin API로 비밀번호 변경
    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(userData.auth_id, {
        password: newPassword,
      });

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { code: "PASSWORD_UPDATE_FAILED", message: "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        username: userData.username,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
