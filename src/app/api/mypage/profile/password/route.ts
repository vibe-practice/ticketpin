import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const changePasswordServerSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
    path: ["newPassword"],
  });

/**
 * PUT /api/mypage/profile/password
 *
 * 비밀번호 변경.
 * - 인증 필수
 * - 현재 비밀번호 확인 (Supabase Auth signInWithPassword)
 * - 새 비밀번호로 변경 (Supabase Auth updateUser)
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { adminClient } = auth;

    // Rate limiting (IP 기반, 5분에 5회)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rateLimit = await checkRateLimit(`change-password:${ip}`, {
      maxAttempts: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "비밀번호 변경 시도가 너무 많습니다. 5분 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // 요청 바디 파싱 및 검증
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "잘못된 요청 형식입니다." },
        },
        { status: 400 }
      );
    }

    const parsed = changePasswordServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다.",
          },
        },
        { status: 422 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // 현재 비밀번호 확인: 현재 사용자의 이메일로 로그인 시도
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_ERROR", message: "인증 정보를 확인할 수 없습니다." },
        },
        { status: 401 }
      );
    }

    // 현재 비밀번호 검증: signInWithPassword로 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WRONG_PASSWORD",
            message: "현재 비밀번호가 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    // 새 비밀번호로 변경
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[PUT /api/mypage/profile/password] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "비밀번호 변경에 실패했습니다. 다시 시도해 주세요.",
          },
        },
        { status: 500 }
      );
    }

    // 업체 포털 계정 비밀번호 동기화 (business_accounts)
    // auth.users.encrypted_password가 변경되었으므로 RPC로 새 해시를 가져와 업데이트
    try {
      const { data: userRow } = await adminClient
        .from("users")
        .select("username")
        .eq("auth_id", authUser.id)
        .single();

      if (userRow) {
        const username = (userRow as Record<string, unknown>).username as string;
        const { data: newHash } = await adminClient.rpc("get_auth_password", { p_auth_id: authUser.id });

        if (newHash) {
          // login_id = username인 업체 계정의 비밀번호 업데이트
          await adminClient
            .from("business_accounts")
            .update({ password_hash: newHash as string })
            .eq("login_id", username);
        }
      }
    } catch (syncError) {
      // 동기화 실패는 비밀번호 변경 성공에 영향을 주지 않음
      console.error("[PUT /api/mypage/profile/password] Business account sync error:", syncError);
    }

    return NextResponse.json({
      success: true,
      data: { message: "비밀번호가 성공적으로 변경되었습니다." },
    });
  } catch (error) {
    console.error("[PUT /api/mypage/profile/password] Unexpected error:", error);
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
