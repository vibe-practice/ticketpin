import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminReorderCategoriesSchema } from "@/lib/validations/admin";

/**
 * PUT /api/admin/categories/reorder
 *
 * 관리자 카테고리 정렬 순서 일괄 변경
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminReorderCategoriesSchema.safeParse(body);

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

    const { orders } = parsed.data;

    // 각 카테고리의 sort_order를 개별 업데이트
    // Supabase에는 batch update가 없으므로 Promise.all로 병렬 처리
    const updatePromises = orders.map(({ id, sort_order }) =>
      adminClient
        .from("categories")
        .update({ sort_order })
        .eq("id", id)
    );

    const results = await Promise.all(updatePromises);

    // 에러 확인
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("[PUT /api/admin/categories/reorder] Update errors:", errors.map((e) => e.error));
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "카테고리 정렬 변경에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // ISR 무효화
    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, data: { updated: orders.length } });
  } catch (error) {
    console.error("[PUT /api/admin/categories/reorder] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
