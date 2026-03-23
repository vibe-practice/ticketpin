# 개발 태스크

## 개요
- Phase 4: 업체 전용 포털 (11개 태스크)
- 예상 개발 시간: 30h
- Phase 1~3은 완료됨 → `docs/archive/v2/TASKS.md` 참조

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

## Phase 4: 업체 전용 포털

### 인증 플로우

```
/business/[businessId] 접속
  → 미인증: SMS 인증번호 화면 (업체 등록 연락처로 6자리 발송)
  → 인증 통과: 업체 로그인 페이지 (아이디/비밀번호)
  → 로그인 성공: 대시보드 (세션 8시간 유지)
```

### URL 구조

| 경로 | 설명 |
|------|------|
| `/business/[businessId]` | SMS 인증 → 로그인 → 대시보드 |
| `/business/[businessId]/gifts` | 매입(선물) 상세 테이블 |
| `/business/[businessId]/settlements` | 정산 내역 테이블 |
| `/business/[businessId]/info` | 내 업체 정보 (조회 전용) |
| `/business/[businessId]/logs` | 접근 로그 (IP, 시간, 액션) |

---

### 타입 + 더미 데이터

- [x] `P4-001` 🔴 업체 포털 전용 타입 정의 + 더미 데이터 (~2h)
  - `src/types/index.ts`에 `BusinessDashboardStats`, `BusinessGiftListItem`, `BusinessAccessLog` 타입 추가
  - `src/mock/business/` 디렉토리에 더미 데이터 생성 (dashboard, gifts, settlements, info, logs)
  - 완료 기준: 타입 정의 완료, 더미 데이터 5종 생성

### 레이아웃

- [x] `P4-002` 🔴 업체 레이아웃 + 사이드바/상단바 컴포넌트 (~3h)
  - `src/app/(business)/layout.tsx` 생성 (관리자 layout 패턴 참고)
  - `src/components/business/BusinessSidebar.tsx` (5개 메뉴: 대시보드, 매입상세, 정산내역, 업체정보, 접근로그)
  - `src/components/business/BusinessTopBar.tsx` (업체명, 로그아웃)
  - 완료 기준: 레이아웃 렌더링, 접기/펼치기, 반응형

### SMS 인증 + 로그인

- [x] `P4-003` 🔴 업체 SMS 인증 + 로그인 페이지 UI (~3h)
  - **SMS 인증 화면** (1단계):
    - `/business/[businessId]` 미인증 시 표시
    - 휴대폰 뒷자리 마스킹 표시 (010-****-5678)
    - 인증번호 발송 버튼, 6자리 입력, 3분 타이머
    - 더미 인증 처리 (프론트엔드 먼저 원칙)
  - **로그인 화면** (2단계):
    - SMS 인증 통과 후 표시
    - 업체 아이디 + 비밀번호 입력 폼
    - 아이디 찾기/비밀번호 찾기 없음
    - 더미 로그인 처리
  - 완료 기준: SMS 인증 → 로그인 → 대시보드 진입 플로우 동작 (더미)

### 페이지 UI

- [x] `P4-004` 🔴 대시보드 페이지 UI (~3h)
  - 통계 카드 4개: 오늘 매입건수, 오늘 매입금액, 오늘 정산금액, 이번달 정산금액
  - 기간 필터 (오늘/7일/30일/직접설정)
  - 완료 기준: 통계 카드 렌더링, 기간 필터 동작, 더미 데이터 반영

- [x] `P4-005` 🔴 매입(선물) 상세 테이블 페이지 UI (~3h)
  - 테이블 컬럼: 일시, 보낸 사람, 상품명, 수량, 금액, 결제수단, 정산금액
  - 기간 필터, 페이지네이션, CSV 내보내기
  - 완료 기준: 테이블 렌더링, 필터/페이지네이션 동작

- [x] `P4-006` 🔴 정산 내역 테이블 페이지 UI (~3h)
  - 테이블 컬럼: 정산일, 매입건수, 매입총액, 수수료율, 정산금액, 상태
  - 상태/기간 필터, 페이지네이션
  - 완료 기준: 테이블 렌더링, 상태 뱃지, 필터 동작

