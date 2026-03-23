import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { logBusinessAccess, resolveBusinessId } from "@/lib/business/auth";

const verifyCheckSchema = z.object({
  businessId: z.string().min(1, "업체 ID가 필요합니다."),
  code: z.string().length(6, "인증번호 6자리를 입력해 주세요."),
});

const VERIFY_CHECK_RATE_LIMIT_IP = { maxAttempts: 10, windowMs: 5 * 60 * 1000 };
const VERIFY_CHECK_RATE_LIMIT_BIZ = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);

    const rateResult = await checkRateLimit(`biz-verify-check:${ip}`, VERIFY_CHECK_RATE_LIMIT_IP);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "너무 많은 인증 시도입니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = verifyCheckSchema.safeParse(body);

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

    const { businessId: identifier, code } = parsed.data;

    const businessId = await resolveBusinessId(identifier);
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const adminClient = createAdminClient();

    // businessId 기반 rate limit (브루트포스 방어)
    const bizRateResult = await checkRateLimit(`biz-verify-check:${businessId}`, VERIFY_CHECK_RATE_LIMIT_BIZ);
    if (!bizRateResult.success) {
      // 초과 시 인증번호 무효화
      await adminClient
        .from("business_verification_codes")
        .delete()
        .eq("business_id", businessId)
        .eq("verified", false);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 발송해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // 가장 최근 미인증 인증번호 조회
    const { data: verification, error: verifyError } = await adminClient
      .from("business_verification_codes")
      .select("id, code, expires_at, verified")
      .eq("business_id", businessId)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (verifyError || !verification) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_NOT_FOUND",
            message: "인증번호를 먼저 발송해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    // 만료 확인
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_EXPIRED",
            message: "인증 시간이 만료되었습니다. 인증번호를 다시 발송해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    // 인증번호 일치 확인
    if (verification.code !== code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_MISMATCH",
            message: "인증번호가 올바르지 않습니다. 다시 확인해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    // 인증 성공: verified = true 업데이트
    const { error: updateError } = await adminClient
      .from("business_verification_codes")
      .update({ verified: true })
      .eq("id", verification.id);

    if (updateError) {
      console.error("[biz-verify-check] 인증 상태 업데이트 실패:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "인증 처리에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // 접근 로그 기록 (fire-and-forget)
    logBusinessAccess({
      businessId,
      ipAddress: ip,
      action: "verify_success",
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      { success: true, data: { verified: true } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[biz-verify-check] Unexpected error:", error);
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
