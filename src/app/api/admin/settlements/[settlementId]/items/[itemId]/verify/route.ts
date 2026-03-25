import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import { verificationSchema } from "@/lib/validations/business";

type RouteContext = { params: Promise<{ settlementId: string; itemId: string }> };

/**
 * PATCH /api/admin/settlements/[settlementId]/items/[itemId]/verify
 *
 * 교환권 검증 상태 변경 + rejected 시 정산 금액 재계산
 * DB RPC `verify_settlement_item`으로 원자적 처리 (동시 verify 시 금액 불일치 방지)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { settlementId, itemId } = await params;
    if (!UUID_RE.test(settlementId) || !UUID_RE.test(itemId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 ID입니다." } },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }
    const parsed = verificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." } },
        { status: 422 }
      );
    }

    const { verification_status, verification_memo } = parsed.data;

    // DB RPC로 원자적 처리 (FOR UPDATE 잠금 + 재계산을 단일 트랜잭션에서 수행)
    const { data, error } = await adminClient.rpc("verify_settlement_item", {
      p_item_id: itemId,
      p_settlement_id: settlementId,
      p_verification_status: verification_status,
      p_verification_memo: verification_memo ?? null,
    });

    if (error) {
      console.error("[PATCH verify] RPC error:", error);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "검증 상태 변경에 실패했습니다." } },
        { status: 500 }
      );
    }

    const result = data as Record<string, unknown>;
    if (result.success === false) {
      const errorCode = result.error_code as string;
      const errorMessage = result.error_message as string;
      const statusCode = errorCode === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json(
        { success: false, error: { code: errorCode, message: errorMessage } },
        { status: statusCode }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH verify] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
