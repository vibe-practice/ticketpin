import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE, escapeIlike } from "@/lib/admin/utils";

/**
 * GET /api/admin/settlements
 *
 * 정산 목록 조회 (업체/상태/날짜/금액 필터 + 페이지네이션)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size")) || 20));
    const businessId = sp.get("business_id") ?? undefined;
    const status = sp.get("status") ?? undefined;
    const startDate = sp.get("start_date") ?? undefined;
    const endDate = sp.get("end_date") ?? undefined;
    const search = sp.get("search")?.trim() ?? undefined;

    // business_id 형식 검증
    if (businessId && !UUID_RE.test(businessId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 업체 ID입니다." } },
        { status: 400 }
      );
    }

    // 쿼리 빌드 — settlements JOIN businesses
    let query = adminClient
      .from("settlements")
      .select(
        `id, business_id, settlement_date, gift_count, gift_total_amount,
         commission_rate, settlement_amount, status, confirmed_at, paid_at,
         paid_by, memo, created_at, updated_at,
         businesses!inner(business_name, contact_person, bank_name, account_number, account_holder)`,
        { count: "exact" }
      )
      .order("settlement_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (businessId) query = query.eq("business_id", businessId);
    if (status) query = query.eq("status", status);
    if (startDate) query = query.gte("settlement_date", startDate);
    if (endDate) query = query.lte("settlement_date", endDate);

    // 업체명 검색 (businesses.business_name ilike)
    if (search) {
      query = query.ilike("businesses.business_name", `%${escapeIlike(search)}%`);
    }

    // 페이지네이션
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[GET /api/admin/settlements] Query error:", error);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "정산 목록 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    // Flatten JOIN 결과
    const settlements = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const biz = r.businesses as Record<string, unknown> | null;
      return {
        id: r.id,
        business_id: r.business_id,
        settlement_date: r.settlement_date,
        gift_count: r.gift_count,
        gift_total_amount: r.gift_total_amount,
        commission_rate: r.commission_rate,
        settlement_amount: r.settlement_amount,
        status: r.status,
        confirmed_at: r.confirmed_at,
        paid_at: r.paid_at,
        paid_by: r.paid_by,
        memo: r.memo,
        created_at: r.created_at,
        updated_at: r.updated_at,
        business_name: biz?.business_name ?? "",
        contact_person: biz?.contact_person ?? "",
        bank_name: biz?.bank_name ?? "",
        account_number: biz?.account_number ?? "",
        account_holder: biz?.account_holder ?? "",
      };
    });

    return NextResponse.json({
      success: true,
      data: settlements,
      pagination: {
        page,
        page_size: pageSize,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/settlements] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
