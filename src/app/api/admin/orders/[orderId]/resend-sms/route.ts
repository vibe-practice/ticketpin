import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import {
  BCRYPT_SALT_ROUNDS,
  TEMP_PW_EXPIRY_MINUTES,
  generateTempPassword,
} from "@/lib/constants";
import { sendSmsSync, buildAdminResendMessage, resolveVoucherSmsPhone } from "@/lib/sms";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/orders/[orderId]/resend-sms
 *
 * 관리자 SMS 재발송
 * - 새 임시 비밀번호 생성 + 바우처 임시 비밀번호 재설정
 * - SMS 발송 (동기 — 관리자에게 결과 반환 필요)
 * - sms_logs에 기록
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!UUID_REGEX.test(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ORDER_ID", message: "유효하지 않은 주문 ID입니다." },
        },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // 주문 조회
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_number, receiver_phone, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ORDER_CANCELLED", message: "취소된 주문에는 SMS를 재발송할 수 없습니다." },
        },
        { status: 409 }
      );
    }

    // 바우처 조회
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, code, status, is_gift, owner_id")
      .eq("order_id", orderId)
      .limit(1)
      .maybeSingle();

    if (voucherError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_NOT_FOUND", message: "연결된 바우처를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 새 임시 비밀번호 생성
    const tempPasswordPlain = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPasswordPlain, BCRYPT_SALT_ROUNDS);
    const tempPasswordExpiresAt = new Date(
      Date.now() + TEMP_PW_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    // 바우처 임시 비밀번호 업데이트 + 잠금 해제 + 시도 횟수 초기화
    const { error: updateError } = await adminClient
      .from("vouchers")
      .update({
        temp_password_hash: tempPasswordHash,
        temp_password_expires_at: tempPasswordExpiresAt,
        temp_password_attempts: 0,
        user_password_attempts: 0,
        is_password_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", voucher.id);

    if (updateError) {
      console.error("[POST /api/admin/orders/[orderId]/resend-sms] 바우처 업데이트 실패:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "임시 비밀번호 재설정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // SMS 수신자 결정: 선물 바우처면 수신자(owner) 번호로 발송
    const smsPhone = await resolveVoucherSmsPhone(adminClient, order.receiver_phone, voucher);

    // SMS 발송 (동기) — smsPhone이 null이면 SMS 미발송
    let smsResult: { success: boolean; smsLogId?: string | null } = { success: false };
    if (smsPhone) {
      const smsMessage = buildAdminResendMessage({
        voucherCode: voucher.code,
        tempPassword: tempPasswordPlain,
      });

      smsResult = await sendSmsSync({
        recipientPhone: smsPhone,
        messageContent: smsMessage,
        messageType: "admin_resend",
        voucherId: voucher.id,
        orderId,
        sentBy: "admin",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        voucher_id: voucher.id,
        sms_sent: smsResult.success,
        sms_log_id: smsResult.smsLogId ?? null,
        temp_password_expires_at: tempPasswordExpiresAt,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/orders/[orderId]/resend-sms] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
