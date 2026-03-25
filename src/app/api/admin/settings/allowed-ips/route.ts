import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { addIpSchema, deleteByIdSchema } from "@/lib/validations/admin";
import { getClientIp } from "@/lib/utils/ip";

/**
 * GET /api/admin/settings/allowed-ips
 * 허용된 IP 목록 조회
 */
export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await auth.adminClient
      .from("admin_allowed_ips")
      .select("id, ip_address, description, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "IP 목록을 조회할 수 없습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
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
 * POST /api/admin/settings/allowed-ips
 * IP 추가
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = addIpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { ip_address, description } = parsed.data;

    // 중복 체크
    const { data: existing } = await auth.adminClient
      .from("admin_allowed_ips")
      .select("id")
      .eq("ip_address", ip_address)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DUPLICATE_IP", message: "이미 등록된 IP 주소입니다." },
        },
        { status: 409 }
      );
    }

    const { data, error } = await auth.adminClient
      .from("admin_allowed_ips")
      .insert({
        ip_address,
        description: description || null,
      })
      .select("id, ip_address, description, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "IP 추가에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
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
 * DELETE /api/admin/settings/allowed-ips
 * IP 삭제
 */
export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = deleteByIdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    // 최소 1개의 IP는 유지해야 함
    const { data: allIps } = await auth.adminClient
      .from("admin_allowed_ips")
      .select("id")
      .limit(2);

    if (!allIps || allIps.length <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MIN_IP_REQUIRED",
            message: "최소 1개의 허용 IP가 필요합니다.",
          },
        },
        { status: 400 }
      );
    }

    // 자기 IP 차단 방지: 삭제 대상 IP가 현재 접속 IP와 동일하면 거부
    const { data: targetIp } = await auth.adminClient
      .from("admin_allowed_ips")
      .select("ip_address")
      .eq("id", parsed.data.id)
      .single();

    if (targetIp) {
      const currentIp = getClientIp(request.headers);
      if ((targetIp as Record<string, unknown>).ip_address === currentIp) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SELF_IP_DELETE_FORBIDDEN",
              message: "현재 접속 중인 IP는 삭제할 수 없습니다.",
            },
          },
          { status: 400 }
        );
      }
    }

    const { error } = await auth.adminClient
      .from("admin_allowed_ips")
      .delete()
      .eq("id", parsed.data.id);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DB_ERROR", message: "IP 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
