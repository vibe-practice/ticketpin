import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { purchaseAccountFormSchema } from "@/lib/validations/purchase-account";
import { escapeIlike } from "@/lib/admin/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminPurchaseAccountListItem } from "@/types";

/**
 * GET /api/admin/purchase-accounts
 *
 * 매입 아이디 목록 조회 (검색, 상태 필터, 페이징, 통계)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) ?? [];

    // 기본 쿼리
    let query = adminClient
      .from("purchase_accounts")
      .select("*", { count: "exact" });

    // 상태 필터
    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

    // 검색 (account_name)
    if (search) {
      const escaped = escapeIlike(search);
      query = query.ilike("account_name", `%${escaped}%`);
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/admin/purchase-accounts] Query error:", error);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "매입 아이디 목록 조회에 실패했습니다." } },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const accounts = data ?? [];

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        data: { data: [], total, page, per_page: limit, total_pages: Math.ceil(total / limit) },
      });
    }

    // user_id 목록으로 username 조회
    const userIds = accounts.map((a) => a.user_id);
    const { data: users } = await adminClient
      .from("users")
      .select("id, username")
      .in("id", userIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u.username]));

    // gifts 통계 집계: 각 매입 아이디(receiver_id)의 총 매입 건수/금액
    const { data: giftStats } = await adminClient
      .from("gifts")
      .select("receiver_id, source_voucher_id")
      .in("receiver_id", userIds);

    // source_voucher_id로 orders에서 total_amount 조회
    const sourceVoucherIds = (giftStats ?? []).map((g) => g.source_voucher_id).filter(Boolean);

    let voucherOrderMap = new Map<string, number>();
    if (sourceVoucherIds.length > 0) {
      const { data: vouchers } = await adminClient
        .from("vouchers")
        .select("id, order_id")
        .in("id", sourceVoucherIds);

      const orderIds = [...new Set((vouchers ?? []).map((v) => v.order_id).filter(Boolean))];
      if (orderIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, total_amount")
          .in("id", orderIds);

        const orderAmountMap = new Map((orders ?? []).map((o) => [o.id, Number(o.total_amount)]));
        const voucherOrderIdMap = new Map((vouchers ?? []).map((v) => [v.id, v.order_id]));

        voucherOrderMap = new Map<string, number>();
        for (const [vId, oId] of voucherOrderIdMap) {
          if (oId) voucherOrderMap.set(vId, orderAmountMap.get(oId) ?? 0);
        }
      }
    }

    // receiver_id별 통계 집계
    const statsMap = new Map<string, { count: number; amount: number }>();
    for (const g of giftStats ?? []) {
      const existing = statsMap.get(g.receiver_id) ?? { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += voucherOrderMap.get(g.source_voucher_id) ?? 0;
      statsMap.set(g.receiver_id, existing);
    }

    const result: AdminPurchaseAccountListItem[] = accounts.map((a) => {
      const stats = statsMap.get(a.user_id) ?? { count: 0, amount: 0 };
      return {
        ...a,
        username: userMap.get(a.user_id) ?? "",
        total_gift_count: stats.count,
        total_gift_amount: stats.amount,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: result,
        total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/purchase-accounts] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/purchase-accounts
 *
 * 매입 아이디 생성 (Supabase Auth 계정 + users + purchase_accounts)
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
        { success: false, error: { code: "INVALID_JSON", message: "올바른 JSON 형식이 아닙니다." } },
        { status: 400 },
      );
    }

    const parsed = purchaseAccountFormSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: firstError?.message ?? "입력값이 올바르지 않습니다." } },
        { status: 422 },
      );
    }

    const { account_name, username, password, memo } = parsed.data;
    const notification_phone = parsed.data.notification_phone || null;

    // username 중복 체크
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_USERNAME", message: "이미 사용 중인 아이디입니다." } },
        { status: 409 },
      );
    }

    // Supabase Auth 계정 생성 (이메일: username@purchase.internal)
    const supabaseAdmin = createAdminClient();
    const fakeEmail = `${username}@purchase.internal`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("[POST /api/admin/purchase-accounts] Auth create error:", authError);
      return NextResponse.json(
        { success: false, error: { code: "AUTH_ERROR", message: "계정 생성에 실패했습니다." } },
        { status: 500 },
      );
    }

    // users 테이블 INSERT
    const { data: newUser, error: userError } = await adminClient
      .from("users")
      .insert({
        auth_id: authData.user.id,
        username,
        email: fakeEmail,
        name: account_name,
        phone: "00000000000",
        identity_verified: false,
        status: "active",
        is_purchase_account: true,
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      console.error("[POST /api/admin/purchase-accounts] User insert error:", userError);
      // 롤백: Auth 계정 삭제
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: { code: "USER_ERROR", message: "회원 레코드 생성에 실패했습니다." } },
        { status: 500 },
      );
    }

    // purchase_accounts 테이블 INSERT
    const { data: account, error: accountError } = await adminClient
      .from("purchase_accounts")
      .insert({
        user_id: newUser.id,
        account_name,
        notification_phone: notification_phone ?? null,
        memo: memo ?? null,
        status: "active",
      })
      .select("*")
      .single();

    if (accountError || !account) {
      console.error("[POST /api/admin/purchase-accounts] Account insert error:", accountError);
      // 롤백: users 레코드 삭제 + Auth 계정 삭제
      await adminClient.from("users").delete().eq("id", newUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: { code: "ACCOUNT_ERROR", message: "매입 아이디 생성에 실패했습니다." } },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...account,
          username,
          total_gift_count: 0,
          total_gift_amount: 0,
        } as AdminPurchaseAccountListItem,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/admin/purchase-accounts] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}
