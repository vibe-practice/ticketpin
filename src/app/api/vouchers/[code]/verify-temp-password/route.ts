import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema, verifyTempPasswordSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { VOUCHER_MAX_ATTEMPTS } from "@/lib/constants";

// Rate limit: IP당 분당 10회
const VERIFY_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

/**
 * POST /api/vouchers/[code]/verify-temp-password
 *
 * 임시 비밀번호 검증
 * - bcrypt 비교
 * - 5회 실패 시 잠금 (is_password_locked = true)
 * - 만료 시간 확인
 * - 성공 시 상태를 temp_verified로 변경
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
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rateLimitResult = await checkRateLimit(`verify-temp:${ip}`, VERIFY_RATE_LIMIT);
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

    const parsed = verifyTempPasswordSchema.safeParse(body);
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

    const { temp_password } = parsed.data;

    // ── 바우처 조회 ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select(
        "id, status, temp_password_hash, temp_password_expires_at, temp_password_attempts, is_password_locked"
      )
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
          error: { code: "VOUCHER_LOCKED", message: "입력이 잠겼습니다. 고객센터에 문의해주세요." },
        },
        { status: 403 }
      );
    }

    if (voucher.status !== "issued") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "이미 임시 비밀번호 인증이 완료된 바우처입니다.",
          },
        },
        { status: 400 }
      );
    }

    if (!voucher.temp_password_hash) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_TEMP_PASSWORD", message: "임시 비밀번호가 설정되지 않았습니다." },
        },
        { status: 400 }
      );
    }

    // ── 만료 시간 확인 ──
    if (voucher.temp_password_expires_at) {
      const expiresAt = new Date(voucher.temp_password_expires_at);
      if (new Date() > expiresAt) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "TEMP_PASSWORD_EXPIRED", message: "임시 비밀번호가 만료되었습니다. 재발행해주세요." },
          },
          { status: 400 }
        );
      }
    }

    // ── bcrypt 비교 ──
    const isMatch = await bcrypt.compare(temp_password, voucher.temp_password_hash);

    if (!isMatch) {
      // Atomic increment로 경쟁 조건 방지
      const { data: updated } = await adminClient.rpc("increment_temp_password_attempts", {
        p_voucher_id: voucher.id,
        p_max_attempts: VOUCHER_MAX_ATTEMPTS,
      });

      const result = updated as { new_attempts: number; is_locked: boolean } | null;
      const newAttempts = result?.new_attempts ?? voucher.temp_password_attempts + 1;
      const isNowLocked = result?.is_locked ?? newAttempts >= VOUCHER_MAX_ATTEMPTS;

      if (isNowLocked) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VOUCHER_LOCKED",
              message: "입력 횟수를 초과하여 잠금 처리되었습니다. 고객센터에 문의해주세요.",
            },
            data: { attempts: newAttempts, is_locked: true },
          },
          { status: 403 }
        );
      }

      const remaining = VOUCHER_MAX_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WRONG_PASSWORD",
            message: `임시 비밀번호가 올바르지 않습니다. (${remaining}회 더 틀리면 잠금됩니다.)`,
          },
          data: { attempts: newAttempts, remaining, is_locked: false },
        },
        { status: 401 }
      );
    }

    // ── 성공: 상태 전이 issued -> temp_verified ──
    const { error: updateError } = await adminClient
      .from("vouchers")
      .update({ status: "temp_verified" })
      .eq("id", voucher.id)
      .eq("status", "issued"); // 낙관적 잠금: issued 상태일 때만 전이

    if (updateError) {
      console.error("[verify-temp-password] Update error:", updateError.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "상태 업데이트에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { verified: true },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/verify-temp-password] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
