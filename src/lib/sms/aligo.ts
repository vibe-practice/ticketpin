/**
 * 알리고 SMS API 저수준 클라이언트
 *
 * API 문서: https://smartsms.aligo.in/admin/api/spec.html
 * 엔드포인트: https://apis.aligo.in/send/
 * 방식: POST (multipart/form-data)
 */

export interface AligoSendParams {
  /** 수신 번호 (하이픈 없이, 예: "01012345678") */
  receiver: string;
  /** 메시지 내용 */
  msg: string;
  /** 메시지 제목 (LMS일 때 사용) */
  title?: string;
  /** 메시지 타입: SMS(90byte 이하), LMS(장문) */
  msg_type?: "SMS" | "LMS";
}

export interface AligoResponse {
  /** 결과 코드 (1: 성공). 알리고 API가 문자열로 반환할 수 있음 */
  result_code: number | string;
  /** 결과 메시지 */
  message: string;
  /** 메시지 ID */
  msg_id?: string;
  /** 성공 건수 */
  success_cnt?: number;
  /** 에러 건수 */
  error_cnt?: number;
  /** 메시지 타입 */
  msg_type?: string;
}

/**
 * 메시지 바이트 수 계산 (EUC-KR 기준)
 * 한글/한자/일본어 등: 2byte, ASCII: 1byte
 */
function getByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes += code > 127 ? 2 : 1;
  }
  return bytes;
}

/**
 * 알리고 SMS 발송 API 호출
 *
 * 고정 IP 프록시 서버(SMS_PROXY_URL)가 설정된 경우 프록시를 경유하고,
 * 미설정 시 알리고 API를 직접 호출한다.
 *
 * @returns 알리고 API 응답 객체
 * @throws Error - 네트워크 오류 또는 API 응답 파싱 실패
 */
export async function sendAligoSms(params: AligoSendParams): Promise<AligoResponse> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  if (!apiKey || !userId || !sender) {
    throw new Error("알리고 SMS 환경변수가 설정되지 않았습니다. (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)");
  }

  // 메시지 타입 자동 결정 (90byte 초과 시 LMS)
  const msgType = params.msg_type ?? (getByteLength(params.msg) > 90 ? "LMS" : "SMS");

  const proxyUrl = process.env.SMS_PROXY_URL;
  const proxyApiKey = process.env.SMS_PROXY_API_KEY;

  // 프록시 서버가 설정된 경우 프록시 경유
  if (proxyUrl && proxyApiKey) {
    const response = await fetch(`${proxyUrl}/api/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${proxyApiKey}`,
      },
      body: JSON.stringify({
        key: apiKey,
        user_id: userId,
        sender,
        receiver: params.receiver,
        msg: params.msg,
        msg_type: msgType,
        title: msgType === "LMS" ? (params.title ?? "[티켓매니아]") : undefined,
        testmode_yn: process.env.ALIGO_TESTMODE === "Y" ? "Y" : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS 프록시 HTTP 오류: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as AligoResponse;
    if (Number(result.result_code) !== 1) {
      throw new Error(`SMS 발송 실패: [${result.result_code}] ${result.message}`);
    }
    return result;
  }

  // 프록시 미설정 시 알리고 API 직접 호출 (로컬 개발 등)
  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("user_id", userId);
  formData.append("sender", sender);
  formData.append("receiver", params.receiver);
  formData.append("msg", params.msg);
  formData.append("msg_type", msgType);

  if (msgType === "LMS") {
    formData.append("title", params.title ?? "[티켓매니아]");
  }

  if (process.env.ALIGO_TESTMODE === "Y") {
    formData.append("testmode_yn", "Y");
  }

  const response = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`알리고 API HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as AligoResponse;
  if (Number(result.result_code) !== 1) {
    throw new Error(`SMS 발송 실패: [${result.result_code}] ${result.message}`);
  }
  return result;
}
