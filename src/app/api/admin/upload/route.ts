import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";

// 허용 MIME 타입
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

// 최대 파일 크기: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 허용 버킷
const ALLOWED_BUCKETS = ["banners", "side-banners", "categories"];

/**
 * POST /api/admin/upload
 *
 * 범용 이미지 업로드 엔드포인트
 * FormData: file (File), bucket (string), path? (string)
 * 응답: { success: true, data: { url: string } }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;
    const pathPrefix = (formData.get("path") as string | null) ?? "";

    // ── 입력 검증 ──

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FILE", message: "파일이 없습니다." },
        },
        { status: 400 }
      );
    }

    if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BUCKET",
            message: `허용된 버킷: ${ALLOWED_BUCKETS.join(", ")}`,
          },
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
            message: `허용된 파일 형식: JPEG, PNG, WebP, GIF, SVG`,
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
            message: "파일 크기는 5MB 이하여야 합니다.",
          },
        },
        { status: 400 }
      );
    }

    // 확장자 추출
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif", "svg"];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EXTENSION",
            message: "허용되지 않는 파일 확장자입니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 파일 업로드 ──

    // 고유 파일명 생성: {prefix}/{timestamp}_{random}.{ext}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedPrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
    const filePath = sanitizedPrefix
      ? `${sanitizedPrefix}/${timestamp}_${random}.${ext}`
      : `${timestamp}_${random}.${ext}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[POST /api/admin/upload] Storage error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPLOAD_ERROR", message: "파일 업로드에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // public URL 생성
    const { data: publicUrlData } = adminClient.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return NextResponse.json(
      {
        success: true,
        data: {
          url: publicUrlData.publicUrl,
          bucket,
          path: filePath,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/upload] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
