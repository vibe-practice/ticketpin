import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

/**
 * GET /api/mypage/orders
 *
 * 구매 내역 목록 조회 (서버사이드 필터/페이징).
 *
 * 쿼리 파라미터:
 * - page (number, default: 1)
 * - limit (number, default: 5, max: 50)
 * - status ("all" | "active" | "cancelled", default: "all")
 * - date_from (ISO 8601, optional)
 * - date_to (ISO 8601, optional)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;
    const { searchParams } = request.nextUrl;

    // ── 페이징 파라미터 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const statusFilter = searchParams.get("status") ?? "all";
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    // ── 주문 목록 쿼리 (상품 JOIN) ──
    let query = adminClient
      .from("orders")
      .select(
        `id, order_number, user_id, product_id, quantity, product_price,
         fee_type, fee_amount, total_amount, payment_method, pg_transaction_id,
         receiver_phone, status, created_at, updated_at,
         installment_months, approval_no, card_no, card_company_code, card_company_name,
         products:product_id (id, name, price, fee_rate, fee_unit, image_url)`,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 상태 필터
    if (statusFilter === "active") {
      query = query.neq("status", "cancelled");
    } else if (statusFilter === "cancelled") {
      query = query.eq("status", "cancelled");
    }

    // 기간 필터
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      // dateTo에 시간이 없으면 해당일 끝까지 포함
      const toDate = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", toDate);
    }

    // 페이징
    query = query.range(from, to);

    const { data: orders, count, error: ordersError } = await query;

    if (ordersError) {
      console.error("[GET /api/mypage/orders] Query error:", ordersError.message);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "주문 목록 조회 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      const emptyTotal = count ?? 0;
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: emptyTotal,
          page,
          limit,
          total_pages: Math.ceil(emptyTotal / limit),
        },
      });
    }

    // ── 주문별 바우처 + 취소 + 선물 정보 병렬 조회 ──
    const orderIds = orders.map((o) => (o as Record<string, unknown>).id as string);
    const cancelledOrderIds = orders
      .filter((o) => (o as Record<string, unknown>).status === "cancelled")
      .map((o) => (o as Record<string, unknown>).id as string);

    // 바우처에서 gifted 상태인 것의 선물 정보도 필요하므로, 바우처 ID 목록을 먼저 확보해야 함
    // 그러나 gift는 source_voucher_id 기반이므로 바우처 결과에 의존 → 2단계로 분리
    const [vouchersResult, cancellationsResult] = await Promise.all([
      adminClient.from("vouchers").select("id, code, order_id, status").in("order_id", orderIds),
      cancelledOrderIds.length > 0
        ? adminClient.from("cancellations").select("order_id, reason_type, refund_status, refund_amount, created_at").in("order_id", cancelledOrderIds)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (vouchersResult.error) {
      console.error("[GET /api/mypage/orders] Vouchers error:", vouchersResult.error.message);
    }
    if (cancellationsResult.error) {
      console.error("[GET /api/mypage/orders] Cancellations error:", cancellationsResult.error.message);
    }

    // 바우처 매핑: 원본 바우처(gifted 상태)를 우선 사용
    // 선물 완료 시 같은 order_id에 원본(gifted)과 새 바우처(issued)가 공존하므로
    // 구매자 본인의 원본 바우처를 보여줘야 선물 완료 상태가 정상 표시됨
    const voucherByOrderId = new Map<string, { id: string; code: string; status: string }>();
    if (vouchersResult.data) {
      for (const v of vouchersResult.data) {
        const vRecord = v as Record<string, unknown>;
        const orderId = vRecord.order_id as string;
        const existing = voucherByOrderId.get(orderId);
        const current = {
          id: vRecord.id as string,
          code: vRecord.code as string,
          status: vRecord.status as string,
        };
        if (!existing || (existing.status !== "gifted" && current.status === "gifted")) {
          voucherByOrderId.set(orderId, current);
        }
      }
    }

    // 취소 정보 매핑
    const cancellationMap = new Map<
      string,
      { reason_type: string; refund_status: string; refund_amount: number; created_at: string }
    >();
    if (cancellationsResult.data) {
      for (const c of cancellationsResult.data) {
        const cRecord = c as Record<string, unknown>;
        cancellationMap.set(cRecord.order_id as string, {
          reason_type: cRecord.reason_type as string,
          refund_status: cRecord.refund_status as string,
          refund_amount: cRecord.refund_amount as number,
          created_at: cRecord.created_at as string,
        });
      }
    }

    // ── 선물 수신자 정보 (gifted 상태 바우처 기반, 바우처 결과에 의존) ──
    const giftedVoucherIds = Array.from(voucherByOrderId.entries())
      .filter(([, v]) => v.status === "gifted")
      .map(([, v]) => v.id);

    const giftReceiverMap = new Map<string, { username: string; name: string }>();

    if (giftedVoucherIds.length > 0) {
      const { data: giftRecords, error: giftError } = await adminClient
        .from("gifts")
        .select("source_voucher_id, receiver_id, receiver:receiver_id (username, name)")
        .in("source_voucher_id", giftedVoucherIds);

      if (giftError) {
        console.error("[GET /api/mypage/orders] Gift error:", giftError.message);
      }

      if (giftRecords) {
        for (const g of giftRecords) {
          const gRecord = g as Record<string, unknown>;
          const receiver = gRecord.receiver as Record<string, unknown> | null;
          if (receiver) {
            giftReceiverMap.set(gRecord.source_voucher_id as string, {
              username: receiver.username as string,
              name: receiver.name as string,
            });
          }
        }
      }
    }

    // ── 응답 데이터 매핑 ──
    const items = orders.map((order) => {
      const o = order as Record<string, unknown>;
      const orderId = o.id as string;
      const voucher = voucherByOrderId.get(orderId);
      const cancellation = cancellationMap.get(orderId) ?? null;
      const giftReceiver = voucher ? giftReceiverMap.get(voucher.id) ?? null : null;

      // products JOIN 결과
      const product = o.products as Record<string, unknown> | null;

      return {
        id: o.id,
        order_number: o.order_number,
        user_id: o.user_id,
        product_id: o.product_id,
        quantity: o.quantity,
        product_price: o.product_price,
        fee_type: o.fee_type,
        fee_amount: o.fee_amount,
        total_amount: o.total_amount,
        payment_method: o.payment_method,
        pg_transaction_id: o.pg_transaction_id,
        receiver_phone: o.receiver_phone,
        status: o.status,
        installment_months: o.installment_months,
        approval_no: o.approval_no,
        card_no: o.card_no,
        card_company_code: o.card_company_code,
        card_company_name: o.card_company_name,
        created_at: o.created_at,
        updated_at: o.updated_at,
        product: product
          ? {
              id: product.id,
              name: product.name,
              price: product.price,
              fee_rate: product.fee_rate,
              fee_unit: product.fee_unit,
              image_url: product.image_url,
            }
          : null,
        voucher_status: voucher?.status ?? null,
        voucher_code: voucher?.code ?? null,
        gift_receiver: giftReceiver,
        cancellation,
      };
    });

    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/mypage/orders] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
