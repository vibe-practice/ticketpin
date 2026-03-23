# 개발 태스크

## 개요
- 총 태스크 수: 14개
- Phase 1: 2개 | Phase 2: 1개 | Phase 3: 11개
- 예상 총 개발 시간: 20h

---

## 코드 규칙

### 커밋 컨벤션
- `feat(태스크ID): 설명` — 새 기능
- `fix(태스크ID): 설명` — 버그 수정

### 완료 정의 (Definition of Done)
- [ ] 코드 작성 완료 (태스크 완료 기준 충족)
- [ ] 빌드 통과 (`npm run build`)
- [ ] 린트 통과 (`npm run lint`)
- [ ] 브라우저 테스트 통과
- [ ] 문서 업데이트 (TASKS.md, ROADMAP.md)

---

## Phase 1: 관리자 주문 취소 제한 해제

### 1. 관리자 취소 API 수정
> 관리자 취소 API에서 비밀번호/핀 확인 여부 검증을 제거하여, cancelled 외 모든 상태에서 취소 가능하도록 변경

- [x] `P1-001` 🔴 관리자 취소 API에서 `user_password_hash` 검증 제거 (~0.5h)
  - 파일: `src/app/api/admin/orders/[orderId]/cancel/route.ts`
  - 작업 내용:
    - 116~128행의 `voucher.user_password_hash !== null` 검증 블록 제거
    - 주석 업데이트 (14행: "비밀번호가 미설정된 주문만 취소 가능" → "cancelled 외 모든 상태 취소 가능")
  - 완료 기준: `password_set`, `pin_revealed`, `gifted` 상태 주문 모두 API를 통해 취소 가능

### 2. 관리자 UI 취소 버튼 조건 변경
> OrderDetailModal에서 취소 버튼 노출 조건을 변경하고, 비밀번호 설정/핀 확인 완료 주문 취소 시 경고 문구 추가

- [x] `P1-002` 🔴 OrderDetailModal 취소 버튼 조건 변경 + 경고 문구 추가 (~1.5h)
  - 파일: `src/components/admin/orders/OrderDetailModal.tsx`
  - 작업 내용:
    - 284행: `canAdminCancel = isNotCancelled && !order.is_password_set` → `canAdminCancel = isNotCancelled` 로 변경
    - CancelReasonDialog에 주문 상태 정보 전달하여, 비밀번호 설정 완료/핀 확인 완료/선물 완료 주문일 경우 경고 문구 표시
    - 경고 문구 예시: "이 주문은 비밀번호가 설정되었습니다. 취소 시 바우처가 비활성화되고 핀이 재고로 복구됩니다."
    - 핀 확인 완료 주문: "이 주문은 핀 번호가 이미 확인되었습니다. 취소 시 확인된 핀이 재고로 복구되어 다른 사용자에게 재배정될 수 있습니다."
  - 완료 기준: `cancelled` 외 모든 상태에서 취소 버튼 노출, 상태별 적절한 경고 문구 표시, 취소 처리 정상 동작

---

## Phase 2: 수수료 별도 결제 핀 전달 버그 수정

### 3. 수수료 결제 확인 API 버그 수정
> 수수료 별도 결제 상품에서 수수료 결제 후 "결제 처리 실패, 핀 전달 처리 중 오류" 에러 발생 → RPC 멱등성 응답 미처리 및 핀 조회 로직 수정

- [x] `P2-001` 🔴 수수료 결제 확인 API(`fee-payment/confirm`) 핀 전달 로직 수정 (~1.5h)
  - 파일: `src/app/api/vouchers/[code]/fee-payment/confirm/route.ts`
  - 작업 내용:
    - 367행: RPC 응답 타입에 `pin_count` 필드 추가
    - 369~385행: RPC 응답의 `already_delivered: true` 플래그 체크 로직 추가 — 이미 전달 완료된 경우 PG 망취소 없이 기존 핀 반환
    - 388~401행: `fetchAndDecryptPins` 호출 실패 시 재시도 또는 에러 처리 개선
    - 508~573행: `handlePinDeliveryRetry` 함수에도 동일한 `already_delivered` 처리 적용
  - 완료 기준: 수수료 별도 결제 → 핀 번호 정상 확인, 중복 호출 시에도 에러 없이 핀 반환, 불필요한 PG 망취소 방지

