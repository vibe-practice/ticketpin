# useB API 연동 태스크 목록

> 신분증 OCR + 진위확인 + 사본판별 + 1원 계좌인증
> 원칙: 프론트엔드 먼저 (mock 데이터) → 백엔드/DB → 실제 API 연동

---

## Phase 1: 프론트엔드 (Mock 데이터)

### P1-001: 타입 정의 및 Mock 데이터
- [ ] `src/types/index.ts` — User 인터페이스에 신분증/계좌 인증 필드 추가
  - `identity_type`: 신분증 종류 (resident_card / driver_license)
  - `identity_verified_at`: 신분증 인증 일시
  - `account_verified`: 계좌 인증 완료 여부
  - `account_bank_name`: 은행명
  - `account_number`: 계좌번호 (마스킹)
  - `account_holder`: 예금주명
  - `account_verified_at`: 계좌 인증 일시
- [ ] `MyPageSummary` Pick 타입에 새 필드 추가
- [ ] Mock 응답 데이터 준비 (OCR 결과, 진위확인 결과, 1원인증 결과)

### P1-002: 회원가입 Zustand 스토어 변경
- [ ] `src/store/registerStore.ts` — 6단계로 변경
  - step: `1 | 2 | 3 | 4 | 5 | 6`
  - 약관동의 데이터 (agreePrivacy, agreeMarketing)
  - 휴대폰 본인인증 데이터 (name, phone)
  - 신분증 인증 데이터 (idType, ocrResult, verifyResult)
  - 계좌 인증 데이터 (bankCode, bankName, accountNumber, accountHolder)

### P1-003: 회원가입 Step1 — 약관동의
- [ ] 기존 Step2에 묻혀있던 약관동의를 독립 단계로 분리
- [ ] 서비스 이용약관 (필수)
- [ ] 개인정보 수집 및 이용 동의 (필수)
- [ ] 마케팅 수신 동의 (선택)

### P1-004: 회원가입 Step2 — 휴대폰 본인인증
- [ ] 기존 Step1 (다날 T-PAY) 그대로 이동
- [ ] `IdentityVerificationModal` 재활용

### P1-005: 회원가입 Step3 — 신분증 인증 UI
- [ ] 신분증 종류 선택 (주민등록증 / 운전면허증)
- [ ] 신분증 촬영/업로드 UI
- [ ] OCR 결과 표시 및 수정 화면 (이름, 주민번호, 발급일자 등)
- [ ] 진위확인 진행 중 로딩 UI
- [ ] 사본판별 결과 표시
- [ ] 성공/실패 피드백 UI
- [ ] Mock 데이터로 동작 확인

### P1-006: 회원가입 Step4 — 1원 계좌인증 UI
- [ ] 은행 선택 UI (주요 은행 목록)
- [ ] 계좌번호 입력
- [ ] 계좌 실명조회 결과 표시 (예금주명 확인)
- [ ] 1원 송금 요청 버튼
- [ ] 인증코드 입력 UI (4자리)
- [ ] 인증코드 만료 타이머 (5분)
- [ ] 재발송 버튼
- [ ] 성공/실패 피드백 UI
- [ ] Mock 데이터로 동작 확인

### P1-007: 회원가입 Step5 — 아이디/비밀번호/이메일 입력
- [ ] 기존 Step2의 입력 폼에서 약관 섹션 제거
- [ ] 아이디 + 중복확인
- [ ] 비밀번호 + 강도 표시 + 확인
- [ ] 이메일

### P1-008: 회원가입 Step6 — 완료
- [ ] 기존 Step3 완료 화면 재활용

### P1-009: Zod 스키마 정리
- [ ] `src/lib/validations/auth.ts` — registerSchema에서 약관 필드 분리
- [ ] `src/lib/validations/verification.ts` 신규 생성
  - 신분증 OCR 요청 스키마
  - 진위확인 요청 스키마
  - 계좌 실명조회 스키마
  - 1원 인증코드 확인 스키마

### P1-010: 관리자 회원 테이블 변경
- [ ] `AdminMembersClient.tsx` — 테이블 컬럼 추가
  - 신분증 인증 (완료/미완료 뱃지)
  - 계좌 인증 (완료/미완료 뱃지)
- [ ] CSV 내보내기에 신분증 인증, 계좌 인증 컬럼 추가

