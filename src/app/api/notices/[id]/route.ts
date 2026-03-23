import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notices/[id]
 * 공지사항 상세 조회 (공개 — 인증 불필요)
 * 이전글/다음글 네비게이션 포함
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // 공지사항 상세 조회
    const { data: notice, error } = await supabase
      .from("notices")
      .select("id, title, content, category, is_important, view_count, created_at")
      .eq("id", id)
      .single();

    if (error || !notice) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "공지사항을 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    // 이전글 (현재보다 오래된 공지 중 가장 최신)
    const { data: prevNotice } = await supabase
      .from("notices")
      .select("id, title")
      .lt("created_at", notice.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 다음글 (현재보다 새로운 공지 중 가장 오래된)
    const { data: nextNotice } = await supabase
      .from("notices")
      .select("id, title")
      .gt("created_at", notice.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        ...notice,
        prevNotice: prevNotice ? { id: prevNotice.id, title: prevNotice.title } : null,
        nextNotice: nextNotice ? { id: nextNotice.id, title: nextNotice.title } : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/notices/[id]] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
