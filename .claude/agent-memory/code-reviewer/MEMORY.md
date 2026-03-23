# Code Reviewer Memory

## Index
- [admin-business-review.md](admin-business-review.md) — 2026-03-13 관리자/업체 포털 전체 리뷰 결과

## Project Patterns

### Repeated Issues Found (Updated 2026-03-13)
- **handleLogout 중복**: 3곳(Sidebar, TopBar, AdminTopBar)에 동일 로직 반복
- **FeeMode vs FeeType**: ProductDetailClient에서 FeeMode 로컬 타입, types/index.ts의 FeeType과 동일
- **as unknown as 캐스팅**: queries.ts, 바우처 API, 관리자 API, 업체 API 등 15곳 이상에서 Supabase JOIN 결과 캐스팅
- **API Route 보일러플레이트**: JSON 파싱 try-catch, 응답 구조 등 28개+ 파일에서 반복
- **eslint-disable react-hooks/exhaustive-deps**: AdminFaqClient, MemberDetailModal, AdminNoticesClient 3건
- **N+1 쿼리**: admin/members GET에서 유저당 3개 count 쿼리 (20명=60쿼리)
- **비원자적 정산 재계산**: settlement item verify 시 status 업데이트와 합계 재계산이 분리됨 (race condition)
- **(해결됨)** formatPrice, maskUsername, PinInput 중복
- **(해결됨)** formatFeePercent, calcFeeAmount - utils.ts로 통합
- **(해결됨)** check-username 입력값 정규식 검증
- **(해결됨)** 관리자 페이지 인증 - middleware에서 IP + 세션 체크 구현됨
- **(해결됨)** AuthProvider Mock 사용자 - 실제 /api/auth/me 호출로 전환됨
- **(해결됨)** /search 라우트 - 검색이 /category?q= 로 통합됨

### Anti-Patterns to Watch
- `sessionStorage` 직접 접근: VoucherMain.tsx의 useState initializer에서 SSR hydration mismatch 위험
- onBlur + setTimeout 패턴: VoucherGift.tsx에서 검색 결과 숨기기에 사용 (불안정)
- admin/cancellations limit 최대 2000: 메모리에 2000건 로드 후 post-filter (페이지네이션 무효화)
- admin/pins 검색: pin_number 외 검색 시 post-filter가 페이지네이션과 충돌
- PG 취소 retry: 스텁 구현 (항상 성공 반환) — 프로덕션 배포 전 실제 구현 필수

### Security Issues Identified
- Auth signUp 성공 후 users insert 실패 시 orphan 레코드 (deleteUser 실패 미핸들링)
- reset-password: 이름+전화번호만으로 비밀번호 변경 가능 (본인인증 없음) - 최우선 수정
- rate-limit: 인메모리 Map 기반 -> 서버리스 환경에서 무효화 (Critical)
- settlement verify: 비원자적 금액 재계산 -> 동시 요청 시 정산 금액 불일치 (Critical)
- PG 취소 성공 + DB 실패 시 orphan 환불 발생 가능 (admin/orders cancel)
- get_auth_password RPC: 사용자 비밀번호 해시를 업체 계정에 복사 (보안 검토 필요)
- allowed-ips 삭제 시 자기 IP 차단 방지 로직 없음

### Code Conventions Confirmed
- Zod 스키마: `src/lib/validations/` 디렉토리에 도메인별 분리 (auth, voucher, order, admin, business)
- 에러 메시지: `<AlertCircle size={13} />` + `text-error` (일부 `text-destructive` 혼용)
- 아이콘: Lucide React만 사용 (확인됨)
- Supabase 클라이언트: 4종 분리 (client, server, admin, middleware)
- API 응답: `{ success, error: { code, message }, data }` 패턴 통일
- 인증 가드: getAuthenticatedUser(), getAuthenticatedAdmin(), getAuthenticatedBusiness() 공통 헬퍼
- as any 캐스팅: 0건 (타입 안전성 우수)
- 관리자 세션: admin_session 쿠키 (8시간), 업체 세션: business_session 쿠키 (4시간)
- SQL 이스케이프: escapeIlike() 유틸로 와일드카드 문자 이스케이프

### Architecture Notes
- rate-limit.ts: 인메모리 Map -> 프로덕션 전 Redis 교체 필수
- Pretendard 폰트: CDN -> next/font/local 전환 권장
- globals.css: --font-mono가 Pretendard (monospace 미설정, DESIGN-SYSTEM.md와 불일치)
- (admin)/layout.tsx: 전체 "use client" -> SSR 이점 상실
- getCategories(): 3개 레이아웃에서 캐싱 없이 매번 호출
- 상품 상세 수량 상한 없음 (OrderPageClient에서만 10개 제한)
- UUID_REGEX: admin/utils.ts와 business/auth.ts에 중복 정의
- 업체 대시보드: 최대 6개 Supabase 쿼리 (settlements 2개 + gifts fallback 2개 + 월간 2개)
