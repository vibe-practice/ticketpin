import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { addAdminAccountSchema, deleteByIdSchema } from "@/lib/validations/admin";

/**
 * GET /api/admin/settings/accounts
 * 관리자 계정 목록 조회 (password_hash 제외)
 */
export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await auth.adminClient
      .from("admin_users")
      .select("id, username, name, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "계정 목록을 조회할 수 없습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
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
 * POST /api/admin/settings/accounts
 * 관리자 계정 추가
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = addAdminAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { username, password, name } = parsed.data;

    // 중복 체크
    const { data: existing } = await auth.adminClient
      .from("admin_users")
      .select("id")
      .eq("username", username)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DUPLICATE_USERNAME", message: "이미 사용 중인 아이디입니다." },
        },
        { status: 409 }
      );
    }

    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 12);

    const { data, error } = await auth.adminClient
      .from("admin_users")
      .insert({
        username,
        password_hash: passwordHash,
        name,
      })
      .select("id, username, name, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "계정 추가에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
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
 * DELETE /api/admin/settings/accounts
 * 관리자 계정 삭제 (본인 계정 삭제 방지)
 */
export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = deleteByIdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { id } = parsed.data;

    // 본인 계정 삭제 방지
    if (id === auth.adminUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SELF_DELETE_FORBIDDEN",
            message: "현재 로그인한 본인 계정은 삭제할 수 없습니다.",
          },
        },
        { status: 403 }
      );
    }

    // 최소 1개 계정 유지
    const { data: allAccounts } = await auth.adminClient
      .from("admin_users")
      .select("id")
      .limit(2);

    if (!allAccounts || allAccounts.length <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MIN_ACCOUNT_REQUIRED",
            message: "최소 1개의 관리자 계정이 필요합니다.",
          },
        },
        { status: 400 }
      );
    }

    const { error } = await auth.adminClient
      .from("admin_users")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "계정 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
