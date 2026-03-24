import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SideBanner } from "@/types";

/**
 * GET /api/side-banners
 *
 * 활성 사이드 배너 목록 조회 (position, sort_order 순)
 * 인증 불필요 — 공개 API
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("side_banners")
      .select("id, image_url, link_url, alt_text, position, sort_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/side-banners] Query error:", error);
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
    console.error("[GET /api/side-banners] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
