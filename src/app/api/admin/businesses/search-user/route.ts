import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { escapeIlike } from "@/lib/admin/utils";

/**
 * GET /api/admin/businesses/search-user?q=xxx
 *
 * 업체 등록/수정 시 회원 검색 API
 * - username ilike 검색, active 회원만, 최대 10건
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!q || q.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "검색어는 2자 이상이어야 합니다." },
        },
        { status: 400 }
      );
    }

    // #9 수정: escapeIlike로 SQL 와일드카드만 이스케이프 (과도한 sanitize 제거)
    const escaped = escapeIlike(q).substring(0, 50);

    const { data: users, error } = await adminClient
      .from("users")
      .select("id, username, name, phone")
      .eq("status", "active")
      .ilike("username", `%${escaped}%`)
      .limit(10);

    if (error) {
      console.error("[GET /api/admin/businesses/search-user] Query error:", error);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "회원 검색에 실패했습니다." } },
        { status: 500 }
      );
    }

    const results = (users ?? []).map((u) => {
      const user = u as Record<string, unknown>;
      return {
        id: user.id as string,
        username: user.username as string,
        name: user.name as string,
        phone: user.phone as string,
      };
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("[GET /api/admin/businesses/search-user] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
