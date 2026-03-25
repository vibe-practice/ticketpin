import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { VOUCHER_MAX_REISSUE, TEMP_PW_EXPIRY_MINUTES, BCRYPT_SALT_ROUNDS, generateTempPassword } from "@/lib/constants";
import { sendSmsSync, buildReissueMessage, resolveVoucherSmsPhone } from "@/lib/sms";

// Rate limit: IP당 분당 5회
const REISSUE_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

/**
 * POST /api/vouchers/[code]/reissue
 *
 * 임시 비밀번호 재발행
 * - 재발행 횟수 제한 (최대 5회)
 * - 새 임시 비밀번호 bcrypt 해싱 후 저장
 * - temp_password_expires_at 갱신 (현재시간 + 20분)
 * - temp_password_attempts 초기화
 * - is_password_locked 해제
 * - 상태를 issued로 되돌림
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // ── 코드 형식 검증 ──
    const codeResult = voucherCodeSchema.safeParse(code);
    if (!codeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CODE", message: "유효하지 않은 바우처 코드입니다." },
        },
        { status: 400 }
      );
    }

    // ── Rate Limiting ──
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(`reissue:${ip}`, REISSUE_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        },
        { status: 429 }
      );
    }

    // ── 바우처 조회 ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, status, reissue_count, user_password_hash, order_id, is_gift, owner_id")
      .eq("code", code)
      .single();

    if (voucherError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_NOT_FOUND", message: "바우처를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 상태 검증 ──
    // 비밀번호가 이미 설정된 경우 재발행 불가
    if (voucher.user_password_hash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PASSWORD_ALREADY_SET",
            message: "이미 비밀번호가 설정되어 재발행할 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }

    // issued 또는 temp_verified 상태에서만 재발행 가능
    if (voucher.status !== "issued" && voucher.status !== "temp_verified") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "현재 상태에서는 재발행할 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 재발행 횟수 제한 ──
    if (voucher.reissue_count >= VOUCHER_MAX_REISSUE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REISSUE_LIMIT_EXCEEDED",
            message: `재발행 횟수(${VOUCHER_MAX_REISSUE}회)를 모두 사용했습니다. 고객센터에 문의해주세요.`,
          },
        },
        { status: 400 }
      );
    }

    // ── 새 임시 비밀번호 생성 + bcrypt 해싱 ──
    const tempPasswordPlain = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPasswordPlain, BCRYPT_SALT_ROUNDS);
    const tempPasswordExpiresAt = new Date(
      Date.now() + TEMP_PW_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    // ── DB 업데이트 (원자적 횟수 검증) ──
    const { data: updateResult, error: updateError } = await adminClient
      .from("vouchers")
      .update({
        temp_password_hash: tempPasswordHash,
        temp_password_expires_at: tempPasswordExpiresAt,
        temp_password_attempts: 0,
        reissue_count: voucher.reissue_count + 1,
        is_password_locked: false,
        status: "issued", // issued 상태 유지 (잠금 해제 시에도)
      })
      .eq("id", voucher.id)
      .lt("reissue_count", VOUCHER_MAX_REISSUE)
      .select("id")
      .single();

    if (updateError || !updateResult) {
      // 동시 요청으로 이미 재발행 횟수가 초과된 경우
      if (!updateResult && !updateError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "REISSUE_LIMIT_EXCEEDED",
              message: `재발행 횟수(${VOUCHER_MAX_REISSUE}회)를 모두 사용했습니다. 고객센터에 문의해주세요.`,
            },
          },
          { status: 409 }
        );
      }
      console.error("[reissue] Update error:", updateError?.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "재발행에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ── SMS 발송 (after API로 응답 후 실행) ──
    const voucherId = voucher.id;
    const orderId = voucher.order_id;
    const isGift = voucher.is_gift;
    const ownerId = voucher.owner_id;

    after(async () => {
      const smsAdminClient = createAdminClient();

      // SMS 수신자 결정: 선물 바우처면 수신자(owner) 번호로 발송
      const { data: orderData } = await smsAdminClient
        .from("orders")
        .select("receiver_phone")
        .eq("id", orderId)
        .single();
      const smsPhone = await resolveVoucherSmsPhone(
        smsAdminClient,
        orderData?.receiver_phone ?? "",
        { is_gift: isGift, owner_id: ownerId }
      );

      if (smsPhone) {
        const smsMessage = buildReissueMessage({
          tempPassword: tempPasswordPlain,
          voucherCode: code,
        });

        await sendSmsSync({
          recipientPhone: smsPhone,
          messageContent: smsMessage,
          messageType: "reissue",
          voucherId,
          orderId,
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        temp_password_expires_at: tempPasswordExpiresAt,
        reissue_count: voucher.reissue_count + 1,
        reissue_remaining: VOUCHER_MAX_REISSUE - (voucher.reissue_count + 1),
      },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/reissue] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
