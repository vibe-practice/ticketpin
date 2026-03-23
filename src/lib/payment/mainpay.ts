/**
 * MainPay PG API 핵심 모듈
 *
 * 상용 결제창 HOST: https://api-std.mainpay.co.kr
 * 상용 취소 HOST: https://relay.mainpay.co.kr
 * Content-Type: application/x-www-form-urlencoded; charset=utf-8
 * 응답 형식: JSON
 */

import { createHash, randomInt } from "crypto";

// ── HOST 설정 ──────────────────────────────────────────
const STD_HOST = "https://api-std.mainpay.co.kr";
const RELAY_HOST = "https://relay.mainpay.co.kr";

// ── PG API 타임아웃 (15초) ─────────────────────────────
const PG_TIMEOUT_MS = 15_000;

// ── 환경변수 ────────────────────────────────────────────
function getMbrNo(): string {
  const mbrNo = process.env.MAINPAY_MBR_NO;
  if (!mbrNo) throw new Error("MAINPAY_MBR_NO 환경변수가 설정되지 않았습니다.");
  return mbrNo;
}

function getApiKey(): string {
  const apiKey = process.env.MAINPAY_API_KEY;
  if (!apiKey) throw new Error("MAINPAY_API_KEY 환경변수가 설정되지 않았습니다.");
  return apiKey;
}

// ── 카드사 코드 매핑 ────────────────────────────────────
export const CARD_COMPANY_MAP: Record<string, string> = {
  "01": "비씨카드",
  "02": "신한카드",
  "03": "삼성카드",
  "04": "현대카드",
  "05": "롯데카드",
  "06": "해외JCB카드",
  "07": "국민카드",
  "08": "하나카드(구외환)",
  "09": "해외카드",
  "11": "수협카드",
  "12": "농협카드",
  "15": "씨티카드",
  "21": "신한카드",
  "22": "제주카드",
  "23": "광주카드",
  "24": "전북카드",
  "26": "신협카드",
  "27": "하나카드",
  "30": "신세계카드",
  "31": "우리카드",
  "37": "해외은련카드",
  "38": "롯데아멕스",
  "42": "해외VISA",
  "43": "해외MASTER",
};

/**
 * 카드사 코드로 카드사명 조회
 */
export function getCardCompanyName(issueCompanyNo: string): string {
  return CARD_COMPANY_MAP[issueCompanyNo] ?? `카드사(${issueCompanyNo})`;
}

// ── timestamp 생성 (yyMMddHHmmssSSS, KST 고정) ─────────
export function generateTimestamp(): string {
  // KST(UTC+9) 기준으로 생성
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yy = String(kst.getUTCFullYear()).slice(-2);
  const MM = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const HH = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  const SSS = String(kst.getUTCMilliseconds()).padStart(3, "0");
  return `${yy}${MM}${dd}${HH}${mm}${ss}${SSS}`;
}

// ── mbrRefNo 공통 생성 (최대 20자) ─────────────────────
/**
 * 가맹점 주문번호 생성
 * @param prefix 접두어 (TM=주문, CL=취소, FE=수수료) — 최대 2자
 * @returns prefix + timestamp(13자리) + 랜덤(4자리) = 최대 19자
 */
export function generateMbrRefNo(prefix: string = "TM"): string {
  const ts = Date.now().toString().slice(-13);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[randomInt(chars.length)];
  }
  return `${prefix}${ts}${suffix}`;
}

// ── Signature 생성 ──────────────────────────────────────
/**
 * SHA-256(mbrNo|mbrRefNo|amount|apiKey|timestamp) hex 소문자
 */
export function generateSignature(
  mbrNo: string,
  mbrRefNo: string,
  amount: number,
  apiKey: string,
  timestamp: string
): string {
  const raw = `${mbrNo}|${mbrRefNo}|${amount}|${apiKey}|${timestamp}`;
  return createHash("sha256").update(raw).digest("hex");
}

// ── 타입 정의 ────────────────────────────────────────────

export interface MainPayReadyRequest {
  mbrRefNo: string;
  amount: number;
  goodsName: string;
  approvalUrl: string;
  closeUrl: string;
  customerTelNo?: string;
  customerName?: string;
  customerEmail?: string;
  merchantData?: string;
}

export interface MainPayReadyResponse {
  resultCode: string;
  resultMessage: string;
  data?: {
    aid: string;
    nextPcUrl: string;
    nextMobileUrl: string;
  };
}

export interface MainPayPayRequest {
  aid: string;
  mbrRefNo: string;
  authToken: string;
  amount: number;
}

export interface MainPayPayResponse {
  resultCode: string;
  resultMessage: string;
  data?: {
    mbrNo: string;
    refNo: string;
    tranDate: string;
    tranTime: string;
    mbrRefNo: string;
    amount: string;
    applNo: string;
    cardNo: string;
    installment: string;
    issueCompanyNo: string;
    acqCompanyNo: string;
    payType: string;
  };
}

