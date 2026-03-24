import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateSideBannerSchema } from "@/lib/validations/admin";
import type { SideBanner } from "@/types";

/**
 * GET /api/admin/side-banners
 *
 * 관리자 사이드 배너 전체 목록 조회 (비활성 포함)
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("side_banners")
      .select("id, image_url, link_url, alt_text, position, sort_order, is_active, created_at, updated_at")
      .order("position", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/side-banners] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "사이드 배너 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const sideBanners: SideBanner[] = (data ?? []).map((row) => ({
      id: row.id as string,
      image_url: row.image_url as string,
      link_url: (row.link_url as string) ?? null,
      alt_text: (row.alt_text as string) ?? "",
      position: row.position as SideBanner["position"],
      sort_order: row.sort_order as number,
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));

    return NextResponse.json({ success: true, data: sideBanners });
  } catch (error) {
    console.error("[GET /api/admin/side-banners] Unexpected error:", error);
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
 * POST /api/admin/side-banners
 *
 * 관리자 사이드 배너 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminCreateSideBannerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const { image_url, link_url, alt_text, position, sort_order, is_active } = parsed.data;

    // sort_order 자동 계산
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxOrderRow } = await adminClient
        .from("side_banners")
        .select("sort_order")
        .eq("position", position)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalSortOrder = maxOrderRow ? (maxOrderRow.sort_order as number) + 1 : 1;
    }

    const { data: newBanner, error: insertError } = await adminClient
      .from("side_banners")
      .insert({
        image_url,
        link_url: link_url ?? null,
        alt_text: alt_text ?? "",
        position,
        sort_order: finalSortOrder,
        is_active: is_active ?? true,
      })
      .select("id, image_url, link_url, alt_text, position, sort_order, is_active, created_at, updated_at")
      .single();

    if (insertError || !newBanner) {
      console.error("[POST /api/admin/side-banners] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "사이드 배너 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    revalidatePath("/", "layout");

    const result: SideBanner = {
      id: newBanner.id as string,
      image_url: newBanner.image_url as string,
      link_url: (newBanner.link_url as string) ?? null,
      alt_text: (newBanner.alt_text as string) ?? "",
      position: newBanner.position as SideBanner["position"],
      sort_order: newBanner.sort_order as number,
      is_active: newBanner.is_active as boolean,
      created_at: newBanner.created_at as string,
      updated_at: newBanner.updated_at as string,
    };

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/side-banners] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
