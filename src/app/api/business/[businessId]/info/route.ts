import { NextResponse } from "next/server";
import { getAuthenticatedBusiness, resolveBusinessId } from "@/lib/business/auth";

/**
 * GET /api/business/[businessId]/info
 *
 * 업체 정보 조회 (읽기 전용).
 * - 업체명, 담당자, 연락처, 은행/계좌, 수수료율, 상태
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (auth.error) return auth.error;

    const { businessId: sessionBizId, adminClient } = auth;
    const { businessId: urlIdentifier } = await params;

    const businessId = await resolveBusinessId(urlIdentifier);
    if (!businessId || sessionBizId !== businessId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BUSINESS_FORBIDDEN", message: "접근 권한이 없습니다." },
        },
        { status: 403 }
      );
    }

    const { data: business, error: bizError } = await adminClient
      .from("businesses")
      .select(
        "id, user_id, business_name, contact_person, contact_phone, bank_name, account_number, account_holder, commission_rate, receiving_account_id, status, memo, created_at, updated_at"
      )
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BUSINESS_NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: business,
    });
  } catch (error) {
    console.error("[GET /api/business/:id/info] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
