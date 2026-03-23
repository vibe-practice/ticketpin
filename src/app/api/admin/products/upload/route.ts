import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

// 허용 MIME 타입
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// 최대 파일 크기 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/admin/products/upload
 *
 * 상품 이미지 업로드 (Supabase Storage)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_FILE", message: "파일이 첨부되지 않았습니다." },
        },
        { status: 400 }
      );
    }

    // MIME 타입 검증
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "허용되지 않는 파일 형식입니다. (JPG, PNG, WEBP, GIF만 가능)",
          },
        },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "파일 크기가 5MB를 초과합니다.",
          },
        },
        { status: 400 }
      );
    }

    // 확장자 추출
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
    const safeExt = allowedExts.includes(ext) ? ext : "jpg";

    // 고유 파일명 생성
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filePath = `products/${timestamp}-${randomStr}.${safeExt}`;

    // Supabase Storage 업로드
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminClient.storage
      .from("product-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[POST /api/admin/products/upload] Upload error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPLOAD_ERROR", message: "파일 업로드에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 공개 URL 생성
    const { data: urlData } = adminClient.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/products/upload] Unexpected error:", error);
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
 * DELETE /api/admin/products/upload
 *
 * 상품 이미지 삭제 (Supabase Storage)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const filePath = body.path as string;

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_PATH", message: "삭제할 파일 경로가 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    // 경로 검증: products/ 하위만 허용, path traversal 차단
    if (!filePath.startsWith("products/") || filePath.includes("..")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_PATH", message: "허용되지 않는 파일 경로입니다." },
        },
        { status: 403 }
      );
    }

    const { error: removeError } = await adminClient.storage
      .from("product-images")
      .remove([filePath]);

    if (removeError) {
      console.error("[DELETE /api/admin/products/upload] Remove error:", removeError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "파일 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { path: filePath } });
  } catch (error) {
    console.error("[DELETE /api/admin/products/upload] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
