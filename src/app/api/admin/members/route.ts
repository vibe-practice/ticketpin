import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateMemberSchema } from "@/lib/validations/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

const ADMIN_CREATE_MEMBER_RATE_LIMIT = { maxAttempts: 10, windowMs: 60 * 1000 };

/**
 * GET /api/admin/members
 * 관리자 회원 목록 조회 (검색, 필터, 페이징)
 *
 * Query params:
 *   page     - 페이지 번호 (기본 1)
 *   limit    - 페이지 크기 (기본 20, 최대 100)
 *   search   - 검색어 (아이디, 이름, 이메일, 전화번호)
 *   status   - 회원 상태 필터 (active, suspended, withdrawn)
 *   sort_by  - 정렬 기준 (created_at, username, name, total_purchase_amount)
 *   sort_order - 정렬 순서 (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "";
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 기본 쿼리: users 테이블
    let query = adminClient
      .from("users")
      .select(
        "id, auth_id, username, email, name, phone, identity_verified, status, total_purchase_count, total_purchase_amount, created_at, updated_at",
        { count: "exact" },
      );

    // 매입 아이디 숨김 (매입관리 페이지에서만 관리)
    query = query.or("is_purchase_account.is.null,is_purchase_account.eq.false");

    // 상태 필터
    if (status && ["active", "suspended", "withdrawn"].includes(status)) {
      query = query.eq("status", status);
    }

    // 검색 (아이디, 이름, 이메일, 전화번호)
    if (search) {
      const sanitized = search
        .replace(/[,()\\[\]]/g, "")    // or 구문 파괴 문자 제거
        .replace(/[%_]/g, "\\$&");      // ilike 와일드카드는 이스케이프
      if (sanitized) {
        const phoneDigits = sanitized.replace(/\D/g, "");
        const orConditions = [
          `username.ilike.%${sanitized}%`,
          `name.ilike.%${sanitized}%`,
          `email.ilike.%${sanitized}%`,
        ];
        if (phoneDigits.length >= 3) {
          orConditions.push(`phone.ilike.%${phoneDigits}%`);
        }
        query = query.or(orConditions.join(","));
      }
    }

    // 정렬
    const SORTABLE_COLUMNS = ["created_at", "username", "name", "total_purchase_amount", "updated_at"];
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "created_at";
    const ascending = sortOrder === "asc";
    query = query.order(safeSortBy, { ascending });

    // 페이징
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/admin/members] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "회원 목록 조회에 실패했습니다." },
        },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);
    const users = data ?? [];

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          data: [],
          total,
          page,
          per_page: limit,
          total_pages: totalPages,
        },
      });
    }

    // 회원별 카운트 집계 (RPC 1회로 통합 -- N+1 방지)
    const userIds = users.map((u) => u.id as string);

    const { data: countRows } = await adminClient.rpc("get_member_counts", {
      p_user_ids: userIds,
    });

    const countMap = new Map(
      ((countRows ?? []) as { user_id: string; voucher_count: number; gift_sent_count: number; gift_received_count: number; order_count: number; order_total_amount: number }[])
        .map((c) => [c.user_id, c])
    );

    // AdminUserListItem 매핑
    const members = users.map((user) => {
      const counts = countMap.get(user.id as string);
      return {
        ...user,
        order_count: counts?.order_count ?? 0,
        total_purchase_count: counts?.order_count ?? 0,
        total_purchase_amount: counts?.order_total_amount ?? 0,
        voucher_count: counts?.voucher_count ?? 0,
        gift_sent_count: counts?.gift_sent_count ?? 0,
        gift_received_count: counts?.gift_received_count ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: members,
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/members] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/members
 * 관리자 회원 직접 추가
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // Rate limiting
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `admin-create-member:${ip}`,
      ADMIN_CREATE_MEMBER_RATE_LIMIT,
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 },
      );
    }

    // 입력 검증
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." },
        },
        { status: 400 },
      );
    }
    const parsed = adminCreateMemberSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 },
      );
    }

    const { username, password, name, email, phone } = parsed.data;

    // 아이디 중복 확인
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_USERNAME",
            message: "이미 사용 중인 아이디입니다.",
          },
        },
        { status: 409 },
      );
    }

    // Supabase Auth 계정 생성
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already registered")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_EMAIL",
              message: "이미 가입된 이메일입니다.",
            },
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_CREATE_FAILED",
            message: "계정 생성에 실패했습니다.",
          },
        },
        { status: 500 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_CREATE_FAILED",
            message: "계정 생성에 실패했습니다.",
          },
        },
        { status: 500 },
      );
    }

    // users 테이블에 프로필 생성
    const { error: profileError } = await adminClient.from("users").insert({
      auth_id: authData.user.id,
      username,
      email,
      name,
      phone,
      identity_verified: false,
    });

    if (profileError) {
      // Auth 사용자가 이미 생성되었으므로 orphan 계정 방지를 위해 삭제
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authData.user.id);
      if (deleteError) {
        console.error("[POST /api/admin/members] CRITICAL: Orphan auth cleanup failed:", authData.user.id, deleteError);
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PROFILE_CREATE_FAILED",
            message: "회원 프로필 생성에 실패했습니다.",
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "회원이 성공적으로 추가되었습니다.",
          username,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 },
    );
  }
}
