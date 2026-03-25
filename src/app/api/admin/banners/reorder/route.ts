import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminReorderBannersSchema } from "@/lib/validations/admin";

/**
 * PUT /api/admin/banners/reorder
 *
 * 관리자 배너 정렬 순서 일괄 변경
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = adminReorderBannersSchema.safeParse(body);

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

    const updatePromises = orders.map(({ id, sort_order }) =>
      adminClient
        .from("banners")
        .update({ sort_order })
        .eq("id", id)
    );

    const results = await Promise.all(updatePromises);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("[PUT /api/admin/banners/reorder] Update errors:", errors.map((e) => e.error));
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "배너 정렬 변경에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, data: { updated: orders.length } });
  } catch (error) {
    console.error("[PUT /api/admin/banners/reorder] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
