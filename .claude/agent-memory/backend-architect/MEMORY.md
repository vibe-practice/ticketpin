# 백엔드 아키텍트 메모리

## Supabase 쿼리 패턴
- 서버 컴포넌트용 클라이언트: `src/lib/supabase/server.ts` (쿠키 기반, `await createClient()`)
- 브라우저용 클라이언트: `src/lib/supabase/client.ts`
- Admin(service role): `src/lib/supabase/admin.ts` (RLS 우회, `createAdminClient()`)
- **중요**: `generateStaticParams()`에서는 쿠키 기반 서버 클라이언트 사용 불가 (빌드 타임 요청 스코프 밖). admin 클라이언트를 사용해야 함.
- 쿼리 함수 모음: `src/lib/supabase/queries.ts`

## DB 스키마 (Phase 1 기준)
- 테이블: users, admin_users, categories, products, pins
- RLS: categories(is_visible=true만 조회), products(전체 조회), pins/admin_users(클라이언트 접근 불가)
- FK: products.category_id -> categories.id
- Supabase 관계 조회: `products` 테이블에서 `categories(id, name, slug, icon)` 형태로 JOIN

## ISR 설정
- `export const revalidate = 60` -- 각 페이지 파일 최상위에 선언
- 상품/카테고리 페이지에 적용 완료

## 타입 매핑
- `ProductWithCategory`: Product + `category: Pick<Category, "id" | "name" | "slug" | "icon">`
- Supabase JOIN 결과에서 `categories` 키로 반환됨 -> `mapProductWithCategory()`로 변환

## 인증 API 패턴
- Rate limiting: `src/lib/rate-limit.ts` (메모리 기반, IP별 제한)
- Zod 서버 스키마: `src/lib/validations/auth.ts` (serverRegisterSchema, serverLoginSchema, serverFindIdSchema, serverResetPasswordSchema)
- API Routes: `src/app/api/auth/` (login, register, logout, me, check-username, find-id, reset-password)
- `/api/auth/me` (GET): supabase.auth.getUser() -> auth_id로 users 조회 -> User 반환
- AuthProvider: `src/components/providers/AuthProvider.tsx` -> `/api/auth/me` 호출하여 인증 상태 확인
- authStore: `src/store/authStore.ts` -> user, isLoading, logout (Zustand)
- TopBar/Sidebar: useAuthStore로 user 상태 읽어 로그인/비로그인 UI 전환
- users 테이블 RLS: 본인만 조회 가능 -> find-id/reset-password/me에서는 adminClient 사용 필수
- 비밀번호 변경: `adminClient.auth.admin.updateUserById(auth_id, { password })` 사용
- 아이디 마스킹: `maskUsername()` in `src/lib/utils.ts` (앞 3자 + * + 마지막 1자)
- 미들웨어: `src/middleware.ts` -> 세션 갱신 + 보호 경로(/mypage) + 인증 경로 리다이렉트

## 본인인증 시뮬레이션
- 모달 컴포넌트: `src/components/ui/identity-verification-modal.tsx`
- 외부/내부 래퍼 패턴으로 구현 (open=true일 때만 내부 컴포넌트 마운트 → 린트 규칙 준수)
- 결과 타입: `VerificationResult { name, phone, verified }`
- 회원가입, 아이디 찾기, 비밀번호 재설정 3곳에서 공통 사용

## DB 스키마 (Phase 2 추가)
- 테이블: orders, vouchers, cancellations, gifts, sms_logs
- pins에 voucher_id 컬럼 추가 (1바우처=N핀)
- RLS: orders/vouchers(본인만 조회), gifts(본인 송수신), cancellations/sms_logs(service role만)
- **DB의 products 테이블**: `fee_amount`(NOT NULL) + `fee_rate`(numeric) + `fee_unit`(varchar) 3개 공존
- 마이그레이션(20260308000003)에서 fee_amount DROP 의도했으나 실제 DB에는 남아있음
- 상품 등록/수정 시 fee_amount도 함께 계산해서 저장 필요 (호환 유지)

