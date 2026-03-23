import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/dashboard/recent-orders
 * 대시보드용 최근 주문 목록 (최신 10건)
 *
 * 반환: AdminOrderListItem[] 형태
 */
export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { adminClient } = auth;

    // 최근 주문 10건 조회 (products, users, vouchers JOIN)
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select(`
        id, order_number, user_id, product_id, quantity,
        product_price, fee_type, fee_amount, total_amount,
        payment_method, pg_transaction_id, receiver_phone,
        status, created_at, updated_at,
        products(name, image_url),
        users(username, name, phone)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (ordersError) {
      console.error("[GET /api/admin/dashboard/recent-orders] Orders query error:", ordersError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QUERY_ERROR",
            message: "최근 주문 조회에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    const orderList = orders ?? [];

    // 주문 ID 목록으로 바우처 정보 일괄 조회
    const orderIds = orderList.map((o) => o.id);

    const voucherMap = new Map<
      string,
      {
        id: string;
        code: string;
        status: string;
        is_password_locked: boolean;
        reissue_count: number;
        user_password_hash: string | null;
      }
    >();
    const cancelMap = new Map<
      string,
      {
        reason_type: string;
        refund_status: string;
        refund_amount: number;
        created_at: string;
      }
    >();
    const smsMap = new Map<string, Array<Record<string, unknown>>>();
    const giftMap = new Map<
      string,
      {
        id: string;
        receiver_id: string;
        created_at: string;
        receiver_username: string;
      }
    >();
    const pinCountMap = new Map<string, number>();

    if (orderIds.length > 0) {
      // 바우처, 취소, SMS 병렬 조회
      const [voucherResult, cancelResult, smsResult] =
        await Promise.all([
          adminClient
            .from("vouchers")
            .select(
              "id, code, status, is_password_locked, reissue_count, user_password_hash, order_id"
            )
            .in("order_id", orderIds),

          adminClient
            .from("cancellations")
            .select("order_id, reason_type, refund_status, refund_amount, created_at")
            .in("order_id", orderIds),

          adminClient
            .from("sms_logs")
            .select("order_id, id, message_type, send_status, created_at")
            .in("order_id", orderIds),
        ]);

      // 바우처 매핑 (order_id -> voucher)
      for (const v of voucherResult.data ?? []) {
        voucherMap.set(v.order_id as string, {
          id: v.id,
          code: v.code,
          status: v.status,
          is_password_locked: v.is_password_locked,
          reissue_count: v.reissue_count,
          user_password_hash: v.user_password_hash,
        });
      }

      // 취소 매핑
      for (const c of cancelResult.data ?? []) {
        cancelMap.set(c.order_id as string, {
          reason_type: c.reason_type,
          refund_status: c.refund_status,
          refund_amount: c.refund_amount,
          created_at: c.created_at,
        });
      }

      // SMS 매핑
      for (const s of smsResult.data ?? []) {
        const orderId = s.order_id as string;
        if (!smsMap.has(orderId)) smsMap.set(orderId, []);
        smsMap.get(orderId)!.push(s);
      }

      // 바우처 ID 목록으로 선물 + 핀 카운트 병렬 조회
      const voucherIds = Array.from(voucherMap.values()).map((v) => v.id);
      const voucherToOrder = new Map<string, string>();
      for (const [orderId, v] of voucherMap.entries()) {
        voucherToOrder.set(v.id, orderId);
      }

      if (voucherIds.length > 0) {
        const [giftResult, pinResult] = await Promise.all([
          adminClient
            .from("gifts")
            .select(
              "source_voucher_id, id, receiver_id, created_at, users!gifts_receiver_id_fkey(username)"
            )
            .in("source_voucher_id", voucherIds),

          adminClient
            .from("pins")
            .select("voucher_id")
            .in("voucher_id", voucherIds),
        ]);

        // 선물 매핑 (source_voucher_id -> order_id 역매핑)
        for (const g of giftResult.data ?? []) {
          const orderId = voucherToOrder.get(g.source_voucher_id as string);
          if (orderId) {
            const receiver = g.users as unknown as { username: string } | null;
            giftMap.set(orderId, {
              id: g.id,
              receiver_id: g.receiver_id,
              created_at: g.created_at,
              receiver_username: receiver?.username ?? "",
            });
          }
        }

        // 핀 카운트 (voucher_id -> order_id 매핑)
        for (const p of pinResult.data ?? []) {
          const orderId = voucherToOrder.get(p.voucher_id as string);
          if (orderId) {
            pinCountMap.set(orderId, (pinCountMap.get(orderId) ?? 0) + 1);
          }
        }
      }
    }

    // AdminOrderListItem 형태로 조합
    const recentOrders = orderList.map((order) => {
      const product = order.products as unknown as {
        name: string;
        image_url: string | null;
      } | null;
      const user = order.users as unknown as {
        username: string;
        name: string;
        phone: string;
      } | null;
      const voucher = voucherMap.get(order.id);
      const cancellation = cancelMap.get(order.id) ?? null;
      const smsLogs = smsMap.get(order.id) ?? [];
      const gift = giftMap.get(order.id) ?? null;
      const pinCount = pinCountMap.get(order.id) ?? 0;

      return {
        id: order.id,
        order_number: order.order_number,
        user_id: order.user_id,
        product_id: order.product_id,
        quantity: order.quantity,
        product_price: order.product_price,
        fee_type: order.fee_type,
        fee_amount: order.fee_amount,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        pg_transaction_id: order.pg_transaction_id,
        receiver_phone: order.receiver_phone,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        // 확장 필드
        product_name: product?.name ?? "알 수 없는 상품",
        product_image_url: product?.image_url ?? null,
        buyer_username: user?.username ?? "",
        buyer_name: user?.name ?? "",
        buyer_phone: user?.phone ?? "",
        voucher_id: voucher?.id ?? null,
        voucher_code: voucher?.code ?? null,
        voucher_status: voucher?.status ?? null,
        is_password_set: !!voucher?.user_password_hash,
        is_password_locked: voucher?.is_password_locked ?? false,
        reissue_count: voucher?.reissue_count ?? 0,
        pin_count: pinCount,
        cancellation,
        sms_logs: smsLogs,
        gift,
      };
    });

    return NextResponse.json({ success: true, data: recentOrders });
  } catch (err) {
    console.error("[GET /api/admin/dashboard/recent-orders] Unexpected error:", err);
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
