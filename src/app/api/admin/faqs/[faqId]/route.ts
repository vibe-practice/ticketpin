import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateFaqSchema } from "@/lib/validations/admin";

type RouteContext = { params: Promise<{ faqId: string }> };

/**
 * PUT /api/admin/faqs/[faqId]
 *
 * FAQ 수정
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { faqId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = adminUpdateFaqSchema.safeParse(body);

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

    // 빈 업데이트 방지
    const updateData = parsed.data;
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "수정할 항목이 없습니다." },
        },
        { status: 422 }
      );
    }

    const { data: updatedFaq, error: updateError } = await adminClient
      .from("faqs")
      .update(updateData)
      .eq("id", faqId)
      .select("id, category, question, answer, is_visible, sort_order, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("[PUT /api/admin/faqs/[faqId]] Update error:", updateError);

      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "해당 FAQ를 찾을 수 없습니다." },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "FAQ 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!updatedFaq) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "해당 FAQ를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedFaq });
  } catch (error) {
    console.error("[PUT /api/admin/faqs/[faqId]] Unexpected error:", error);
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
 * DELETE /api/admin/faqs/[faqId]
 *
 * FAQ 삭제
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { faqId } = await context.params;

    // 존재 여부 확인
    const { data: existing, error: findError } = await adminClient
      .from("faqs")
      .select("id")
      .eq("id", faqId)
      .maybeSingle();

    if (findError) {
      console.error("[DELETE /api/admin/faqs/[faqId]] Find error:", findError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "FAQ 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "해당 FAQ를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminClient
      .from("faqs")
      .delete()
      .eq("id", faqId);

    if (deleteError) {
      console.error("[DELETE /api/admin/faqs/[faqId]] Delete error:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "FAQ 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id: faqId } });
  } catch (error) {
    console.error("[DELETE /api/admin/faqs/[faqId]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
