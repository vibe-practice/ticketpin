import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Banner } from "@/types";

/**
 * GET /api/banners
 *
 * 활성 배너 목록 조회 (sort_order 순)
 * 인증 불필요 — 공개 API
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("banners")
      .select("id, image_url, link_url, alt_text, sort_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/banners] Query error:", error);
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
    console.error("[GET /api/banners] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
