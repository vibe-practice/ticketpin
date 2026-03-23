# 관리자 기능 개선 및 버그 수정 로드맵

> 작성일: 2026-03-10
> 버전: v1.0

---

## 1. 기술 스택

기존 프로젝트 스택 그대로 사용 (변경 없음)

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript (strict) |
| DB | Supabase (PostgreSQL) |
| 스타일링 | Tailwind CSS 4 |
| UI | shadcn/ui + Radix UI |

---

## 2. 시스템 아키텍처

### 변경 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/admin/orders/[orderId]/cancel/route.ts` | `user_password_hash` 검증 제거 |
| `src/components/admin/orders/OrderDetailModal.tsx` | 취소 버튼 노출 조건 변경 + 경고 문구 추가 |

### 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `src/app/api/orders/[orderId]/cancel/route.ts` | 사용자 취소는 기존 정책 유지 (비밀번호 설정 전만 취소 가능) |
| `supabase/migrations/20260308000004_create_cancel_order_function.sql` | RPC 함수는 이미 상태 무관하게 취소 처리 가능 |

---

## 3. 상태 관리

### 주문 상태별 관리자 취소 가능 여부 (변경 후)

| 주문 상태 | 현재 | 변경 후 |
|-----------|------|---------|
| `paid` (결제완료) | 취소 가능 | 취소 가능 |
| `password_set` (비밀번호 설정) | **취소 불가** | 취소 가능 |
| `pin_revealed` (핀 확인) | **취소 불가** | 취소 가능 |
| `gifted` (선물 완료) | **취소 불가** | 취소 가능 |
| `cancelled` (취소됨) | 취소 불가 (이미 취소) | 취소 불가 (이미 취소) |

---

## 4. 보안 구현

### 관리자 전용 변경

- 사용자 취소 API (`/api/orders/[orderId]/cancel`)는 **기존 정책 유지** — 비밀번호 설정 전만 취소 가능
- 관리자 취소 API (`/api/admin/orders/[orderId]/cancel`)만 제한 해제
- 관리자 인증 (`getAuthenticatedAdmin`)은 기존 그대로 유지

### 취소 시 경고

- 비밀번호가 설정된 주문 취소 시 관리자에게 경고 문구 표시
- 핀 번호가 이미 확인된 주문 취소 시 더 강한 경고 표시

---

## 5. 마일스톤

### Phase 1: 관리자 취소 제한 해제

**목표:** 관리자가 `cancelled` 외 모든 상태의 주문을 취소할 수 있도록 함
**예상 기간:** 1일

#### 포함 기능

- 관리자 취소 API에서 비밀번호 설정 여부 검증 제거
- 관리자 UI에서 취소 버튼 노출 조건 변경 (`cancelled`만 아니면 노출)
- 비밀번호 설정/핀 확인 완료 주문 취소 시 경고 문구 추가

#### 릴리즈 기준 (Definition of Done)

- [x] `password_set` 상태 주문에서 취소 버튼 노출 확인 ✅ 완료
- [x] `pin_revealed` 상태 주문에서 취소 버튼 노출 확인 ✅ 완료
- [x] `gifted` 상태 주문에서 취소 버튼 노출 확인 ✅ 완료
- [x] 취소 처리 시 PG 환불 + DB 상태 변경 + 핀 재고 복구 정상 동작 ✅ 완료
- [x] 비밀번호 설정된 주문 취소 시 경고 문구 표시 ✅ 완료
- [x] 빌드/린트 통과 ✅ 완료

---

## 6. 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 핀 번호가 이미 노출된 주문 취소 시 핀 재사용 문제 | 높음 | 취소 시 핀이 `waiting` 상태로 복구되므로, 이미 확인된 핀이 다른 사용자에게 재배정될 수 있음 → 관리자에게 경고 문구로 안내 |
| 선물 완료된 주문 취소 시 수신자 바우처 처리 | 중간 | 선물된 주문의 경우 수신자 바우처도 함께 취소되어야 함 → 현재 RPC 함수가 원래 바우처만 처리하므로 주의 필요 |

---

