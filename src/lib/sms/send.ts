/**
 * SMS 발송 + 재시도 + sms_logs 기록 통합 모듈
 *
 * 발송 실패 시 최대 3회 재시도 (1초 / 5초 / 30초 간격)
 * 모든 발송 시도는 sms_logs 테이블에 기록
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendAligoSms, type AligoResponse } from "./aligo";
import type { SmsMessageType, SmsSentBy } from "@/types";

/** 재시도 간격 (ms): 1초, 5초, 30초 */
const RETRY_DELAYS = [1000, 5000, 30000];

/** 최대 시도 횟수 (최초 1회 + 재시도 최대 3회 = 총 4회) */
const MAX_RETRIES = 3;

interface SendSmsParams {
  /** 수신 번호 (하이픈 없는 숫자열, 예: "01012345678") */
  recipientPhone: string;
  /** 메시지 내용 */
  messageContent: string;
  /** 메시지 유형 */
  messageType: SmsMessageType;
  /** 관련 바우처 ID (optional) */
  voucherId?: string;
  /** 관련 주문 ID (optional) */
  orderId?: string;
  /** 발송 주체 */
  sentBy?: SmsSentBy;
}

interface SendSmsResult {
  success: boolean;
  smsLogId?: string;
  aligoResponse?: AligoResponse;
  error?: string;
}

/**
 * 지정된 ms만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * SMS 발송 (재시도 로직 포함)
 *
 * 1. 알리고 API 호출
 * 2. 실패 시 3회까지 재시도 (1초/5초/30초 간격)
 * 3. 최종 결과를 sms_logs에 기록
 */
async function sendSmsWithRetry(params: SendSmsParams): Promise<SendSmsResult> {
  const adminClient = createAdminClient();
  let lastError: string | undefined;
  let lastResponse: AligoResponse | undefined;

  // 재시도 루프 (최초 1회 + 재시도 3회 = 최대 4회 시도)
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 재시도 시 대기
    if (attempt > 0) {
      const maskedPhone = params.recipientPhone.slice(-4);
      console.warn(`[SMS] 재시도 ${attempt}/${MAX_RETRIES}: type=${params.messageType}, phone=****${maskedPhone}`);
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      const response = await sendAligoSms({
        receiver: params.recipientPhone.replace(/\D/g, ""),
        msg: params.messageContent,
      });

      lastResponse = response;

      // 성공 판단: result_code === 1 또는 실제 발송 성공(success_cnt >= 1)
      if (Number(response.result_code) === 1 || (response.success_cnt != null && Number(response.success_cnt) >= 1)) {
        // 성공 로그 기록
        const { data: logData } = await adminClient
          .from("sms_logs")
          .insert({
            voucher_id: params.voucherId ?? null,
            order_id: params.orderId ?? null,
            recipient_phone: params.recipientPhone,
            message_type: params.messageType,
            message_content: params.messageContent,
            send_status: "sent",
            aligo_response: response as unknown as Record<string, unknown>,
            sent_by: params.sentBy ?? "system",
          })
          .select("id")
          .single();

        return {
          success: true,
          smsLogId: logData?.id,
          aligoResponse: response,
        };
      }

      // API 응답은 왔지만 실패인 경우
      lastError = response.message ?? `알리고 API 오류 (code: ${response.result_code})`;
      console.error(`[SMS] 시도 ${attempt + 1} 실패: ${lastError}`);
    } catch (error) {
      // 네트워크 오류 등
      lastError = error instanceof Error ? error.message : "알 수 없는 오류";
      console.error(`[SMS] 시도 ${attempt + 1} 실패: ${lastError}`);
    }
  }

  // 모든 시도 실패 - 실패 로그 기록
  const { data: logData } = await adminClient
    .from("sms_logs")
    .insert({
      voucher_id: params.voucherId ?? null,
      order_id: params.orderId ?? null,
      recipient_phone: params.recipientPhone,
      message_type: params.messageType,
      message_content: params.messageContent,
      send_status: "failed",
      aligo_response: (lastResponse as unknown as Record<string, unknown>) ?? { error: lastError },
      sent_by: params.sentBy ?? "system",
    })
    .select("id")
    .single();

  return {
    success: false,
    smsLogId: logData?.id,
    aligoResponse: lastResponse,
    error: lastError,
  };
}

/**
 * SMS 발송 (비동기, fire-and-forget)
 *
 * 주문/바우처 API 응답을 블로킹하지 않도록 비동기로 실행한다.
 * 발송 결과는 sms_logs 테이블에서 확인 가능.
 *
 * @returns void (결과를 기다리지 않음)
 */
export function sendSmsAsync(params: SendSmsParams): void {
  // fire-and-forget: Promise를 await하지 않고 에러만 로깅
  sendSmsWithRetry(params).catch((error) => {
    console.error(
      `[SMS] 발송 실패 (${params.messageType}):`,
      error instanceof Error ? error.message : error
    );
  });
}

/**
 * SMS 발송 (동기, 결과 반환)
 *
 * 발송 결과가 필요한 경우 (관리자 재발송 등) 사용.
 */
export async function sendSmsSync(params: SendSmsParams): Promise<SendSmsResult> {
  return sendSmsWithRetry(params);
}
