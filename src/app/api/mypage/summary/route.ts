import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth-guard";
import { ACTIVE_VOUCHER_STATUSES } from "@/lib/voucher-status";

/**
 * GET /api/mypage/summary
 *
 * 마이페이지 대시보드 요약 정보 조회.
 * - 사용자 프로필 (이름, 이메일, 전화번호 등)
 * - 보유 상품권 수 (사용 가능 상태)
 * - 총 구매 건수/금액
 * - 보낸/받은 선물 수
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { userId, adminClient } = auth;

    // ── 병렬 쿼리 실행 ──
    const [userResult, voucherResult, orderSummaryResult, giftSentResult, giftReceivedResult] = await Promise.all([
      // 사용자 프로필
      adminClient
        .from("users")
        .select("id, username, name, email, phone, identity_verified, created_at")
        .eq("id", userId)
        .single(),
      // 보유 상품권 수 (사용 가능 상태)
      adminClient
        .from("vouchers")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .in("status", ACTIVE_VOUCHER_STATUSES),
      // 주문 요약 (건수 + 금액, DB 레벨 집계)
      adminClient.rpc("get_user_order_summary", { p_user_id: userId }).single(),
      // 보낸 선물 수
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", userId),
      // 받은 선물 수
      adminClient
        .from("gifts")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId),
    ]);

    if (userResult.error || !userResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "USER_NOT_FOUND", message: "사용자 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // 부분 쿼리 실패 로깅
    const queryErrors = [
      orderSummaryResult.error && { query: "orderSummary", error: orderSummaryResult.error },
      voucherResult.error && { query: "voucher", error: voucherResult.error },
      giftSentResult.error && { query: "giftSent", error: giftSentResult.error },
      giftReceivedResult.error && { query: "giftReceived", error: giftReceivedResult.error },
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      console.error("[GET /api/mypage/summary] Partial query errors:", queryErrors);
    }

    const user = userResult.data;
    const orderSummary = orderSummaryResult.data as { order_count: number; total_amount: number } | null;

    return NextResponse.json({
      success: true,
      data: {
        user,
        voucher_count: voucherResult.count ?? 0,
        total_purchase_count: orderSummary?.order_count ?? 0,
        total_purchase_amount: orderSummary?.total_amount ?? 0,
        gift_sent_count: giftSentResult.count ?? 0,
        gift_received_count: giftReceivedResult.count ?? 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/mypage/summary] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
