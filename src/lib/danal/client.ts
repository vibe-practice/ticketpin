// ============================================================
// 다날 본인인증 API 통신 모듈
// - Ready(TID 발급) 및 Confirm(인증 결과 확인) 요청 처리
// - CPID/CPPWD는 서버에서만 사용, 프론트엔드 노출 금지
// ============================================================

import type {
  DanalReadyResponse,
  DanalConfirmResponse,
  DanalReadyParams,
  DanalConfirmParams,
} from "./types";

const DANAL_UAS_URL = "https://uas.teledit.com/uas/";
const DANAL_AUTH_FORM_URL =
  "https://wauth.teledit.com/Danal/WebAuth/Web/Start.php";

/**
 * 다날 응답 문자열(key=value&key=value)을 객체로 파싱
 * URLSearchParams를 사용하여 디코딩 처리
 */
function parseResponse(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = raw.split("&");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.substring(0, idx);
    const value = pair.substring(idx + 1);
    result[key] = decodeURIComponent(value);
  }
  return result;
}

/**
 * 다날 응답에서 필수 필드(RETURNCODE, RETURNMSG)가 있는지 검증
 * parseResponse()의 결과를 타입 안전하게 변환
 */
function validateDanalResponse<T extends { RETURNCODE: string; RETURNMSG: string }>(
  raw: Record<string, string>
): T {
  if (!raw.RETURNCODE || !raw.RETURNMSG) {
    throw new Error(
      `Invalid Danal response: missing RETURNCODE or RETURNMSG (keys: ${Object.keys(raw).join(", ")})`
    );
  }
  return raw as unknown as T;
}

/**
 * 객체를 key=value&key=value 형태의 문자열로 변환
 */
function buildBody(data: { [key: string]: string }): string {
  return Object.entries(data)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join("&");
}

/**
 * Ready 요청 — TID 발급
 * 다날 서버에 인증 세션 생성을 요청하고 TID + form hidden fields를 반환
 */
export async function danalReady(
  callbackUrl: string,
  orderId: string
): Promise<DanalReadyResponse> {
  const cpid = process.env.DANAL_CPID;
  const cppwd = process.env.DANAL_CPPWD;

  if (!cpid || !cppwd) {
    throw new Error("DANAL_CPID or DANAL_CPPWD environment variable is not set");
  }

  const params = {
    TXTYPE: "ITEMSEND",
    SERVICE: "UAS",
    AUTHTYPE: "36",
    CPID: cpid,
    CPPWD: cppwd,
    TARGETURL: callbackUrl,
    CHARSET: "UTF-8",
    ORDERID: orderId,
  } satisfies DanalReadyParams;
  const body = buildBody(params);

  const response = await fetch(DANAL_UAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Danal Ready request failed: HTTP ${response.status}`);
  }

  const rawText = await response.text();
  return validateDanalResponse<DanalReadyResponse>(parseResponse(rawText));
}

/**
 * Confirm 요청 — 인증 결과 확인
 * 콜백에서 받은 TID로 다날 서버에 인증 결과를 요청
 */
export async function danalConfirm(tid: string): Promise<DanalConfirmResponse> {
  const params = {
    TXTYPE: "CONFIRM",
    TID: tid,
    CONFIRMOPTION: "0",
    IDENOPTION: "0",
  } satisfies DanalConfirmParams;
  const body = buildBody(params);

  const response = await fetch(DANAL_UAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Danal Confirm request failed: HTTP ${response.status}`);
  }

  const rawText = await response.text();
  return validateDanalResponse<DanalConfirmResponse>(parseResponse(rawText));
}

/** 다날 인증 페이지 form action URL */
export { DANAL_AUTH_FORM_URL };