### P1-011: 관리자 회원 상세 모달 변경
- [ ] `MemberDetailModal.tsx` — 기본 정보 섹션에 추가
  - 신분증 인증: 종류 + 인증일시
  - 계좌 인증: 은행명 + 마스킹 계좌번호 + 인증일시

### P1-012: 마이페이지 변경
- [ ] `my/page.tsx` — 프로필 카드 인증 뱃지 확장
  - 기존: "본인인증" 뱃지 1개
  - 변경: "휴대폰" + "신분증" + "계좌" 뱃지
- [ ] `my/profile/page.tsx` — 기본 정보에 추가
  - 신분증 인증 상태 + 종류
  - 인증된 계좌 정보 (은행명 + 마스킹 계좌번호)

---

## Phase 2: 백엔드 / DB

### P2-001: DB 마이그레이션
- [ ] `supabase/migrations/` — users 테이블 컬럼 추가
  - `identity_type` varchar(20) — 신분증 종류
  - `identity_verified_at` timestamptz — 신분증 인증 일시
  - `account_verified` boolean DEFAULT false — 계좌 인증 여부
  - `account_bank_name` varchar(50) — 은행명
  - `account_number` text — 계좌번호 (암호화)
  - `account_holder` varchar(50) — 예금주명
  - `account_verified_at` timestamptz — 계좌 인증 일시

### P2-002: useB API 클라이언트 모듈
- [ ] `src/lib/verification/useb.ts` 신규 생성
  - JWT 토큰 발급 (OAuth)
  - 토큰 캐싱 및 만료 관리
  - OCR API 호출 함수
  - 진위확인 API 호출 함수
  - 사본판별 API 호출 함수
  - 계좌 실명조회 함수
  - 1원 입금이체 함수
  - 인증코드 검증 함수
  - 에러 핸들링

### P2-003: 환경변수 추가
- [ ] `.env.local`에 추가
  - USEB_EMAIL
  - USEB_PASSWORD
  - USEB_CLIENT_ID
  - USEB_CLIENT_SECRET

### P2-004: 신분증 인증 API 라우트
- [ ] `src/app/api/verification/id-card/ocr/route.ts` — OCR 요청
- [ ] `src/app/api/verification/id-card/verify/route.ts` — 진위확인 + 사본판별
- [ ] Rate Limiting 적용
- [ ] 인증 완료 시 users 테이블 업데이트

### P2-005: 1원 계좌인증 API 라우트
- [ ] `src/app/api/verification/account/send/route.ts` — 실명조회 + 1원 송금
- [ ] `src/app/api/verification/account/confirm/route.ts` — 인증코드 확인
- [ ] Rate Limiting 적용
- [ ] 인증 완료 시 users 테이블 업데이트
- [ ] 계좌번호 암호화 저장

### P2-006: 기존 API 수정 — select 컬럼 추가
- [ ] `src/app/api/auth/register/route.ts` — 인증 데이터 저장
- [ ] `src/app/api/auth/me/route.ts` — select 컬럼 추가
- [ ] `src/app/api/mypage/profile/route.ts` — select 컬럼 추가
- [ ] `src/app/api/mypage/summary/route.ts` — select 컬럼 추가
- [ ] `src/app/api/admin/members/route.ts` (GET/POST) — select 컬럼 추가
- [ ] `src/app/api/admin/members/[id]/route.ts` — select 컬럼 추가
- [ ] `src/app/api/admin/members/[id]/status/route.ts` — select 컬럼 추가

---

## Phase 3: 실제 연동

### P3-001: Mock → 실제 API 교체
- [ ] 회원가입 Step3 (신분증 인증) — Mock → useB API
- [ ] 회원가입 Step4 (계좌 인증) — Mock → useB API
- [ ] 에러 핸들링 실제 테스트
- [ ] 인증코드 만료/재시도 테스트

### P3-002: 통합 테스트
- [ ] 회원가입 전체 플로우 (6단계) 테스트
- [ ] 관리자 회원관리에서 인증 정보 확인
- [ ] 마이페이지에서 인증 정보 확인
- [ ] 실패 케이스 테스트 (잘못된 신분증, 틀린 인증코드 등)

---

## 파일 변경 요약

| 구분 | 파일 수 |
|---|---|
| DB 마이그레이션 | 1개 |
| 신규 생성 | 10개 |
| 기존 수정 | 15개 |
| 환경변수 | 1개 |
| **총** | **27개 파일** |