---

## Phase 3: 업체/정산 관리 백엔드 연동

### DB 스키마 (마이그레이션)

- [x] `P3-001` 🔴 businesses 테이블 + settlements 테이블 마이그레이션 작성 (~2h)
  - 파일: `supabase/migrations/20260312000001_create_businesses_settlements.sql`
  - 작업 내용:
    - `businesses` 테이블 생성 (id, user_id→users.id, business_name, contact_person, contact_phone, bank_name, account_number, account_holder, commission_rate, receiving_account_id→users.id, status, memo, created_at, updated_at)
    - `settlements` 테이블 생성 (id, business_id→businesses.id, settlement_date, gift_count, gift_total_amount, commission_rate, settlement_amount, status, confirmed_at, paid_at, paid_by, memo, created_at, updated_at)
    - `settlement_gift_items` 테이블 생성 (id, settlement_id→settlements.id, gift_id→gifts.id, verification_status, verification_memo, recycle_status, created_at)
    - `users` 테이블에 `is_receiving_account boolean DEFAULT false` 컬럼 추가
    - 인덱스: businesses(user_id), businesses(receiving_account_id), settlements(business_id, settlement_date), settlement_gift_items(settlement_id)
    - RLS: service_role만 접근 (관리자 API 경유)
    - updated_at 트리거 적용
  - 완료 기준: `supabase db push` 또는 마이그레이션 적용 성공, 테이블 생성 확인

### 업체 관리 API

- [x] `P3-002` 🔴 업체 CRUD API (~2h)
  - 파일: `src/app/api/admin/businesses/route.ts` (GET 목록, POST 등록)
  - 파일: `src/app/api/admin/businesses/[businessId]/route.ts` (GET 상세, PATCH 수정, DELETE 삭제)
  - 작업 내용:
    - GET `/api/admin/businesses` — 업체 목록 조회 (필터: 업체명/아이디 검색, 상태, 수수료율 범위), 페이지네이션, 누적 통계(총 매입건수/금액/정산금액/미정산금액) JOIN
    - POST `/api/admin/businesses` — 업체 등록 (user_id 연결, 수신 계정 지정, Zod 유효성 검증)
    - GET `/api/admin/businesses/[businessId]` — 업체 상세 조회
    - PATCH `/api/admin/businesses/[businessId]` — 업체 정보 수정 (수수료율, 계좌, 담당자 등)
    - DELETE `/api/admin/businesses/[businessId]` — 업체 삭제 (소프트 삭제: status → terminated)
  - 완료 기준: 모든 CRUD 동작 정상, 관리자 인증 적용, Zod 유효성 검증 통과

- [x] `P3-003` 🟡 업체 매입(선물) 내역 API (~1h)
  - 파일: `src/app/api/admin/businesses/[businessId]/gifts/route.ts`
  - 작업 내용:
    - GET — 해당 업체의 수신 계정(receiving_account_id)으로 들어온 선물(gifts) 목록 조회
    - 날짜 범위 필터, 페이지네이션
    - gifts 테이블 JOIN: vouchers → orders → users 로 최초 구매자 정보 역추적
  - 완료 기준: 수신 계정으로 받은 선물 목록 정상 조회, 체인 역추적 정보 포함

### 정산 관리 API

- [x] `P3-004` 🔴 일별 정산 생성 API (~2.5h)
  - 파일: `src/app/api/admin/settlements/generate/route.ts`
  - 작업 내용:
    - POST — 날짜(또는 날짜 범위) + 업체 ID(선택) 받아서 정산 레코드 자동 생성
    - 해당일에 수신 계정으로 들어온 선물을 업체별 집계
    - 건당 정산금액 = total_amount × commission_rate / 100 (반올림)
    - 총 정산금액 = 건당 정산금액의 합
    - settlement_gift_items 테이블에 건별 레코드 삽입
    - 자동 검증: 바우처 상태(gifted), 핀 상태(assigned), 주문 존재 여부 확인 → 이상 시 suspicious 처리
    - 이미 해당 날짜+업체 정산이 존재하면 409 Conflict 반환
  - 완료 기준: 정산 자동 생성 정상 동작, 건당/총 정산금액 반올림 정확, 자동 검증 동작, 중복 방지

