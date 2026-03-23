/**
 * 요청 헤더에서 클라이언트 IP를 추출하는 공통 유틸리티.
 *
 * [배포 환경별 주의사항]
 * - Vercel: x-forwarded-for 헤더가 플랫폼에 의해 안전하게 설정되므로
 *   클라이언트가 이 헤더를 위조해도 Vercel이 실제 IP로 덮어씁니다.
 * - 자체 서버(nginx, Apache 등): 반드시 리버스 프록시에서
 *   x-forwarded-for / x-real-ip 헤더를 신뢰할 수 있는 값으로 설정해야 합니다.
 *   프록시 설정 없이 사용하면 클라이언트가 헤더를 위조하여
 *   IP 기반 접근 제어를 우회할 수 있습니다.
 *
 * Edge Runtime 호환 (순수 함수, Node.js API 미사용).
 */

interface HeadersLike {
  get(name: string): string | null;
}

export function getClientIp(headers: HeadersLike): string {
  // x-forwarded-for: 프록시/로드밸런서 경유 시 원래 IP
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // x-real-ip: nginx 등에서 설정
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}
