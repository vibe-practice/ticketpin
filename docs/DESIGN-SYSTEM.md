# 디자인 시스템

## 개요

- 서비스명: 상품권 교환권 플랫폼
- 플랫폼: 웹 (Next.js 16 + Tailwind CSS 4 + shadcn/ui)
- 기준 해상도: 모바일 우선 반응형 (320px ~ 1440px)

---

## 디자인 원칙

### 톤앤매너

깔끔하고 모던한 커머스 경험. 불필요한 장식을 배제하고, 상품과 정보에 집중하는 정돈된 UI. 상품권/선물 서비스 특성상 프리미엄하면서도 신뢰감 있는 분위기를 유지한다.

### 브랜드 키워드

- **신뢰** — 결제와 핀 번호를 다루는 서비스로서 안정감과 보안감
- **세련** — 소프트 퍼플 기반의 프리미엄하면서 현대적인 느낌
- **명확** — 복잡한 바우처 플로우를 직관적으로 전달하는 정보 구조
- **간결** — 이모지 없이 아이콘과 타이포만으로 완성하는 미니멀한 화면

### 참고 서비스

- **네이버 스마트스토어** — 상품 그리드 레이아웃, 카테고리 필터, 검색 중심 커머스 UI 구조
- **카카오 선물하기** — 선물/기프트 서비스의 바우처 전달 플로우, 카드형 상품 표현 (PRD 레퍼런스)
- **토스** — 깔끔한 정보 구조, 모던한 폼/결제 UI, 상태 피드백 패턴

---

## 컬러 시스템

### Primary / Secondary / Accent

| 용도 | 변수명 | 값 | 설명 |
|------|--------|-----|------|
| Primary | `color-primary` | `#7C3AED` | 주요 브랜드 컬러, CTA 버튼 |
| Primary (연한) | `color-primary-soft` | `#EDE9FE` | 호버 배경, 뱃지 배경, 선택 상태 |
| Primary (진한) | `color-primary-dark` | `#6D28D9` | 프레스, 활성 상태, 포커스 링 |
| Primary (매우 연한) | `color-primary-muted` | `#F5F3FF` | 섹션 배경, 배너 배경 |
| Secondary | `color-secondary` | `#1E293B` | 네비게이션, 헤딩, 강조 텍스트 |
| Secondary (연한) | `color-secondary-soft` | `#F1F5F9` | 보조 배경, 비활성 영역 |
| Accent | `color-accent` | `#F59E0B` | 포인트 강조, 인기/추천 뱃지, 할인 태그 |
| Accent (연한) | `color-accent-soft` | `#FFFBEB` | 알림 배경, 프로모션 배너 |

### Primary 팔레트 (전체)

| 단계 | 값 | 용도 |
|------|-----|------|
| primary-50 | `#F5F3FF` | 섹션 배경, 뮤트 배경 |
| primary-100 | `#EDE9FE` | 뱃지 배경, 호버 |
| primary-200 | `#DDD6FE` | 포커스 링, 보더 |
| primary-300 | `#C4B5FD` | 비활성 버튼 |
| primary-400 | `#A78BFA` | 아이콘 호버 |
| primary-500 | `#8B5CF6` | 보조 CTA |
| primary-600 | `#7C3AED` | 메인 CTA (Primary) |
| primary-700 | `#6D28D9` | 프레스, 활성 |
| primary-800 | `#5B21B6` | 다크 액센트 |
| primary-900 | `#4C1D95` | 극도로 진한 텍스트 |

### Neutral (Gray Scale)

Slate 계열로 퍼플과 자연스럽게 어울리는 쿨톤 그레이 사용.

| 변수명 | 값 | 용도 |
|--------|-----|------|
| `gray-50` | `#F8FAFC` | 페이지 배경 |
| `gray-100` | `#F1F5F9` | 카드/섹션 배경, 인풋 배경 |
| `gray-200` | `#E2E8F0` | 보더, 구분선 |
| `gray-300` | `#CBD5E1` | 비활성 보더, 디바이더 |
| `gray-400` | `#94A3B8` | 비활성 텍스트, 플레이스홀더 |
| `gray-500` | `#64748B` | 보조 텍스트 |
| `gray-600` | `#475569` | 부가 설명 텍스트 |
| `gray-700` | `#334155` | 기본 본문 텍스트 |
| `gray-800` | `#1E293B` | 강조 텍스트, 제목 |
| `gray-900` | `#0F172A` | 헤딩, 최상위 텍스트 |
| `gray-950` | `#020617` | 최대 강조 (거의 사용 안 함) |

