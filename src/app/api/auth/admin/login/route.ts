import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "@/lib/admin/auth";
import { getClientIp } from "@/lib/utils/ip";

const adminLoginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

const ADMIN_LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (IP 기반)
    const ip = getClientIp(request.headers);

    const rateResult = await checkRateLimit(`admin-login:${ip}`, ADMIN_LOGIN_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "너무 많은 로그인 시도입니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // 요청 파싱 및 유효성 검증
    const body = await request.json().catch(() => ({}));
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const adminClient = createAdminClient();

    // 관리자 계정 조회
    const { data: adminUser, error: queryError } = await adminClient
      .from("admin_users")
      .select("id, username, password_hash, name")
      .eq("username", username)
      .single();

    if (queryError || !adminUser) {
      console.error(`[admin-login] 실패 (계정 미존재): username=${username}, ip=${ip}`);
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

    // 비밀번호 검증
    const isPasswordValid = await compare(password, adminUser.password_hash);
    if (!isPasswordValid) {
      console.error(`[admin-login] 실패 (비밀번호 불일치): username=${username}, ip=${ip}`);
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

    // 기존 세션 정리 (해당 관리자의 이전 세션 삭제)
    await adminClient
      .from("admin_sessions")
      .delete()
      .eq("admin_user_id", adminUser.id);

    // 새 세션 생성
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    const { error: sessionError } = await adminClient
      .from("admin_sessions")
      .insert({
        admin_user_id: adminUser.id,
        token,
        expires_at: expiresAt,
      });

    if (sessionError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_ERROR",
            message: "세션 생성에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    console.log(`[admin-login] 성공: adminId=${adminUser.id}, username=${username}, ip=${ip}`);

    // 세션 쿠키 설정
    const response = NextResponse.json(
      {
        success: true,
        data: {
          name: adminUser.name,
        },
      },
      { status: 200 }
    );

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error("[admin-login] Unexpected error:", error);
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
