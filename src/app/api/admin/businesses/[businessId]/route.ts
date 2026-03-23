import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { businessFormSchema } from "@/lib/validations/business";
import { UUID_RE } from "@/lib/admin/utils";
import type { AdminBusinessListItem } from "@/types";

function invalidIdResponse() {
  return NextResponse.json(
    { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 업체 ID입니다." } },
    { status: 400 }
  );
}

/**
 * GET /api/admin/businesses/[businessId]
 *
 * 관리자 업체 상세 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) return invalidIdResponse();

    const { data: biz, error } = await adminClient
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (error || !biz) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    const raw = biz as Record<string, unknown>;
    const recvId = raw.receiving_account_id as string | null;

    // user_id → username/name 별도 조회 (FK 모호성 방지)
    let user: { username: string; name: string } | null = null;
    if (raw.user_id) {
      const { data: userRow } = await adminClient
        .from("users")
        .select("username, name")
        .eq("id", raw.user_id as string)
        .single();
      if (userRow) {
        const u = userRow as Record<string, unknown>;
        user = { username: u.username as string, name: (u.name as string) ?? "" };
      }
    }

    // 수신 계정 username 조회
    let receivingUsername: string | null = null;
    if (recvId) {
      const { data: recvUser } = await adminClient
        .from("users")
        .select("username")
        .eq("id", recvId)
        .single();
      receivingUsername = (recvUser as Record<string, unknown> | null)?.username as string ?? null;
    }

    // ── 통계: 벌크 조회로 N+1 제거 (#3 수정) ──
    let totalGiftCount = 0;
    let totalGiftAmount = 0;

    if (recvId) {
      // gifts 조회 (1회)
      const { data: giftData } = await adminClient
        .from("gifts")
        .select("id, new_voucher_id")
        .eq("receiver_id", recvId);

      totalGiftCount = giftData?.length ?? 0;

      if (giftData && giftData.length > 0) {
        // vouchers 벌크 조회 (1회)
        const voucherIds = giftData.map((g) => (g as Record<string, unknown>).new_voucher_id as string);
        const { data: vouchers } = await adminClient
          .from("vouchers")
          .select("id, order_id")
          .in("id", voucherIds);

        if (vouchers && vouchers.length > 0) {
          // orders 벌크 조회 (1회)
          const orderIds = [...new Set(vouchers.map((v) => (v as Record<string, unknown>).order_id as string))];
          const { data: orders } = await adminClient
            .from("orders")
            .select("id, total_amount")
            .in("id", orderIds);

          totalGiftAmount = (orders ?? []).reduce(
            (sum, o) => sum + ((o as Record<string, unknown>).total_amount as number),
            0
          );
        }
      }
    }

    // 정산 통계 (1회 벌크 조회)
    let totalSettled = 0;
    let pendingSettlement = 0;
    const { data: settleData } = await adminClient
      .from("settlements")
      .select("settlement_amount, status")
      .eq("business_id", businessId);

    for (const row of settleData ?? []) {
      const s = row as Record<string, unknown>;
      const amt = s.settlement_amount as number;
      const status = s.status as string;
      if (status === "paid") totalSettled += amt;
      else if (status === "pending" || status === "confirmed") pendingSettlement += amt;
    }

    const result: AdminBusinessListItem = {
      id: raw.id as string,
      user_id: raw.user_id as string,
      business_name: raw.business_name as string,
      contact_person: raw.contact_person as string,
      contact_phone: raw.contact_phone as string,
      bank_name: raw.bank_name as string,
      account_number: raw.account_number as string,
      account_holder: raw.account_holder as string,
      commission_rate: Number(raw.commission_rate),
      receiving_account_id: recvId,
      auth_phone: (raw.auth_phone as string) ?? null,
      status: raw.status as "active" | "terminated",
      memo: (raw.memo as string) ?? null,
      created_at: raw.created_at as string,
      updated_at: raw.updated_at as string,
      username: user?.username ?? "",
      user_name: user?.name ?? "",
      receiving_account_username: receivingUsername,
      total_gift_count: totalGiftCount,
      total_gift_amount: totalGiftAmount,
      total_settled_amount: totalSettled,
      pending_settlement_amount: pendingSettlement,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/admin/businesses/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/businesses/[businessId]
 *
 * 관리자 업체 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) return invalidIdResponse();

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

    // 기존 업체 확인
    const { data: existing, error: existError } = await adminClient
      .from("businesses")
      .select("id, receiving_account_id")
      .eq("id", businessId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    const data = parsed.data;
    const existingRaw = existing as Record<string, unknown>;
    const oldReceivingId = existingRaw.receiving_account_id as string | null;
    const newReceivingId = data.receiving_account_id ?? null;

    // receiving_account_id 변경 시 새 수신 계정 존재 여부 먼저 확인
    if (newReceivingId && newReceivingId !== oldReceivingId) {
      const { data: recvUser, error: recvError } = await adminClient
        .from("users")
        .select("id")
        .eq("id", newReceivingId)
        .single();

      if (recvError || !recvUser) {
        return NextResponse.json(
          { success: false, error: { code: "RECEIVING_USER_NOT_FOUND", message: "수신 계정을 찾을 수 없습니다." } },
          { status: 404 }
        );
      }
    }

    // 업체 업데이트 먼저 실행
    const { data: updated, error: updateError } = await adminClient
      .from("businesses")
      .update({
        business_name: data.business_name,
        contact_person: data.contact_person,
        contact_phone: data.contact_phone,
        bank_name: data.bank_name,
        account_number: data.account_number,
        account_holder: data.account_holder,
        commission_rate: data.commission_rate,
        receiving_account_id: newReceivingId,
        memo: data.memo ?? null,
      })
      .eq("id", businessId)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/admin/businesses/:id] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "업체 수정에 실패했습니다." } },
        { status: 500 }
      );
    }

    // 업체 업데이트 성공 후 플래그 처리 (#5 수정 — 에러 핸들링 추가)
    if (oldReceivingId !== newReceivingId) {
      // 기존 수신 계정 플래그 해제 (다른 업체에서 사용 중이 아닌 경우만)
      if (oldReceivingId) {
        const { count: otherBizCount } = await adminClient
          .from("businesses")
          .select("id", { count: "exact", head: true })
          .eq("receiving_account_id", oldReceivingId)
          .neq("id", businessId);

        if ((otherBizCount ?? 0) === 0) {
          const { error: flagOffError } = await adminClient
            .from("users")
            .update({ is_receiving_account: false })
            .eq("id", oldReceivingId);

          if (flagOffError) {
            console.error("[PATCH /api/admin/businesses/:id] Flag off error:", flagOffError);
          }
        }
      }

      // 새 수신 계정 플래그 설정
      if (newReceivingId) {
        const { error: flagOnError } = await adminClient
          .from("users")
          .update({ is_receiving_account: true })
          .eq("id", newReceivingId);

        if (flagOnError) {
          console.error("[PATCH /api/admin/businesses/:id] Flag on error:", flagOnError);
        }
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/businesses/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/businesses/[businessId]
 *
 * 관리자 업체 삭제 (소프트 삭제: status → terminated)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) return invalidIdResponse();

    // 존재 여부 확인
    const { data: existing, error: existError } = await adminClient
      .from("businesses")
      .select("id, status")
      .eq("id", businessId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    if ((existing as Record<string, unknown>).status === "terminated") {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_TERMINATED", message: "이미 해지된 업체입니다." } },
        { status: 400 }
      );
    }

    // 소프트 삭제
    const { error: updateError } = await adminClient
      .from("businesses")
      .update({ status: "terminated" })
      .eq("id", businessId);

    if (updateError) {
      console.error("[DELETE /api/admin/businesses/:id] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "DELETE_ERROR", message: "업체 해지에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id: businessId } });
  } catch (error) {
    console.error("[DELETE /api/admin/businesses/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/businesses/[businessId]
 *
 * 해지된 업체 재활성화 (status: terminated → active)
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { businessId } = await params;
    if (!UUID_RE.test(businessId)) return invalidIdResponse();

    // 존재 여부 확인
    const { data: existing, error: existError } = await adminClient
      .from("businesses")
      .select("id, status")
      .eq("id", businessId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: "BUSINESS_NOT_FOUND", message: "존재하지 않는 업체입니다." } },
        { status: 404 }
      );
    }

    if ((existing as Record<string, unknown>).status === "active") {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_ACTIVE", message: "이미 활성 상태인 업체입니다." } },
        { status: 400 }
      );
    }

    // 재활성화
    const { error: updateError } = await adminClient
      .from("businesses")
      .update({ status: "active" })
      .eq("id", businessId);

    if (updateError) {
      console.error("[PUT /api/admin/businesses/:id] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "REACTIVATE_ERROR", message: "업체 활성화에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id: businessId } });
  } catch (error) {
    console.error("[PUT /api/admin/businesses/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
