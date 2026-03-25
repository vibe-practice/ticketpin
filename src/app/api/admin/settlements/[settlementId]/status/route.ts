import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["confirmed", "paid", "cancelled"]),
});

// 허용되는 상태 전이
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
};

type RouteContext = { params: Promise<{ settlementId: string }> };

/**
 * PATCH /api/admin/settlements/[settlementId]/status
 *
 * 정산 상태 변경:
 * - pending → confirmed / cancelled
 * - confirmed → paid / cancelled
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, adminUserId } = auth;

    const { settlementId } = await params;
    if (!UUID_RE.test(settlementId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 정산 ID입니다." } },
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
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "유효하지 않은 상태입니다." } },
        { status: 422 }
      );
    }

    const newStatus = parsed.data.status;

    // 현재 정산 조회
    const { data: settlement, error: fetchError } = await adminClient
      .from("settlements")
      .select("id, status, settlement_date")
      .eq("id", settlementId)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "정산을 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const currentStatus = (settlement as Record<string, unknown>).status as string;
    const settlementDate = (settlement as Record<string, unknown>).settlement_date as string;

    // 당일 정산은 확인/입금완료 처리 불가 (cancelled는 가능)
    if (newStatus !== "cancelled") {
      const kstParts = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const y = kstParts.find((p) => p.type === "year")!.value;
      const m = kstParts.find((p) => p.type === "month")!.value;
      const d = kstParts.find((p) => p.type === "day")!.value;
      const todayKST = `${y}-${m}-${d}`;

      if (settlementDate === todayKST) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SAME_DAY_SETTLEMENT",
              message: "당일에는 정산 처리가 불가능합니다. 익일 이후에 처리해주세요.",
            },
          },
          { status: 400 }
        );
      }
    }

    const allowed = VALID_TRANSITIONS[currentStatus];

    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `'${currentStatus}' 상태에서 '${newStatus}' 상태로 변경할 수 없습니다.`,
          },
        },
        { status: 400 }
      );
    }

    // 상태 업데이트
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "confirmed") {
      updateData.confirmed_at = now;
    } else if (newStatus === "paid") {
      updateData.paid_at = now;
      updateData.paid_by = adminUserId;
    }

    const { error: updateError } = await adminClient
      .from("settlements")
      .update(updateData)
      .eq("id", settlementId);

    if (updateError) {
      console.error("[PATCH /api/admin/settlements/:id/status] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "상태 변경에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { status: newStatus } });
  } catch (error) {
    console.error("[PATCH /api/admin/settlements/:id/status] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
