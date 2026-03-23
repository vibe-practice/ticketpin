import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedBusiness, resolveBusinessId } from "@/lib/business/auth";

const accessLogsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId: urlIdentifier } = await params;

    // 세션 검증
    const auth = await getAuthenticatedBusiness();
    if (auth.error) return auth.error;

    const { businessId: sessionBusinessId, adminClient } = auth;

    // URL의 login_id 또는 UUID를 실제 business_id로 변환
    const businessId = await resolveBusinessId(urlIdentifier);
    if (!businessId || sessionBusinessId !== businessId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_FORBIDDEN",
            message: "접근 권한이 없습니다.",
          },
        },
        { status: 403 }
      );
    }

    // 쿼리 파라미터 검증
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = accessLogsQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUERY",
            message: "잘못된 요청 파라미터입니다.",
          },
        },
        { status: 400 }
      );
    }

    const { from, to, page, limit } = parsed.data;

    // 쿼리 빌드
    let query = adminClient
      .from("business_access_logs")
      .select("id, business_id, ip_address, action, user_agent, created_at", {
        count: "exact",
      })
      .eq("business_id", sessionBusinessId)
      .order("created_at", { ascending: false });

    // 기간 필터
    if (from) {
      query = query.gte("created_at", `${from}T00:00:00+09:00`);
    }
    if (to) {
      query = query.lte("created_at", `${to}T23:59:59+09:00`);
    }

    // 페이지네이션
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("[access-logs] 조회 실패:", error.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QUERY_ERROR",
            message: "로그 조회 중 오류가 발생했습니다.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs ?? [],
        total: count ?? 0,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("[access-logs] 서버 오류:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 내부 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
