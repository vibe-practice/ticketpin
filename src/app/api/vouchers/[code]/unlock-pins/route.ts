import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema, unlockPinsSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { decryptPin } from "@/lib/crypto/pin";
import { VOUCHER_MAX_ATTEMPTS } from "@/lib/constants";

// Rate limit: IP당 분당 10회
const UNLOCK_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

/**
 * POST /api/vouchers/[code]/unlock-pins
 *
 * 사용자 비밀번호 검증 후 핀 번호 복호화 반환
 * - 비밀번호 검증 (bcrypt)
 * - 5회 실패 시 잠금
 * - 성공 시 핀 N개 AES-256-GCM 복호화하여 반환
 * - 바우처 상태: password_set -> pin_revealed
 * - 핀 상태: assigned -> consumed
 * - 이미 pin_revealed인 경우 재조회 허용
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
    const rateLimitResult = await checkRateLimit(`unlock-pins:${ip}`, UNLOCK_RATE_LIMIT);
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

    const parsed = unlockPinsSchema.safeParse(body);
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
      .select(
        `id, order_id, status, user_password_hash, user_password_attempts, is_password_locked, fee_paid,
        orders!inner ( fee_type, fee_amount )`
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
          error: { code: "VOUCHER_LOCKED", message: "비밀번호 입력이 잠겼습니다. 고객센터에 문의해주세요." },
        },
        { status: 403 }
      );
    }

    // password_set 또는 pin_revealed 상태만 허용 (pin_revealed는 재조회)
    if (voucher.status !== "password_set" && voucher.status !== "pin_revealed") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "비밀번호를 먼저 설정해주세요.",
          },
        },
        { status: 400 }
      );
    }

    if (!voucher.user_password_hash) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_PASSWORD", message: "비밀번호가 설정되지 않았습니다." },
        },
        { status: 400 }
      );
    }

    // ── bcrypt 비교 ──
    const isMatch = await bcrypt.compare(password, voucher.user_password_hash);

    if (!isMatch) {
      // Atomic increment로 경쟁 조건 방지
      const { data: updated } = await adminClient.rpc("increment_voucher_password_attempts", {
        p_voucher_id: voucher.id,
        p_max_attempts: VOUCHER_MAX_ATTEMPTS,
      });

      const result = updated as { new_attempts: number; is_locked: boolean } | null;
      const newAttempts = result?.new_attempts ?? voucher.user_password_attempts + 1;
      const isNowLocked = result?.is_locked ?? newAttempts >= VOUCHER_MAX_ATTEMPTS;

      if (isNowLocked) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VOUCHER_LOCKED",
              message: `비밀번호를 ${VOUCHER_MAX_ATTEMPTS}회 잘못 입력하여 잠금 처리되었습니다. 고객센터에 문의해주세요.`,
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
            message: `비밀번호가 올바르지 않습니다. (${remaining}회 남음)`,
          },
          data: { attempts: newAttempts, remaining, is_locked: false },
        },
        { status: 401 }
      );
    }

    // ── 핀 조회 + 복호화 ──
    const { data: pins, error: pinsError } = await adminClient
      .from("pins")
      .select("id, pin_number_encrypted, status")
      .eq("voucher_id", voucher.id)
      .order("created_at", { ascending: true });

    if (pinsError || !pins || pins.length === 0) {
      console.error("[unlock-pins] Pins query error:", pinsError?.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "PINS_NOT_FOUND", message: "핀 번호를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 복호화
    const decryptedPins: string[] = [];
    for (const pin of pins) {
      try {
        const decrypted = decryptPin(pin.pin_number_encrypted);
        decryptedPins.push(decrypted);
      } catch (decryptError) {
        console.error("[unlock-pins] Decrypt error for pin:", pin.id, decryptError);
        return NextResponse.json(
          {
            success: false,
            error: { code: "DECRYPT_FAILED", message: "핀 번호 복호화에 실패했습니다." },
          },
          { status: 500 }
        );
      }
    }

    // ── 상태 전이 (최초 조회 시에만) ──
    if (voucher.status === "password_set") {
      // 수수료 별도 결제가 필요한 경우 → 상태 전이 스킵 (fee-payment/confirm에서 처리)
      const order = voucher.orders as unknown as { fee_type: string; fee_amount: number };
      const needsFeePay = order.fee_type === "separate" && !voucher.fee_paid && order.fee_amount > 0;

      if (!needsFeePay) {
        // 수수료 불필요 또는 이미 결제됨 → 원자적 상태 전이 (RPC)
        const { data: rpcResult, error: rpcError } = await adminClient.rpc(
          "reveal_pins",
          {
            p_voucher_id: voucher.id,
            p_order_id: voucher.order_id,
          }
        );

        if (rpcError || !rpcResult?.success) {
          // 이미 pin_revealed인 경우는 멱등성으로 성공 처리됨
          if (!rpcResult?.already_revealed) {
            console.error("[unlock-pins] reveal_pins RPC failed:", {
              rpcError: rpcError?.message,
              rpcResult,
            });
          }
        }
      } else {
        // 수수료 결제 필요 → 시도 횟수만 리셋 (상태 전이는 fee-payment/confirm에서 처리)
        await adminClient
          .from("vouchers")
          .update({ user_password_attempts: 0 })
          .eq("id", voucher.id);
      }
    } else {
      // pin_revealed 재조회: 시도 횟수만 리셋
      await adminClient
        .from("vouchers")
        .update({ user_password_attempts: 0 })
        .eq("id", voucher.id);
    }

    console.log(`[unlock-pins] 핀 복호화 완료: voucherId=${voucher.id}, code=${code}, pinCount=${decryptedPins.length}`);

    // 검증 토큰 발급 (모바일 수수료 결제 리다이렉트 시 비밀번호 대체용)
    let verificationToken: string | undefined;
    try {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error: tokenError } = await adminClient
        .from("pin_verification_tokens")
        .insert({
          token,
          voucher_id: voucher.id,
          voucher_code: code,
        });

      if (!tokenError) {
        verificationToken = token;
      } else {
        console.error("[unlock-pins] 검증 토큰 생성 실패:", tokenError.message);
      }
    } catch (tokenErr) {
      console.error("[unlock-pins] 검증 토큰 생성 중 예외:", tokenErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        pins: decryptedPins,
        pin_count: decryptedPins.length,
        ...(verificationToken ? { verification_token: verificationToken } : {}),
      },
    });
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/unlock-pins] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