## 주문 API (P2-017)
- PostgreSQL stored procedure: `create_order_with_voucher()` (트랜잭션 + SELECT FOR UPDATE SKIP LOCKED)
- API Route: `POST /api/orders` (인증 필수, Zod 검증, bcrypt 해싱)
- 마이그레이션: `supabase/migrations/20260308000002_create_order_function.sql`
- Zod 스키마: `src/lib/validations/order.ts` (createOrderSchema)
- 패키지: `bcryptjs` + `@types/bcryptjs` (salt rounds 12)
- 임시 비밀번호: 3자리 숫자(000~999), bcrypt 해싱, 20분 만료
- 주문번호 형식: `TM-YYYYMMDD-XXXX` (XXXX = 4자리 영숫자 대문자)
- 응답 형식: `{ success: boolean, data?: T, error?: { code: string, message: string } }`

## Zod v4 주의사항
- `parsed.error.errors` 대신 `parsed.error.issues` 사용 (Zod v4 breaking change)

## 바우처 API (P2-018)
- API Routes: `src/app/api/vouchers/[code]/` (route.ts, verify-temp-password, set-password, unlock-pins, reissue)
- Zod 스키마: `src/lib/validations/voucher.ts`
- 인증 불필요 (SMS 링크 기반 접근, 코드만으로 조회)
- 상수: `src/lib/constants.ts` (VOUCHER_MAX_ATTEMPTS=5, VOUCHER_MAX_REISSUE=5, TEMP_PW_EXPIRY_MINUTES=20)
- 상태 전이: issued -> temp_verified -> password_set -> pin_revealed
- Supabase JOIN 결과를 `as unknown as Record<string, unknown>`으로 캐스팅 필요 (TS 타입 추론 이슈)
- 핀 복호화: `decryptPin()` from `src/lib/crypto/pin.ts`
- 주문/바우처/핀 상태 동기화: unlock-pins에서 3개 테이블 동시 업데이트

## SMS 모듈 (P2-020)
- 디렉토리: `src/lib/sms/` (aligo.ts, templates.ts, send.ts, index.ts)
- 알리고 API: `https://apis.aligo.in/send/` (POST, multipart/form-data)
- 메시지 타입: purchase, reissue, gift, cancel, admin_resend
- 재시도: 최대 3회 (1초/5초/30초), 최초 1회 + 재시도 3회 = 최대 4회 시도
- fire-and-forget: `sendSmsAsync()` (API 응답 블로킹 안 함)
- 동기 발송: `sendSmsSync()` (관리자 재발송 등 결과 필요 시)
- 메시지 바이트 > 90 시 자동 LMS 전환
- 개발 환경: testmode_yn=Y (실제 발송 안 함)
- 연동 지점: POST /api/orders (purchase), POST /api/vouchers/[code]/reissue (reissue)
- gift, cancel, admin_resend는 해당 API 구현 시 연동 예정

## 마이페이지 API (P3-013)
- 공통 인증 헬퍼: `src/lib/api/auth-guard.ts` (`getAuthenticatedUser()` → userId + adminClient 반환)
- API Routes: `src/app/api/mypage/` (summary, orders, vouchers, gifts, profile)
- 모든 API는 인증 필수 (adminClient 사용 — users RLS 우회)
- 페이징: page/limit 쿼리 파라미터, Supabase `.range()` + `count: 'exact'`
- 필터: status, date_from, date_to 쿼리 파라미터
- 바우처 쿼리: 중첩 JOIN 실패 시 폴백 쿼리 패턴 적용 (Supabase 중첩 관계 쿼리 불안정)
- 선물 API: type=sent|received 파라미터, 검색은 메모리 필터링 (DB 레벨 어려움)
- 프론트엔드: 모든 마이페이지를 클라이언트 컴포넌트로 전환, useEffect + fetch 패턴
- GiftListPage: `src/components/mypage/GiftListPage.tsx` (gifts prop 제거, 내부에서 API 호출)

