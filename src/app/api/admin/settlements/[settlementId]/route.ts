import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/utils";
import { settlementMemoSchema } from "@/lib/validations/business";

type RouteContext = { params: Promise<{ settlementId: string }> };

/**
 * GET /api/admin/settlements/[settlementId]
 *
 * 정산 상세 조회 (정산 정보 + settlement_gift_items)
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { settlementId } = await params;
    if (!UUID_RE.test(settlementId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 정산 ID입니다." } },
        { status: 400 }
      );
    }

    // 정산 + 업체 정보
    const { data: settlement, error: stlError } = await adminClient
      .from("settlements")
      .select(
        `*, businesses!inner(business_name, contact_person, bank_name, account_number, account_holder)`
      )
      .eq("id", settlementId)
      .single();

    if (stlError || !settlement) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "정산을 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    // 정산 항목 (settlement_gift_items) + 바우처 상태 JOIN
    const { data: rawItems, error: itemsError } = await adminClient
      .from("settlement_gift_items")
      .select("*, voucher:vouchers(status)")
      .eq("settlement_id", settlementId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("[GET /api/admin/settlements/:id] Items query error:", itemsError);
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "정산 항목 조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    // Flatten
    const stl = settlement as Record<string, unknown>;
    const biz = stl.businesses as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      data: {
        settlement: {
          id: stl.id,
          business_id: stl.business_id,
          settlement_date: stl.settlement_date,
          gift_count: stl.gift_count,
          gift_total_amount: stl.gift_total_amount,
          commission_rate: stl.commission_rate,
          settlement_amount: stl.settlement_amount,
          status: stl.status,
          confirmed_at: stl.confirmed_at,
          paid_at: stl.paid_at,
          paid_by: stl.paid_by,
          memo: stl.memo,
          created_at: stl.created_at,
          updated_at: stl.updated_at,
          business_name: biz?.business_name ?? "",
          contact_person: biz?.contact_person ?? "",
          bank_name: biz?.bank_name ?? "",
          account_number: biz?.account_number ?? "",
          account_holder: biz?.account_holder ?? "",
        },
        items: (rawItems ?? []).map((item) => {
          const row = item as Record<string, unknown>;
          const voucher = row.voucher as Record<string, unknown> | null;
          return { ...row, voucher_status: voucher?.status ?? null, voucher: undefined };
        }),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/settlements/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settlements/[settlementId]
 *
 * 정산 메모 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { settlementId } = await params;
    if (!UUID_RE.test(settlementId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 정산 ID입니다." } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = settlementMemoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." } },
        { status: 422 }
      );
    }

    const { error: updateError } = await adminClient
      .from("settlements")
      .update({ memo: parsed.data.memo ?? null })
      .eq("id", settlementId);

    if (updateError) {
      console.error("[PATCH /api/admin/settlements/:id] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_ERROR", message: "메모 저장에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/admin/settlements/:id] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
