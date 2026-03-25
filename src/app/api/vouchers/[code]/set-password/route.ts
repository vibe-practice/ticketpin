import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema, setPasswordSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

// Rate limit: IP당 분당 10회
const SET_PW_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

// bcrypt salt rounds
const BCRYPT_SALT_ROUNDS = 12;

/**
 * POST /api/vouchers/[code]/set-password
 *
 * 사용자 비밀번호 설정 (4자리 숫자)
 * - 임시 비밀번호 인증 완료 후(temp_verified) 설정 가능
 * - 이미 설정된 경우 거부
 * - bcrypt 해싱 후 저장
 * - 상태를 password_set으로 변경
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
    const rateLimitResult = await checkRateLimit(`set-pw:${ip}`, SET_PW_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        },
        { status: 429 }
      );
    }

    // ── 입력 검증 ──
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        },
        { status: 400 }
      );
    }

    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: firstError?.message ?? "입력값이 올바르지 않습니다." },
        },
        { status: 422 }
      );
    }

    const { password } = parsed.data;

    // ── 바우처 조회 ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, order_id, status, user_password_hash, is_password_locked")
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
    if (voucher.is_password_locked) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_LOCKED", message: "잠긴 바우처입니다. 고객센터에 문의해주세요." },
        },
        { status: 403 }
      );
    }

    if (voucher.user_password_hash) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PASSWORD_ALREADY_SET", message: "비밀번호가 이미 설정되어 있습니다." },
        },
        { status: 409 }
      );
    }

    if (voucher.status !== "temp_verified") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "임시 비밀번호 인증을 먼저 완료해주세요.",
          },
        },
        { status: 400 }
      );
    }

    // ── bcrypt 해싱 ──
    const userPasswordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // ── 상태 전이: temp_verified -> password_set (낙관적 잠금 + 결과 확인) ──
    const { data: updateResult, error: updateError } = await adminClient
      .from("vouchers")
      .update({
        user_password_hash: userPasswordHash,
        status: "password_set",
      })
      .eq("id", voucher.id)
      .eq("status", "temp_verified")
      .select("id")
      .single();

    if (updateError || !updateResult) {
      // 동시 요청으로 이미 처리된 경우 (status가 temp_verified가 아님)
      if (!updateResult && !updateError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "ALREADY_PROCESSED", message: "이미 처리된 요청입니다. 페이지를 새로고침해 주세요." },
          },
          { status: 409 }
        );
      }
      console.error("[set-password] Update error:", updateError?.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "비밀번호 설정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 주문 상태도 password_set으로 변경
    if (voucher.order_id) {
      const { error: orderUpdateError } = await adminClient
        .from("orders")
        .update({ status: "password_set" })
        .eq("id", voucher.order_id)
        .eq("status", "paid"); // paid -> password_set

      if (orderUpdateError) {
        // 주문 상태 업데이트 실패 시 바우처 롤백
        console.error("[set-password] Order update failed, rolling back voucher:", orderUpdateError.message);
        await adminClient
          .from("vouchers")
          .update({
            user_password_hash: null,
            status: "temp_verified",
          })
          .eq("id", voucher.id)
          .eq("status", "password_set");

        return NextResponse.json(
          {
            success: false,
            error: { code: "UPDATE_FAILED", message: "비밀번호 설정에 실패했습니다. 다시 시도해 주세요." },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { password_set: true },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/set-password] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
