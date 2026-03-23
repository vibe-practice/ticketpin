---
name: business-portal-patterns
description: 업체 포털(business portal) 컴포넌트 구조, 디자인 패턴, 완료된 태스크 목록
type: project
---

## 업체 포털 레이아웃 구조
- `src/app/(business)/layout.tsx` — "use client", BusinessSidebar + BusinessTopBar
  - `/business/login` 경로 시 `<>{children}</>` 만 렌더 (레이아웃 분기)
- `src/components/business/BusinessSidebar.tsx` — 다크 violet 테마 사이드바, 접기/펼치기
- `src/components/business/BusinessTopBar.tsx` — 브레드크럼 + 로그아웃 버튼
- `SIDEBAR_WIDTH_EXPANDED / SIDEBAR_WIDTH_COLLAPSED` 상수 export (layout.tsx에서 spacer 계산용)

## 업체 포털 인증 흐름 (P4-003 완료)
- `/business/[businessId]` (대시보드 page.tsx): SMS 인증 → 로그인 → 대시보드 3단계
  - `AuthStep = "verify" | "login" | "dashboard"` 상태로 관리
  - SMS 인증: `src/components/business/auth/BusinessVerifyForm.tsx`
  - 로그인: `src/components/business/auth/BusinessLoginForm.tsx`
  - 하위 경로(/gifts, /settlements 등)는 인증 없이 직접 접근 가능 (미들웨어 미보호)
- 더미 인증: 아무 6자리 숫자 → 성공 (단 "000000" → 실패), 아이디 test/비밀번호 test1234 → 성공
- 인증 카드 UI: 중앙 `max-w-[420px]` 카드, 상단 violet→indigo 그라데이션 1px 바
- 6자리 입력 박스: `grid grid-cols-6 gap-2` (overflow 방지) — `flex flex-1` 사용 시 카드 너비 초과 주의
- 타이머: `TIMER_SECONDS = 180`, 1분 이하 빨간 경고 + animate-pulse
- 붙여넣기 처리: onPaste에서 `e.preventDefault()` + clipboardData 파싱
- 키보드 이동: Backspace(빈칸→이전 포커스), ArrowLeft/Right 지원

## 업체 포털 디자인 테마
- 색상: violet 계열 (`bg-violet-600`, `text-violet-700`, `border-violet-200`, `bg-violet-50`)
- 카드 상단 그라데이션 바: `bg-gradient-to-r from-violet-500 via-violet-400 to-indigo-500`
- Stat Card accent: `border-violet-200 bg-violet-50` + 아이콘 `bg-violet-100 text-violet-600`
- 결제수단 뱃지: `bg-blue-50 text-blue-700 border border-blue-100`
- 정산금액 강조: `text-violet-700 font-bold`

## 매입상세(Gifts) 컴포넌트 구조 (P4-005 완료)
- `src/components/business/gifts/BusinessGiftsClient.tsx` — 메인 클라이언트 컴포넌트
  - 기간 필터: 오늘/7일/30일/직접설정 버튼 그룹 + Popover Calendar (react-day-picker DateRange)
  - KST 변환: `toKSTDateString(iso)` — UTC+9 오프셋 적용 후 YYYY-MM-DD 반환
  - 빠른 선택 날짜 계산: `getQuickRangeDates()` — Date.now() 직접 사용 (렌더 시 호출 아님)
  - CSV 내보내기: BOM(`\uFEFF`) + 따옴표 이스케이프 + 파일명 `매입상세_YYYYMMDD.csv`
  - 합계 표시: 테이블 `<tfoot>`에 총건수/총금액/총정산금액 행
  - 테이블 하단 페이지네이션: `<Pagination>` 컴포넌트 재사용
- `src/app/(business)/business/[businessId]/gifts/page.tsx` — 서버 컴포넌트, MOCK_BUSINESS_GIFTS 주입
- 더미 데이터: `src/mock/business/gifts.ts` → `MOCK_BUSINESS_GIFTS` (8개 아이템)

## BusinessDashboardClient 타입 이슈 수정
- `icon: LucideIcon` 필드에 실제 아이콘 컴포넌트 할당 시 TypeScript 에러 발생
- 원인: lucide-react 버전 타입 불일치 (`ElementType<any>` ≠ `LucideIcon`)
- 해결: `icon: ElementType | LucideIcon` 으로 유니온 타입 사용
  - 단, linter가 `import type { ElementType } from "react"` 제거할 수 있음 → 실제 사용 확인 필요

## 데이터 테이블 패턴 (업체 포털용 경량 버전)
- AdminDataTable 대신 직접 `<table>` 사용 (업체 포털은 관리자 컴포넌트 재사용 불가)
- thead: `bg-muted/40` 배경 + `text-xs font-semibold text-muted-foreground`
- tbody rows: 짝수 `bg-card`, 홀수 `bg-muted/20` + `hover:bg-violet-50/50`
- 일시 컬럼: `font-mono text-xs` (코드 느낌)
- 보낸 사람 컬럼: 이름 + `@username` 2줄 표시 (flex-col)
- tfoot: `border-t-2 border-border bg-muted/30` 합계 행
