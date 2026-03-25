import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdateBannerSchema } from "@/lib/validations/admin";
import type { Banner } from "@/types";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * PUT /api/admin/banners/[bannerId]
 *
 * 관리자 배너 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { bannerId } = await params;

    if (!UUID_REGEX.test(bannerId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 배너 ID입니다." } },
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
    const parsed = adminUpdateBannerSchema.safeParse(body);

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

    // 기존 배너 확인
    const { data: existing, error: existError } = await adminClient
      .from("banners")
      .select("id")
      .eq("id", bannerId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BANNER_NOT_FOUND", message: "존재하지 않는 배너입니다." },
        },
        { status: 404 }
      );
    }

    // 업데이트 데이터 구성
    const dbUpdate: Record<string, unknown> = {};
    if (parsed.data.image_url !== undefined) dbUpdate.image_url = parsed.data.image_url;
    if (parsed.data.link_url !== undefined) dbUpdate.link_url = parsed.data.link_url;
    if (parsed.data.alt_text !== undefined) dbUpdate.alt_text = parsed.data.alt_text;
    if (parsed.data.sort_order !== undefined) dbUpdate.sort_order = parsed.data.sort_order;
    if (parsed.data.is_active !== undefined) dbUpdate.is_active = parsed.data.is_active;

    if (Object.keys(dbUpdate).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_UPDATE", message: "변경할 항목이 없습니다." },
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await adminClient
      .from("banners")
      .update(dbUpdate)
      .eq("id", bannerId)
      .select("id, image_url, link_url, alt_text, sort_order, is_active, created_at, updated_at")
      .single();

    if (updateError || !updated) {
      console.error("[PUT /api/admin/banners/:id] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "배너 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    revalidatePath("/", "layout");

    const result: Banner = {
      id: updated.id as string,
      image_url: updated.image_url as string,
      link_url: (updated.link_url as string) ?? null,
      alt_text: (updated.alt_text as string) ?? "",
      sort_order: updated.sort_order as number,
      is_active: updated.is_active as boolean,
      created_at: updated.created_at as string,
      updated_at: updated.updated_at as string,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[PUT /api/admin/banners/:id] Unexpected error:", error);
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
 * DELETE /api/admin/banners/[bannerId]
 *
 * 관리자 배너 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { bannerId } = await params;

    if (!UUID_REGEX.test(bannerId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "유효하지 않은 배너 ID입니다." } },
        { status: 400 }
      );
    }

    // 기존 배너 확인
    const { data: existing, error: existError } = await adminClient
      .from("banners")
      .select("id, image_url")
      .eq("id", bannerId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BANNER_NOT_FOUND", message: "존재하지 않는 배너입니다." },
        },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminClient
      .from("banners")
      .delete()
      .eq("id", bannerId);

    if (deleteError) {
      console.error("[DELETE /api/admin/banners/:id] Delete error:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "배너 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // Storage에서 이미지 삭제 시도 (실패해도 DB 삭제는 유지)
    try {
      const imageUrl = existing.image_url as string;
      const bucketPrefix = "/storage/v1/object/public/banners/";
      const idx = imageUrl.indexOf(bucketPrefix);
      if (idx !== -1) {
        const storagePath = imageUrl.substring(idx + bucketPrefix.length);
        await adminClient.storage.from("banners").remove([storagePath]);
      }
    } catch {
      // Storage 삭제 실패는 무시 — DB 레코드는 이미 삭제됨
    }

    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, data: { id: bannerId } });
  } catch (error) {
    console.error("[DELETE /api/admin/banners/:id] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
