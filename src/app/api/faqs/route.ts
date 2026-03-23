import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/faqs
 * FAQ 목록 조회 (공개 — 인증 불필요)
 * 쿼리 파라미터: category (선택)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");

    const supabase = await createClient();

    let query = supabase
      .from("faqs")
      .select("id, category, question, answer, sort_order")
      .order("sort_order", { ascending: true });

    // 카테고리 필터 (RLS에서 is_visible=true 자동 적용)
    if (category && category !== "전체") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/faqs] Supabase error:", error.message, error.code, error.details);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "FAQ 목록 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    // 카테고리별 카운트 조회 (전체 카테고리)
    const { data: allFaqs, error: countError } = await supabase
      .from("faqs")
      .select("category");

    if (countError) {
      console.error("[GET /api/faqs] Count query error:", countError.message);
    }

    const categoryCounts: Record<string, number> = { "전체": 0 };
    if (allFaqs) {
      categoryCounts["전체"] = allFaqs.length;
      for (const faq of allFaqs) {
        categoryCounts[faq.category] = (categoryCounts[faq.category] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
      categoryCounts,
    });
  } catch (err) {
    console.error("[GET /api/faqs] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