- [x] `P3-005` 🔴 정산 CRUD + 상태 변경 API (~2h)
  - 파일: `src/app/api/admin/settlements/route.ts` (GET 목록)
  - 파일: `src/app/api/admin/settlements/[settlementId]/route.ts` (GET 상세, PATCH 수정)
  - 파일: `src/app/api/admin/settlements/[settlementId]/status/route.ts` (PATCH 상태 변경)
  - 작업 내용:
    - GET `/api/admin/settlements` — 정산 목록 조회 (필터: 업체명, 상태, 대상일 범위, 금액 범위), 페이지네이션, businesses JOIN
    - GET `/api/admin/settlements/[settlementId]` — 정산 상세 + 건별 선물 목록 (settlement_gift_items JOIN gifts/vouchers/orders/users)
    - PATCH `.../status` — 상태 변경 (pending→confirmed→paid, pending/confirmed→cancelled)
    - 상태 변경 시 타임스탬프 기록 (confirmed_at, paid_at, paid_by)
  - 완료 기준: 목록/상세/상태 변경 정상 동작, 상태 전이 규칙 적용

- [x] `P3-006` 🟡 교환권 검증 상태 변경 API (~1h)
  - 파일: `src/app/api/admin/settlements/[settlementId]/items/[itemId]/verify/route.ts`
  - 작업 내용:
    - PATCH — settlement_gift_items의 verification_status 변경 (verified/suspicious/rejected/pending)
    - verification_memo 업데이트
    - rejected로 변경 시 해당 정산의 총 금액 재계산 (settlement_amount 업데이트)
  - 완료 기준: 검증 상태 변경 → 정산 금액 자동 재계산

- [x] `P3-007` 🟡 핀 재활용(재고 복원) API (~1.5h)
  - 파일: `src/app/api/admin/settlements/[settlementId]/items/[itemId]/recycle/route.ts`
  - 작업 내용:
    - POST — 해당 건의 핀들을 assigned → waiting으로 상태 변경
    - 바우처 연결 해제 (voucher_id NULL 처리 또는 바우처 cancelled 처리)
    - settlement_gift_items의 recycle_status를 recycled로 변경
    - 트랜잭션으로 원자성 보장 (RPC 함수 작성 권장)
  - 완료 기준: 핀 상태 waiting으로 복원, 해당 상품 재고에 반영, recycle_status 정상 업데이트

### 프론트엔드 ↔ 백엔드 연동

- [x] `P3-008` 🔴 업체 관리 프론트엔드 API 연동 (~2h)
  - 파일: `src/components/admin/businesses/AdminBusinessesClient.tsx`
  - 파일: `src/components/admin/businesses/BusinessFormModal.tsx`
  - 파일: `src/components/admin/businesses/BusinessDetailModal.tsx`
  - 작업 내용:
    - 더미 데이터(MOCK_*) → fetch API 호출로 교체
    - 업체 등록/수정 폼 → POST/PATCH API 호출
    - 업체 상세 모달 매입/정산 탭 → 실제 API 데이터 로드
    - 로딩/에러 상태 처리, toast 알림
  - 완료 기준: 더미 데이터 제거, 실제 API와 연동하여 CRUD 정상 동작

- [x] `P3-009` 🔴 정산 관리 프론트엔드 API 연동 (~2.5h)
  - 파일: `src/components/admin/settlements/AdminSettlementsClient.tsx`
  - 파일: `src/components/admin/settlements/SettlementDetailModal.tsx`
  - 파일: `src/components/admin/settlements/SettlementGenerateModal.tsx`
  - 파일: `src/components/admin/settlements/VoucherDetailModal.tsx`
  - 작업 내용:
    - 더미 데이터(MOCK_*) → fetch API 호출로 교체
    - 일별 정산 생성 모달 → POST `/api/admin/settlements/generate` 호출
    - 정산 상태 변경 → PATCH API 호출
    - 교환권 검증 상태 변경, 핀 재활용 → 각 API 호출
    - 날짜 범위 필터, 검색, 정렬, 페이지네이션 → API 쿼리 파라미터로 전달
  - 완료 기준: 더미 데이터 제거, 실제 API와 연동하여 전체 플로우 정상 동작

