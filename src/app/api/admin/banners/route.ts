import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreateBannerSchema } from "@/lib/validations/admin";
import type { Banner } from "@/types";

/**
 * GET /api/admin/banners
 *
 * 관리자 배너 전체 목록 조회 (sort_order 순, 비활성 포함)
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("banners")
      .select("id, image_url, link_url, alt_text, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/banners] Query error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "배너 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const banners: Banner[] = (data ?? []).map((row) => ({
      id: row.id as string,
      image_url: row.image_url as string,
      link_url: (row.link_url as string) ?? null,
      alt_text: (row.alt_text as string) ?? "",
      sort_order: row.sort_order as number,
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));

    return NextResponse.json({ success: true, data: banners });
  } catch (error) {
    console.error("[GET /api/admin/banners] Unexpected error:", error);
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
 * POST /api/admin/banners
 *
 * 관리자 배너 등록
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminCreateBannerSchema.safeParse(body);

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

    const { image_url, link_url, alt_text, sort_order, is_active } = parsed.data;

    // sort_order 자동 계산: 지정 안 됐으면 마지막 + 1
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxOrderRow } = await adminClient
        .from("banners")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalSortOrder = maxOrderRow ? (maxOrderRow.sort_order as number) + 1 : 1;
    }

    const { data: newBanner, error: insertError } = await adminClient
      .from("banners")
      .insert({
        image_url,
        link_url: link_url ?? null,
        alt_text: alt_text ?? "",
        sort_order: finalSortOrder,
        is_active: is_active ?? true,
      })
      .select("id, image_url, link_url, alt_text, sort_order, is_active, created_at, updated_at")
      .single();

    if (insertError || !newBanner) {
      console.error("[POST /api/admin/banners] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "배너 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    revalidatePath("/", "layout");

    const result: Banner = {
      id: newBanner.id as string,
      image_url: newBanner.image_url as string,
      link_url: (newBanner.link_url as string) ?? null,
      alt_text: (newBanner.alt_text as string) ?? "",
      sort_order: newBanner.sort_order as number,
      is_active: newBanner.is_active as boolean,
      created_at: newBanner.created_at as string,
      updated_at: newBanner.updated_at as string,
    };

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/banners] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
