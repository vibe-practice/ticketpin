import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { PIN_NUMBER_PATTERN } from "@/lib/validations/admin";
import { encryptPin, hashPin } from "@/lib/crypto/pin";

/** 청크 크기: 한 번에 DB에 삽입하는 핀 수 */
const CHUNK_SIZE = 100;

/** TXT 파일 최대 크기 (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 최대 핀 수 (단일 업로드) */
const MAX_PIN_COUNT = 10000;

interface UploadResult {
  total_parsed: number;
  total_success: number;
  total_failed: number;
  total_duplicate: number;
  failed_lines: FailedLine[];
}

interface FailedLine {
  line: number;
  value: string;
  reason: string;
}

/**
 * POST /api/admin/pins/upload
 *
 * TXT 파일 대량 핀 등록
 * - multipart/form-data로 file(TXT) + product_id 전송
 * - 한 줄에 핀 번호 하나 (형식: 1234-1234-1234-1234)
 * - 100개씩 청크로 DB 삽입
 * - 중복 핀 번호 체크
 * - 성공/실패 건수 리포트 반환
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    // ── FormData 파싱 ──
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_FORM_DATA", message: "multipart/form-data 형식이 아닙니다." },
        },
        { status: 400 }
      );
    }

    const productId = formData.get("product_id") as string | null;
    const file = formData.get("file") as File | null;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "상품 ID를 지정해 주세요." },
        },
        { status: 422 }
      );
    }

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "TXT 파일을 업로드해 주세요." },
        },
        { status: 422 }
      );
    }

    // ── 파일 검증 ──
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: `파일 크기가 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB를 초과합니다.`,
          },
        },
        { status: 422 }
      );
    }

    // 파일 확장자 + MIME 타입 검증
    const fileName = file.name?.toLowerCase() ?? "";
    if (!fileName.endsWith(".txt")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_FILE_TYPE", message: "TXT 파일만 업로드 가능합니다." },
        },
        { status: 422 }
      );
    }

    // ── 상품 존재 여부 확인 ──
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, name")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않는 상품입니다." },
        },
        { status: 404 }
      );
    }

    // ── TXT 파일 파싱 ──
    const text = await file.text();
    const lines = text.split(/\r?\n/);

    const validPins: { line: number; pin: string }[] = [];
    const failedLines: FailedLine[] = [];
    let formatErrorCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue; // 빈 줄 무시

      if (!PIN_NUMBER_PATTERN.test(raw)) {
        failedLines.push({
          line: i + 1,
          value: raw.length > 50 ? raw.substring(0, 50) + "..." : raw,
          reason: "형식 오류 (올바른 형식: 1234-1234-1234-1234)",
        });
        formatErrorCount++;
        continue;
      }

      validPins.push({ line: i + 1, pin: raw });
    }

    if (validPins.length === 0) {
      const result: UploadResult = {
        total_parsed: failedLines.length,
        total_success: 0,
        total_failed: failedLines.length,
        total_duplicate: 0,
        failed_lines: failedLines.slice(0, 100), // 최대 100개만 반환
      };

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (validPins.length > MAX_PIN_COUNT) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOO_MANY_PINS",
            message: `한 번에 최대 ${MAX_PIN_COUNT.toLocaleString()}개까지 등록 가능합니다. (요청: ${validPins.length.toLocaleString()}개)`,
          },
        },
        { status: 422 }
      );
    }

    // ── 기존 핀 해시 로드 (중복 체크용, DB 레벨 해시 조회) ──
    const existingPinHashes = new Set<string>();

    const { data: existingPins } = await adminClient
      .from("pins")
      .select("pin_number_hash")
      .eq("product_id", productId)
      .in("status", ["waiting", "assigned"]);

    if (existingPins) {
      for (const pin of existingPins) {
        const hash = (pin as Record<string, unknown>).pin_number_hash as string;
        if (hash) existingPinHashes.add(hash);
      }
    }

    // ── 파일 내 중복 + DB 중복 체크 ──
    const seenInFile = new Set<string>();
    const pinsToInsert: { line: number; pin: string; encrypted: string; hash: string }[] = [];
    let duplicateCount = 0;

    for (const { line, pin } of validPins) {
      // 파일 내 중복
      if (seenInFile.has(pin)) {
        failedLines.push({ line, value: pin, reason: "파일 내 중복" });
        duplicateCount++;
        continue;
      }
      seenInFile.add(pin);

      // DB 기존 핀과 중복 (해시 기반)
      const pinHash = hashPin(pin);
      if (existingPinHashes.has(pinHash)) {
        failedLines.push({ line, value: pin, reason: "이미 등록된 핀 번호" });
        duplicateCount++;
        continue;
      }

      // 암호화
      const encrypted = encryptPin(pin);
      pinsToInsert.push({ line, pin, encrypted, hash: pinHash });
    }

    // ── 청크 단위 DB 삽입 ──
    let successCount = 0;

    for (let i = 0; i < pinsToInsert.length; i += CHUNK_SIZE) {
      const chunk = pinsToInsert.slice(i, i + CHUNK_SIZE);

      const insertData = chunk.map((item) => ({
        product_id: productId,
        pin_number_encrypted: item.encrypted,
        pin_number_hash: item.hash,
        status: "waiting" as const,
        registration_method: "csv" as const, // TXT 업로드이지만 DB 스키마상 csv로 통일
      }));

      const { error: insertError } = await adminClient
        .from("pins")
        .insert(insertData);

      if (insertError) {
        console.error(
          `[POST /api/admin/pins/upload] Chunk insert error (offset ${i}):`,
          insertError
        );
        // 청크 실패 시 해당 청크의 핀들을 실패 목록에 추가
        for (const item of chunk) {
          failedLines.push({
            line: item.line,
            value: item.pin,
            reason: "DB 삽입 오류",
          });
        }
      } else {
        successCount += chunk.length;
      }
    }

    const result: UploadResult = {
      total_parsed: validPins.length + formatErrorCount,
      total_success: successCount,
      total_failed: failedLines.length,
      total_duplicate: duplicateCount,
      failed_lines: failedLines.slice(0, 100), // 최대 100개만 반환
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[POST /api/admin/pins/upload] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
