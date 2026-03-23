import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverRegisterSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const REGISTER_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitResult = await checkRateLimit(`register:${ip}`, REGISTER_RATE_LIMIT);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON 형식이 아닙니다." } },
        { status: 400 },
      );
    }

    const parsed = serverRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다." } },
        { status: 400 },
      );
    }

    const { username, email, password, name, phone } = parsed.data;

    const adminClient = createAdminClient();

    // 아이디 중복 확인
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: "USERNAME_EXISTS", message: "이미 사용 중인 아이디입니다." } },
        { status: 409 },
      );
    }

    // Supabase Auth 회원가입 (이메일 인증 없이 즉시 활성화)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message?.toLowerCase() ?? "";
      if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("duplicate") || msg.includes("already exists")) {
        return NextResponse.json(
          { success: false, error: { code: "EMAIL_EXISTS", message: "이미 가입된 이메일입니다." } },
          { status: 409 },
        );
      }
      console.error("[register] Supabase Auth error:", authError?.message);
      return NextResponse.json(
        { success: false, error: { code: "AUTH_ERROR", message: "회원가입 처리 중 오류가 발생했습니다." } },
        { status: 400 },
      );
    }

    // users 테이블에 프로필 생성 (admin client로 RLS 우회)
    const { error: profileError } = await adminClient.from("users").insert({
      auth_id: authData.user.id,
      username,
      email,
      name,
      phone,
      identity_verified: true,
    });

    if (profileError) {
      // Auth 사용자가 이미 생성되었으므로 orphan 계정 방지를 위해 삭제
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: { code: "USER_CREATE_FAILED", message: "프로필 생성에 실패했습니다." } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
