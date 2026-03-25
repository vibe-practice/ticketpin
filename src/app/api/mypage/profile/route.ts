import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import { ACTIVE_VOUCHER_STATUSES } from "@/lib/voucher-status";

/**
 * GET /api/mypage/profile
 *
 * 내 프로필 조회 (회원정보 수정 페이지용).
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;

    const { data: user, error: userError } = await adminClient
      .from("users")
      .select(
        "id, username, name, email, phone, identity_verified, status, total_purchase_count, total_purchase_amount, created_at, updated_at"
      )
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "USER_NOT_FOUND", message: "사용자 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("[GET /api/mypage/profile] Unexpected error:", error);
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
 * DELETE /api/mypage/profile
 *
 * 회원 탈퇴.
 * - 인증 필수
 * - 사용 가능한 바우처가 있으면 탈퇴 불가
 * - 탈퇴 시: users.status를 "withdrawn"으로 변경 + Supabase Auth 사용자 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;

    // Rate limiting (IP 기반, 10분에 3회)
    const ip = getClientIp(request.headers);
    const rateLimit = await checkRateLimit(`withdraw:${ip}`, {
      maxAttempts: 3,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // 사용 가능한 바우처 존재 여부 확인
    const { count: activeVoucherCount, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .in("status", ACTIVE_VOUCHER_STATUSES);

    if (voucherError) {
      console.error("[DELETE /api/mypage/profile] Voucher check error:", voucherError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "탈퇴 조건 확인 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    if ((activeVoucherCount ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "HAS_ACTIVE_VOUCHERS",
            message: `보유 중인 상품권이 ${activeVoucherCount}개 있어 탈퇴할 수 없습니다. 상품권을 모두 사용하거나 취소한 후 탈퇴해 주세요.`,
          },
        },
        { status: 409 }
      );
    }

    // 현재 사용자 상태 조회 (롤백 시 원래 상태 보존을 위해)
    const { data: currentUser } = await adminClient
      .from("users")
      .select("status")
      .eq("id", userId)
      .single();

    const originalStatus = currentUser?.status ?? "active";

    // auth_id 조회
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_ERROR", message: "인증 정보를 확인할 수 없습니다." },
        },
        { status: 401 }
      );
    }

    // users 테이블 status를 withdrawn으로 변경
    const { error: updateError } = await adminClient
      .from("users")
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[DELETE /api/mypage/profile] User update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_FAILED", message: "탈퇴 처리 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    // Supabase Auth 사용자 삭제
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
      authUser.id
    );

    if (deleteAuthError) {
      // Auth 삭제 실패 시 users 상태 롤백
      console.error("[DELETE /api/mypage/profile] Auth delete error:", deleteAuthError);
      const { error: rollbackError } = await adminClient
        .from("users")
        .update({ status: originalStatus, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (rollbackError) {
        console.error("[DELETE /api/mypage/profile] CRITICAL: Rollback failed:", rollbackError);
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_FAILED", message: "탈퇴 처리 중 오류가 발생했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "회원 탈퇴가 완료되었습니다." },
    });
  } catch (error) {
    console.error("[DELETE /api/mypage/profile] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
