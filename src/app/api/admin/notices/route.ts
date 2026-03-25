import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateNoticeSchema } from "@/lib/validations/admin";

/**
 * GET /api/admin/notices
 *
 * 관리자 공지사항 목록 조회 (is_visible 관계없이 전체 조회)
 * adminClient(service role)를 사용하여 RLS 우회
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // 공지사항 + 작성자 이름 조회
    const { data, error } = await adminClient
      .from("notices")
      .select("id, title, content, category, is_important, is_visible, view_count, created_by, created_at, updated_at, admin_users(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/notices] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "공지사항 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // admin_users JOIN 결과에서 created_by_name 추출
    const notices = (data ?? []).map((row) => {
      const raw = row as Record<string, unknown>;
      const adminUser = raw.admin_users as Record<string, unknown> | null;
      return {
        id: raw.id as string,
        title: raw.title as string,
        content: raw.content as string,
        category: raw.category as string,
        is_important: raw.is_important as boolean,
        is_visible: raw.is_visible as boolean,
        view_count: raw.view_count as number,
        created_by: raw.created_by as string,
        created_by_name: adminUser?.name as string ?? "관리자",
        created_at: raw.created_at as string,
        updated_at: raw.updated_at as string,
      };
    });

    return NextResponse.json({ success: true, data: notices });
  } catch (error) {
    console.error("[GET /api/admin/notices] Unexpected error:", error);
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
 * POST /api/admin/notices
 *
 * 공지사항 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, adminUserId } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = adminCreateNoticeSchema.safeParse(body);

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

    const { title, content, category, is_important, is_visible } = parsed.data;

    const { data: newNotice, error: insertError } = await adminClient
      .from("notices")
      .insert({
        title,
        content,
        category,
        is_important: is_important ?? false,
        is_visible: is_visible ?? true,
        created_by: adminUserId,
      })
      .select("id, title, content, category, is_important, is_visible, view_count, created_by, created_at, updated_at")
      .single();

    if (insertError || !newNotice) {
      console.error("[POST /api/admin/notices] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "공지사항 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 작성자 이름 조회
    const { data: adminUser } = await adminClient
      .from("admin_users")
      .select("name")
      .eq("id", adminUserId)
      .maybeSingle();

    const result = {
      ...newNotice,
      created_by_name: (adminUser?.name as string) ?? "관리자",
    };

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/notices] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
