import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { sendSmsSync, buildPasswordResetMessage, resolveVoucherSmsPhone } from "@/lib/sms";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/orders/[orderId]/reset-password
 *
 * 사용자 비밀번호(4자리) 초기화
 * - user_password_hash → null
 * - user_password_attempts → 0
 * - is_password_locked → false
 * - voucher status → temp_verified (비밀번호 재설정 필요 상태)
 * - 새 임시 비밀번호 생성 + SMS 발송
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
      .select("id, receiver_phone, status")
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
          error: { code: "ORDER_CANCELLED", message: "취소된 주문의 비밀번호는 초기화할 수 없습니다." },
        },
        { status: 409 }
      );
    }

    // 바우처 조회
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, code, user_password_hash, status, is_gift, owner_id")
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

    // 비밀번호가 설정되지 않은 경우
    if (voucher.user_password_hash === null) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PASSWORD_NOT_SET", message: "비밀번호가 설정되지 않은 바우처입니다." },
        },
        { status: 409 }
      );
    }

    // 바우처 업데이트: 비밀번호 초기화 (기존 임시 비밀번호도 무효화)
    // temp_verified 상태로 변경되면 사용자는 링크 접속 시 바로 새 비밀번호 설정 페이지로 이동
    const { error: updateError } = await adminClient
      .from("vouchers")
      .update({
        user_password_hash: null,
        user_password_attempts: 0,
        is_password_locked: false,
        temp_password_hash: null,
        temp_password_expires_at: null,
        temp_password_attempts: 0,
        status: "temp_verified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", voucher.id);

    if (updateError) {
      console.error("[POST /api/admin/orders/[orderId]/reset-password] 바우처 업데이트 실패:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "비밀번호 초기화에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 주문 상태도 업데이트 (password_set/pin_revealed -> paid로 롤백)
    if (order.status === "password_set" || order.status === "pin_revealed") {
      const { error: orderUpdateError } = await adminClient
        .from("orders")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (orderUpdateError) {
        console.error("[reset-password] 주문 상태 롤백 실패:", orderUpdateError);
      }
    }

    // SMS 수신자 결정: 선물 바우처면 수신자(owner) 번호로 발송
    const smsPhone = await resolveVoucherSmsPhone(adminClient, order.receiver_phone, voucher);

    // SMS 발송 (동기) — smsPhone이 null이면 SMS 미발송 (선물 수신자 번호 조회 실패)
    let smsResult: { success: boolean; smsLogId?: string | null } = { success: false };
    if (smsPhone) {
      const smsMessage = buildPasswordResetMessage({
        voucherCode: voucher.code,
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
        new_voucher_status: "temp_verified",
        sms_sent: smsResult.success,
        sms_log_id: smsResult.smsLogId ?? null,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/orders/[orderId]/reset-password] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
