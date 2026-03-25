import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateFaqSchema } from "@/lib/validations/admin";

/**
 * GET /api/admin/faqs
 *
 * 관리자 FAQ 목록 조회 (is_visible 관계없이 전체 조회)
 * adminClient(service role)를 사용하여 RLS 우회
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("faqs")
      .select("id, category, question, answer, is_visible, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/faqs] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "FAQ 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("[GET /api/admin/faqs] Unexpected error:", error);
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
 * POST /api/admin/faqs
 *
 * FAQ 등록
 */
export async function POST(request: NextRequest) {
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
    const parsed = adminCreateFaqSchema.safeParse(body);

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

    const { category, question, answer, sort_order, is_visible } = parsed.data;

    // sort_order 자동 계산: 지정 안 됐으면 마지막 + 1
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxOrderRow } = await adminClient
        .from("faqs")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalSortOrder = maxOrderRow ? (maxOrderRow.sort_order as number) + 1 : 1;
    }

    const { data: newFaq, error: insertError } = await adminClient
      .from("faqs")
      .insert({
        category,
        question,
        answer,
        sort_order: finalSortOrder,
        is_visible: is_visible ?? true,
      })
      .select("id, category, question, answer, is_visible, sort_order, created_at, updated_at")
      .single();

    if (insertError || !newFaq) {
      console.error("[POST /api/admin/faqs] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "FAQ 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: newFaq },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/faqs] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
