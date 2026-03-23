import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateNoticeSchema } from "@/lib/validations/admin";

type RouteContext = { params: Promise<{ noticeId: string }> };

/**
 * PUT /api/admin/notices/[noticeId]
 *
 * 공지사항 수정
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { noticeId } = await context.params;

    const body = await request.json();
    const parsed = adminUpdateNoticeSchema.safeParse(body);

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

    const { data: updatedNotice, error: updateError } = await adminClient
      .from("notices")
      .update(updateData)
      .eq("id", noticeId)
      .select("id, title, content, category, is_important, is_visible, view_count, created_by, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("[PUT /api/admin/notices/[noticeId]] Update error:", updateError);

      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "해당 공지사항을 찾을 수 없습니다." },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "공지사항 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!updatedNotice) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "해당 공지사항을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 작성자 이름 조회
    const createdBy = updatedNotice.created_by as string | null;
    let createdByName = "관리자";
    if (createdBy) {
      const { data: adminUser } = await adminClient
        .from("admin_users")
        .select("name")
        .eq("id", createdBy)
        .maybeSingle();
      createdByName = (adminUser?.name as string) ?? "관리자";
    }

    return NextResponse.json({
      success: true,
      data: { ...updatedNotice, created_by_name: createdByName },
    });
  } catch (error) {
    console.error("[PUT /api/admin/notices/[noticeId]] Unexpected error:", error);
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
 * DELETE /api/admin/notices/[noticeId]
 *
 * 공지사항 삭제
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { noticeId } = await context.params;

    // 존재 여부 확인
    const { data: existing, error: findError } = await adminClient
      .from("notices")
      .select("id")
      .eq("id", noticeId)
      .maybeSingle();

    if (findError) {
      console.error("[DELETE /api/admin/notices/[noticeId]] Find error:", findError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "공지사항 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "해당 공지사항을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminClient
      .from("notices")
      .delete()
      .eq("id", noticeId);

    if (deleteError) {
      console.error("[DELETE /api/admin/notices/[noticeId]] Delete error:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "공지사항 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id: noticeId } });
  } catch (error) {
    console.error("[DELETE /api/admin/notices/[noticeId]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