## 관리자 주문 API (P4-015)
- API Routes: `src/app/api/admin/orders/` (route.ts=목록, [orderId]/route.ts=상세)
- 액션 API: `[orderId]/cancel`, `[orderId]/resend-sms`, `[orderId]/reset-password`, `[orderId]/unlock`
- 인증: `getAuthenticatedAdmin()` from `src/lib/admin/auth.ts` (세션 쿠키 기반)
- Zod: `adminCancelOrderSchema` in `src/lib/validations/admin.ts`
- 목록: 7종 필터 (order_status, fee_type, card_company, installment, date_range, amount_range, voucher_status)
- 검색: order_number, buyer_username, buyer_name, buyer_phone, product_name (일부 메모리 필터링)
- cancel_order_with_refund RPC: cancelled_by 하드코딩 "user" → 관리자 취소 시 후속 UPDATE로 "admin" 설정
- 타입 캐스팅 주의: cancellation 필드에서 reason_type은 CancellationReasonType, refund_status는 CancelStatus로 캐스팅 필수

## 관리자 회원 API (P4-016)
- API Routes: `src/app/api/admin/members/` (route.ts=목록+추가, [memberId]/route.ts=상세, [memberId]/status/route.ts=상태변경)
- 목록: 검색(username, name, email, phone), 상태 필터, 정렬, 페이징
- 상세: 회원 기본 정보 + 주문 내역(AdminOrderListItem[]) + 선물 내역(AdminGiftListItem[]) JOIN
- 상태 변경: PATCH /api/admin/members/[memberId]/status (active/suspended/inactive)
- 카운트 집계: voucher_count, gift_sent_count, gift_received_count는 별도 쿼리로 집계 (JOIN 대신 병렬 쿼리)
- Zod: `adminUpdateMemberStatusSchema`, `adminCreateMemberSchema` in `src/lib/validations/admin.ts`
- 프론트: MemberDetailModal에서 mock 함수 대신 API 호출로 전환 완료

## 관리자 상품/카테고리 API (P4-017)
- 상품 CRUD: `src/app/api/admin/products/` (route.ts=목록+등록, [productId]/route.ts=상세+수정+삭제)
- 이미지 업로드: `src/app/api/admin/products/upload/route.ts` (Supabase Storage, product-images 버킷)
- 카테고리 CRUD: `src/app/api/admin/categories/` (route.ts=목록+등록, [categoryId]/route.ts=수정+삭제)
- 카테고리 정렬: `PUT /api/admin/categories/reorder` (sort_order 일괄 변경)
- Zod: `adminCreateProductSchema`, `adminUpdateProductSchema`, `adminCreateCategorySchema`, `adminUpdateCategorySchema`, `adminReorderCategoriesSchema`
- ISR 무효화: revalidatePath("/", "layout") + 카테고리/상품 페이지
- 삭제 보호: 상품은 핀/주문이 있으면 삭제 불가, 카테고리는 소속 상품이 있으면 삭제 불가

## 관리자 핀 등록 API (P4-018)
- API Routes: `src/app/api/admin/pins/` (route.ts=목록+개별등록, [pinId]/route.ts=상세+수정+삭제, upload/route.ts=TXT대량등록, stock/route.ts=재고현황)
- 암호화: 기존 `src/lib/crypto/pin.ts`의 encryptPin/decryptPin 재사용 (AES-256-GCM)
- 핀번호 형식: `1234-1234-1234-1234` (하이픈 구분 4자리씩)
- TXT 대량 등록: 100개씩 청크, 중복체크(DB+파일내), 실패 리포트, registration_method="csv"
- 중복 체크: 암호화된 핀은 DB 레벨 비교 불가 → 전체 조회 후 복호화 비교 (waiting/assigned만)
- 핀번호 검색: 암호화 상태이므로 DB 레벨 검색 불가 → 결과 반환 후 메모리 필터링
- PinStockSummary 타입에 returned 필드 추가함 (기존 타입에 없었음)
- Zod: adminCreatePinSchema, adminUpdatePinSchema, adminUploadPinsSchema + PIN_NUMBER_PATTERN export

## Zod v4 UUID 호환성 주의
- Zod v4의 `.uuid()`는 RFC 4122 엄격 적용 (version 1-8, variant 89ab만 허용)
- 시드 데이터의 커스텀 UUID (예: c0000000-...) 는 검증 실패
- 대안: `z.string().regex(uuidPattern)` 사용 (uuidPattern은 8-4-4-4-12 hex 패턴)

