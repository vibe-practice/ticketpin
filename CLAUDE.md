# 티켓매니아 프로젝트 - Claude 지시문

## 프로젝트 개요

상품권 교환권 플랫폼. 사용자가 상품권을 구매하고 바우처(핀 번호)를 관리하는 서비스.

- **문서**: `docs/PRD.md`, `docs/ROADMAP.md`, `docs/DESIGN-SYSTEM.md`, `docs/TASKS.md`
- **현재 Phase**: Phase 2 (결제 + 바우처 + SMS) 진행 중

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript (strict) |
| 스타일링 | Tailwind CSS 4 |
| UI | shadcn/ui + Radix UI |
| 상태관리 | Zustand |
| 폼 | React Hook Form + Zod |
| 아이콘 | Lucide React |
| 패키지 매니저 | npm (프로젝트), pnpm도 사용 가능 |

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (user)/          # 사용자 영역 (메인, 카테고리, 상품, 이용안내, 고객센터, 약관)
│   ├── (auth)/          # 인증 영역 (login, register, find-id, reset-password)
│   ├── (admin)/         # 관리자 영역 (/admin/*)
│   ├── (mypage)/        # 마이페이지 영역
│   ├── (voucher)/       # 바우처 독립 페이지 (/v/[code]/*)
│   ├── layout.tsx       # 루트 레이아웃
│   └── globals.css      # 전역 스타일 + CSS 변수 (디자인 토큰)
├── components/
│   ├── layout/          # SiteLayout, Sidebar, TopBar, Footer
│   └── ui/              # 공통 UI (toast, skeleton, confirm-dialog, pagination, empty-state, spinner)
├── lib/
│   ├── utils.ts         # cn() 유틸
│   └── validations/
│       └── auth.ts      # Zod 스키마 (registerSchema, loginSchema, resetPasswordSchema)
├── mock/                # 더미 데이터 (categories, products, pins, banners)
├── store/               # Zustand 스토어 (registerStore)
└── types/
    └── index.ts         # 공통 타입 (User, Category, Product, Pin 등)
