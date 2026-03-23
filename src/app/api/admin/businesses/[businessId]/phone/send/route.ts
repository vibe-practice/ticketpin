import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import { sendAligoSms } from "@/lib/sms/aligo";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { PHONE_RE, maskPhone, generateVerificationCode } from "@/lib/business/utils";

const CODE_EXPIRY_MINUTES = 3;
const SEND_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };

const sendSchema = z.object({
  phone: z.string().regex(PHONE_RE, "올바른 휴대폰 번호를 입력해 주세요."),
});

/**
 * POST /api/admin/businesses/[businessId]/phone/send
 *
 * 관리자가 업체의 SMS 인증 휴대폰 번호를 변경하기 위해
 * 새 번호로 인증번호를 발송한다.
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

    // Rate limit (business_id 기준, 5회/5분)
    const ip = getClientIp(request.headers);
    const rateResult = await checkRateLimit(`admin-phone-send:${businessId}:${ip}`, SEND_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "너무 많은 인증 요청입니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429 }
      );
    }

    // 요청 바디 검증
    const body = await request.json().catch(() => ({}));
    const parsed = sendSchema.safeParse(body);

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

    const { phone } = parsed.data;

    // 업체 존재 여부 확인
    const { data: business, error: bizError } = await adminClient
      .from("businesses")
      .select("id, business_name, status")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // 기존 미인증 코드 삭제 (같은 업체)
    await adminClient
      .from("business_verification_codes")
      .delete()
      .eq("business_id", businessId)
      .eq("verified", false);

    // 인증번호 저장 (phone 필드에 새 번호 저장)
    const { error: insertError } = await adminClient
      .from("business_verification_codes")
      .insert({
        business_id: businessId,
        code,
        phone,
        expires_at: expiresAt,
        verified: false,
      });

    if (insertError) {
      console.error("[admin-phone-send] 인증번호 저장 실패:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "인증번호 생성에 실패했습니다." } },
        { status: 500 }
      );
    }

    // SMS 발송
    const smsReceiver = phone.replace(/\D/g, "");
    try {
      await sendAligoSms({
        receiver: smsReceiver,
        msg: `[티켓핀] SMS 인증번호 변경: ${code} (${CODE_EXPIRY_MINUTES}분 이내 입력)`,
      });
    } catch (smsError) {
      console.error("[admin-phone-send] SMS 발송 실패:", smsError);
      // SMS 실패 시 저장된 인증번호 삭제
      await adminClient
        .from("business_verification_codes")
        .delete()
        .eq("business_id", businessId)
        .eq("verified", false);

      return NextResponse.json(
        { success: false, error: { code: "SMS_SEND_FAILED", message: "SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        maskedPhone: maskPhone(phone),
        expiresInSeconds: CODE_EXPIRY_MINUTES * 60,
      },
    });
  } catch (error) {
    console.error("[admin-phone-send] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