## 7. Phase 2: 수수료 별도 결제 핀 전달 버그 수정 ✅ 완료

### 배경

수수료 별도(`fee_type: "separate"`) 결제 상품에서 핀 번호 확인을 위해 수수료를 결제하면 "결제 처리 실패, 핀 전달 처리 중 오류가 발생했습니다. 결제가 취소됩니다." 에러가 발생하는 버그.

### 원인

`/api/vouchers/[code]/fee-payment/confirm` API에서 RPC `deliver_fee_pins`의 멱등성 응답(`already_delivered: true`)을 제대로 처리하지 않음.

### 변경 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/vouchers/[code]/fee-payment/confirm/route.ts` | RPC 응답의 `already_delivered` 플래그 처리 + 핀 조회 안정성 개선 |

### 마일스톤

**목표:** 수수료 별도 결제 상품에서 수수료 결제 후 핀 번호가 정상적으로 전달되도록 수정
**예상 기간:** 0.5일

#### 릴리즈 기준 (Definition of Done)

- [ ] 수수료 별도 결제 상품에서 수수료 결제 → 핀 번호 정상 확인
- [ ] 중복 호출 시에도 에러 없이 핀 번호 반환
- [ ] PG 망취소가 불필요하게 실행되지 않음
- [ ] 빌드/린트 통과

---

## 8. Phase 3: 업체/정산 관리 백엔드 연동

> 프론트엔드(더미 데이터) 구현 완료 상태. 백엔드 API + DB 스키마 + 프론트 연동 진행.

### 배경

업체(B2B)가 고객으로부터 상품권을 매입한 뒤, 플랫폼 수신 계정으로 "선물하기"로 교환권을 전송하고, 관리자가 일별로 집계하여 수수료율을 적용한 정산금액을 입금하는 시스템.

### 비즈니스 플로우

1. 업체의 고객이 사이트에서 상품권 구매
2. 업체가 고객으로부터 교환권 매입 (수수료 떼고 고객에 입금)
3. 업체가 플랫폼 지정 수신 계정으로 "선물하기"로 교환권 전송
4. 관리자가 일별로 받은 선물 집계 → 정산(수수료율 적용) → 수동 입금 → 입금완료 처리

### 현재 상태 (API 연동 완료)

| 파일 | 상태 | 설명 |
|------|------|------|
| `src/components/admin/businesses/AdminBusinessesClient.tsx` | ✅ API 연동 | 업체 목록/필터/검색 |
| `src/components/admin/businesses/BusinessFormModal.tsx` | ✅ API 연동 | 업체 등록/수정 폼 |
| `src/components/admin/businesses/BusinessDetailModal.tsx` | ✅ API 연동 | 업체 상세 (탭: 기본정보/매입내역/정산내역) |
| `src/components/admin/settlements/AdminSettlementsClient.tsx` | ✅ API 연동 | 정산 목록 (날짜 범위/검색/정렬/페이지네이션) |
| `src/components/admin/settlements/SettlementDetailModal.tsx` | ✅ API 연동 | 정산 상세 (건별 목록 + 합계) |
| `src/components/admin/settlements/SettlementGenerateModal.tsx` | ✅ API 연동 | 일별 정산 생성 |
| `src/components/admin/settlements/VoucherDetailModal.tsx` | ✅ API 연동 | 교환권 건별 상세 (체인 + 검증 + 핀 재활용) |
| `src/types/index.ts` | ✅ 완료 | Business, Settlement, SettlementGiftItem 타입 정의 |

### DB 스키마 설계

