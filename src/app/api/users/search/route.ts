import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";

const searchQuerySchema = z.object({
  q: z
    .string()
    .min(2, "검색어는 2자 이상이어야 합니다.")
    .max(20, "검색어는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 검색할 수 있습니다."),
});

/** PostgreSQL ilike 와일드카드 이스케이핑 (%, _ → \%, \_) */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/**
 * GET /api/users/search?q=xxx
 *
 * 회원 검색 (선물용, 아이디 기반).
 * - 인증 필수
 * - 아이디(username)에 검색어가 포함된 회원 반환
 * - 자기 자신 제외
 * - 원본 아이디/이름 반환
 * - 최대 10건
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;

    // Rate limiting (IP 기반, 분당 30회)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rateLimit = await checkRateLimit(`user-search:${ip}`, {
      maxAttempts: 30,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
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

    // 쿼리 파라미터 검증
    const searchParams = request.nextUrl.searchParams;
    const parsed = searchQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다.",
          },
        },
        { status: 400 }
      );
    }

    const { q } = parsed.data;

    // username에 검색어가 포함된 활성 회원 조회 (자기 자신 제외, 최대 10건)
    const { data: users, error: queryError } = await adminClient
      .from("users")
      .select("id, username, name")
      .eq("status", "active")
      .neq("id", userId)
      .ilike("username", `%${escapeIlike(q)}%`)
      .limit(10);

    if (queryError) {
      console.error("[GET /api/users/search] Query error:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "검색 중 오류가 발생했습니다.",
          },
        },
        { status: 500 }
      );
    }

    const results = (users ?? []).map(
      (user: { id: string; username: string; name: string }) => ({
        id: user.id,
        username: user.username,
        name: user.name,
      })
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("[GET /api/users/search] Unexpected error:", error);
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
