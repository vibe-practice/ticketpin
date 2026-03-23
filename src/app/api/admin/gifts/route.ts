import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { AdminGiftListItem, VoucherStatus, FeeType } from "@/types";

/**
 * GET /api/admin/gifts
 *
 * 관리자 선물 이력 목록 조회 (필터/검색/페이징/정렬)
 *
 * 쿼리 파라미터:
 * - page, limit: 페이징
 * - search: 통합검색 (보낸사람, 받는사람, 상품명, 바우처코드)
 * - sort_by, sort_order: 정렬
 * - voucher_status: 바우처 상태 필터 (comma separated)
 * - fee_type: 수수료 방식 (included|separate)
 * - date_from, date_to: 선물 기간
 * - amount_min, amount_max: 금액 범위
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // ── 페이징 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const search = searchParams.get("search")?.trim() ?? "";
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";
    const voucherStatusFilter = searchParams.get("voucher_status")?.split(",").filter(Boolean) ?? [];
    const feeTypeFilter = searchParams.get("fee_type") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const amountMin = searchParams.get("amount_min") ? parseInt(searchParams.get("amount_min")!, 10) : null;
    const amountMax = searchParams.get("amount_max") ? parseInt(searchParams.get("amount_max")!, 10) : null;

    // ── 1단계: gifts 기본 조회 + JOIN ──
    // gifts -> users(sender), users(receiver), products, vouchers(source/new)
    // Supabase 중첩 관계 쿼리가 불안정하므로 별도 쿼리로 처리

    let query = adminClient
      .from("gifts")
      .select(
        `id, sender_id, receiver_id, source_voucher_id, new_voucher_id, product_id, created_at`,
        { count: "exact" }
      );

    // 날짜 필터 (DB 레벨)
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }

    // 정렬
    const SORTABLE_COLUMNS = ["created_at"];
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "created_at";
    const ascending = sortOrder === "asc";
    query = query.order(safeSortBy, { ascending });

    // 후처리 필터 필요 여부 판단
    const JOIN_SORT_FIELDS = ["sender_name", "receiver_name", "product_name", "total_amount"];
    const POST_FILTER_MAX = 2000;
    const needsPostFilter = !!search || voucherStatusFilter.length > 0 || !!feeTypeFilter ||
      amountMin != null || amountMax != null || JOIN_SORT_FIELDS.includes(sortBy);

    if (!needsPostFilter) {
      query = query.range(from, to);
    } else {
      query = query.limit(POST_FILTER_MAX);
    }

    const { data: giftsRaw, error: giftsError, count } = await query;

    if (giftsError) {
      console.error("[GET /api/admin/gifts] Query error:", giftsError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "선물 이력 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!giftsRaw || giftsRaw.length === 0) {
      const total = count ?? 0;
      return NextResponse.json({
        success: true,
        data: {
          data: [],
          total,
          page,
          per_page: limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    }

    // ── 2단계: 관련 데이터 병렬 조회 ──
    const senderIds = [...new Set(giftsRaw.map((g) => g.sender_id as string))];
    const receiverIds = [...new Set(giftsRaw.map((g) => g.receiver_id as string))];
    const allUserIds = [...new Set([...senderIds, ...receiverIds])];
    const productIds = [...new Set(giftsRaw.map((g) => g.product_id as string | null).filter((id): id is string => id != null))];
    const sourceVoucherIds = giftsRaw.map((g) => g.source_voucher_id as string).filter(Boolean);
    const newVoucherIds = giftsRaw.map((g) => g.new_voucher_id as string).filter(Boolean);
    const allVoucherIds = [...new Set([...sourceVoucherIds, ...newVoucherIds])];

    const [usersResult, productsResult, vouchersResult] = await Promise.all([
      allUserIds.length > 0
        ? adminClient
            .from("users")
            .select("id, username, name, phone")
            .in("id", allUserIds)
        : Promise.resolve({ data: [] as { id: string; username: string; name: string; phone: string }[] }),
      productIds.length > 0
        ? adminClient
            .from("products")
            .select("id, name, price")
            .in("id", productIds)
        : Promise.resolve({ data: [] as { id: string; name: string; price: number }[] }),
      allVoucherIds.length > 0
        ? adminClient
            .from("vouchers")
            .select("id, code, order_id, status")
            .in("id", allVoucherIds)
        : Promise.resolve({ data: [] as { id: string; code: string; order_id: string; status: string }[] }),
    ]);

    // 바우처의 주문 정보 조회 (수수료/총금액)
    const orderIds = [...new Set((vouchersResult.data ?? []).map((v) => v.order_id as string))];
    const ordersResult = orderIds.length > 0
      ? await adminClient
          .from("orders")
          .select("id, quantity, fee_type, fee_amount, total_amount")
          .in("id", orderIds)
      : { data: [] as { id: string; quantity: number; fee_type: string; fee_amount: number; total_amount: number }[] };

    // ── 3단계: 인덱스 맵 구성 ──
    const usersMap = new Map(
      (usersResult.data ?? []).map((u) => [u.id, u])
    );
    const productsMap = new Map(
      (productsResult.data ?? []).map((p) => [p.id, p])
    );
    const vouchersMap = new Map(
      (vouchersResult.data ?? []).map((v) => [v.id, v])
    );
    const ordersMap = new Map(
      (ordersResult.data ?? []).map((o) => [o.id, o])
    );

    // ── 4단계: AdminGiftListItem 조합 ──
    let items: AdminGiftListItem[] = giftsRaw.map((raw) => {
      const gift = raw as Record<string, unknown>;
      const sender = usersMap.get(gift.sender_id as string);
      const receiver = usersMap.get(gift.receiver_id as string);
      const product = productsMap.get(gift.product_id as string);
      const sourceVoucher = vouchersMap.get(gift.source_voucher_id as string);
      const newVoucher = vouchersMap.get(gift.new_voucher_id as string);
      const order = newVoucher ? ordersMap.get(newVoucher.order_id as string) : undefined;

      return {
        id: gift.id as string,
        sender_id: gift.sender_id as string,
        receiver_id: gift.receiver_id as string,
        source_voucher_id: gift.source_voucher_id as string,
        new_voucher_id: gift.new_voucher_id as string,
        product_id: (gift.product_id as string | null) ?? null,
        created_at: gift.created_at as string,
        // 확장 필드
        sender_username: sender?.username ?? "",
        sender_name: sender?.name ?? "",
        sender_phone: sender?.phone ?? "",
        receiver_username: receiver?.username ?? "",
        receiver_name: receiver?.name ?? "",
        receiver_phone: receiver?.phone ?? "",
        product_name: product?.name ?? "",
        product_price: product?.price ?? 0,
        source_voucher_code: (sourceVoucher?.code as string) ?? "",
        new_voucher_code: (newVoucher?.code as string) ?? "",
        new_voucher_status: ((newVoucher?.status as VoucherStatus) ?? "issued") as VoucherStatus,
        order_quantity: (order?.quantity as number) ?? 0,
        fee_amount: (order?.fee_amount as number) ?? 0,
        fee_type: ((order?.fee_type as FeeType) ?? "included") as FeeType,
        total_amount: (order?.total_amount as number) ?? 0,
      };
    });

    // ── 5단계: 후처리 필터 ──

    // 통합 검색
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item) => {
        return (
          item.sender_username.toLowerCase().includes(q) ||
          item.sender_name.toLowerCase().includes(q) ||
          item.receiver_username.toLowerCase().includes(q) ||
          item.receiver_name.toLowerCase().includes(q) ||
          item.product_name.toLowerCase().includes(q) ||
          item.source_voucher_code.toLowerCase().includes(q) ||
          item.new_voucher_code.toLowerCase().includes(q)
        );
      });
    }

    // 바우처 상태 필터
    if (voucherStatusFilter.length > 0) {
      items = items.filter(
        (item) => voucherStatusFilter.includes(item.new_voucher_status)
      );
    }

    // 수수료 방식 필터
    if (feeTypeFilter === "included" || feeTypeFilter === "separate") {
      items = items.filter((item) => item.fee_type === feeTypeFilter);
    }

    // 금액 범위 필터
    if (amountMin != null && !isNaN(amountMin)) {
      items = items.filter((item) => item.total_amount >= amountMin);
    }
    if (amountMax != null && !isNaN(amountMax)) {
      items = items.filter((item) => item.total_amount <= amountMax);
    }

    // JOIN 필드 정렬
    if (JOIN_SORT_FIELDS.includes(sortBy)) {
      const key = sortBy as keyof AdminGiftListItem;
      items.sort((a, b) => {
        const aVal = typeof a[key] === "number" ? a[key] : String(a[key] ?? "").toLowerCase();
        const bVal = typeof b[key] === "number" ? b[key] : String(b[key] ?? "").toLowerCase();
        if (typeof aVal === "number" && typeof bVal === "number") {
          return ascending ? aVal - bVal : bVal - aVal;
        }
        return ascending
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    // 페이징
    let total: number;
    if (needsPostFilter) {
      total = items.length;
      items = items.slice(from, from + limit);
    } else {
      total = count ?? 0;
    }
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        data: items,
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/gifts] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
