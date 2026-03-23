import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";

type RouteContext = { params: Promise<{ settlementId: string; itemId: string }> };

/**
 * POST /api/admin/settlements/[settlementId]/items/[itemId]/recycle
 *
 * 핀 수동 재활용 — recycle_settlement_pins RPC 호출
 */
export async function POST(
  _request: NextRequest,
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

    // 항목이 해당 정산에 속하는지 확인
    const { data: item, error: itemError } = await adminClient
      .from("settlement_gift_items")
      .select("id, settlement_id")
      .eq("id", itemId)
      .eq("settlement_id", settlementId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "정산 항목을 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    // RPC 호출
    const { data: result, error: rpcError } = await adminClient.rpc(
      "recycle_settlement_pins",
      { p_settlement_gift_item_id: itemId }
    );

    if (rpcError) {
      console.error("[POST recycle] RPC error:", rpcError);
      return NextResponse.json(
        { success: false, error: { code: "RPC_ERROR", message: "핀 재활용 처리에 실패했습니다." } },
        { status: 500 }
      );
    }

    const rpcResult = result as Record<string, unknown>;

    if (rpcResult.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: (rpcResult.error_code as string) ?? "RPC_FAILED",
            message: (rpcResult.error_message as string) ?? "핀 재활용에 실패했습니다.",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recycled_pin_count: rpcResult.recycled_pin_count,
        voucher_id: rpcResult.voucher_id,
      },
    });
  } catch (error) {
    console.error("[POST recycle] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
