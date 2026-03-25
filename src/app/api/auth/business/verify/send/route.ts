import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { sendAligoSms } from "@/lib/sms/aligo";
import { logBusinessAccess, resolveBusinessId } from "@/lib/business/auth";
import { maskPhone, generateVerificationCode } from "@/lib/business/utils";

const verifySendSchema = z.object({
  businessId: z.string().min(1, "업체 ID가 필요합니다."),
});

const VERIFY_SEND_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };
const CODE_EXPIRY_MINUTES = 3;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);

    const rateResult = await checkRateLimit(`biz-verify-send:${ip}`, VERIFY_SEND_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "너무 많은 인증 요청입니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = verifySendSchema.safeParse(body);

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

    const { businessId: identifier } = parsed.data;

    // login_id 또는 UUID로 실제 business_id 조회
    const businessId = await resolveBusinessId(identifier);
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const adminClient = createAdminClient();

    // 업체 조회 (active 상태 확인)
    const { data: business, error: bizError } = await adminClient
      .from("businesses")
      .select("id, business_name, contact_phone, auth_phone, status")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "업체 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    if (business.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_INACTIVE",
            message: "비활성 상태의 업체입니다. 관리자에게 문의하세요.",
          },
        },
        { status: 403 }
      );
    }

    // auth_phone 우선, 없으면 contact_phone 폴백
    const rawBiz = business as Record<string, unknown>;
    const phone = (rawBiz.auth_phone as string | null) ?? business.contact_phone;
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // 기존 미사용 인증번호 무효화 (같은 업체의 미인증 코드 삭제)
    await adminClient
      .from("business_verification_codes")
      .delete()
      .eq("business_id", businessId)
      .eq("verified", false);

    // 인증번호 저장
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
      console.error("[biz-verify-send] 인증번호 저장 실패:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "인증번호 생성에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // SMS 발송
    const smsReceiver = phone.replace(/\D/g, "");
    try {
      await sendAligoSms({
        receiver: smsReceiver,
        msg: `[티켓매니아] 업체 인증번호: ${code} (${CODE_EXPIRY_MINUTES}분 이내 입력)`,
      });
    } catch (smsError) {
      console.error("[biz-verify-send] SMS 발송 실패:", smsError);
      // SMS 발송 실패 시 저장된 인증번호 삭제
      await adminClient
        .from("business_verification_codes")
        .delete()
        .eq("business_id", businessId)
        .eq("verified", false);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SMS_SEND_FAILED",
            message: "SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 500 }
      );
    }

    // 접근 로그 기록 (fire-and-forget)
    logBusinessAccess({
      businessId,
      ipAddress: ip,
      action: "verify_attempt",
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          maskedPhone: maskPhone(phone),
          expiresInSeconds: CODE_EXPIRY_MINUTES * 60,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[biz-verify-send] Unexpected error:", error);
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
