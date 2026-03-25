import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { decryptPin } from "@/lib/crypto/pin";
import { z } from "zod";

// Rate limit: IP당 분당 10회
const RETRIEVE_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

const retrievePinsSchema = z.object({
  verification_token: z.string().min(1, "검증 토큰이 필요합니다."),
});

/**
 * POST /api/vouchers/[code]/retrieve-pins
 *
 * 검증 토큰 기반 핀 번호 조회 API
 * - 모바일 수수료 결제 후 리다이렉트 복귀 시 사용
 * - 비밀번호 대신 검증 토큰으로 인증
 * - 토큰은 일회용 (사용 후 used=true 처리)
 * - TTL: 10분
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
    const rateLimitResult = await checkRateLimit(`retrieve-pins:${ip}`, RETRIEVE_RATE_LIMIT);
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

    const parsed = retrievePinsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "검증 토큰이 올바르지 않습니다." },
        },
        { status: 422 }
      );
    }

    const { verification_token } = parsed.data;

    // ── 검증 토큰 조회 + 유효성 확인 ──
    const adminClient = createAdminClient();

    const { data: tokenData, error: tokenError } = await adminClient
      .from("pin_verification_tokens")
      .select("id, voucher_id, voucher_code, expires_at, used")
      .eq("token", verification_token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_TOKEN", message: "유효하지 않은 검증 토큰입니다." },
        },
        { status: 401 }
      );
    }

    // 만료 체크
    if (new Date(tokenData.expires_at) < new Date()) {
      // 만료된 토큰 삭제
      await adminClient.from("pin_verification_tokens").delete().eq("id", tokenData.id);
      return NextResponse.json(
        {
          success: false,
          error: { code: "TOKEN_EXPIRED", message: "검증 토큰이 만료되었습니다. 비밀번호를 다시 입력해주세요." },
        },
        { status: 401 }
      );
    }

    // 이미 사용된 토큰 체크
    if (tokenData.used) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "TOKEN_USED", message: "이미 사용된 검증 토큰입니다." },
        },
        { status: 401 }
      );
    }

    // 바우처 코드 일치 확인
    if (tokenData.voucher_code !== code) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CODE_MISMATCH", message: "바우처 코드가 일치하지 않습니다." },
        },
        { status: 403 }
      );
    }

    // 토큰 사용 처리
    await adminClient
      .from("pin_verification_tokens")
      .update({ used: true })
      .eq("id", tokenData.id);

    // ── 핀 조회 + 복호화 ──
    const { data: pins, error: pinsError } = await adminClient
      .from("pins")
      .select("id, pin_number_encrypted")
      .eq("voucher_id", tokenData.voucher_id)
      .order("created_at", { ascending: true });

    if (pinsError || !pins || pins.length === 0) {
      console.error("[retrieve-pins] Pins query error:", pinsError?.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "PINS_NOT_FOUND", message: "핀 번호를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const decryptedPins: string[] = [];
    for (const pin of pins) {
      try {
        const decrypted = decryptPin(pin.pin_number_encrypted);
        decryptedPins.push(decrypted);
      } catch (decryptError) {
        console.error("[retrieve-pins] Decrypt error for pin:", pin.id, decryptError);
        return NextResponse.json(
          {
            success: false,
            error: { code: "DECRYPT_FAILED", message: "핀 번호 복호화에 실패했습니다." },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        pins: decryptedPins,
        pin_count: decryptedPins.length,
      },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/retrieve-pins] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