### Semantic (상태 컬러)

| 용도 | 변수명 | 값 | 배경 | 설명 |
|------|--------|-----|------|------|
| 성공 | `success` | `#00C853` | `success-bg: #E8F5E9` | 결제 완료, 선물 전송 성공 |
| 경고 | `warning` | `#FBC02D` | `warning-bg: #FFF8E1` | 타이머 경고, 재고 부족 |
| 에러 | `error` | `#D32F2F` | `error-bg: #FDECEA` | 결제 실패, 입력 오류, 취소 |
| 정보 | `info` | `#3B82F6` | `info-bg: #EFF6FF` | 안내, 알림, 도움말 |

### 텍스트 색상 체계

| 용도 | CSS 변수 | 값 | Tailwind 클래스 |
|------|----------|-----|-----------------|
| 메인 텍스트 | `--foreground` | `#111111` | `text-foreground` |
| 중요 보조 텍스트 (sub1) | `--secondary-foreground` | `#505050` | `text-secondary-foreground` |
| 보조 텍스트 (sub2) | `--muted-foreground` | `#767676` | `text-muted-foreground` |
| 비활성 텍스트 | `--color-disabled` | `#999999` | disabled/placeholder 상태 |
| 화이트 텍스트 | `--primary-foreground` | `#FFFFFF` | `text-primary-foreground` |

### 다크모드

- 지원 여부: **MVP 미지원, 추후 확장**
- 라이트 모드만 구현. 다크모드 전환 토글 없음.
- 향후 확장 시 CSS 변수 기반으로 매핑하여 전환 가능하도록 토큰 구조 설계.

### 플랫폼별 코드

**CSS 변수 (globals.css)**

```css
@layer base {
  :root {
    /* Primary */
    --color-primary: 124 58 237;       /* #7C3AED */
    --color-primary-soft: 237 233 254; /* #EDE9FE */
    --color-primary-dark: 109 40 217;  /* #6D28D9 */
    --color-primary-muted: 245 243 255; /* #F5F3FF */

    /* Secondary */
    --color-secondary: 30 41 59;       /* #1E293B */
    --color-secondary-soft: 241 245 249; /* #F1F5F9 */

    /* Accent */
    --color-accent: 245 158 11;        /* #F59E0B */
    --color-accent-soft: 255 251 235;  /* #FFFBEB */

    /* Semantic */
    --color-success: #00C853;
    --color-success-bg: #E8F5E9;
    --color-warning: #FBC02D;
    --color-warning-bg: #FFF8E1;
    --color-error: #D32F2F;
    --color-error-bg: #FDECEA;
    --color-info: #3B82F6;
    --color-info-bg: #EFF6FF;

    /* Background */
    --background: 248 250 252;         /* #F8FAFC */
    --foreground: #111111;
    --card: 255 255 255;               /* #FFFFFF */
    --card-foreground: 30 41 59;       /* #1E293B */
    --border: 226 232 240;             /* #E2E8F0 */
    --input: 241 245 249;              /* #F1F5F9 */
    --ring: 124 58 237;                /* #7C3AED */
    --muted: 241 245 249;              /* #F1F5F9 */
    --muted-foreground: #767676;
  }
}
```

**shadcn/ui 테마 매핑**

shadcn/ui의 CSS 변수 체계에 맞춰 위 변수를 `--primary`, `--secondary`, `--destructive` 등으로 매핑하여 사용한다. 세부 매핑은 컴포넌트 구현 시 `components.json` 설정에서 정의.

---

## 타이포그래피

### 폰트 패밀리

