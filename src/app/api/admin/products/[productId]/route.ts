import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateProductSchema } from "@/lib/validations/admin";
import type { AdminProductListItem } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidIdResponse() {
  return NextResponse.json(
    { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 상품 ID입니다." } },
    { status: 400 }
  );
}

/**
 * GET /api/admin/products/[productId]
 *
 * 관리자 상품 상세 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { productId } = await params;
    if (!UUID_RE.test(productId)) return invalidIdResponse();

    const { data: product, error } = await adminClient
      .from("products")
      .select(
        `id, category_id, name, price, fee_rate, fee_unit, image_url, description,
         status, total_sales, popular_rank, created_at, updated_at,
         categories!inner(id, name, slug)`
      )
      .eq("id", productId)
      .single();

    if (error || !product) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않는 상품입니다." },
        },
        { status: 404 }
      );
    }

    // 핀 재고 조회 (DB View 집계)
    const { data: pinStatsRow } = await adminClient
      .from("product_pin_stats")
      .select("waiting, assigned, consumed, returned")
      .eq("product_id", productId)
      .maybeSingle();

    const statsRow = pinStatsRow as Record<string, unknown> | null;
    const stock = {
      waiting: Number(statsRow?.waiting) || 0,
      assigned: Number(statsRow?.assigned) || 0,
      consumed: Number(statsRow?.consumed) || 0,
      returned: Number(statsRow?.returned) || 0,
    };

    const raw = product as Record<string, unknown>;
    const category = raw.categories as Record<string, unknown>;

    const result: AdminProductListItem = {
      id: raw.id as string,
      category_id: raw.category_id as string,
      name: raw.name as string,
      price: raw.price as number,
      fee_rate: Number(raw.fee_rate),
      fee_unit: raw.fee_unit as "percent" | "fixed",
      image_url: (raw.image_url as string) ?? null,
      description: (raw.description as string) ?? null,
      status: raw.status as "active" | "inactive",
      total_sales: raw.total_sales as number,
      popular_rank: (raw.popular_rank as number) ?? null,
      created_at: raw.created_at as string,
      updated_at: raw.updated_at as string,
      category_name: category.name as string,
      category_slug: category.slug as string,
      pin_stock_waiting: stock.waiting,
      pin_stock_assigned: stock.assigned,
      pin_stock_consumed: stock.consumed,
      pin_stock_returned: stock.returned,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/admin/products/:id] Unexpected error:", error);
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
 * PATCH /api/admin/products/[productId]
 *
 * 관리자 상품 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { productId } = await params;
    if (!UUID_RE.test(productId)) return invalidIdResponse();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = adminUpdateProductSchema.safeParse(body);

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

    // 기존 상품 확인
    const { data: existing, error: existError } = await adminClient
      .from("products")
      .select("id, category_id, price, fee_rate, fee_unit")
      .eq("id", productId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않는 상품입니다." },
        },
        { status: 404 }
      );
    }

    // 카테고리 변경 시 존재 여부 확인
    const updateData = parsed.data;
    if (updateData.category_id) {
      const { data: category, error: catError } = await adminClient
        .from("categories")
        .select("id")
        .eq("id", updateData.category_id)
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
    }

    // 업데이트 데이터 구성
    const dbUpdate: Record<string, unknown> = {};
    if (updateData.name !== undefined) dbUpdate.name = updateData.name;
    if (updateData.category_id !== undefined) dbUpdate.category_id = updateData.category_id;
    if (updateData.price !== undefined) dbUpdate.price = updateData.price;
    if (updateData.fee_rate !== undefined) dbUpdate.fee_rate = updateData.fee_rate;
    if (updateData.fee_unit !== undefined) dbUpdate.fee_unit = updateData.fee_unit;
    if (updateData.description !== undefined) dbUpdate.description = updateData.description ?? null;
    if (updateData.status !== undefined) dbUpdate.status = updateData.status;
    if (updateData.image_url !== undefined) dbUpdate.image_url = updateData.image_url ?? null;

    // fee_amount 동기화 (DB에 fee_amount NOT NULL 컬럼이 남아있어 호환 유지)
    const existingRaw = existing as Record<string, unknown>;
    if (updateData.fee_rate !== undefined || updateData.fee_unit !== undefined || updateData.price !== undefined) {
      const finalPrice = updateData.price ?? (existingRaw.price as number);
      const finalFeeRate = updateData.fee_rate ?? Number(existingRaw.fee_rate);
      const finalFeeUnit = updateData.fee_unit ?? (existingRaw.fee_unit as string);
      dbUpdate.fee_amount = finalFeeUnit === "percent"
        ? Math.round(finalPrice * finalFeeRate / 100)
        : Math.round(finalFeeRate);
    }

    if (Object.keys(dbUpdate).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_UPDATE", message: "변경할 항목이 없습니다." },
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await adminClient
      .from("products")
      .update(dbUpdate)
      .eq("id", productId)
      .select(
        `id, category_id, name, price, fee_rate, fee_unit, image_url, description,
         status, total_sales, popular_rank, created_at, updated_at,
         categories!inner(id, name, slug)`
      )
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/admin/products/:id] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "상품 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");
    const updatedRaw = updated as Record<string, unknown>;
    const category = updatedRaw.categories as Record<string, unknown>;
    revalidatePath(`/category/${category.slug}`, "page");
    revalidatePath(`/product/${productId}`, "page");

    // 핀 재고 조회 (DB View 집계)
    const { data: patchPinStatsRow } = await adminClient
      .from("product_pin_stats")
      .select("waiting, assigned, consumed, returned")
      .eq("product_id", productId)
      .maybeSingle();

    const patchStatsRow = patchPinStatsRow as Record<string, unknown> | null;
    const stock = {
      waiting: Number(patchStatsRow?.waiting) || 0,
      assigned: Number(patchStatsRow?.assigned) || 0,
      consumed: Number(patchStatsRow?.consumed) || 0,
      returned: Number(patchStatsRow?.returned) || 0,
    };

    const result: AdminProductListItem = {
      id: updatedRaw.id as string,
      category_id: updatedRaw.category_id as string,
      name: updatedRaw.name as string,
      price: updatedRaw.price as number,
      fee_rate: Number(updatedRaw.fee_rate),
      fee_unit: updatedRaw.fee_unit as "percent" | "fixed",
      image_url: (updatedRaw.image_url as string) ?? null,
      description: (updatedRaw.description as string) ?? null,
      status: updatedRaw.status as "active" | "inactive",
      total_sales: updatedRaw.total_sales as number,
      popular_rank: (updatedRaw.popular_rank as number) ?? null,
      created_at: updatedRaw.created_at as string,
      updated_at: updatedRaw.updated_at as string,
      category_name: category.name as string,
      category_slug: category.slug as string,
      pin_stock_waiting: stock.waiting,
      pin_stock_assigned: stock.assigned,
      pin_stock_consumed: stock.consumed,
      pin_stock_returned: stock.returned,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[PATCH /api/admin/products/:id] Unexpected error:", error);
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
 * DELETE /api/admin/products/[productId]
 *
 * 관리자 상품 강제 삭제 (연결된 핀 삭제 + 주문/선물 연결 해제)
 * DB RPC function으로 트랜잭션 처리
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { productId } = await params;
    if (!UUID_RE.test(productId)) return invalidIdResponse();

    // 카테고리 slug 조회 (ISR 무효화용)
    const { data: existing } = await adminClient
      .from("products")
      .select("id, image_url, categories!inner(slug)")
      .eq("id", productId)
      .single();

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않는 상품입니다." },
        },
        { status: 404 }
      );
    }

    // RPC로 트랜잭션 내에서 cascade 삭제
    const { data: rpcResult, error: rpcError } = await adminClient
      .rpc("admin_delete_product", { p_product_id: productId });

    if (rpcError) {
      console.error("[DELETE /api/admin/products/:id] RPC error:", JSON.stringify(rpcError));
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: rpcError.message ?? "상품 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const result = rpcResult as { success: boolean; code?: string; image_url?: string };
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: result.code ?? "DELETE_ERROR", message: "상품 삭제에 실패했습니다." },
        },
        { status: result.code === "PRODUCT_NOT_FOUND" ? 404 : 500 }
      );
    }

    // 이미지가 Supabase Storage에 있으면 삭제
    const imageUrl = result.image_url;
    if (imageUrl && imageUrl.includes("/storage/v1/object/public/product-images/")) {
      const filePath = imageUrl.split("/product-images/")[1];
      if (filePath) {
        await adminClient.storage.from("product-images").remove([filePath]);
      }
    }

    // ISR 무효화
    revalidatePath("/", "layout");
    const raw = existing as Record<string, unknown>;
    const category = raw.categories as Record<string, unknown>;
    revalidatePath(`/category/${category.slug}`, "page");

    return NextResponse.json({ success: true, data: { id: productId } });
  } catch (error) {
    console.error("[DELETE /api/admin/products/:id] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
