import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notices
 * 공지사항 목록 조회 (공개 — 인증 불필요)
 * 쿼리 파라미터: category (선택), page (기본 1), limit (기본 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    const supabase = await createClient();

    // 카테고리별 카운트 조회
    const { data: allNotices, error: countError } = await supabase
      .from("notices")
      .select("category, is_important");

    if (countError) {
      console.error("[GET /api/notices] Count query error:", countError.message);
    }

    const categoryCounts: Record<string, number> = { "전체": 0 };
    if (allNotices) {
      categoryCounts["전체"] = allNotices.length;
      for (const notice of allNotices) {
        categoryCounts[notice.category] = (categoryCounts[notice.category] || 0) + 1;
      }
    }

    // 목록 조회 (중요 공지 먼저, 최신순)
    let query = supabase
      .from("notices")
      .select("id, title, content, category, is_important, view_count, created_at", { count: "exact" })
      .order("is_important", { ascending: false })
      .order("created_at", { ascending: false });

    if (category && category !== "전체") {
      query = query.eq("category", category);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/notices] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "공지사항 목록 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: data ?? [],
      categoryCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[GET /api/notices] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
