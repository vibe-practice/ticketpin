import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

const CHECK_USERNAME_RATE_LIMIT = { maxAttempts: 20, windowMs: 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(`check-username:${ip}`, CHECK_USERNAME_RATE_LIMIT);

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

    const { username } = body as { username?: unknown };

    if (
      !username ||
      typeof username !== "string" ||
      username.length < 4 ||
      username.length > 20 ||
      !/^[a-zA-Z0-9]+$/.test(username)
    ) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "아이디는 4~20자의 영문, 숫자만 사용 가능합니다." } },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    return NextResponse.json({ success: true, available: !existingUser });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
