import { NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/business/auth";

export async function GET() {
  try {
    const auth = await getAuthenticatedBusiness();
    if (auth.error) return auth.error;

    const { businessId, adminClient } = auth;

    // 업체 정보 + login_id 조회
    const [bizResult, accountResult] = await Promise.all([
      adminClient
        .from("businesses")
        .select("id, business_name, contact_person, contact_phone, status")
        .eq("id", businessId)
        .single(),
      adminClient
        .from("business_accounts")
        .select("login_id")
        .eq("business_id", businessId)
        .single(),
    ]);

    if (bizResult.error || !bizResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "업체 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    const business = bizResult.data;
    const loginId = (accountResult.data as Record<string, unknown>)?.login_id as string | undefined;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: business.id,
          loginId: loginId ?? null,
          businessName: business.business_name,
          contactPerson: business.contact_person,
          status: business.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[biz-me] Unexpected error:", error);
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
