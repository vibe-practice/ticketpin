# 개발 로드맵

> 작성일: 2026-03-13
> 버전: v3.0

---

## 완료된 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 관리자 주문 취소 제한 해제 | ✅ 완료 |
| Phase 2 | 수수료 별도 결제 핀 전달 버그 수정 | ✅ 완료 |
| Phase 3 | 업체/정산 관리 백엔드 연동 | ✅ 완료 |

> 상세 내역: `docs/archive/v2/ROADMAP.md`, `docs/archive/v2/TASKS.md`

---

## Phase 4: 업체 전용 포털

### 배경

업체(Business)가 자기 데이터를 직접 조회할 수 있는 전용 포털. 관리자 측 업체/정산 관리(Phase 3)는 완료됨. 업체가 직접 접속하여 정산 요약, 매입 내역, 정산 내역, 계좌 정보를 확인하는 페이지.

### 인증 플로우

```
/business/[businessId] 접속
  ├─ 1단계: SMS 인증 (업체 등록 연락처로 6자리 인증번호 발송, 3분 유효)
  ├─ 2단계: 업체 로그인 (아이디/비밀번호, 아이디찾기·비번찾기 없음)
  └─ 3단계: 대시보드 진입 (세션 8시간 유지)
```

### URL 구조

| 경로 | 설명 |
|------|------|
| `/business/[businessId]` | SMS 인증 → 로그인 → 대시보드 |
| `/business/[businessId]/gifts` | 매입(선물) 상세 테이블 |
| `/business/[businessId]/settlements` | 정산 내역 테이블 |
| `/business/[businessId]/info` | 내 업체 정보 (조회 전용) |
| `/business/[businessId]/logs` | 접근 로그 |

### 보안

- SMS 인증 → 로그인 2단계 인증
- 세션에 businessId 포함, URL businessId와 일치 검증
- `business_sessions` 테이블 (별도)
- 미들웨어에서 `/business/*` 경로 보호
- 모든 인증/접근 시 IP 주소 로깅 (`business_access_logs`)

### DB 스키마 (신규)

#### business_accounts 테이블
```sql
CREATE TABLE business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  login_id varchar(50) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### business_sessions 테이블
```sql
CREATE TABLE business_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  token varchar(255) NOT NULL UNIQUE,
  ip_address varchar(45),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

#### business_verification_codes 테이블
```sql
CREATE TABLE business_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  code varchar(6) NOT NULL,
  phone varchar(20) NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

#### business_access_logs 테이블
```sql
CREATE TABLE business_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  ip_address varchar(45) NOT NULL,
  action varchar(30) NOT NULL CHECK (action IN ('verify_attempt', 'verify_success', 'login_attempt', 'login_success', 'login_fail', 'page_access', 'logout')),
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```

### API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/business/[id]/verify/send` | SMS 인증번호 발송 |
| POST | `/api/business/[id]/verify/confirm` | 인증번호 확인 |
| POST | `/api/business/[id]/login` | 업체 로그인 |
| POST | `/api/business/[id]/logout` | 로그아웃 |
| GET | `/api/business/[id]/dashboard` | 대시보드 통계 |
| GET | `/api/business/[id]/gifts` | 매입 내역 |
| GET | `/api/business/[id]/settlements` | 정산 내역 |
| GET | `/api/business/[id]/info` | 업체 정보 |
| GET | `/api/business/[id]/access-logs` | 접근 로그 |

### 재활용 기존 코드

| 파일 | 활용 |
|------|------|
| `src/lib/admin/auth.ts` | 업체 인증 헬퍼 패턴 복제 |
| `src/middleware.ts` | 업체 경로 보호 로직 추가 |
| `src/app/(admin)/layout.tsx` | 업체 레이아웃 패턴 참고 |
| `src/types/index.ts` | Business, Settlement, SettlementGiftItem 타입 재활용 |
| `src/lib/admin-constants.ts` | 상태 스타일/라벨 상수 재활용 |
| `src/lib/sms/aligo.ts` | SMS 발송 함수 재활용 |
| `src/lib/validations/business.ts` | Zod 스키마 재활용 |

### 마일스톤

**예상 기간:** 3~4일

| 순서 | 태스크 | 예상 시간 |
|------|--------|----------|
| 1 | P4-001 + P4-002 (병렬) | 5h | ✅ 완료 |
| 2 | P4-003~P4-007 (병렬) | 13.5h | ✅ 완료 |
| 3 | P4-008 | 4.5h | ✅ 완료 |
| 4 | P4-009 + P4-010 (병렬) | 6h | ✅ 완료 |
| 5 | P4-011 | 2h |

### 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| SMS 인증 + 로그인 2단계 세션 관리 복잡도 | 중간 | SMS 인증 통과 상태를 임시 토큰으로 관리, 로그인 시 최종 세션 발급 |
| 업체 A가 업체 B URL 접근 시 보안 | 높음 | 세션 businessId ↔ URL businessId 일치 검증 + 미들웨어 보호 |
| IP 로깅 프라이버시 | 낮음 | 업체 자체 보안 관리 용도, 업체 본인만 조회 가능 |
