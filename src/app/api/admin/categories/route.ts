import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateCategorySchema } from "@/lib/validations/admin";
import type { Category } from "@/types";

/**
 * GET /api/admin/categories
 *
 * 관리자 카테고리 목록 조회 (sort_order 순)
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("categories")
      .select("id, name, subtitle, slug, icon, image_url, is_visible, sort_order, created_at")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/categories] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "카테고리 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 카테고리별 상품 수 조회 (category_id만 select하여 전송량 최소화)
    const productCountMap: Record<string, number> = {};

    const { data: countRows } = await adminClient
      .from("products")
      .select("category_id");

    for (const row of (countRows ?? [])) {
      const catId = (row as Record<string, unknown>).category_id as string;
      productCountMap[catId] = (productCountMap[catId] ?? 0) + 1;
    }

    const categories: (Category & { product_count: number })[] = (data ?? []).map((raw) => ({
      id: raw.id as string,
      name: raw.name as string,
      subtitle: (raw.subtitle as string) ?? "",
      slug: raw.slug as string,
      icon: (raw.icon as string) ?? "Tag",
      image_url: (raw.image_url as string) ?? null,
      is_visible: raw.is_visible as boolean,
      sort_order: raw.sort_order as number,
      created_at: raw.created_at as string,
      product_count: productCountMap[raw.id as string] ?? 0,
    }));

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("[GET /api/admin/categories] Unexpected error:", error);
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
 * POST /api/admin/categories
 *
 * 관리자 카테고리 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminCreateCategorySchema.safeParse(body);

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

    const { name, subtitle, icon, is_visible, sort_order } = parsed.data;

    // slug 생성: 명시적으로 전달되면 사용, 아니면 이름에서 자동 생성
    let slug = parsed.data.slug;
    if (!slug) {
      slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9가-힣-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      // 한글 slug인 경우 영문으로 변환하기 어려우므로 timestamp 추가
      if (/[가-힣]/.test(slug)) {
        slug = `category-${Date.now().toString(36)}`;
      }
    }

    // slug 중복 확인
    const { data: existingSlug } = await adminClient
      .from("categories")
      .select("id")
      .eq("slug", slug)
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

    // sort_order 자동 계산: 지정 안 됐으면 마지막 + 1
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxOrderRow } = await adminClient
        .from("categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalSortOrder = maxOrderRow ? (maxOrderRow.sort_order as number) + 1 : 1;
    }

    const { data: newCategory, error: insertError } = await adminClient
      .from("categories")
      .insert({
        name,
        subtitle: subtitle ?? "",
        slug,
        icon: icon ?? "Tag",
        is_visible: is_visible ?? true,
        sort_order: finalSortOrder,
      })
      .select("id, name, subtitle, slug, icon, image_url, is_visible, sort_order, created_at")
      .single();

    if (insertError || !newCategory) {
      console.error("[POST /api/admin/categories] Insert error:", insertError);

      // unique constraint 위반
      if (insertError?.code === "23505") {
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
          error: { code: "INSERT_ERROR", message: "카테고리 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");

    const result: Category = {
      id: newCategory.id as string,
      name: newCategory.name as string,
      subtitle: (newCategory.subtitle as string) ?? "",
      slug: newCategory.slug as string,
      icon: (newCategory.icon as string) ?? "Tag",
      image_url: (newCategory.image_url as string) ?? null,
      is_visible: newCategory.is_visible as boolean,
      sort_order: newCategory.sort_order as number,
      created_at: newCategory.created_at as string,
    };

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/categories] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
