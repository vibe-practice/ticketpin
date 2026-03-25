// ============================================================
// POST /api/auth/identity/ready
// - 다날 본인인증 TID 발급 요청
// - 세션 생성 후 sessionId + form 데이터 반환
// ============================================================

import { NextResponse } from "next/server";
import { danalReady, DANAL_AUTH_FORM_URL } from "@/lib/danal/client";
import { createIdentitySession } from "@/lib/danal/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import type { IdentityReadyApiResponse } from "@/lib/danal/types";

export async function POST(request: Request) {
  try {
    // Rate limiting: IP당 1분에 5회
    const ip = getClientIp(request.headers);
    const rateLimit = await checkRateLimit(`identity-ready:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
    });
    if (!rateLimit.success) {
      return NextResponse.json<IdentityReadyApiResponse>(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error("[identity/ready] NEXT_PUBLIC_APP_URL is not set");
      return NextResponse.json<IdentityReadyApiResponse>(
        {
          success: false,
          error: { code: "SERVER_ERROR", message: "서버 설정 오류입니다." },
        },
        { status: 500 }
      );
    }

    const callbackUrl = `${appUrl}/api/auth/identity/callback`;
    const orderId = `ID-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 다날 Ready 요청
    const readyResult = await danalReady(callbackUrl, orderId);

    if (readyResult.RETURNCODE !== "0000") {
      console.error(
        "[identity/ready] Danal Ready failed:",
        readyResult.RETURNCODE,
        readyResult.RETURNMSG
      );
      return NextResponse.json<IdentityReadyApiResponse>(
        {
          success: false,
          error: {
            code: "DANAL_ERROR",
            message: "본인인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 502 }
      );
    }

    const tid = readyResult.TID;
    if (!tid) {
      console.error("[identity/ready] TID not returned from Danal");
      return NextResponse.json<IdentityReadyApiResponse>(
        {
          success: false,
          error: { code: "DANAL_ERROR", message: "인증 세션 생성에 실패했습니다." },
        },
        { status: 502 }
      );
    }

    // DB 세션 생성
    const sessionId = await createIdentitySession(tid);

    // form hidden fields 추출 (RETURNCODE, RETURNMSG 제외)
    const formFields: Record<string, string> = {};
    const excludeKeys = new Set(["RETURNCODE", "RETURNMSG", "CPPWD", "CPID"]);
    for (const [key, value] of Object.entries(readyResult)) {
      if (!excludeKeys.has(key) && value !== undefined) {
        formFields[key] = value;
      }
    }

    return NextResponse.json<IdentityReadyApiResponse>({
      success: true,
      data: {
        sessionId,
        tid,
        formAction: DANAL_AUTH_FORM_URL,
        formFields,
      },
    });
  } catch (error) {
    console.error("[identity/ready] Unexpected error:", error);
    return NextResponse.json<IdentityReadyApiResponse>(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