```

---

## 레이아웃 구조

| 라우트 그룹 | 레이아웃 | 특징 |
|------------|---------|------|
| `(user)` | SiteLayout (사이드바 + TopBar) | 사이드바 GNB |
| `(auth)` | 인증 전용 레이아웃 | 중앙 카드 형태 |
| `(admin)` | 관리자 레이아웃 | 사이드바 240px |
| `(mypage)` | 마이페이지 레이아웃 | 사이드 탭 |
| `(voucher)` | 바우처 독립 레이아웃 | 모바일 최적화 |

- `SiteLayout`의 `mainClassName` prop으로 main 엘리먼트 스타일 커스터마이징 가능

---

## 개발 규칙

### 데이터 원칙

- 프론트엔드 먼저, 더미 데이터로 UI 구현
- 더미 데이터는 `src/mock/`에 위치, 실제 타입과 동일한 인터페이스 사용
- API 연동은 Phase 후반부(P1-017~P1-020 등)에서 진행

### 레이아웃 원칙

- **모든 페이지의 콘텐츠 컨테이너는 `container-main` 클래스(`max-w-[1440px]`)로 통일한다.** `max-w-[1200px]` 등 임의의 max-width를 사용하지 않는다.
- `container-main`은 `src/app/globals.css`에 정의: `mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-12`
- **사용자 모니터 해상도가 2560x1440이므로, 텍스트 크기를 넉넉하게 설정한다.** 본문 텍스트는 최소 16px 이상, 라벨/보조 텍스트는 최소 14px 이상으로 한다. `text-[11px]`, `text-[12px]`, `text-[13px]` 같은 작은 텍스트는 지양한다.

### 컴포넌트 패턴

- 폼: React Hook Form + Zod resolver 사용 (`useForm`, `zodResolver`)
- 전역 상태: Zustand (`src/store/`)
- 아이콘: Lucide React만 사용
- 스타일: Tailwind 유틸리티 클래스, `cn()` 유틸로 조건부 클래스 병합

### 인증 폼 패턴

- Zod 스키마는 `src/lib/validations/auth.ts`에 집중 관리
- 에러 메시지는 `<AlertCircle size={13} />` 아이콘과 함께 `text-[13px] text-destructive`로 표시
- 성공 메시지는 `<CheckCircle2 size={13} />` 아이콘과 함께 `text-[13px] text-green-600`으로 표시

### 명명 규칙

- 페이지: `page.tsx` (Next.js App Router 컨벤션)
- 클라이언트 컴포넌트: `"use client"` 상단 선언
- 타입/인터페이스: PascalCase (`User`, `Product`, `LoginFormData`)
- Zod 스키마: camelCase + Schema 접미사 (`loginSchema`, `registerSchema`)

---

## 명령어

```bash
npm run dev    # 개발 서버 (포트 자동 할당 — 3000, 3001, 3002 순으로 시도)
npm run build  # 프로덕션 빌드
npm run lint   # ESLint 검사
```

- 개발 서버 포트: 3000이 사용 중이면 자동으로 3001, 3002 사용
- 브라우저 테스트 시 실제 리스닝 포트 확인 후 접속

---

## 디자인 시스템

전체 디자인 토큰은 `docs/DESIGN-SYSTEM.md` 및 `src/app/globals.css` 참조.

| 토큰 | 용도 |
|------|------|
| `primary` | 브랜드 컬러 (보라 계열) |
| `destructive` | 에러/삭제 |
| `muted` | 비활성 텍스트/배경 |
| `border` | 테두리 |
| `card` | 카드 배경 |
| `foreground` | 기본 텍스트 |

---

## 현재 완료된 태스크 (Phase 1)

- [x] P1-001~P1-008: 프로젝트 셋업, 공통 컴포넌트, 타입/더미 데이터
- [x] P1-009: 회원가입 페이지 UI (3단계 Stepper)
- [x] P1-010: 로그인 페이지 UI
- [x] P1-011: 아이디 찾기 + 비밀번호 재설정 페이지 UI
- [x] P1-012~P1-014: 메인, 카테고리 목록, 상품 상세 페이지 UI
- [x] P1-015: 회원가입 폼 유효성 검사 (RHF + Zod + Zustand)
- [x] P1-016: 로그인 + 아이디 찾기 + 비밀번호 재설정 폼 인터랙션
- [x] P5-001~P5-002: GNB/Footer 컴포넌트 업데이트

---

## 서브에이전트 활용 규칙

작업을 시작할 때 **반드시 어떤 서브에이전트를 사용하면 좋을지 추천**한다.

- 적합한 서브에이전트가 있으면: 해당 에이전트 이름과 이유를 안내
- 적합한 서브에이전트가 없으면: "이 작업에 적합한 서브에이전트가 없습니다. 필요하다면 새로 만들어야 합니다."라고 안내
- 서브에이전트 없이 직접 작업하는 것이 더 효율적인 경우에도 그 이유를 설명

### 현재 사용 가능한 서브에이전트

| 에이전트 | 용도 |
|---------|------|
| `backend-architect` | API 설계, DB 스키마, 서버 로직, 인증/권한, 보안, 성능 최적화 |
| `frontend-design-virtuoso` | UI/UX 디자인, 페이지/컴포넌트 레이아웃, 애니메이션, 비주얼 디자인 |
| `code-reviewer` | 코드 리뷰, 버그 탐지, 안티패턴 검출, 프로젝트 컨벤션 검증 |
| `Explore` | 코드베이스 탐색, 파일/키워드 검색, 구조 파악 |
| `Plan` | 구현 전략 설계, 아키텍처 계획, 트레이드오프 분석 |

---

## QA 테스트 체크리스트

- **체크리스트의 항목을 위에서부터 순서대로 하나씩 확인한다.** 항목을 건너뛰거나 한꺼번에 넘어가지 않는다.
- 테스트 항목을 확인할 때마다 `docs/TEST-CHECKLIST.md`에서 해당 항목을 `[ ]` → `[x]`로 체크한다.
- **스냅샷/화면에서 실제로 해당 내용이 표시되는 것을 직접 확인한 후에만 체크한다.** 확인하지 않은 항목을 체크하지 않는다.
- **모든 항목은 반드시 직접 동작시켜서 확인한다.** UI가 존재하는 것만 보고 체크하지 않는다. 버튼은 직접 클릭하고, 필터는 실제로 적용해보고, 입력은 실제로 값을 넣어보고, 결과가 정상인지 확인한 후에만 체크한다.
- 관리자에서 액션한 후 사용자 프론트에 반영되어야 하는 항목은 반드시 프론트에서도 확인한다.
- 오류가 발견되면 **즉시 테스트를 멈추고 사용자에게 보고한다.** 임의로 수정하거나 다음 항목으로 넘어가지 않는다.

---

## 브라우저 테스트 및 스크린샷

- Playwright 스크린샷 저장 경로: `.playwright-mcp/` (프로젝트 루트 내)
- **브라우저 해상도**: 항상 **2560x1440** (사용자 실제 모니터 해상도)으로 테스트한다. 1440px 등 임의로 줄이지 않는다.
- **브라우저 테스트 완료 후 문제가 없으면 `.playwright-mcp/` 내 스크린샷(`.png`)과 로그(`.log`)를 모두 삭제한다.**
  ```bash
  rm -f .playwright-mcp/*.png .playwright-mcp/*.log
  ```