## 관리자 선물/취소환불 API (P4-019)
- 선물 목록: `GET /api/admin/gifts` (필터: voucher_status, fee_type, date_range, amount_range + 통합검색)
- 선물 체인: `GET /api/admin/gifts/[giftId]/chain` (source_voucher_id 재귀 역추적 + 순방향 추적, MAX_DEPTH=50)
- 취소 목록: `GET /api/admin/cancellations` (필터: cancel_status, reason_type, cancelled_by, date_range, amount_range)
- 취소 재시도: `POST /api/admin/cancellations/[cancellationId]/retry` (PG stub, refund_status=failed만)
- 패턴: JOIN 필드 검색은 메모리 필터링 (최대 2000건 안전장치), DB 직접 필드는 DB 레벨 필터
- 프론트: 현재 mock 데이터 사용 (AdminGiftsClient, AdminRefundsClient), API 연동은 P4-021~026에서

## MainPay PG 결제 (P2-016)
- 핵심 모듈: `src/lib/payment/mainpay.ts` (generateTimestamp, generateSignature, paymentReady, paymentPay, paymentCancel)
- API Routes: `src/app/api/payment/ready/route.ts`, `src/app/api/payment/pay/route.ts`
- PG 콜백: `src/app/(user)/payment/approval/page.tsx`, `src/app/(user)/payment/close/page.tsx`
- 취소: `src/lib/payment/cancel.ts` (refNo/tranDate/payType 없으면 즉시 성공)
- 수수료: `src/lib/payment/fee.ts` (nextPcUrl/nextMobileUrl/mbrRefNo 반환)
- HOST: 결제창=api-std.mainpay.co.kr, 취소=relay.mainpay.co.kr (다름!)
- Content-Type: application/x-www-form-urlencoded (URLSearchParams)
- feePaymentConfirmSchema에 auth_token, mbr_ref_no 필드 추가됨

## 결제 세션 (P6-001) + 결제-주문 원자성 (P6-002)
- 테이블: `payment_sessions` (RLS 활성 + 정책 없음 = anon/authenticated 차단, service_role만 접근)
- 세션 헬퍼: `src/lib/payment/session.ts` (createPaymentSession, validatePaymentSession, completePaymentSession, getPaymentSession)
- 흐름: ready에서 세션 INSERT → pay에서 세션 조회 + amount 검증 → 세션 amount로 PG 승인 (클라이언트 값 무시)
- **P6-002**: `/api/payment/pay`가 PG 결제 승인 + 주문 생성을 하나의 흐름으로 처리
- 클라이언트는 `/api/orders`를 별도 호출하지 않음, pay 응답에서 order_number 직접 사용
- 세션에서 product_id, quantity, fee_type 추출 → RPC에 전달 (receiverPhone만 클라이언트에서 받음)
- 망취소: `executePgReversal()` — 주문 생성 실패 시 `cancelPgPayment()` 자동 호출
- 수수료 결제도 동일 패턴: PG 승인 성공 후 핀 전달 실패 시 망취소
- 수수료 결제도 동일 패턴: prepare에서 세션 INSERT → confirm에서 세션 검증
- **P6-003**: confirm에 바우처 비밀번호(password) 검증 추가 (bcrypt), prepare에 인증 사용자 owner 검증 추가
- **P6-004**: `deliver_fee_pins` RPC로 바우처·핀·주문 상태 원자적 전이, 마이그레이션 `20260309000006`
- handlePinDeliveryRetry도 비밀번호 검증 후에만 접근 가능 (confirm 내에서 비밀번호 검증 선행)
- feePaymentConfirmSchema에 password 필드 추가 (4자리 숫자)
- TTL: 30분, 만료 세션은 조회 시 expired로 전이
- cleanup_expired_payment_sessions() DB 함수 제공 (크론 없이 수동/필요 시 호출)
- 마이그레이션: `20260309000005_create_payment_sessions.sql`

## 환경변수
- `.env.local` 사용 (git 제외)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- PIN_ENCRYPTION_KEY (32바이트 hex, AES-256-GCM용)
- ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER (SMS 발송)
- MAINPAY_MBR, MAINPAY_API_KEY (PG 결제)
- NEXT_PUBLIC_APP_URL (바우처 URL, PG 콜백 URL 생성용)
