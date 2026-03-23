import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverLoginSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

const LOGIN_RATE_LIMIT = { maxAttempts: 10, windowMs: 5 * 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (IP 기반)
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);

    if (!rateLimitResult.success) {
      const retryAfterSec = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.`,
          },
        },
        { status: 429 }
      );
    }

    // 요청 파싱 및 유효성 검증
    const body = await request.json().catch(() => ({}));
    const parsed = serverLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;

    // username으로 email 조회 (admin client로 RLS 우회)
    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
      .from("users")
      .select("email, status, is_purchase_account")
      .eq("username", username)
      .single();

    if (!userData || userData.status === "withdrawn" || userData.is_purchase_account === true) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "아이디 또는 비밀번호가 올바르지 않습니다.",
          },
        },
        { status: 401 }
      );
    }

    // 정지 계정 안내
    if (userData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACCOUNT_DISABLED",
            message: "이용이 제한된 계정입니다. 고객센터에 문의해 주세요.",
          },
        },
        { status: 403 }
      );
    }

    // Supabase Auth 로그인
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password,
    });

    if (authError) {
      console.error("[login] Supabase Auth 에러:", authError.message, authError.status);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "아이디 또는 비밀번호가 올바르지 않습니다.",
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
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
