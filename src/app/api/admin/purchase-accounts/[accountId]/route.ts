import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { purchaseAccountUpdateSchema } from "@/lib/validations/purchase-account";
import { UUID_RE } from "@/lib/admin/utils";

/**
 * GET /api/admin/purchase-accounts/[accountId]
 *
 * 매입 아이디 상세 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { accountId } = await params;
    if (!UUID_RE.test(accountId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "잘못된 ID 형식입니다." } },
        { status: 400 },
      );
    }

    const { data, error } = await adminClient
      .from("purchase_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "매입 아이디를 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    // username 조회
    const { data: user } = await adminClient
      .from("users")
      .select("username")
      .eq("id", data.user_id)
      .single();

    return NextResponse.json({
      success: true,
      data: { ...data, username: user?.username ?? "" },
    });
  } catch (error) {
    console.error("[GET /api/admin/purchase-accounts/[accountId]] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/purchase-accounts/[accountId]
 *
 * 매입 아이디 수정 (account_name, memo, status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { accountId } = await params;
    if (!UUID_RE.test(accountId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "잘못된 ID 형식입니다." } },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "올바른 JSON 형식이 아닙니다." } },
        { status: 400 },
      );
    }

    const parsed = purchaseAccountUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: firstError?.message ?? "입력값이 올바르지 않습니다." } },
        { status: 422 },
      );
    }

    const { account_name, username, status, memo } = parsed.data;
    const notification_phone = parsed.data.notification_phone || null;

    // 매입 아이디 조회 (user_id 필요)
    const { data: existing } = await adminClient
      .from("purchase_accounts")
      .select("user_id")
      .eq("id", accountId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "매입 아이디를 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    // username 변경 시 중복 체크 + users/auth.users 동기화
    let originalUsername: string | null = null;
    let authId: string | null = null;
    if (username) {
      const { data: currentUser } = await adminClient
        .from("users")
        .select("username, auth_id")
        .eq("id", existing.user_id)
        .single();

      if (currentUser && currentUser.username !== username) {
        originalUsername = currentUser.username;
        authId = currentUser.auth_id;

        // 중복 체크
        const { data: dup } = await adminClient
          .from("users")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (dup) {
          return NextResponse.json(
            { success: false, error: { code: "DUPLICATE_USERNAME", message: "이미 사용 중인 아이디입니다." } },
            { status: 409 },
          );
        }

        // users.username 변경
        const { error: usersUpdateError } = await adminClient
          .from("users")
          .update({ username })
          .eq("id", existing.user_id);

        if (usersUpdateError) {
          console.error("[PUT purchase-accounts] users.username update error:", usersUpdateError);
          return NextResponse.json(
            { success: false, error: { code: "UPDATE_ERROR", message: "아이디 변경에 실패했습니다." } },
            { status: 500 },
          );
        }

        // auth.users.email 변경 (매입 계정은 username@purchase.internal 형식)
        const { error: authError } = await adminClient.auth.admin.updateUserById(
          currentUser.auth_id,
          { email: `${username}@purchase.internal` },
        );

        if (authError) {
          // 롤백: users.username 원복
          await adminClient
            .from("users")
            .update({ username: originalUsername })
            .eq("id", existing.user_id);

          console.error("[PUT purchase-accounts] Auth update error:", authError);
          return NextResponse.json(
            { success: false, error: { code: "AUTH_ERROR", message: "아이디 변경에 실패했습니다." } },
            { status: 500 },
          );
        }
      }
    }

    const updatePayload: Record<string, unknown> = { account_name, notification_phone };
    if (status !== undefined) updatePayload.status = status;
    if (memo !== undefined) updatePayload.memo = memo;

    const { data, error } = await adminClient
      .from("purchase_accounts")
      .update(updatePayload)
      .eq("id", accountId)
      .select("*, user_id")
      .single();

    if (error || !data) {
      // username이 변경되었다면 롤백
      if (originalUsername && authId) {
        const { error: rollbackUsersErr } = await adminClient.from("users").update({ username: originalUsername }).eq("id", existing.user_id);
        const { error: rollbackAuthErr } = await adminClient.auth.admin.updateUserById(authId, { email: `${originalUsername}@purchase.internal` });
        if (rollbackUsersErr || rollbackAuthErr) {
          console.error("[PUT purchase-accounts] Rollback failed:", { rollbackUsersErr, rollbackAuthErr, accountId, originalUsername });
        }
      }
      console.error("[PUT purchase-accounts] Update error:", error);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "수정에 실패했습니다." } },
        { status: 500 },
      );
    }

    // users.name도 동기화 (선물하기 검색 시 표시되는 이름)
    await adminClient
      .from("users")
      .update({ name: account_name })
      .eq("id", data.user_id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[PUT /api/admin/purchase-accounts/[accountId]] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
