---
name: Admin/Business Portal Full Review (2026-03-13)
description: 관리자/업체 포털 전체 코드 리뷰 결과 - 보안, 버그, 코드 품질 이슈 15건
type: project
---

# 관리자/업체 포털 전체 리뷰 (2026-03-13)

## 리뷰 범위
- Admin pages: `src/app/(admin)/`
- Admin APIs: `src/app/api/admin/`
- Business portal: `src/app/(business)/`
- Business auth APIs: `src/app/api/auth/business/`
- Settlement files
- SMS library: `src/lib/sms/`
- Auth helpers: `src/lib/admin/`, `src/lib/business/`
- Middleware: `src/middleware.ts`

## 발견된 이슈 요약 (15건)

### Critical (2건)
1. **rate-limit.ts 인메모리 Map** — 서버리스 환경에서 인스턴스별 독립 Map, 사실상 rate limiting 무효화
2. **settlement item verify 비원자적 재계산** — `src/app/api/admin/settlements/[settlementId]/items/[itemId]/verify/route.ts` L57-106, 동시 verify 요청 시 정산 금액 불일치

### High (5건)
3. **cancellations limit 2000** — `src/app/api/admin/cancellations/route.ts` L36, 2000건 메모리 로드 후 post-filter
4. **members N+1 쿼리** — `src/app/api/admin/members/route.ts` L113-135, 유저당 3개 count 쿼리
5. **PG 취소 + DB 실패 orphan** — `src/app/api/admin/orders/[orderId]/cancel/route.ts`, PG 환불 성공 후 RPC 실패 시 복구 불가
6. **(admin)/layout.tsx 전체 "use client"** — 모든 admin 페이지 SSR 상실
7. **pins 검색 페이지네이션 버그** — `src/app/api/admin/pins/route.ts` L199-212, post-filter가 range와 충돌

### Medium (5건)
8. **get_auth_password RPC 보안** — 사용자 비밀번호 해시를 업체 계정에 복사
9. **business API middleware 인증 갭** — middleware에서 business 라우트 passthrough, API 레벨에서만 인증
10. **업체 대시보드 쿼리 과다** — 최대 6개 순차/병렬 쿼리
11. **수수료 환불 부분 실패** — 선물 취소 시 수수료 환불 루프에서 일부 실패 무시
12. **allowed-ips 자기 IP 삭제** — 관리자가 자기 IP 삭제하여 lockout 가능

### Low (3건)
13. **UUID_REGEX 중복** — admin/utils.ts와 business/auth.ts에 동일 정규식
14. **as Record<string, unknown> 과다** — Supabase JOIN 결과 캐스팅 15곳+
15. **PG retry 스텁** — cancellations retry가 항상 성공 반환 (미구현)

## 긍정적 패턴
- getAuthenticatedAdmin/Business/User 인증 가드 일관성
- Zod 스키마 도메인별 분리 (5개 파일)
- escapeIlike() SQL injection 방지
- AES-256 + SHA-256 핀 암호화
- 정산 상태 전이 검증 (VALID_TRANSITIONS)
- SMS 재시도 + sms_logs 감사 로그
- as any 0건 유지