| 용도 | 폰트명 | Fallback | 비고 |
|------|--------|----------|------|
| Display / Body 공용 | Pretendard | -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif | 한국어 최적화 산세리프. 깔끔하고 현대적. 가변 폰트(Variable) 사용 권장 |
| Mono (핀 번호 표시) | JetBrains Mono | "Fira Code", Consolas, monospace | 핀 번호, 코드 등 고정폭 문자 표시용 |

### 굵기 스케일

| 토큰 | 값 | 용도 |
|------|-----|------|
| `font-regular` | 400 | 기본 본문 |
| `font-medium` | 500 | 강조 본문, 라벨, 링크 |
| `font-semibold` | 600 | 서브 제목, 버튼 텍스트, 카드 제목 |
| `font-bold` | 700 | 페이지 제목, 헤딩, 가격 표시 |

### Display 스케일

| 토큰 | 크기 (데스크탑) | 크기 (모바일) | 행간 | 자간 | 용도 |
|------|----------------|--------------|------|------|------|
| `display-2xl` | 72px | 48px | 1.1 | -0.03em | 히어로 메인 타이틀 |
| `display-xl` | 60px | 40px | 1.1 | -0.03em | 히어로 서브 타이틀 |
| `display-lg` | 48px | 36px | 1.15 | -0.02em | 대형 섹션 타이틀 |
| `display-md` | 36px | 30px | 1.2 | -0.02em | 섹션 타이틀 |
| `display-sm` | 30px | 26px | 1.2 | -0.01em | 카드 대형 타이틀 |
| `display-xs` | 24px | 22px | 1.25 | -0.01em | 소형 타이틀 |

### Heading 스케일

| 토큰 | 크기 (데스크탑) | 크기 (모바일) | 행간 | 자간 | 용도 |
|------|----------------|--------------|------|------|------|
| `h1` | 36px | 28px | 1.25 | -0.03em | 페이지 제목 |
| `h2` | 30px | 24px | 1.3 | -0.025em | 섹션 제목 |
| `h3` | 24px | 20px | 1.3 | -0.025em | 서브 섹션 제목 |
| `h4` | 20px | 18px | 1.35 | -0.025em | 카드 제목, 모달 타이틀 |
| `h5` | 18px | 16px | 1.4 | -0.025em | 소제목, 그룹 타이틀 |
| `h6` | 16px | 14px | 1.4 | -0.025em | 라벨 헤딩, 폼 섹션 |

### Body 스케일

| 토큰 | 크기 | 행간 | 자간 | 용도 |
|------|------|------|------|------|
| `body-xl` | 20px | 1.6 | -0.025em | 리드 문구, 상품 설명 강조 |
| `body-lg` | 18px | 1.6 | -0.025em | 강조 본문, 가격 설명 |
| `body-md` | 16px | 1.6 | -0.025em | 기본 본문, 상품 설명 |
| `body-sm` | 14px | 1.5 | -0.025em | 부가 설명, 테이블 셀, 필터 옵션 |
| `body-xs` | 12px | 1.5 | -0.025em | 각주, 법적 고지, 타임스탬프 |

### Caption / Overline / Label

| 토큰 | 크기 | 행간 | 자간 | 굵기 | 용도 |
|------|------|------|------|------|------|
| `caption` | 13px | 1.4 | -0.025em | 400 | 이미지 캡션, 보조 정보, 날짜 |
| `overline` | 12px | 1.3 | 0.05em | 600 | 카테고리 라벨, 상위 분류 (대문자 변환) |
| `label` | 14px | 1.4 | -0.025em | 500 | 폼 라벨, 버튼 텍스트, 네비게이션 항목 |

### 플랫폼별 코드

```css
@layer base {
  :root {
    --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;
  }
}
```

```typescript
// tailwind.config.ts (Tailwind CSS 4 기준)
// @theme 블록 또는 CSS에서 정의
// fontSize는 clamp()로 반응형 처리 권장

// 예시: display-2xl
// font-size: clamp(3rem, 2rem + 4vw, 4.5rem);
```

---

## 간격 / 레이아웃

### Spacing 스케일

4px 기반 간격 체계.

