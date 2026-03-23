import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateProductSchema } from "@/lib/validations/admin";
import type { AdminProductListItem } from "@/types";

/**
 * GET /api/admin/products
 *
 * 관리자 상품 목록 조회 (필터/검색/페이징/정렬)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // ── 페이징 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const search = searchParams.get("search")?.trim() ?? "";
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";
    const categoryIds = searchParams.get("category_ids")?.split(",").filter(Boolean) ?? [];
    const status = searchParams.get("status") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const priceMin = searchParams.get("price_min") ? parseInt(searchParams.get("price_min")!, 10) : null;
    const priceMax = searchParams.get("price_max") ? parseInt(searchParams.get("price_max")!, 10) : null;

    // ── 상품 조회 ──
    let query = adminClient
      .from("products")
      .select(
        `id, category_id, name, price, fee_rate, fee_unit, image_url, description,
         status, total_sales, popular_rank, created_at, updated_at,
         categories!inner(id, name, slug)`,
        { count: "exact" }
      );

    // 카테고리 필터
    if (categoryIds.length > 0) {
      query = query.in("category_id", categoryIds);
    }

    // 상태 필터
    if (status === "active" || status === "inactive" || status === "soldout") {
      query = query.eq("status", status);
    }

    // 날짜 범위
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }

    // 가격 범위
    if (priceMin != null && !isNaN(priceMin)) {
      query = query.gte("price", priceMin);
    }
    if (priceMax != null && !isNaN(priceMax)) {
      query = query.lte("price", priceMax);
    }

    // 검색 (상품명, 상품 ID)
    if (search) {
      const sanitized = search
        .replace(/[%_,()\\[\]]/g, "");
      if (sanitized) {
        // UUID 형식에 맞는 문자(hex + dash)만 포함된 경우 ID 검색도 포함
        const isIdLike = /^[a-f0-9-]+$/i.test(sanitized);
        if (isIdLike) {
          query = query.or(`name.ilike.%${sanitized}%,id::text.ilike.%${sanitized}%`);
        } else {
          query = query.ilike("name", `%${sanitized}%`);
        }
      }
    }

    // 정렬
    const SORTABLE_COLUMNS = ["created_at", "name", "price", "total_sales", "pin_stock_waiting"];
    // pin_stock_waiting는 후처리 정렬
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) && sortBy !== "pin_stock_waiting"
      ? sortBy
      : "created_at";
    const safeSortOrder = ["asc", "desc"].includes(sortOrder) ? sortOrder : "desc";
    const ascending = safeSortOrder === "asc";
    query = query.order(safeSortBy, { ascending });
    // 동일 값 행의 순서를 보장하기 위한 보조 정렬 키
    if (safeSortBy !== "id") {
      query = query.order("id", { ascending: true });
    }

    // pin_stock_waiting 정렬은 후처리 필요 → 전체 조회
    const needsPostFilter = sortBy === "pin_stock_waiting";

    if (!needsPostFilter) {
      query = query.range(from, to);
    } else {
      // TODO: 상품 5000개 초과 시 DB 레벨 집계(RPC/View)로 전환 필요
      const POST_FILTER_MAX = 5000;
      query = query.limit(POST_FILTER_MAX);
    }

    const { data: productsRaw, error: productsError, count } = await query;

    if (productsError) {
      console.error("[GET /api/admin/products] Query error:", productsError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "상품 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!productsRaw || productsRaw.length === 0) {
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

    // ── 핀 재고 조회 (DB View 집계) ──
    const productIds = productsRaw.map((p) => p.id as string);

    const { data: pinStatsRaw } = await adminClient
      .from("product_pin_stats")
      .select("product_id, waiting, assigned, consumed, returned")
      .in("product_id", productIds);

    const pinStockMap = new Map<string, { waiting: number; assigned: number; consumed: number; returned: number }>();
    for (const row of (pinStatsRaw ?? [])) {
      const r = row as Record<string, unknown>;
      pinStockMap.set(r.product_id as string, {
        waiting: Number(r.waiting) || 0,
        assigned: Number(r.assigned) || 0,
        consumed: Number(r.consumed) || 0,
        returned: Number(r.returned) || 0,
      });
    }

    // ── 데이터 매핑 ──
    let items: AdminProductListItem[] = productsRaw.map((raw) => {
      const product = raw as Record<string, unknown>;
      const category = product.categories as Record<string, unknown>;
      const pid = product.id as string;
      const stock = pinStockMap.get(pid) ?? { waiting: 0, assigned: 0, consumed: 0, returned: 0 };

      return {
        id: pid,
        category_id: product.category_id as string,
        name: product.name as string,
        price: product.price as number,
        fee_rate: Number(product.fee_rate),
        fee_unit: product.fee_unit as "percent" | "fixed",
        image_url: (product.image_url as string) ?? null,
        description: (product.description as string) ?? null,
        status: product.status as "active" | "inactive" | "soldout",
        total_sales: product.total_sales as number,
        popular_rank: (product.popular_rank as number) ?? null,
        created_at: product.created_at as string,
        updated_at: product.updated_at as string,
        category_name: category.name as string,
        category_slug: category.slug as string,
        pin_stock_waiting: stock.waiting,
        pin_stock_assigned: stock.assigned,
        pin_stock_consumed: stock.consumed,
        pin_stock_returned: stock.returned,
      };
    });

    // ── 후처리 ──


    // pin_stock_waiting 정렬
    if (sortBy === "pin_stock_waiting") {
      items.sort((a, b) =>
        ascending
          ? a.pin_stock_waiting - b.pin_stock_waiting
          : b.pin_stock_waiting - a.pin_stock_waiting
      );
    }

    // 후처리 시 메모리 페이징
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
    console.error("[GET /api/admin/products] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/products
 *
 * 관리자 상품 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminCreateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const { name, category_id, price, fee_rate, fee_unit, description, status: productStatus, image_url } = parsed.data;

    // 카테고리 존재 여부 확인
    const { data: category, error: catError } = await adminClient
      .from("categories")
      .select("id, name, slug")
      .eq("id", category_id)
      .single();

    if (catError || !category) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CATEGORY_NOT_FOUND", message: "존재하지 않는 카테고리입니다." },
        },
        { status: 404 }
      );
    }

    // fee_amount 계산 (DB에 fee_amount NOT NULL 컬럼이 남아있어 호환 유지)
    const feeAmount = fee_unit === "percent"
      ? Math.round(price * fee_rate / 100)
      : Math.round(fee_rate);

    // 상품 생성
    const { data: newProduct, error: insertError } = await adminClient
      .from("products")
      .insert({
        name,
        category_id,
        price,
        fee_rate,
        fee_unit,
        fee_amount: feeAmount,
        description: description ?? null,
        status: productStatus,
        image_url: image_url ?? null,
      })
      .select("id, category_id, name, price, fee_rate, fee_unit, image_url, description, status, total_sales, created_at, updated_at")
      .single();

    if (insertError || !newProduct) {
      console.error("[POST /api/admin/products] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "상품 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");
    revalidatePath(`/category/${category.slug}`, "page");

    const result: AdminProductListItem = {
      id: newProduct.id as string,
      category_id: newProduct.category_id as string,
      name: newProduct.name as string,
      price: newProduct.price as number,
      fee_rate: Number(newProduct.fee_rate),
      fee_unit: newProduct.fee_unit as "percent" | "fixed",
      image_url: (newProduct.image_url as string) ?? null,
      description: (newProduct.description as string) ?? null,
      status: newProduct.status as "active" | "inactive",
      total_sales: newProduct.total_sales as number,
      popular_rank: null,
      created_at: newProduct.created_at as string,
      updated_at: newProduct.updated_at as string,
      category_name: category.name as string,
      category_slug: category.slug as string,
      pin_stock_waiting: 0,
      pin_stock_assigned: 0,
      pin_stock_consumed: 0,
      pin_stock_returned: 0,
    };

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/products] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