export interface MainPayCancelRequest {
  mbrRefNo: string;
  orgRefNo: string;
  orgTranDate: string;
  payType: string;
  amount: number;
}

export interface MainPayCancelResponse {
  resultCode: string;
  resultMessage: string;
  data?: {
    refNo: string;
    tranDate: string;
    tranTime: string;
    mbrRefNo: string;
  };
}

// ── 내부: timeout 적용 fetch ────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = PG_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ── 내부: HTTP 응답 검증 + JSON 파싱 ────────────────────
async function parseResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[MainPay] ${label} HTTP ${response.status}:`, text.slice(0, 500));
    return {
      resultCode: String(response.status),
      resultMessage: `PG 서버 오류 (HTTP ${response.status})`,
    } as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const text = await response.text().catch(() => "");
    console.error(`[MainPay] ${label} 비정상 응답 (Content-Type: ${contentType}):`, text.slice(0, 500));
    return {
      resultCode: "INVALID_RESPONSE",
      resultMessage: "PG 서버 응답 형식이 올바르지 않습니다.",
    } as T;
  }

  return response.json() as Promise<T>;
}

// ── API 호출 함수 ────────────────────────────────────────

/**
 * 결제 준비 (결제창 URL 발급)
 * POST https://api-std.mainpay.co.kr/v1/payment/ready
 */
export async function paymentReady(
  params: MainPayReadyRequest
): Promise<MainPayReadyResponse> {
  const mbrNo = getMbrNo();
  const apiKey = getApiKey();
  const timestamp = generateTimestamp();
  const signature = generateSignature(
    mbrNo,
    params.mbrRefNo,
    params.amount,
    apiKey,
    timestamp
  );

  const body = new URLSearchParams();
  body.append("mbrNo", mbrNo);
  body.append("mbrRefNo", params.mbrRefNo);
  body.append("paymethod", "CARD");
  body.append("amount", String(params.amount));
  body.append("goodsName", params.goodsName);
  body.append("approvalUrl", params.approvalUrl);
  body.append("closeUrl", params.closeUrl);
  body.append("timestamp", timestamp);
  body.append("signature", signature);

  // 할부 최대 12개월 제한
  body.append("availableInstallment", "02:03:04:05:06:07:08:09:10:11:12");

  if (params.customerTelNo) body.append("customerTelNo", params.customerTelNo);
  if (params.customerName) body.append("customerName", params.customerName);
  if (params.customerEmail) body.append("customerEmail", params.customerEmail);
  if (params.merchantData) body.append("merchantData", params.merchantData);

  const response = await fetchWithTimeout(`${STD_HOST}/v1/payment/ready`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: body.toString(),
  });

  return parseResponse<MainPayReadyResponse>(response, "ready");
}

/**
 * 결제 승인
 * POST https://api-std.mainpay.co.kr/v1/payment/pay
 */
export async function paymentPay(
  params: MainPayPayRequest
): Promise<MainPayPayResponse> {
  const mbrNo = getMbrNo();
  const apiKey = getApiKey();
  const timestamp = generateTimestamp();
  const signature = generateSignature(
    mbrNo,
    params.mbrRefNo,
    params.amount,
    apiKey,
    timestamp
  );

  const body = new URLSearchParams();
  body.append("mbrNo", mbrNo);
  body.append("aid", params.aid);
  body.append("mbrRefNo", params.mbrRefNo);
  body.append("authToken", params.authToken);
  body.append("paymethod", "CARD");
  body.append("amount", String(params.amount));
  body.append("timestamp", timestamp);
  body.append("signature", signature);

  const response = await fetchWithTimeout(`${STD_HOST}/v1/payment/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: body.toString(),
  });

  return parseResponse<MainPayPayResponse>(response, "pay");
}

/**
 * 결제 전액 취소
 * POST https://relay.mainpay.co.kr/v1/api/payments/payment/cancel
 *
 * 주의: HOST가 결제창(api-std)과 다름!
 */
export async function paymentCancel(
  params: MainPayCancelRequest
): Promise<MainPayCancelResponse> {
  const mbrNo = getMbrNo();
  const apiKey = getApiKey();
  const timestamp = generateTimestamp();
  const signature = generateSignature(
    mbrNo,
    params.mbrRefNo,
    params.amount,
    apiKey,
    timestamp
  );

  const body = new URLSearchParams();
  body.append("mbrNo", mbrNo);
  body.append("mbrRefNo", params.mbrRefNo);
  body.append("orgRefNo", params.orgRefNo);
  body.append("orgTranDate", params.orgTranDate);
  body.append("payType", params.payType);
  body.append("paymethod", "CARD");
  body.append("amount", String(params.amount));
  body.append("timestamp", timestamp);
  body.append("signature", signature);

  const response = await fetchWithTimeout(
    `${RELAY_HOST}/v1/api/payments/payment/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: body.toString(),
    }
  );

  return parseResponse<MainPayCancelResponse>(response, "cancel");
}
