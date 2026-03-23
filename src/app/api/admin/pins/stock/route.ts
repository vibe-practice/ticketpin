import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { PinStockSummary } from "@/types";

/**
 * GET /api/admin/pins/stock
 *
 * 상품별 핀 재고 현황 집계
 * - 각 상품의 대기/할당/소진/반환 핀 수를 집계
 * - category_id 필터 지원
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get("category_id") ?? "";
    const productStatus = searchParams.get("product_status") ?? "";

    // ── 상품 목록 조회 ──
    let productQuery = adminClient
      .from("products")
      .select("id, name, category_id, categories!inner(id, name)")
      .order("name", { ascending: true });

    if (categoryId) {
      productQuery = productQuery.eq("category_id", categoryId);
    }

    if (productStatus === "active" || productStatus === "inactive" || productStatus === "soldout") {
      productQuery = productQuery.eq("status", productStatus);
    }

    const { data: productsRaw, error: productError } = await productQuery;

    if (productError) {
      console.error("[GET /api/admin/pins/stock] Product query error:", productError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "상품 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!productsRaw || productsRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: [],
          totals: { waiting: 0, assigned: 0, consumed: 0, returned: 0, total: 0 },
        },
      });
    }

    const productIds = productsRaw.map((p) => (p as Record<string, unknown>).id as string);

    // ── 핀 집계 (DB View) ──
    const { data: pinStatsRaw, error: pinError } = await adminClient
      .from("product_pin_stats")
      .select("product_id, waiting, assigned, consumed, returned")
      .in("product_id", productIds);

    if (pinError) {
      console.error("[GET /api/admin/pins/stock] Pin stats query error:", pinError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "핀 재고 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 상품별 핀 수 맵 구성
    const stockMap = new Map<string, { waiting: number; assigned: number; consumed: number; returned: number }>();

    for (const pid of productIds) {
      stockMap.set(pid, { waiting: 0, assigned: 0, consumed: 0, returned: 0 });
    }

    for (const row of (pinStatsRaw ?? [])) {
      const r = row as Record<string, unknown>;
      const pid = r.product_id as string;
      if (stockMap.has(pid)) {
        stockMap.set(pid, {
          waiting: Number(r.waiting) || 0,
          assigned: Number(r.assigned) || 0,
          consumed: Number(r.consumed) || 0,
          returned: Number(r.returned) || 0,
        });
      }
    }

    // ── 결과 매핑 ──
    const summary: (PinStockSummary & { category_name: string })[] = productsRaw.map((raw) => {
      const product = raw as Record<string, unknown>;
      const category = product.categories as Record<string, unknown>;
      const pid = product.id as string;
      const stock = stockMap.get(pid)!;

      return {
        product_id: pid,
        product_name: product.name as string,
        category_name: category.name as string,
        waiting: stock.waiting,
        assigned: stock.assigned,
        consumed: stock.consumed,
        returned: stock.returned,
        total: stock.waiting + stock.assigned + stock.consumed + stock.returned,
      };
    });

    // ── 전체 합계 ──
    const totals = {
      waiting: 0,
      assigned: 0,
      consumed: 0,
      returned: 0,
      total: 0,
    };

    for (const s of summary) {
      totals.waiting += s.waiting;
      totals.assigned += s.assigned;
      totals.consumed += s.consumed;
      totals.returned += s.returned;
    }
    totals.total = totals.waiting + totals.assigned + totals.consumed + totals.returned;

    return NextResponse.json({
      success: true,
      data: {
        summary,
        totals,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/pins/stock] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