| 토큰 | 값 | 용도 |
|------|-----|------|
| `space-0` | 0 | 없음 |
| `space-px` | 1px | 미세 보더, 구분선 |
| `space-0.5` | 2px | 아이콘 내부 여백 |
| `space-1` | 4px | 최소 간격, 인라인 아이콘-텍스트 |
| `space-2` | 8px | 요소 내부 여백, 뱃지 패딩 |
| `space-3` | 12px | 작은 간격, 리스트 아이템 간격 |
| `space-4` | 16px | 기본 간격, 카드 내부 패딩 |
| `space-5` | 20px | 폼 필드 간격 |
| `space-6` | 24px | 중간 간격, 섹션 내 그룹 간격 |
| `space-8` | 32px | 큰 간격, 카드 간 간격 |
| `space-10` | 40px | 섹션 내부 여백 |
| `space-12` | 48px | 섹션 간 간격 (모바일) |
| `space-16` | 64px | 섹션 간 간격 (데스크탑) |
| `space-20` | 80px | 대형 여백 |
| `space-24` | 96px | 페이지 상하 여백 |

### 그리드 시스템

| 항목 | 값 |
|------|-----|
| 그리드 컬럼 수 | 12 |
| 거터 (Gutter) | 24px (데스크탑), 16px (모바일) |
| 마진 (Margin) | 자동 중앙 정렬 |

### 반응형 브레이크포인트

| 토큰 | 값 | 기준 너비 | 컬럼 | 레이아웃 |
|------|-----|-----------|------|----------|
| `mobile` | 0 ~ 767px | 375px | 1열 | 단일 컬럼, 풀 와이드 카드 |
| `tablet` | 768 ~ 1439px | 768px | 2~3열 | 상품 2열 그리드, 사이드바 접힘 |
| `desktop` | 1440px+ | 1440px | 3~4열 | 상품 3~4열 그리드, 사이드바 펼침, 최대 너비 제한 |

### 컨테이너

| 항목 | 값 |
|------|-----|
| 최대 너비 | 1280px |
| 좌우 패딩 (모바일) | 16px |
| 좌우 패딩 (태블릿) | 24px |
| 좌우 패딩 (데스크탑) | 32px |

### 터치 타겟

| 항목 | 최소 크기 |
|------|-----------|
| 모바일/태블릿 버튼 | 44px |
| 아이콘 버튼 | 44px |
| 리스트 아이템 높이 | 48px |
| 체크박스/라디오 터치 영역 | 44px |

---

## 둥글기 (Border Radius)

모던하고 부드러운 느낌을 위해 적당한 둥글기 적용. 과도한 pill 형태는 지양.

| 토큰 | 값 | 용도 |
|------|-----|------|
| `radius-none` | 0 | 직각 요소 |
| `radius-sm` | 4px | 뱃지, 태그, 칩, 인라인 코드 |
| `radius-md` | 8px | 버튼, 인풋, 셀렉트, 드롭다운 |
| `radius-lg` | 12px | 카드, 토스트, 알림 |
| `radius-xl` | 16px | 모달, 바텀시트, 대형 카드 |
| `radius-2xl` | 24px | 히어로 섹션 카드, 프로모션 배너 |
| `radius-full` | 9999px | 아바타, 원형 아이콘 버튼, 필 태그 |

---

## 그림자 (Shadow / Elevation)

레이어드 그림자로 자연스러운 깊이감 표현. 단일 box-shadow 사용 금지.

