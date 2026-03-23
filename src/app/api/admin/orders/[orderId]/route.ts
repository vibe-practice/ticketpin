import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { AdminOrderListItem, SmsLog, CancellationReasonType, CancelStatus } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/orders/[orderId]
 *
 * 관리자 주문 상세 조회
 */
export async function GET(
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

    // 주문 + users + products 조회
    const { data: orderRaw, error: orderError } = await adminClient
      .from("orders")
      .select(
        `id, order_number, user_id, product_id, quantity, product_price, fee_type, fee_amount, total_amount,
         payment_method, pg_transaction_id, pg_ref_no, pg_tran_date, pg_pay_type,
         card_no, card_company_code, card_company_name, installment_months, approval_no,
         receiver_phone, status, created_at, updated_at,
         users!inner(id, username, name, phone),
         products(id, name, image_url)`
      )
      .eq("id", orderId)
      .single();

    if (orderError || !orderRaw) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const order = orderRaw as Record<string, unknown>;
    const user = order.users as Record<string, unknown>;
    const product = order.products as Record<string, unknown> | null;

    // 관련 데이터 병렬 조회
    const [voucherResult, cancellationResult, smsLogsResult] = await Promise.all([
      adminClient
        .from("vouchers")
        .select("id, code, user_password_hash, is_password_locked, reissue_count, status, fee_paid, fee_pg_transaction_id, fee_amount")
        .eq("order_id", orderId)
        .eq("is_gift", false)
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("cancellations")
        .select("order_id, reason_type, refund_status, refund_amount, created_at")
        .eq("order_id", orderId)
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("sms_logs")
        .select("id, voucher_id, order_id, recipient_phone, message_type, message_content, send_status, aligo_response, sent_by, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);

    const voucher = voucherResult.data;
    const cancellation = cancellationResult.data;
    const smsLogs = (smsLogsResult.data ?? []) as unknown as SmsLog[];
    const voucherId = voucher?.id as string | undefined;

    // 핀 수량 + 선물 체인
    let pinCount = 0;
    let giftChain: AdminOrderListItem["gift_chain"] = null;

    if (voucherId) {
      const pinsResult = await adminClient
        .from("pins")
        .select("id", { count: "exact", head: true })
        .eq("voucher_id", voucherId);

      pinCount = pinsResult.count ?? 0;

      // 선물 체인 추적: source_voucher_id -> new_voucher_id -> ... (최대 10회)
      // 1단계: gifts만 순차 조회하여 rawChain 구성
      const MAX_CHAIN_DEPTH = 10;
      const rawChain: Array<{
        sender_id: string;
        receiver_id: string;
        created_at: string;
        auto_recycled: boolean;
      }> = [];
      let currentVoucherId: string | null = voucherId;

      for (let i = 0; i < MAX_CHAIN_DEPTH && currentVoucherId; i++) {
        const giftResult = await adminClient
          .from("gifts")
          .select("sender_id, receiver_id, new_voucher_id, auto_recycled, created_at")
          .eq("source_voucher_id", currentVoucherId)
          .limit(1)
          .maybeSingle();

        const giftRow = giftResult.data as Record<string, unknown> | null;
        if (!giftRow) break;

        rawChain.push({
          sender_id: giftRow.sender_id as string,
          receiver_id: giftRow.receiver_id as string,
          created_at: giftRow.created_at as string,
          auto_recycled: (giftRow.auto_recycled as boolean) ?? false,
        });

        currentVoucherId = (giftRow.new_voucher_id as string) ?? null;
      }

      // 2단계: 모든 user ID를 모아서 1번만 users 조회
      if (rawChain.length > 0) {
        const allUserIds = [...new Set(rawChain.flatMap((g) => [g.sender_id, g.receiver_id]))];

        const { data: usersData } = await adminClient
          .from("users")
          .select("id, username")
          .in("id", allUserIds);

        const userMap = new Map<string, string>();
        if (usersData) {
          for (const u of usersData) {
            userMap.set(u.id, u.username);
          }
        }

        // 3단계: userMap으로 username 매핑하여 giftChain 구성
        giftChain = rawChain.map((g) => ({
          sender_username: userMap.get(g.sender_id) ?? "",
          receiver_username: userMap.get(g.receiver_id) ?? "",
          created_at: g.created_at,
          auto_recycled: g.auto_recycled,
        }));
      }
    }

    const item: AdminOrderListItem = {
      id: order.id as string,
      order_number: order.order_number as string,
      user_id: order.user_id as string,
      product_id: (order.product_id as string | null) ?? null,
      quantity: order.quantity as number,
      product_price: order.product_price as number,
      fee_type: order.fee_type as "included" | "separate",
      fee_amount: order.fee_amount as number,
      total_amount: order.total_amount as number,
      payment_method: order.payment_method as string | null,
      pg_transaction_id: order.pg_transaction_id as string | null,
      pg_ref_no: order.pg_ref_no as string | null,
      pg_tran_date: order.pg_tran_date as string | null,
      pg_pay_type: order.pg_pay_type as string | null,
      card_no: order.card_no as string | null,
      card_company_code: order.card_company_code as string | null,
      card_company_name: order.card_company_name as string | null,
      installment_months: order.installment_months as number,
      approval_no: order.approval_no as string | null,
      receiver_phone: order.receiver_phone as string,
      status: order.status as AdminOrderListItem["status"],
      created_at: order.created_at as string,
      updated_at: order.updated_at as string,
      product_name: product ? (product.name as string) : "(삭제된 상품)",
      product_image_url: product ? ((product.image_url as string) ?? null) : null,
      buyer_username: user.username as string,
      buyer_name: user.name as string,
      buyer_phone: user.phone as string,
      voucher_id: voucherId ?? null,
      voucher_code: (voucher?.code as string) ?? null,
      voucher_status: (voucher?.status as AdminOrderListItem["voucher_status"]) ?? null,
      is_password_set: voucher ? (voucher.user_password_hash as string | null) !== null : false,
      is_password_locked: voucher ? (voucher.is_password_locked as boolean) : false,
      reissue_count: voucher ? (voucher.reissue_count as number ?? 0) : 0,
      fee_paid: voucher ? (voucher.fee_paid as boolean ?? false) : false,
      fee_pg_transaction_id: voucher ? ((voucher.fee_pg_transaction_id as string) ?? null) : null,
      voucher_fee_amount: voucher ? ((voucher.fee_amount as number) ?? null) : null,
      pin_count: pinCount,
      cancellation: cancellation
        ? {
            reason_type: cancellation.reason_type as CancellationReasonType,
            refund_status: cancellation.refund_status as CancelStatus,
            refund_amount: cancellation.refund_amount as number,
            created_at: cancellation.created_at as string,
          }
        : null,
      sms_logs: smsLogs,
      gift_chain: giftChain,
    };

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("[GET /api/admin/orders/[orderId]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
