// ============================================================
// POST /api/auth/identity/result
// - 인증 완료 후 결과 조회
// - sessionId로 세션 조회 → 결과 반환 → 세션 삭제 (일회성)
// ============================================================

import { NextResponse } from "next/server";
import {
  getIdentitySession,
  deleteIdentitySession,
  createResetToken,
} from "@/lib/danal/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IdentityResultApiResponse } from "@/lib/danal/types";
import { maskUsername } from "@/lib/utils";
import { getClientIp } from "@/lib/utils/ip";
import { z } from "zod";

const resultRequestSchema = z.object({
  sessionId: z.string().min(1),
  purpose: z.enum(["register", "find-id", "reset-password"]).default("register"),
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(request.headers);
    const rateLimit = await checkRateLimit(`identity-result:${ip}`, {
      maxAttempts: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.success) {
      return NextResponse.json<IdentityResultApiResponse>(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = resultRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<IdentityResultApiResponse>(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "요청 형식이 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    const { sessionId, purpose } = parsed.data;

    const session = await getIdentitySession(sessionId);

    if (!session) {
      return NextResponse.json<IdentityResultApiResponse>(
        {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "인증 세션이 만료되었거나 존재하지 않습니다.",
          },
        },
        { status: 404 }
      );
    }

    if (!session.confirmed || !session.result) {
      return NextResponse.json<IdentityResultApiResponse>(
        {
          success: false,
          error: {
            code: "NOT_CONFIRMED",
            message: "인증이 아직 완료되지 않았습니다.",
          },
        },
        { status: 400 }
      );
    }

    // 회원가입: 기존 가입 여부 확인 / 비밀번호 재설정: 아이디 조회 + 토큰 발급
    let existingUsername: string | undefined;
    let username: string | undefined;
    let resetToken: string | undefined;

    if (purpose === "register" || purpose === "reset-password") {
      try {
        const adminClient = createAdminClient();
        const { data: existingUser } = await adminClient
          .from("users")
          .select("username")
          .eq("phone", session.result.phone)
          .single();

        if (existingUser?.username) {
          if (purpose === "register") {
            existingUsername = maskUsername(existingUser.username);
          } else {
            username = existingUser.username;
            // 비밀번호 재설정용 일회용 토큰 발급
            resetToken = await createResetToken(existingUser.username, session.result.phone);
          }
        }
      } catch {
        // DB 조회 실패해도 인증 결과는 반환
      }
    }

    const result = {
      name: session.result.name,
      phone: session.result.phone,
      verified: true,
      ...(existingUsername && { existingUsername }),
      ...(username && { username }),
      ...(resetToken && { resetToken }),
    };

    // 일회성 사용: 결과 반환 후 세션 삭제
    await deleteIdentitySession(sessionId);

    return NextResponse.json<IdentityResultApiResponse>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[identity/result] Unexpected error:", error);
    return NextResponse.json<IdentityResultApiResponse>(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
