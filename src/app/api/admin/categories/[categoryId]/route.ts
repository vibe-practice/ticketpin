import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateCategorySchema } from "@/lib/validations/admin";
import type { Category } from "@/types";

/**
 * PATCH /api/admin/categories/[categoryId]
 *
 * 관리자 카테고리 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { categoryId } = await params;

    // UUID 형식 검증
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(categoryId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 카테고리 ID입니다." } },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = adminUpdateCategorySchema.safeParse(body);

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

    // 기존 카테고리 확인
    const { data: existing, error: existError } = await adminClient
      .from("categories")
      .select("id, slug")
      .eq("id", categoryId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CATEGORY_NOT_FOUND", message: "존재하지 않는 카테고리입니다." },
        },
        { status: 404 }
      );
    }

    // 업데이트 데이터 구성
    const dbUpdate: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) dbUpdate.name = parsed.data.name;
    if (parsed.data.subtitle !== undefined) dbUpdate.subtitle = parsed.data.subtitle;
    if (parsed.data.slug !== undefined) dbUpdate.slug = parsed.data.slug;
    if (parsed.data.icon !== undefined) dbUpdate.icon = parsed.data.icon;
    if (parsed.data.is_visible !== undefined) dbUpdate.is_visible = parsed.data.is_visible;
    if (parsed.data.sort_order !== undefined) dbUpdate.sort_order = parsed.data.sort_order;
    if (parsed.data.image_url !== undefined) dbUpdate.image_url = parsed.data.image_url;

    if (Object.keys(dbUpdate).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_UPDATE", message: "변경할 항목이 없습니다." },
        },
        { status: 400 }
      );
    }

    // slug 중복 확인 (변경하는 경우)
    if (dbUpdate.slug && dbUpdate.slug !== existing.slug) {
      const { data: existingSlug } = await adminClient
        .from("categories")
        .select("id")
        .eq("slug", dbUpdate.slug as string)
        .neq("id", categoryId)
        .maybeSingle();

      if (existingSlug) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "DUPLICATE_SLUG", message: "이미 사용 중인 슬러그입니다." },
          },
          { status: 409 }
        );
      }
    }

    const { data: updated, error: updateError } = await adminClient
      .from("categories")
      .update(dbUpdate)
      .eq("id", categoryId)
      .select("id, name, subtitle, slug, icon, image_url, is_visible, sort_order, created_at")
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/admin/categories/:id] Update error:", updateError);

      if (updateError?.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "DUPLICATE_SLUG", message: "이미 사용 중인 슬러그입니다." },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "카테고리 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");
    revalidatePath(`/category/${updated.slug}`, "page");

    const result: Category = {
      id: updated.id as string,
      name: updated.name as string,
      subtitle: (updated.subtitle as string) ?? "",
      slug: updated.slug as string,
      icon: (updated.icon as string) ?? "Tag",
      image_url: (updated.image_url as string) ?? null,
      is_visible: updated.is_visible as boolean,
      sort_order: updated.sort_order as number,
      created_at: updated.created_at as string,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[PATCH /api/admin/categories/:id] Unexpected error:", error);
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
 * DELETE /api/admin/categories/[categoryId]
 *
 * 관리자 카테고리 삭제 (소속 상품이 있으면 삭제 불가)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { categoryId } = await params;

    // UUID 형식 검증
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(categoryId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 카테고리 ID입니다." } },
        { status: 400 }
      );
    }

    // 기존 카테고리 확인
    const { data: existing, error: existError } = await adminClient
      .from("categories")
      .select("id, slug")
      .eq("id", categoryId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CATEGORY_NOT_FOUND", message: "존재하지 않는 카테고리입니다." },
        },
        { status: 404 }
      );
    }

    // 소속 상품 확인
    const { count: productCount } = await adminClient
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    if (productCount && productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "HAS_PRODUCTS",
            message: `해당 카테고리에 ${productCount}개의 상품이 있어 삭제할 수 없습니다.`,
          },
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await adminClient
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (deleteError) {
      console.error("[DELETE /api/admin/categories/:id] Delete error:", deleteError);

      // FK constraint 위반 (products.category_id RESTRICT)
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "HAS_PRODUCTS",
              message: "해당 카테고리에 연결된 상품이 있어 삭제할 수 없습니다.",
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "카테고리 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");
    revalidatePath(`/category/${existing.slug}`, "page");

    return NextResponse.json({ success: true, data: { id: categoryId } });
  } catch (error) {
    console.error("[DELETE /api/admin/categories/:id] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
