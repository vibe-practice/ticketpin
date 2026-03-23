import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { PHONE_RE } from "@/lib/business/utils";

const VERIFY_RATE_LIMIT = { maxAttempts: 10, windowMs: 5 * 60 * 1000 };

const verifySchema = z.object({
  phone: z.string().regex(PHONE_RE, "올바른 휴대폰 번호를 입력해 주세요."),
  code: z.string().length(6, "인증번호 6자리를 입력해 주세요."),
});

/**
 * POST /api/admin/businesses/[businessId]/phone/verify
 *
 * 관리자가 새 휴대폰 번호로 발송된 인증번호를 검증하고,
 * 성공 시 businesses.auth_phone을 업데이트한다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 업체 ID입니다." } },
        { status: 400 }
      );
    }

    // Rate limit (business_id 기준, 10회/5분 — 브루트포스 방어)
    const ip = getClientIp(request.headers);
    const rateResult = await checkRateLimit(`admin-phone-verify:${businessId}:${ip}`, VERIFY_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "너무 많은 인증 시도입니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429 }
      );
    }

    // 요청 바디 검증
    const body = await request.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

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

    const { phone, code } = parsed.data;

    // 업체 존재 여부 확인
    const { data: business, error: bizError } = await adminClient
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    // 가장 최근 미인증 인증번호 조회 (해당 업체 + 해당 전화번호)
    const { data: verification, error: verifyError } = await adminClient
      .from("business_verification_codes")
      .select("id, code, phone, expires_at")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (verifyError || !verification) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CODE_NOT_FOUND", message: "인증번호를 먼저 발송해 주세요." },
        },
        { status: 400 }
      );
    }

    // 만료 확인
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CODE_EXPIRED", message: "인증 시간이 만료되었습니다. 인증번호를 다시 발송해 주세요." },
        },
        { status: 400 }
      );
    }

    // 인증번호 일치 확인
    if (verification.code !== code) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CODE_MISMATCH", message: "인증번호가 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    // 인증 성공: businesses.auth_phone 업데이트
    const { error: updateError } = await adminClient
      .from("businesses")
      .update({ auth_phone: phone })
      .eq("id", businessId);

    if (updateError) {
      console.error("[admin-phone-verify] auth_phone 업데이트 실패:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "SMS 인증 휴대폰 번호 변경에 실패했습니다." } },
        { status: 500 }
      );
    }

    // 해당 업체의 모든 미인증 인증번호 삭제 (잔여 코드 정리)
    await adminClient
      .from("business_verification_codes")
      .delete()
      .eq("business_id", businessId)
      .eq("verified", false);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin-phone-verify] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