#### businesses 테이블
```sql
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  business_name varchar(100) NOT NULL,
  contact_person varchar(50) NOT NULL,
  contact_phone varchar(100) NOT NULL,
  bank_name varchar(50) NOT NULL,
  account_number varchar(50) NOT NULL,
  account_holder varchar(50) NOT NULL,
  commission_rate numeric(5,2) NOT NULL DEFAULT 96.00,
  receiving_account_id uuid REFERENCES users(id),
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### settlements 테이블
```sql
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  settlement_date date NOT NULL,
  gift_count integer NOT NULL DEFAULT 0,
  gift_total_amount integer NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL,
  settlement_amount integer NOT NULL DEFAULT 0,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  confirmed_at timestamptz,
  paid_at timestamptz,
  paid_by uuid REFERENCES admin_users(id),
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (business_id, settlement_date)
);
```

#### settlement_gift_items 테이블
```sql
CREATE TABLE settlement_gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES gifts(id),
  settlement_per_item integer NOT NULL DEFAULT 0,
  verification_status varchar(20) DEFAULT 'pending' CHECK (verification_status IN ('verified', 'suspicious', 'rejected', 'pending')),
  verification_memo text,
  recycle_status varchar(20) DEFAULT 'received' CHECK (recycle_status IN ('received', 'verified', 'recycled', 'rejected')),
  recycled_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### users 테이블 수정
```sql
ALTER TABLE users ADD COLUMN is_receiving_account boolean DEFAULT false;
```

### API 엔드포인트 설계

| 메서드 | 엔드포인트 | 설명 | 태스크 |
|--------|-----------|------|--------|
| GET | `/api/admin/businesses` | 업체 목록 조회 | P3-002 |
| POST | `/api/admin/businesses` | 업체 등록 | P3-002 |
| GET | `/api/admin/businesses/[id]` | 업체 상세 | P3-002 |
| PATCH | `/api/admin/businesses/[id]` | 업체 수정 | P3-002 |
| DELETE | `/api/admin/businesses/[id]` | 업체 삭제 (soft) | P3-002 |
| GET | `/api/admin/businesses/[id]/gifts` | 업체 매입 내역 | P3-003 |
| POST | `/api/admin/settlements/generate` | 일별 정산 생성 | P3-004 |
| GET | `/api/admin/settlements` | 정산 목록 조회 | P3-005 |
| GET | `/api/admin/settlements/[id]` | 정산 상세 + 건별 목록 | P3-005 |
| PATCH | `/api/admin/settlements/[id]/status` | 정산 상태 변경 | P3-005 |
| PATCH | `.../items/[itemId]/verify` | 검증 상태 변경 | P3-006 |
| POST | `.../items/[itemId]/recycle` | 핀 재고 복원 | P3-007 |

### 마일스톤

**목표:** 업체/정산 관리 백엔드 완성 + 프론트엔드 연동
**예상 기간:** 2~3일 (2026-03-12 ~ 2026-03-14)

#### 릴리즈 기준 (Definition of Done)

- [ ] DB 마이그레이션 적용 성공 (businesses, settlements, settlement_gift_items)
- [ ] 업체 CRUD API 정상 동작
- [ ] 일별 정산 생성 — 건당/총 정산금액 반올림 정확
- [ ] 정산 상태 변경 (대기→확인→입금완료) 플로우 정상
- [ ] 교환권 자동 검증 (바우처/핀/주문 상태 체크)
- [ ] 교환권 수동 검증 — rejected 시 정산 금액 재계산
- [ ] 핀 재활용 — assigned → waiting 상태 복원
- [ ] 수신 계정 검색 제외 로직 적용
- [ ] 프론트엔드 더미 데이터 → 실제 API 연동 완료
- [ ] 빌드/린트 통과
- [ ] 브라우저 테스트 통과

### 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 정산 생성 시 선물 체인 역추적 쿼리 복잡도 | 중간 | gifts → vouchers → orders → users 다중 JOIN 필요. 인덱스 최적화 + 필요 시 materialized view 고려 |
| 핀 재활용 시 원자성 보장 | 높음 | RPC 함수로 트랜잭션 처리 (핀 상태 변경 + 바우처 처리 + recycle_status 변경을 하나의 트랜잭션으로) |
| 정산 금액 반올림 일관성 | 중간 | 건당 정산금액은 Math.round(total_amount × rate / 100), 총 정산금액은 건당의 합. DB와 프론트 로직 일치 필요 |
| 수신 계정 보안 | 중간 | is_receiving_account 플래그가 노출되면 업체 계정 식별 가능 → RLS로 일반 사용자에게 해당 컬럼 숨김 |
