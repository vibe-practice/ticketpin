import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type {
  AdminOrderListItem,
  AdminGiftListItem,
  AdminUserListItem,
  SmsLog,
  CancellationReasonType,
  CancelStatus,
  VoucherStatus,
  FeeType,
} from "@/types";
import { ACTIVE_VOUCHER_STATUSES } from "@/lib/voucher-status";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/members/[memberId]
 *
 * 관리자 회원 상세 조회
 * - 회원 기본 정보 (AdminUserListItem)
 * - 구매 내역 (AdminOrderListItem[])
 * - 선물 내역 (AdminGiftListItem[])
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    if (!UUID_REGEX.test(memberId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_MEMBER_ID", message: "유효하지 않은 회원 ID입니다." },
        },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // ── 1. 회원 기본 정보 조회 ──
    const { data: userRaw, error: userError } = await adminClient
      .from("users")
      .select(
        "id, auth_id, username, email, name, phone, identity_verified, status, total_purchase_count, total_purchase_amount, created_at, updated_at"
      )
      .eq("id", memberId)
      .single();

    if (userError || !userRaw) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MEMBER_NOT_FOUND", message: "회원을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 2. 카운트 + 주문 + 선물 병렬 조회 ──
    const [
      voucherCountResult,
      giftSentCountResult,
      giftReceivedCountResult,
      orderSummaryResult,
      ordersResult,
      giftsResult,
    ] = await Promise.all([
      // 바우처 수 (사용 가능 상태만 — 마이페이지와 동일)
      adminClient
        .from("vouchers")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", memberId)
        .in("status", ACTIVE_VOUCHER_STATUSES),
      // 선물 보낸 수
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", memberId),
      // 선물 받은 수
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", memberId),
      // 주문 요약 (건수 + 금액, DB 레벨 집계 — 마이페이지와 동일 RPC)
      adminClient.rpc("get_user_order_summary", { p_user_id: memberId }).single(),
      // 주문 내역 (최근 50건)
      adminClient
        .from("orders")
        .select(
          `id, order_number, user_id, product_id, quantity, product_price, fee_type, fee_amount, total_amount,
           payment_method, pg_transaction_id, pg_ref_no, pg_tran_date, pg_pay_type,
           card_no, card_company_code, card_company_name, installment_months, approval_no,
           receiver_phone, status, created_at, updated_at,
           products(id, name, image_url)`
        )
        .eq("user_id", memberId)
        .order("created_at", { ascending: false })
        .limit(50),
      // 선물 내역
      adminClient
        .from("gifts")
        .select(
          `id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, created_at`
        )
        .or(`sender_id.eq.${memberId},receiver_id.eq.${memberId}`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // ── 3. 회원 정보 매핑 ──
    const orderSummary = orderSummaryResult.data as { order_count: number; total_amount: number } | null;
    const member: AdminUserListItem = {
      ...(userRaw as AdminUserListItem),
      order_count: orderSummary?.order_count ?? 0,
      total_purchase_count: orderSummary?.order_count ?? 0,
      total_purchase_amount: orderSummary?.total_amount ?? 0,
      voucher_count: voucherCountResult.count ?? 0,
      gift_sent_count: giftSentCountResult.count ?? 0,
      gift_received_count: giftReceivedCountResult.count ?? 0,
    };

    // ── 4. 주문 내역 매핑 (AdminOrderListItem) ──
    const ordersRaw = ordersResult.data ?? [];
    let orders: AdminOrderListItem[] = [];

    if (ordersRaw.length > 0) {
      const orderIds = ordersRaw.map((o) => o.id as string);

      // 관련 데이터 병렬 조회
      const [vouchersRes, cancellationsRes, smsLogsRes] = await Promise.all([
        adminClient
          .from("vouchers")
          .select("id, code, order_id, user_password_hash, is_password_locked, reissue_count, status, fee_paid, fee_pg_transaction_id, fee_amount, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false }),
        adminClient
          .from("cancellations")
          .select("order_id, reason_type, refund_status, refund_amount, created_at")
          .in("order_id", orderIds),
        adminClient
          .from("sms_logs")
          .select("id, voucher_id, order_id, recipient_phone, message_type, message_content, send_status, aligo_response, sent_by, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false }),
      ]);

      const vouchersData = vouchersRes.data ?? [];
      const voucherIds = vouchersData.map((v) => v.id as string).filter(Boolean);

      // 핀 수량 + 선물 정보
      const [pinsRes, orderGiftsRes] = await Promise.all([
        voucherIds.length > 0
          ? adminClient.from("pins").select("voucher_id").in("voucher_id", voucherIds)
          : Promise.resolve({ data: [] as { voucher_id: string }[] }),
        voucherIds.length > 0
          ? adminClient.from("gifts").select("id, source_voucher_id, sender_id, receiver_id, auto_recycled, created_at").in("source_voucher_id", voucherIds)
          : Promise.resolve({ data: [] as { id: string; source_voucher_id: string; sender_id: string; receiver_id: string; auto_recycled: boolean; created_at: string }[] }),
      ]);

      // 선물 송수신자 정보
      const orderGiftsData = orderGiftsRes.data ?? [];
      const giftUserIds = [
        ...new Set([
          ...orderGiftsData.map((g) => g.sender_id as string),
          ...orderGiftsData.map((g) => g.receiver_id as string),
        ]),
      ];
      let giftUsersMap: Record<string, string> = {};
      if (giftUserIds.length > 0) {
        const { data: giftUsers } = await adminClient
          .from("users")
          .select("id, username")
          .in("id", giftUserIds);
        if (giftUsers) {
          giftUsersMap = Object.fromEntries(giftUsers.map((r) => [r.id, r.username]));
        }
      }

      // 인덱스 맵 구성
      const voucherByOrderId = new Map<string, (typeof vouchersData)[0]>();
      for (const v of vouchersData) {
        const oid = v.order_id as string;
        if (!voucherByOrderId.has(oid)) {
          voucherByOrderId.set(oid, v);
        }
      }
      const cancellationByOrderId = new Map(
        (cancellationsRes.data ?? []).map((c) => [c.order_id, c])
      );
      const smsLogsByOrderId = new Map<string, SmsLog[]>();
      for (const log of (smsLogsRes.data ?? [])) {
        const oid = log.order_id as string;
        if (!smsLogsByOrderId.has(oid)) {
          smsLogsByOrderId.set(oid, []);
        }
        smsLogsByOrderId.get(oid)!.push(log as unknown as SmsLog);
      }
      const pinCountByVoucherId = new Map<string, number>();
      for (const pin of (pinsRes.data ?? [])) {
        const vid = pin.voucher_id as string;
        pinCountByVoucherId.set(vid, (pinCountByVoucherId.get(vid) ?? 0) + 1);
      }
      const giftByVoucherId = new Map(
        orderGiftsData.map((g) => [g.source_voucher_id, g])
      );

      // AdminOrderListItem 조합
      orders = ordersRaw.map((raw) => {
        const order = raw as Record<string, unknown>;
        const product = order.products as Record<string, unknown> | null;
        const orderId = order.id as string;

        const voucher = voucherByOrderId.get(orderId);
        const cancellation = cancellationByOrderId.get(orderId);
        const smsLogs = smsLogsByOrderId.get(orderId) ?? [];
        const voucherId = voucher?.id as string | undefined;
        const gift = voucherId ? giftByVoucherId.get(voucherId) : undefined;

        return {
          id: orderId,
          order_number: order.order_number as string,
          user_id: order.user_id as string,
          product_id: (order.product_id as string | null) ?? null,
          quantity: order.quantity as number,
          product_price: order.product_price as number,
          fee_type: order.fee_type as FeeType,
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
          // 확장 필드
          product_name: product ? (product.name as string) : "(삭제된 상품)",
          product_image_url: product ? ((product.image_url as string) ?? null) : null,
          buyer_username: userRaw.username as string,
          buyer_name: userRaw.name as string,
          buyer_phone: userRaw.phone as string,
          voucher_id: voucherId ?? null,
          voucher_code: (voucher?.code as string) ?? null,
          voucher_status: (voucher?.status as VoucherStatus) ?? null,
          is_password_set: voucher ? (voucher.user_password_hash as string | null) !== null : false,
          is_password_locked: voucher ? (voucher.is_password_locked as boolean) : false,
          reissue_count: voucher ? (voucher.reissue_count as number ?? 0) : 0,
          fee_paid: voucher ? (voucher.fee_paid as boolean ?? false) : false,
          fee_pg_transaction_id: voucher ? ((voucher.fee_pg_transaction_id as string) ?? null) : null,
          voucher_fee_amount: voucher ? ((voucher.fee_amount as number) ?? null) : null,
          pin_count: voucherId ? (pinCountByVoucherId.get(voucherId) ?? 0) : 0,
          cancellation: cancellation
            ? {
                reason_type: cancellation.reason_type as CancellationReasonType,
                refund_status: cancellation.refund_status as CancelStatus,
                refund_amount: cancellation.refund_amount as number,
                created_at: cancellation.created_at as string,
              }
            : null,
          sms_logs: smsLogs,
          gift_chain: gift
            ? [{
                sender_username: giftUsersMap[gift.sender_id as string] ?? "",
                receiver_username: giftUsersMap[gift.receiver_id as string] ?? "",
                created_at: gift.created_at as string,
                auto_recycled: (gift.auto_recycled as boolean) ?? false,
              }]
            : null,
        };
      });
    }

    // ── 5. 선물 내역 매핑 (AdminGiftListItem) ──
    const giftsRaw = giftsResult.data ?? [];
    let gifts: AdminGiftListItem[] = [];

    if (giftsRaw.length > 0) {
      // 관련 사용자/상품/바우처/주문 정보 수집
      const relatedUserIds = new Set<string>();
      const relatedProductIds = new Set<string>();
      const relatedVoucherIds = new Set<string>();

      for (const g of giftsRaw) {
        relatedUserIds.add(g.sender_id as string);
        relatedUserIds.add(g.receiver_id as string);
        if (g.product_id) relatedProductIds.add(g.product_id as string);
        if (g.source_voucher_id) relatedVoucherIds.add(g.source_voucher_id as string);
        if (g.new_voucher_id) relatedVoucherIds.add(g.new_voucher_id as string);
      }

      const [usersRes, productsRes, vouchersRes] = await Promise.all([
        adminClient
          .from("users")
          .select("id, username, name, phone")
          .in("id", [...relatedUserIds]),
        adminClient
          .from("products")
          .select("id, name, price")
          .in("id", [...relatedProductIds]),
        relatedVoucherIds.size > 0
          ? adminClient
              .from("vouchers")
              .select("id, code, order_id, status")
              .in("id", [...relatedVoucherIds])
          : Promise.resolve({ data: [] as { id: string; code: string; order_id: string; status: string }[] }),
      ]);

      const usersMap = new Map(
        (usersRes.data ?? []).map((u) => [u.id as string, u as Record<string, unknown>])
      );
      const productsMap = new Map(
        (productsRes.data ?? []).map((p) => [p.id as string, p as Record<string, unknown>])
      );
      const vouchersMap = new Map(
        (vouchersRes.data ?? []).map((v) => [v.id as string, v as Record<string, unknown>])
      );

      // 주문 정보 (수수료, 수량 등)
      const orderIds = new Set<string>();
      for (const v of (vouchersRes.data ?? [])) {
        if (v.order_id) orderIds.add(v.order_id as string);
      }

      let ordersMap = new Map<string, Record<string, unknown>>();
      if (orderIds.size > 0) {
        const { data: orderData } = await adminClient
          .from("orders")
          .select("id, quantity, fee_type, fee_amount, total_amount")
          .in("id", [...orderIds]);
        if (orderData) {
          ordersMap = new Map(orderData.map((o) => [o.id as string, o as Record<string, unknown>]));
        }
      }

      gifts = giftsRaw.map((g) => {
        const sender = usersMap.get(g.sender_id as string);
        const receiver = usersMap.get(g.receiver_id as string);
        const product = productsMap.get(g.product_id as string);
        const sourceVoucher = vouchersMap.get(g.source_voucher_id as string);
        const newVoucher = vouchersMap.get(g.new_voucher_id as string);
        const orderInfo = sourceVoucher ? ordersMap.get(sourceVoucher.order_id as string) : undefined;

        return {
          id: g.id as string,
          sender_id: g.sender_id as string,
          receiver_id: g.receiver_id as string,
          source_voucher_id: g.source_voucher_id as string,
          new_voucher_id: g.new_voucher_id as string,
          product_id: (g.product_id as string | null) ?? null,
          created_at: g.created_at as string,
          // 확장 필드
          sender_username: (sender?.username as string) ?? "",
          sender_name: (sender?.name as string) ?? "",
          sender_phone: (sender?.phone as string) ?? "",
          receiver_username: (receiver?.username as string) ?? "",
          receiver_name: (receiver?.name as string) ?? "",
          receiver_phone: (receiver?.phone as string) ?? "",
          product_name: (product?.name as string) ?? "",
          product_price: (product?.price as number) ?? 0,
          source_voucher_code: (sourceVoucher?.code as string) ?? "",
          new_voucher_code: (newVoucher?.code as string) ?? "",
          new_voucher_status: (newVoucher?.status as VoucherStatus) ?? "issued",
          order_quantity: (orderInfo?.quantity as number) ?? 0,
          fee_amount: (orderInfo?.fee_amount as number) ?? 0,
          fee_type: (orderInfo?.fee_type as FeeType) ?? "included",
          total_amount: (orderInfo?.total_amount as number) ?? 0,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        member,
        orders,
        gifts,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/members/[memberId]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
