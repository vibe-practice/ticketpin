import { createAdminClient } from "@/lib/supabase/admin";

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Supabase DB 기반 rate limiting.
 * 서버리스 환경(Vercel)에서도 인스턴스 간 공유되는 글로벌 rate limit을 보장.
 * DB RPC `check_rate_limit`을 호출하여 원자적으로 카운트를 증분하고 결과를 반환.
 *
 * 기존 인메모리 Map 방식은 서버리스 환경에서 인스턴스마다 독립 Map이 생성되어
 * rate limiting이 사실상 무효화되는 문제가 있었음.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.rpc("check_rate_limit", {
      p_key: key,
      p_max_attempts: options.maxAttempts,
      p_window_ms: options.windowMs,
    });

    if (error) {
      // DB 에러 시 rate limit을 통과시키되 경고 로그 기록
      // (가용성 > 보안: DB 장애로 전체 서비스가 차단되는 것을 방지)
      console.error("[checkRateLimit] DB error, allowing request:", error.message);
      return { success: true, remaining: options.maxAttempts, retryAfterMs: 0 };
    }

    const result = data as Record<string, unknown>;
    return {
      success: result.success as boolean,
      remaining: result.remaining as number,
      retryAfterMs: result.retry_after_ms as number,
    };
  } catch (err) {
    console.error("[checkRateLimit] Unexpected error, allowing request:", err);
    return { success: true, remaining: options.maxAttempts, retryAfterMs: 0 };
  }
}
