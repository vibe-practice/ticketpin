import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import {
  BUSINESS_SESSION_COOKIE,
  BUSINESS_SESSION_DURATION_MS,
  logBusinessAccess,
  resolveBusinessId,
} from "@/lib/business/auth";

const businessLoginSchema = z.object({
  businessId: z.string().min(1, "업체 ID가 필요합니다."),
  loginId: z.string().min(1, "아이디를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

const BUSINESS_LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };

// SMS 인증 유효 시간 (10분)
const VERIFY_VALID_MINUTES = 10;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);

    const rateResult = await checkRateLimit(`biz-login:${ip}`, BUSINESS_LOGIN_RATE_LIMIT);
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

    const body = await request.json().catch(() => ({}));
    const parsed = businessLoginSchema.safeParse(body);

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

    const { businessId: identifier, loginId, password } = parsed.data;

    const businessId = await resolveBusinessId(identifier);
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const adminClient = createAdminClient();

    // 접근 로그: 로그인 시도
    logBusinessAccess({
      businessId,
      ipAddress: ip,
      action: "login_attempt",
      userAgent: request.headers.get("user-agent"),
    });

    // 1. SMS 인증 완료 확인 (10분 이내 verified=true)
    const verifyThreshold = new Date(
      Date.now() - VERIFY_VALID_MINUTES * 60 * 1000
    ).toISOString();

    const { data: verification } = await adminClient
      .from("business_verification_codes")
      .select("id")
      .eq("business_id", businessId)
      .eq("verified", true)
      .gte("created_at", verifyThreshold)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VERIFY_REQUIRED",
            message: "SMS 인증을 먼저 완료해 주세요.",
          },
        },
        { status: 403 }
      );
    }

    // 2. 업체 계정 조회
    const { data: account, error: accountError } = await adminClient
      .from("business_accounts")
      .select("id, business_id, login_id, password_hash")
      .eq("business_id", businessId)
      .eq("login_id", loginId)
      .single();

    if (accountError || !account) {
      // 접근 로그: 로그인 실패
      logBusinessAccess({
        businessId,
        ipAddress: ip,
        action: "login_fail",
        userAgent: request.headers.get("user-agent"),
      });

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

    // 3. 비밀번호 검증 (bcrypt 해시 형식 확인)
    const hash = account.password_hash as string;
    if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
      console.error("[biz-login] 지원하지 않는 해시 형식:", hash.slice(0, 4));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "HASH_FORMAT_ERROR",
            message: "비밀번호 검증에 실패했습니다. 관리자에게 문의하세요.",
          },
        },
        { status: 500 }
      );
    }
    const isPasswordValid = await compare(password, hash);
    if (!isPasswordValid) {
      // 접근 로그: 로그인 실패
      logBusinessAccess({
        businessId,
        ipAddress: ip,
        action: "login_fail",
        userAgent: request.headers.get("user-agent"),
      });

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

    // 4. 기존 세션 정리
    await adminClient
      .from("business_sessions")
      .delete()
      .eq("business_id", businessId);

    // 5. 새 세션 생성
    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + BUSINESS_SESSION_DURATION_MS
    ).toISOString();

    const { error: sessionError } = await adminClient
      .from("business_sessions")
      .insert({
        business_id: businessId,
        token,
        ip_address: ip,
        expires_at: expiresAt,
      });

    if (sessionError) {
      console.error("[biz-login] 세션 생성 실패:", sessionError);
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

    // 6. 사용된 인증번호 정리 (해당 업체의 인증 코드 삭제)
    await adminClient
      .from("business_verification_codes")
      .delete()
      .eq("business_id", businessId);

    // 접근 로그: 로그인 성공
    logBusinessAccess({
      businessId,
      ipAddress: ip,
      action: "login_success",
      userAgent: request.headers.get("user-agent"),
    });

    // 업체 정보 조회 (응답에 포함)
    const { data: business } = await adminClient
      .from("businesses")
      .select("id, business_name")
      .eq("id", businessId)
      .single();

    // 세션 쿠키 설정
    const response = NextResponse.json(
      {
        success: true,
        data: {
          businessId,
          businessName: business?.business_name ?? "",
        },
      },
      { status: 200 }
    );

    response.cookies.set(BUSINESS_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: BUSINESS_SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error("[biz-login] Unexpected error:", error);
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
