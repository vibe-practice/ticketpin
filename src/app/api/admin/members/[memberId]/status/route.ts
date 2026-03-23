import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateMemberStatusSchema } from "@/lib/validations/admin";
import type { AdminUserListItem } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/members/[memberId]/status
 *
 * 관리자 회원 상태 변경 (active, suspended, withdrawn)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    if (!UUID_REGEX.test(memberId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_MEMBER_ID", message: "유효하지 않은 회원 ID입니다." },
        },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

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
        { status: 400 }
      );
    }

    const parsed = adminUpdateMemberStatusSchema.safeParse(body);
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
        { status: 400 }
      );
    }

    const { status: newStatus } = parsed.data;

    // 회원 존재 확인
    const { data: existing, error: findError } = await adminClient
      .from("users")
      .select("id, status")
      .eq("id", memberId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MEMBER_NOT_FOUND", message: "회원을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    if (existing.status === newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STATUS_UNCHANGED",
            message: "이미 동일한 상태입니다.",
          },
        },
        { status: 400 }
      );
    }

    // 상태 업데이트
    const { data: updated, error: updateError } = await adminClient
      .from("users")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .select(
        "id, auth_id, username, email, name, phone, identity_verified, status, total_purchase_count, total_purchase_amount, created_at, updated_at"
      )
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/admin/members/[memberId]/status] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "상태 변경에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // suspended/withdrawn인 경우 Supabase Auth 사용자도 ban 처리 고려
    // (현재는 users 테이블의 status만 변경 — 로그인 시 status 체크로 차단)

    // 카운트 정보 추가 조회
    const [voucherCountRes, giftSentRes, giftReceivedRes] = await Promise.all([
      adminClient
        .from("vouchers")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", memberId)
        .neq("status", "cancelled"),
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", memberId),
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", memberId),
    ]);

    const member: AdminUserListItem = {
      ...(updated as AdminUserListItem),
      order_count: (updated.total_purchase_count as number) ?? 0,
      voucher_count: voucherCountRes.count ?? 0,
      gift_sent_count: giftSentRes.count ?? 0,
      gift_received_count: giftReceivedRes.count ?? 0,
    };

    return NextResponse.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("[PATCH /api/admin/members/[memberId]/status] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