| 토큰 | 값 | 용도 |
|------|-----|------|
| `shadow-xs` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | 미세한 구분 (인풋 기본) |
| `shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | 카드 기본, 드롭다운 |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | 호버 카드, 플로팅 버튼 |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | 플로팅 요소, 팝오버, 드롭다운 메뉴 |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | 모달, 다이얼로그 |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | 최상위 오버레이 |
| `shadow-glow` | `0 0 20px rgb(124 58 237 / 0.3)` | Primary 컬러 강조 (CTA 호버) |

---

## 아이콘

| 항목 | 선택 |
|------|------|
| 라이브러리 | **Lucide React** (PRD 지정) |
| 스타일 | Outlined (기본), strokeWidth: 1.75 |

### 사이즈 규칙

| 토큰 | 크기 | 용도 |
|------|------|------|
| `icon-xs` | 14px | 인라인 뱃지 내부, 접미 아이콘 |
| `icon-sm` | 16px | 버튼 내부, 리스트 아이콘, 폼 아이콘 |
| `icon-md` | 20px | 기본 아이콘, 네비게이션 |
| `icon-lg` | 24px | 강조 아이콘, 카드 헤더 |
| `icon-xl` | 32px | 빈 상태, 상태 표시, 히어로 |
| `icon-2xl` | 48px | 대형 빈 상태 일러스트 대체 |

### 사용 가이드

- 아이콘과 텍스트 간격: `space-2` (8px)
- 아이콘 + 텍스트 정렬: vertical center (`items-center`)
- 단독 아이콘 버튼 시 `aria-label` 필수
- 이모지 사용 금지 — 모든 시각 표현은 Lucide 아이콘으로 대체

---

## 모션 / 애니메이션

Framer Motion 기반. 과도한 애니메이션 지양, 기능적 피드백 중심.

| 항목 | 값 |
|------|-----|
| 기본 트랜지션 | `200ms ease-out` |
| 빠른 트랜지션 | `150ms ease-out` (호버, 토글, 포커스) |
| 느린 트랜지션 | `300ms ease-in-out` (모달, 페이지 전환) |
| 페이지 전환 | Fade (opacity 0→1, 200ms) |
| 마이크로 인터랙션 | 버튼 호버: `scale(1.02)`, 프레스: `scale(0.98)` |
| 로딩 애니메이션 | 스켈레톤 UI (shimmer 효과, 펄스 금지) |
| 모션 원칙 | 기능적 피드백 우선. 장식적 애니메이션 최소화. `prefers-reduced-motion` 대응 필수 |

### 주요 모션 패턴

| 패턴 | 적용 | 설명 |
|------|------|------|
| Fade In | 카드, 리스트 아이템 | opacity 0→1, 200ms |
| Slide Up | 토스트, 바텀시트 | translateY(8px)→0, 200ms |
| Scale | 모달 | scale(0.95)→1 + opacity, 200ms |
| Shimmer | 스켈레톤 로딩 | 좌→우 그라데이션 이동, 1.5s 반복 |
| Collapse | 아코디언 | height auto, 200ms |

---

## 컴포넌트 스타일 가이드

### 버튼

| 변형 | 배경 | 텍스트 | 보더 | 용도 |
|------|------|--------|------|------|
| Primary | `primary-600` | White | 없음 | 메인 CTA (구매, 결제, 확인) |
| Secondary | White | `gray-700` | `gray-200` | 보조 액션 (취소, 이전) |
| Ghost | 투명 | `gray-600` | 없음 | 텍스트 액션 (더보기, 링크형) |
| Destructive | `error` | White | 없음 | 삭제, 결제 취소 |

**상태별 스타일**

| 상태 | Primary | Secondary | Ghost | Destructive |
|------|---------|-----------|-------|-------------|
| Default | `bg-primary-600` | `bg-white border` | `bg-transparent` | `bg-error` |
| Hover | `bg-primary-700` | `bg-gray-50` | `bg-gray-100` | `bg-red-600` |
| Active | `bg-primary-800, scale(0.98)` | `bg-gray-100` | `bg-gray-200` | `bg-red-700` |
| Disabled | `bg-gray-300, cursor-not-allowed` | `bg-gray-100, text-gray-400` | `text-gray-300` | `bg-gray-300` |
| Loading | spinner + 텍스트 숨김 | spinner + 텍스트 숨김 | spinner | spinner |

**사이즈**

| 사이즈 | 높이 | 패딩 | 폰트 |
|--------|------|------|------|
| sm | 32px | `px-3` | 13px |
| md | 40px | `px-4` | 14px |
| lg | 48px | `px-6` | 16px |
| xl | 56px | `px-8` | 18px |

### 인풋 / 셀렉트 / 데이트피커

- 높이: 44px (모바일 터치 타겟 충족)
- 배경: `gray-100` (또는 `white` + `border gray-200`)
- 보더: `1px solid gray-200`
- 둥글기: `radius-md` (8px)
- 포커스: `ring-2 ring-primary-600 border-primary-600`
- 폰트: `body-md` (16px) — 모바일에서 자동 줌 방지

**상태별**

| 상태 | 보더 | 배경 | 라벨 색상 |
|------|------|------|-----------|
| Default | `gray-200` | `white` | `gray-700` |
| Focus | `primary-600` + ring | `white` | `gray-900` |
| Error | `error` + ring | `error-bg` | `error` |
| Disabled | `gray-200` | `gray-100` | `gray-400` |
| Read-only | `gray-200` | `gray-50` | `gray-500` |

### 카드

- 배경: `white`
- 보더: `1px solid gray-200` (또는 `shadow-sm`)
- 둥글기: `radius-lg` (12px)
- 패딩: `space-4` (16px) ~ `space-6` (24px)
- 호버: 상품 카드 — `shadow-md` + `translateY(-2px)`, 200ms

### 모달 / 다이얼로그

- 오버레이: `rgba(0, 0, 0, 0.5)` + `backdrop-blur(4px)`
- 모달 배경: `white`
- 둥글기: `radius-xl` (16px)
- 패딩: `space-6` (24px)
- 최대 너비: 480px (sm), 640px (md), 800px (lg)
- 애니메이션: scale(0.95)→1 + fade, 200ms
- 닫기: 오버레이 클릭 + X 버튼 + ESC 키

### 토스트 / 알림

- 위치: 우측 상단 (데스크탑), 상단 중앙 (모바일)
- 최대 너비: 400px
- 둥글기: `radius-lg` (12px)
- 그림자: `shadow-lg`
- 자동 닫힘: 5초 (기본), 에러는 수동 닫기
- 유형별: success/error/warning/info — 좌측 세로 컬러 바 + Semantic 배경색

### 테이블 / 페이지네이션

**테이블**
- 헤더: `bg-gray-50`, `font-semibold`, `body-sm`
- 로우 높이: 52px
- 보더: 하단 `1px solid gray-200`
- 호버: `bg-gray-50`
- 정렬: 숫자/금액 우측, 텍스트 좌측

**페이지네이션**
- 스타일: 숫자 버튼, 현재 페이지 `bg-primary-600 text-white`
- 비활성: `text-gray-400`
- 이전/다음: 화살표 아이콘 버튼

### 뱃지 / 태그 / 칩

| 변형 | 배경 | 텍스트 | 둥글기 | 용도 |
|------|------|--------|--------|------|
| Solid | `primary-600` | White | `radius-sm` | 인기, 추천 |
| Soft | `primary-100` | `primary-700` | `radius-sm` | 카테고리, 상태 |
| Outline | 투명 | `gray-600` | `radius-sm` | 필터 태그 |
| Warning | `warning-bg` | `warning` | `radius-sm` | 품절 임박 |
| Error | `error-bg` | `error` | `radius-sm` | 품절, 만료 |
| Success | `success-bg` | `success` | `radius-sm` | 사용 가능, 완료 |

- 크기: sm (20px 높이, 12px 폰트) / md (24px 높이, 13px 폰트)
- 삭제 가능 칩: 우측 X 아이콘 포함

### 네비게이션 (GNB)

- 높이: 64px (데스크탑), 64px (모바일)
- 배경: `white` + `border-bottom: 1px solid gray-200`
- 고정: `position: sticky, top: 0, z-index: 50`
- **데스크탑**: 좌측 검색바 / 우측 회원가입 + 로그인 버튼 (로고는 사이드바에 위치)
- **모바일**: 좌측 햄버거 / 가운데 로고 / 우측 검색 아이콘
- 검색 아이콘 클릭 시 전체 화면 검색 모달 오픈 (backdrop-blur + fade-in + zoom-in)
- 활성 메뉴: `text-primary-600, font-medium`

#### 드롭다운 메뉴 구조

| 메뉴 | 드롭다운 항목 |
|------|-------------|
| 카테고리 | 카페/음료, 외식/배달, 편의점/마트, 문화/여가, 뷰티/패션, 전체보기 |
| 이용안내 | 이용방법 (`/guide`), 수수료 안내 (`/guide/fee`), 선물하기 안내 (`/guide/gift`) |
| 고객센터 | 자주 묻는 질문 (`/support/faq`), 공지사항 (`/support/notice`), 1:1 문의 (`/support/inquiry`) |

#### 드롭다운 인터랙션

- 데스크탑: hover 시 드롭다운 노출 (mouse leave 시 닫힘)
- 드롭다운 스타일: `bg-card, border, border-border, shadow-md, rounded-md, min-w-[160px]`
- 드롭다운 항목: `block px-4 py-2, text-sm, hover:bg-accent, hover:text-foreground`
- chevron-down 아이콘 메뉴 레이블 우측에 배치

#### 모바일 햄버거 메뉴 구조

- 섹션1 — 카테고리: 카페/음료, 외식/배달, 편의점/마트, 문화/여가, 뷰티/패션, 전체보기
- 섹션2 — 이용안내: 이용방법, 수수료 안내, 선물하기 안내
- 섹션3 — 고객센터: 자주 묻는 질문, 공지사항, 1:1 문의
- 각 섹션 구분선(`border-t, mt-3, pt-3`) + 섹션 레이블(`px-3, py-1, text-xs, font-semibold, text-muted-foreground`)

---

## 폼 패턴

### 폼 레이아웃

| 항목 | 규칙 |
|------|------|
| 기본 레이아웃 | 세로형 (라벨 → 인풋 순서로 쌓기) |
| 라벨 위치 | 인풋 상단 |
| 필수 표시 | 라벨 우측에 `*` (color: `error`) |
| 선택 표시 | 라벨 우측에 `(선택)` (color: `gray-400`, body-sm) |
| 필드 간격 | `space-5` (20px) |
| 그룹 간격 | `space-8` (32px) |

### 유효성 검증

| 항목 | 규칙 |
|------|------|
| 검증 타이밍 | blur 시 1차 검증, 제출 시 전체 검증 |
| 에러 메시지 위치 | 인풋 바로 하단 (`space-1` 간격) |
| 에러 메시지 스타일 | `body-xs` (12px), `color: error`, Lucide `AlertCircle` 아이콘 (14px) 포함 |
| 성공 피드백 | 아이디 중복 확인 등 특정 필드만 — Lucide `CheckCircle` 아이콘 (14px), `color: success` |
| 비밀번호 강도 | 프로그레스 바 (약/중/강), 색상: error → warning → success |

---

## 이미지 / 일러스트 가이드

### 이미지 스타일

| 항목 | 규칙 |
|------|------|
| 기본 스타일 | 상품 이미지(사진) 중심, 아이콘 보조 |
| 상품 이미지 비율 | 1:1 (썸네일), 4:3 (상세 메인) |
| 카테고리 아이콘 | Lucide 아이콘 사용 (일러스트 대신) |
| 둥글기 | 썸네일: `radius-md`, 상세: `radius-lg` |

### 빈 상태 (Empty State)

- 스타일: Lucide 아이콘 (icon-2xl, 48px) + 텍스트 (일러스트 사용 안 함)
- 아이콘 색상: `gray-300`
- 제목: `h4`, `gray-800`
- 설명: `body-sm`, `gray-500`
- 액션: Primary 버튼 (해당 시)
- 예: 검색 결과 없음 → `Search` 아이콘 + "검색 결과가 없습니다" + "다른 키워드로 검색해 보세요"

### 이미지 최적화

| 항목 | 규칙 |
|------|------|
| 포맷 | WebP 우선, AVIF 지원 시 우선 적용, PNG 폴백 |
| Lazy Loading | 적용 (`loading="lazy"`, 뷰포트 진입 시 로드) |
| 반응형 이미지 | Next.js `<Image>` 컴포넌트 사용 (자동 srcset/sizes) |
| 최대 파일 크기 | 썸네일 50KB, 상세 200KB 이내 권장 |
| 플레이스홀더 | 스켈레톤 (shimmer) 또는 blur placeholder |

---

## 페이지 템플릿

### 레이아웃 유형

| 유형 | 구조 | 사용 페이지 |
|------|------|-------------|
| 사용자 기본 | GNB + 콘텐츠 + Footer | `/`, `/category/*`, `/product/*`, `/order/*` |
| 바우처 독립 | 콘텐츠만 (GNB/Footer 없음) | `/v/[code]` 하위 전체 |
| 마이페이지 | GNB + 사이드 탭 메뉴 + 콘텐츠 + Footer | `/my` 하위 전체 |
| 관리자 | 사이드바(240px) + 상단바(64px) + 콘텐츠 | `/admin` 하위 전체 |
| 인증 | 중앙 정렬 카드 (max-w-md) | `/auth/*` (로그인, 회원가입, 아이디 찾기, 비밀번호 재설정) |

### 레이아웃 상세

**사용자 기본**
```
┌─────────────────────────────┐
│           GNB (64px)        │
├─────────────────────────────┤
│                             │
│     콘텐츠 (max-w-1280)     │
│                             │
├─────────────────────────────┤
│          Footer             │
└─────────────────────────────┘
```

**바우처 독립** (모바일 최적화, SMS 링크 접근)
```
┌─────────────────────────────┐
│                             │
│   로고 (상단 중앙, 작게)     │
│                             │
│     바우처 카드 (중앙)       │
│     타이머 / 상태 표시       │
│     액션 버튼               │
│                             │
└─────────────────────────────┘
```

**관리자**
```
┌──────────┬──────────────────┐
│          │  상단바 (64px)    │
│ 사이드바  ├──────────────────┤
│ (240px)  │                  │
│          │    콘텐츠         │
│          │                  │
└──────────┴──────────────────┘
```

**인증**
```
┌─────────────────────────────┐
│                             │
│      ┌─────────────┐       │
│      │    로고      │       │
│      │    폼 필드    │       │
│      │    버튼      │       │
│      └─────────────┘       │
│                             │
└─────────────────────────────┘
```

---

## 디자인 토큰 네이밍

### 토큰 이름 체계

- 형식: `{category}-{property}-{variant}`
- 예시: `color-primary-600`, `spacing-md`, `font-size-lg`, `radius-md`, `shadow-sm`
- 케밥 케이스(kebab-case) 통일

### 토큰 계층 구조

| 계층 | 설명 | 예시 |
|------|------|------|
| Global | 원시 값 (Raw Value) | `violet-600: #7C3AED`, `slate-700: #334155` |
| Alias | 의미 부여 (Semantic) | `color-primary: {violet-600}`, `text-default: {slate-700}` |
| Component | 컴포넌트 전용 | `button-primary-bg: {color-primary}`, `card-border: {gray-200}` |

### 토큰 관리

- **정의**: CSS 변수 (`--color-primary`, `--spacing-md`)로 글로벌 정의
- **매핑**: Tailwind CSS 4 `@theme` 블록에서 CSS 변수 참조
- **shadcn/ui**: `components.json`의 `cssVariables: true` 설정, 테마 CSS 변수 오버라이드
- **일관성**: 컴포넌트 내부에서 직접 HEX 값 사용 금지. 반드시 토큰(CSS 변수 또는 Tailwind 클래스)으로 참조

---

## 접근성

| 항목 | 규칙 |
|------|------|
| 시맨틱 HTML | `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>` 사용 |
| 이미지 alt | 모든 `<img>`에 의미 있는 alt 텍스트. 장식 이미지는 `alt=""` |
| 키보드 네비게이션 | 모든 인터랙티브 요소 Tab/Enter/Space로 조작 가능 |
| 포커스 표시 | `ring-2 ring-primary-600 ring-offset-2` (키보드 포커스 시) |
| 색상 대비 | WCAG AA 기준 (일반 텍스트 4.5:1, 대형 텍스트 3:1) |
| ARIA | 모달(`role="dialog"`), 토스트(`role="alert"`), 로딩(`aria-busy`) 등 적절한 ARIA 속성 |
| 터치 타겟 | 최소 44px (모바일) |
| `prefers-reduced-motion` | 애니메이션 비활성화 대응 필수 |