- [x] `P4-007` 🟡 업체 정보 페이지 UI (~1.5h)
  - 카드 형태: 업체명, 담당자, 연락처, 은행/계좌, 수수료율
  - 조회 전용 (수정 UI 없음)
  - 완료 기준: 정보 카드 렌더링

### 백엔드

- [x] `P4-008` 🔴 업체 인증 백엔드 (SMS + 로그인 + 세션 + 미들웨어 + IP 로깅) (~4.5h)
  - **DB 테이블**:
    - `business_accounts` (업체 로그인 계정: id, business_id, login_id, password_hash, created_at, updated_at)
    - `business_sessions` (세션: id, business_id, token, ip_address, expires_at, created_at)
    - `business_verification_codes` (인증번호: id, business_id, code, phone, expires_at, verified, created_at)
    - `business_access_logs` (접근 로그: id, business_id, ip_address, action, user_agent, created_at)
  - **API**:
    - POST `/api/business/[businessId]/verify/send` — SMS 인증번호 발송
    - POST `/api/business/[businessId]/verify/confirm` — 인증번호 확인 (IP 로그 기록)
    - POST `/api/business/[businessId]/login` — 아이디/비밀번호 로그인 → 세션 생성 (IP 로그 기록)
    - POST `/api/business/[businessId]/logout` — 로그아웃
  - `src/lib/business/auth.ts` (getAuthenticatedBusiness 헬퍼)
  - `src/middleware.ts` 업체 경로 보호 추가
  - 완료 기준: SMS 발송, 인증 → 로그인 → 세션 생성 → 미들웨어 보호 동작, IP 로그 기록

- [x] `P4-009` 🔴 업체 데이터 API + 프론트엔드 연동 (~4h)
  - `/api/business/[businessId]/dashboard` (통계)
  - `/api/business/[businessId]/gifts` (매입 내역)
  - `/api/business/[businessId]/settlements` (정산 내역)
  - `/api/business/[businessId]/info` (업체 정보)
  - 프론트엔드 더미 데이터 → API 연동으로 교체
  - 완료 기준: 모든 API 동작, 더미 데이터 제거, 실제 데이터 표시

### 접근 로그

- [x] `P4-010` 🔴 접근 로그 페이지 UI + API (~2h)
  - `/business/[businessId]/logs` 페이지 생성
  - 테이블 컬럼: 접근 시간, IP 주소, 액션(인증시도/인증성공/로그인/페이지접근), User-Agent
  - 기간 필터, 페이지네이션
  - `/api/business/[businessId]/access-logs` API
  - 완료 기준: 접근 로그 목록 확인 가능

### 통합 테스트

- [ ] `P4-011` 🟡 통합 테스트 + 보안 점검 (~2h)
  - 업체 A가 업체 B URL 접근 시 차단 확인
  - SMS 인증 없이 로그인 페이지 접근 불가 확인
  - 세션 만료, 미들웨어 리다이렉트 확인
  - IP 접근 로그 정상 기록 확인
  - 빌드/린트 통과
  - 브라우저 테스트 (Playwright MCP)
  - 완료 기준: 보안 테스트 통과, 빌드/린트 통과

---

## 의존성 맵

| 태스크 | 선행 태스크 | 이유 |
|--------|-----------|------|
| P4-001 | 없음 | 타입/더미 데이터 독립 |
| P4-002 | 없음 | 레이아웃 독립 |
| P4-003 | P4-002 | 레이아웃 안에 인증/로그인 화면 표시 |
| P4-004~P4-007 | P4-001, P4-002 | 타입 + 레이아웃 필요 |
| P4-008 | P4-003 | 인증/로그인 UI가 있어야 백엔드 연동 |
| P4-009 | P4-004~P4-008 | 모든 UI + 인증 백엔드 필요 |
| P4-010 | P4-008, P4-009 | 접근 로그 API + 인증 필요 |
| P4-011 | P4-009, P4-010 | 전체 완료 후 통합 테스트 |

### 추천 작업 순서

1. P4-001 + P4-002 (병렬)
2. P4-003 + P4-004 + P4-005 + P4-006 + P4-007 (병렬)
3. P4-008
4. P4-009 + P4-010 (병렬)
5. P4-011
