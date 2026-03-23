// ============================================================
// POST /api/auth/identity/callback
// - 다날 인증 완료 후 콜백 (TARGETURL)
// - 다날 서버가 TID를 POST로 전달
// - Confirm 요청으로 인증 결과 검증 후 세션에 저장
// - opener(부모 창)에 postMessage로 완료 알림하는 HTML 응답
// ============================================================

import { danalConfirm } from "@/lib/danal/client";
import { findSessionByTid, setSessionResult } from "@/lib/danal/session";

/** NEXT_PUBLIC_APP_URL 환경변수를 검증하여 반환. 미설정 시 null */
function getAppOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) return null;
  return url;
}

export async function POST(request: Request) {
  const appOrigin = getAppOrigin();
  if (!appOrigin) {
    return new Response(
      buildErrorHtml("서버 설정 오류: APP_URL이 설정되지 않았습니다.", appOrigin),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  try {
    // 다날은 application/x-www-form-urlencoded로 콜백
    const formData = await request.formData();
    const tid = formData.get("TID") as string | null;

    if (!tid) {
      return new Response(
        buildErrorHtml("인증 정보가 전달되지 않았습니다.", appOrigin),
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // 세션에서 TID 검증 (변조 방지)
    const found = findSessionByTid(tid);
    if (!found) {
      return new Response(
        buildErrorHtml("유효하지 않은 인증 세션입니다.", appOrigin),
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // 다날 Confirm 요청
    const confirmResult = await danalConfirm(tid);

    if (confirmResult.RETURNCODE !== "0000") {
      console.error(
        "[identity/callback] Danal Confirm failed:",
        confirmResult.RETURNCODE,
        confirmResult.RETURNMSG
      );
      return new Response(
        buildErrorHtml(
          "본인인증에 실패했습니다. 다시 시도해 주세요.",
          appOrigin
        ),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const name = confirmResult.NAME;
    const phone = confirmResult.PHONE;

    if (!name || !phone) {
      console.error("[identity/callback] Missing NAME or PHONE in Confirm response");
      return new Response(
        buildErrorHtml("인증 정보가 불완전합니다. 다시 시도해 주세요.", appOrigin),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 세션에 인증 결과 저장 (CI/DI는 프론트에 노출하지 않음)
    setSessionResult(found.sessionId, { name, phone });

    // 부모 창(opener)에 postMessage로 완료 알림 후 팝업 닫기
    const html = buildSuccessHtml(found.sessionId, appOrigin);

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("[identity/callback] Unexpected error:", error);
    return new Response(
      buildErrorHtml(
        "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        appOrigin
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

/** HTML 본문에 삽입할 문자열 이스케이프 (XSS 방지) */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** JS 문자열 리터럴에 삽입할 값 이스케이프 (XSS 방지) */
function escapeForJs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function buildSuccessHtml(sessionId: string, origin: string): string {
  const safeSessionId = escapeForJs(sessionId);
  const safeOrigin = escapeForJs(origin);
  // sessionId만 전달하고, 실제 결과는 /api/auth/identity/result에서 안전하게 조회
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>본인인증 완료</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(
        { type: "DANAL_IDENTITY_VERIFIED", sessionId: "${safeSessionId}" },
        "${safeOrigin}"
      );
    }
  } catch (e) {
    console.error("postMessage failed:", e);
  }
  window.close();
</script>
<p>인증이 완료되었습니다. 이 창이 자동으로 닫히지 않으면 직접 닫아주세요.</p>
</body>
</html>`;
}

function buildErrorHtml(message: string, origin: string | null): string {
  const safeMessage = escapeHtml(message);
  const safeMessageJs = escapeForJs(message);
  // origin이 없으면 postMessage를 보내지 않음 (targetOrigin "*" 사용 방지)
  const postMessageScript = origin
    ? `
  try {
    if (window.opener) {
      window.opener.postMessage(
        { type: "DANAL_IDENTITY_ERROR", message: "${safeMessageJs}" },
        "${escapeForJs(origin)}"
      );
    }
  } catch (e) {
    console.error("postMessage failed:", e);
  }`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>본인인증 오류</title></head>
<body>
<script>${postMessageScript}
  setTimeout(function() { window.close(); }, 3000);
</script>
<p>${safeMessage}</p>
<p>3초 후 자동으로 닫힙니다.</p>
</body>
</html>`;
}