- [x] `P3-010` 🟡 수신 계정 검색 제외 로직 (~0.5h)
  - 파일: `src/app/api/vouchers/[code]/search-user/route.ts`
  - 작업 내용:
    - 선물하기 사용자 검색 시 `is_receiving_account = true`인 계정 제외
    - 업체가 정확한 아이디를 입력하면 선물 가능하도록 정확 검색은 허용
  - 완료 기준: 일반 사용자가 수신 계정을 검색할 수 없음, 정확 입력 시에는 선물 가능

### Zod 스키마

- [x] `P3-011` 🟢 업체/정산 Zod 유효성 스키마 작성 (~0.5h)
  - 파일: `src/lib/validations/business.ts`
  - 작업 내용:
    - `businessFormSchema` — 업체 등록/수정 폼 유효성 (업체명 필수, 수수료율 1~100 범위, 계좌 정보 등)
    - `settlementGenerateSchema` — 정산 생성 요청 (날짜, 업체 ID)
    - `verificationUpdateSchema` — 검증 상태 변경 (status enum, memo 선택)
  - 완료 기준: 모든 API 엔드포인트에서 Zod 유효성 검증 적용

---

## 배포 후 개선 태스크

### Rate Limiter Redis 전환
> 현재 인메모리 Map 기반 Rate Limiter → Upstash Redis로 전환. Vercel 서버리스에서 인스턴스 간 상태 공유 불가 문제 해결.

- [ ] `POST-001` 🟡 Rate Limiter를 Upstash Redis 기반으로 전환 (~2h)
  - 파일: `src/lib/rate-limit.ts`
  - 작업 내용:
    - `@upstash/ratelimit` + `@upstash/redis` 패키지 설치
    - 인메모리 Map → Redis 기반 sliding window 방식으로 전환
    - 기존 `checkRateLimit()` 인터페이스 유지 (호출부 변경 최소화)
    - 환경변수 추가: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - 완료 기준: Vercel 서버리스 환경에서도 Rate Limit이 인스턴스 간 공유되어 정상 동작

---

## 의존성 맵

| 태스크 | 선행 태스크 | 이유 |
|--------|-----------|------|
| P1-001 | 없음 | API 독립 수정 |
| P1-002 | P1-001 | API가 먼저 취소를 허용해야 UI에서 호출 가능 |
| P2-001 | 없음 | Phase 1과 독립적인 버그 수정 |
| P3-001 | 없음 | DB 스키마가 가장 먼저 필요 |
| P3-002 | P3-001 | 테이블이 있어야 API 작성 가능 |
| P3-003 | P3-001 | 테이블이 있어야 API 작성 가능 |
| P3-004 | P3-001 | 테이블이 있어야 정산 생성 가능 |
| P3-005 | P3-001 | 테이블이 있어야 API 작성 가능 |
| P3-006 | P3-004 | 정산 생성 후 검증 가능 |
| P3-007 | P3-004 | 정산 건이 있어야 핀 재활용 가능 |
| P3-008 | P3-002, P3-003 | 업체 API가 있어야 프론트 연동 가능 |
| P3-009 | P3-004, P3-005, P3-006, P3-007 | 정산 API가 있어야 프론트 연동 가능 |
| P3-010 | P3-001 | users 테이블 is_receiving_account 컬럼 필요 |
| P3-011 | 없음 | 독립적, 하지만 P3-002~P3-007에서 사용 |

### 추천 작업 순서

1. `P3-011` → `P3-001` (Zod 스키마 + DB 스키마 먼저)
2. `P3-002` + `P3-003` (업체 API — 병렬 가능)
3. `P3-004` → `P3-005` (정산 생성 → 정산 CRUD)
4. `P3-006` + `P3-007` (검증 + 재활용 — 병렬 가능)
5. `P3-008` + `P3-009` + `P3-010` (프론트 연동 — 병렬 가능)

---

## 일정

### 전체 타임라인

| Phase | 기간 | 시작 (예상) | 종료 (예상) |
|-------|------|------------|------------|
| Phase 1 | 1일 | 2026-03-10 | 2026-03-10 |
| Phase 2 | 0.5일 | 2026-03-10 | 2026-03-10 |
| Phase 3 | 2~3일 | 2026-03-12 | 2026-03-14 |
