import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { businessFormSchema } from "@/lib/validations/business";
import { UUID_RE, escapeIlike } from "@/lib/admin/utils";
import type { AdminBusinessListItem } from "@/types";

/**
 * GET /api/admin/businesses
 *
 * 관리자 업체 목록 조회 (필터/검색/페이징 + 통계 집계)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // ── 페이징 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) ?? [];

    // ── 검색: username은 users 테이블이므로 먼저 user_id 목록을 조회 (#2 수정) ──
    let matchedUserIds: string[] | null = null;
    if (search) {
      const escaped = escapeIlike(search);
      if (escaped) {
        const { data: matchedUsers } = await adminClient
          .from("users")
          .select("id")
          .ilike("username", `%${escaped}%`);
        matchedUserIds = (matchedUsers ?? []).map((u) => (u as Record<string, unknown>).id as string);
      }
    }

    // ── 업체 조회 (users JOIN 제거 — FK 모호성 방지) ──
    let query = adminClient
      .from("businesses")
      .select(
        `id, user_id, business_name, contact_person, contact_phone, auth_phone,
         bank_name, account_number, account_holder,
         commission_rate, receiving_account_id, status, memo,
         created_at, updated_at`,
        { count: "exact" }
      );

    // 상태 필터
    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

    // 검색 (업체명, 담당자명, username → user_id)
    if (search) {
      const escaped = escapeIlike(search);
      if (escaped) {
        if (matchedUserIds && matchedUserIds.length > 0) {
          query = query.or(
            `business_name.ilike.%${escaped}%,contact_person.ilike.%${escaped}%,user_id.in.(${matchedUserIds.join(",")})`
          );
        } else {
          query = query.or(
            `business_name.ilike.%${escaped}%,contact_person.ilike.%${escaped}%`
          );
        }
      }
    }

    // 정렬 + 페이징
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: businessesRaw, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /api/admin/businesses] Query error:", queryError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "업체 목록 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    if (!businessesRaw || businessesRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: { data: [], total, page, per_page: limit, total_pages: Math.ceil(total / limit) },
      });
    }

    // ── user_id → username/name 조회 (별도 쿼리) ──
    const userIds = businessesRaw
      .map((b) => (b as Record<string, unknown>).user_id as string)
      .filter((id): id is string => !!id && UUID_RE.test(id));

    const userMap = new Map<string, { username: string; name: string }>();
    if (userIds.length > 0) {
      const { data: userRows } = await adminClient
        .from("users")
        .select("id, username, name")
        .in("id", [...new Set(userIds)]);

      for (const u of userRows ?? []) {
        const row = u as Record<string, unknown>;
        userMap.set(row.id as string, {
          username: row.username as string,
          name: (row.name as string) ?? "",
        });
      }
    }

    // ── 수신 계정 username 조회 ──
    const receivingIds = businessesRaw
      .map((b) => (b as Record<string, unknown>).receiving_account_id as string | null)
      .filter((id): id is string => !!id && UUID_RE.test(id));

    const receivingMap = new Map<string, string>();
    if (receivingIds.length > 0) {
      const { data: recvUsers } = await adminClient
        .from("users")
        .select("id, username")
        .in("id", receivingIds);

      for (const u of recvUsers ?? []) {
        const row = u as Record<string, unknown>;
        receivingMap.set(row.id as string, row.username as string);
      }
    }

    // ── 통계 집계: gifts 벌크 조회 (#1 수정 — N+1 제거) ──
    const bizIds = businessesRaw.map((b) => (b as Record<string, unknown>).id as string);
    const bizReceivingIds = businessesRaw
      .map((b) => (b as Record<string, unknown>).receiving_account_id as string | null)
      .filter((id): id is string => !!id);

    const giftStatsMap = new Map<string, { count: number; amount: number }>();

    if (bizReceivingIds.length > 0) {
      // 1회 벌크 조회: 수신 계정으로 받은 모든 선물
      const { data: allGifts } = await adminClient
        .from("gifts")
        .select("id, receiver_id, new_voucher_id")
        .in("receiver_id", bizReceivingIds);

      if (allGifts && allGifts.length > 0) {
        // receiver_id별 gift 수 집계
        const giftsByReceiver = new Map<string, string[]>();
        for (const g of allGifts) {
          const gift = g as Record<string, unknown>;
          const recvId = gift.receiver_id as string;
          const voucherId = gift.new_voucher_id as string;
          if (!giftsByReceiver.has(recvId)) giftsByReceiver.set(recvId, []);
          giftsByReceiver.get(recvId)!.push(voucherId);
        }

        // 벌크 조회: voucher → order_id
        const allVoucherIds = allGifts.map((g) => (g as Record<string, unknown>).new_voucher_id as string);
        const { data: vouchers } = await adminClient
          .from("vouchers")
          .select("id, order_id")
          .in("id", allVoucherIds);

        const voucherOrderMap = new Map<string, string>();
        for (const v of vouchers ?? []) {
          const voucher = v as Record<string, unknown>;
          voucherOrderMap.set(voucher.id as string, voucher.order_id as string);
        }

        // 벌크 조회: orders → total_amount
        const allOrderIds = [...new Set([...voucherOrderMap.values()])];
        const orderAmountMap = new Map<string, number>();
        if (allOrderIds.length > 0) {
          const { data: orders } = await adminClient
            .from("orders")
            .select("id, total_amount")
            .in("id", allOrderIds);

          for (const o of orders ?? []) {
            const order = o as Record<string, unknown>;
            orderAmountMap.set(order.id as string, order.total_amount as number);
          }
        }

        // 메모리 집계
        for (const [recvId, voucherIds] of giftsByReceiver) {
          let totalAmount = 0;
          for (const vid of voucherIds) {
            const orderId = voucherOrderMap.get(vid);
            if (orderId) totalAmount += orderAmountMap.get(orderId) ?? 0;
          }
          giftStatsMap.set(recvId, { count: voucherIds.length, amount: totalAmount });
        }
      }
    }

    // settlements 통계: 업체별 정산 집계
    const settleStatsMap = new Map<string, { settled: number; pending: number }>();

    if (bizIds.length > 0) {
      const { data: settleData } = await adminClient
        .from("settlements")
        .select("business_id, settlement_amount, status")
        .in("business_id", bizIds);

      for (const row of settleData ?? []) {
        const s = row as Record<string, unknown>;
        const bid = s.business_id as string;
        const amt = s.settlement_amount as number;
        const status = s.status as string;

        const prev = settleStatsMap.get(bid) ?? { settled: 0, pending: 0 };
        if (status === "paid") {
          prev.settled += amt;
        } else if (status === "pending" || status === "confirmed") {
          prev.pending += amt;
        }
        settleStatsMap.set(bid, prev);
      }
    }

    // ── 데이터 매핑 ──
    const items: AdminBusinessListItem[] = businessesRaw.map((raw) => {
      const biz = raw as Record<string, unknown>;
      const bizId = biz.id as string;
      const userId = biz.user_id as string;
      const recvId = biz.receiving_account_id as string | null;
      const user = userMap.get(userId);

      const giftStat = recvId ? giftStatsMap.get(recvId) : undefined;
      const settleStat = settleStatsMap.get(bizId);

      return {
        id: bizId,
        user_id: userId,
        business_name: biz.business_name as string,
        contact_person: biz.contact_person as string,
        contact_phone: biz.contact_phone as string,
        bank_name: biz.bank_name as string,
        account_number: biz.account_number as string,
        account_holder: biz.account_holder as string,
        commission_rate: Number(biz.commission_rate),
        receiving_account_id: recvId,
        auth_phone: (biz.auth_phone as string) ?? null,
        status: biz.status as "active" | "terminated",
        memo: (biz.memo as string) ?? null,
        created_at: biz.created_at as string,
        updated_at: biz.updated_at as string,
        username: user?.username ?? "",
        user_name: user?.name ?? "",
        receiving_account_username: recvId ? (receivingMap.get(recvId) ?? null) : null,
        total_gift_count: giftStat?.count ?? 0,
        total_gift_amount: giftStat?.amount ?? 0,
        total_settled_amount: settleStat?.settled ?? 0,
        pending_settlement_amount: settleStat?.pending ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: items,
        total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/businesses] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/businesses
 *
 * 관리자 업체 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = businessFormSchema.safeParse(body);

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

    const data = parsed.data;

    // user_id 존재 여부 확인
    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("id, username, name")
      .eq("id", data.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "존재하지 않는 회원입니다." } },
        { status: 404 }
      );
    }

    // receiving_account_id 존재 여부 확인
    let receivingUsername: string | null = null;
    if (data.receiving_account_id) {
      const { data: recvUser, error: recvError } = await adminClient
        .from("users")
        .select("id, username")
        .eq("id", data.receiving_account_id)
        .single();

      if (recvError || !recvUser) {
        return NextResponse.json(
          { success: false, error: { code: "RECEIVING_USER_NOT_FOUND", message: "수신 계정을 찾을 수 없습니다." } },
          { status: 404 }
        );
      }
      receivingUsername = (recvUser as Record<string, unknown>).username as string;
    }

    // 업체 먼저 생성 (#6 수정 — 플래그보다 insert 먼저)
    const { data: newBiz, error: insertError } = await adminClient
      .from("businesses")
      .insert({
        user_id: data.user_id,
        business_name: data.business_name,
        contact_person: data.contact_person,
        contact_phone: data.contact_phone,
        bank_name: data.bank_name,
        account_number: data.account_number,
        account_holder: data.account_holder,
        commission_rate: data.commission_rate,
        receiving_account_id: data.receiving_account_id ?? null,
        memo: data.memo ?? null,
      })
      .select("*")
      .single();

    if (insertError || !newBiz) {
      console.error("[POST /api/admin/businesses] Insert error:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "INSERT_ERROR", message: "업체 등록에 실패했습니다." } },
        { status: 500 }
      );
    }

    // 업체 생성 성공 후 수신 계정 플래그 설정 (#5 수정 — 에러 핸들링 추가)
    if (data.receiving_account_id) {
      const { error: flagError } = await adminClient
        .from("users")
        .update({ is_receiving_account: true })
        .eq("id", data.receiving_account_id);

      if (flagError) {
        console.error("[POST /api/admin/businesses] Flag update error:", flagError);
        // 업체는 이미 생성됨 — 플래그 실패를 로그하고 계속 진행
        // (is_receiving_account는 검색 제외용이므로 critical하지 않음)
      }
    }

    // 포털 로그인 계정 자동 생성 (회원 username + auth.users.encrypted_password 복사)
    const bizId = (newBiz as Record<string, unknown>).id as string;
    const userRow2 = user as Record<string, unknown>;
    const loginId = userRow2.username as string;
    let portalAccountWarning: string | null = null;

    // public.users.auth_id로 auth.users.encrypted_password 조회 (RPC)
    const { data: authIdRow } = await adminClient
      .from("users")
      .select("auth_id")
      .eq("id", data.user_id)
      .single();

    if (authIdRow) {
      const authId = (authIdRow as Record<string, unknown>).auth_id as string;
      const { data: passwordHash } = await adminClient.rpc("get_auth_password", { p_auth_id: authId });

      if (passwordHash) {
        const { error: accountError } = await adminClient
          .from("business_accounts")
          .insert({
            business_id: bizId,
            login_id: loginId,
            password_hash: passwordHash as string,
          });

        if (accountError) {
          console.error("[POST /api/admin/businesses] Portal account error:", accountError);
          portalAccountWarning = "업체는 등록되었으나 포털 계정 생성에 실패했습니다. 수동으로 확인하세요.";
        }
      } else {
        portalAccountWarning = "업체는 등록되었으나 회원 비밀번호를 조회할 수 없어 포털 계정이 생성되지 않았습니다.";
      }
    } else {
      portalAccountWarning = "업체는 등록되었으나 회원 auth 정보를 찾을 수 없어 포털 계정이 생성되지 않았습니다.";
    }

    const biz = newBiz as Record<string, unknown>;
    const userRow = user as Record<string, unknown>;

    const result: AdminBusinessListItem = {
      id: biz.id as string,
      user_id: biz.user_id as string,
      business_name: biz.business_name as string,
      contact_person: biz.contact_person as string,
      contact_phone: biz.contact_phone as string,
      bank_name: biz.bank_name as string,
      account_number: biz.account_number as string,
      account_holder: biz.account_holder as string,
      commission_rate: Number(biz.commission_rate),
      receiving_account_id: (biz.receiving_account_id as string) ?? null,
      auth_phone: (biz.auth_phone as string) ?? null,
      status: biz.status as "active",
      memo: (biz.memo as string) ?? null,
      created_at: biz.created_at as string,
      updated_at: biz.updated_at as string,
      username: userRow.username as string,
      user_name: userRow.name as string,
      receiving_account_username: receivingUsername,
      total_gift_count: 0,
      total_gift_amount: 0,
      total_settled_amount: 0,
      pending_settlement_amount: 0,
    };

    return NextResponse.json(
      { success: true, data: result, ...(portalAccountWarning ? { warning: portalAccountWarning } : {}) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/businesses] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
