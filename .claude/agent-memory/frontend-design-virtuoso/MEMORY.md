# 프로젝트 메모리 — 티켓핀 프론트엔드

## 기술 스택 및 환경
- Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, shadcn/ui
- 패키지 매니저: npm (프로젝트), 개발 서버 포트: 3000→3001→3002 순 자동 할당
- Playwright 스크린샷: `.playwright-mcp/` (프로젝트 루트), 테스트 완료 후 삭제

## 핵심 파일 경로
- 타입 정의: `src/types/index.ts`
- 더미 데이터: `src/mock/` (products.ts, orders.ts, vouchers.ts 등)
- 유틸: `src/lib/utils.ts` (cn(), formatPrice())
- 글로벌 스타일/토큰: `src/app/globals.css`
- 미들웨어: `src/middleware.ts` (보호 경로: `/mypage`. `/order`는 P2 백엔드 연동 후 재추가 예정)

## 라우트 그룹 레이아웃
- `(user)`: SiteLayout (사이드바 240px + TopBar) — 일반 페이지
- `(auth)`: 인증 전용 (중앙 카드 형태)
- `(admin)`: 관리자 사이드바
- `(mypage)`: 마이페이지 사이드 탭
- `(voucher)`: 바우처 독립 레이아웃 (모바일 최적화)

## 디자인 패턴 — 확정된 것들
- 색상 클래스: `text-primary`, `bg-brand-primary-soft`, `bg-brand-primary-muted`, `text-brand-primary-dark`, `bg-error-bg`, `text-error`, `bg-info-bg`, `text-info`, `bg-success-bg`, `text-success`
- 카드: `rounded-xl border border-border bg-card`
- 섹션 헤더: `border-b border-border px-5 py-3.5` + `text-sm font-semibold text-foreground`
- 에러 메시지: `<AlertCircle size={13} />` + `text-[13px] text-error`
- 성공 메시지: `<CheckCircle2 size={13} />` + `text-[13px] text-success`
- 뱃지: `rounded-sm px-2 py-0.5 text-[12px] font-semibold` + 색상별 bg/text 조합
- 결제/CTA 버튼: `h-14 w-full rounded-xl bg-primary text-white font-bold hover:bg-brand-primary-dark active:scale-[0.98]`
- 인풋 필드 높이: `h-11` (44px, 터치 타겟 기준)
- 뒤로가기 브레드크럼: `border-b border-border bg-card sticky top-0 z-10` + `py-3 px-6 lg:px-12`
- 페이지 좌우 패딩: `px-6 lg:px-12` (프로젝트 전체 통일)

## useSearchParams Suspense 패턴 (필수)
```tsx
// page.tsx
export default function Page() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ClientComponent />  {/* useSearchParams 사용 컴포넌트 */}
    </Suspense>
  );
}
```
- useSearchParams()를 사용하는 클라이언트 컴포넌트는 반드시 Suspense로 감싸야 빌드 통과

## ESLint 규칙 — react-hooks/set-state-in-effect
- useEffect 내 직접 setState 호출 금지
- 파생 데이터는 useMemo로 대체: `const product = useMemo(() => ..., [dep])`
- isMounted 패턴 대신 Suspense 경계 활용

## 커스텀 체크박스 패턴 (shadcn Checkbox 대신 직접 구현)
```tsx
<div
  role="checkbox"
  aria-checked={isChecked}
  tabIndex={0}
  onClick={() => setIsChecked(!isChecked)}
  onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setIsChecked(!isChecked); } }}
  className={cn("flex h-4.5 w-4.5 items-center justify-center rounded border-2 transition-all", isChecked ? "border-primary bg-primary" : "border-border")}
>
  {isChecked && <svg width="10" height="8">...</svg>}
</div>
```

## 2컬럼 주문 레이아웃 패턴
```tsx
<div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:gap-8 xl:grid-cols-[1fr_400px]">
  {/* 왼쪽: 폼 영역 */}
  {/* 오른쪽: 금액 요약 sticky */}
  <div className="lg:sticky lg:top-[57px] h-fit">...</div>
</div>
```

## ESLint 규칙 — react-hooks/purity
- 클라이언트 컴포넌트 렌더 중 Date.now() 호출 금지 (impure function)
- 해결책: 서버 컴포넌트(page.tsx)에서 계산 후 ISO 문자열로 props 전달

## 바우처 컴포넌트 구조 (P2-004 완료)
- `src/components/voucher/VoucherMain.tsx` — 메인 클라이언트 컴포넌트 (상태 관리: active/expired/locked)
- `src/components/voucher/VoucherCountdownTimer.tsx` — 20분 타이머 (5분 이하 빨간 경고 + 깜빡임)
- `src/components/voucher/TempPasswordInput.tsx` — 3자리 개별 숫자 입력 (자동 포커스 이동, Backspace/Arrow 키 지원)
- `src/app/(voucher)/v/[code]/page.tsx` — 서버 컴포넌트 (더미 데이터 조회, 상태별 리디렉션, expiresAt 계산)
- 타이머 만료 시간은 서버에서 계산하여 ISO 문자열로 전달 (Date.now() 서버에서만 사용)

## 마이페이지 레이아웃 패턴 (P3-004 완료)
- `src/app/(mypage)/layout.tsx` — `flex flex-col lg:flex-row` + `<MyPageSidebar />` + 콘텐츠 영역
- `src/components/mypage/MyPageSidebar.tsx` — 데스크탑: `hidden lg:flex` 사이드 탭 / 모바일: `lg:hidden sticky` 가로 스크롤 탭
- 사이드 탭 sticky: `sticky top-[57px]` (TopBar 높이 57px 아래 고정)
- 모바일 탭 sticky: `sticky top-[57px] z-10 bg-background border-b border-border`
- 마이페이지 데이터: `src/mock/mypage.ts` → `getMyPageSummary(userId)` 반환 타입: `MyPageSummary`
- Stat Card 패턴: `rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`

## FAQ 페이지 패턴 (P5-006 완료)
- 더미 데이터: `src/mock/faq.ts` → `FaqItem`, `FaqCategory` 타입, `getFaqByCategory()` 유틸
- 카테고리 필터: `rounded-full px-4 py-1.5` 필 스타일 탭 + 카운트 뱃지 (`bg-white/25` 활성, `bg-muted` 비활성)
- shadcn/ui Accordion: `type="multiple"` + `divide-y divide-border` 구분선, Q/A 마커 사용
  - Q 마커: `bg-brand-primary-soft text-primary rounded-sm h-5 w-5 text-[11px] font-bold`
  - A 마커: `bg-success-bg text-success rounded-sm h-5 w-5 text-[11px] font-bold`
  - 답변 영역: `bg-muted/40 rounded-lg p-4` + `whitespace-pre-line` (개행 문자 처리)
- 결과 카운트 헤더: `bg-muted/30 border-b border-border px-5 py-3`
- page.tsx에서 "use client" 사용 (useState로 카테고리 상태 관리) + metadata export 제거

## 공지사항 컴포넌트 구조 (P5-007 완료)
- 더미 데이터: `src/mock/notices.ts` → `getNoticesByCategory()`, `getNoticeById()`, `getPrevNotice()`, `getNextNotice()` 유틸
- 목록 페이지: `src/app/(user)/support/notice/page.tsx` — "use client" (useState 카테고리 필터)
  - 전체 탭에서만 중요 공지 별도 섹션 상단 고정 (`bg-brand-primary-muted`, `border-primary/20`)
  - 중요 공지 헤더: `Pin` 아이콘 + "중요 공지" 텍스트
- 상세 페이지: `src/app/(user)/support/notice/[id]/page.tsx` — 서버 컴포넌트 + generateMetadata
  - 이전/다음글 네비게이션: NOTICE_ITEMS 배열 인덱스 기반 (idx+1 = 이전글, idx-1 = 다음글)
  - "목록으로" 버튼: `ListFilter` 아이콘 + 중앙 정렬
- Notice 타입: `id, title, content, category(일반|이벤트|점검), isImportant, createdAt, viewCount` (`src/types/index.ts`에 추가)

## 관리자 레이아웃 패턴 (P4-002 완료)
- `src/components/admin/AdminSidebar.tsx` — 다크 slate-900 배경, 240px↔72px 접기/펼치기
  - 너비 트랜지션: `transition-[width] duration-200 ease-out`
  - 텍스트 숨김: collapsed ? "w-0 opacity-0" : "w-auto opacity-100" (transition-[width,opacity])
  - 활성 메뉴: `bg-primary/15 text-primary` + 좌측 3px primary 바 (absolute)
  - 접힘 툴팁: `group` + `group-hover:block` (absolute left-full ml-3)
  - 서브메뉴: `border-l border-slate-700/60 pl-4` 인덴트 트리
  - isCustomerServiceActive: useMemo로 계산 (useEffect setState 금지)
- `src/components/admin/AdminTopBar.tsx` — PATH_LABELS 맵으로 브레드크럼 생성
- `src/app/(admin)/layout.tsx` — collapsed/mobileOpen 상태, spacer div로 사이드바 너비 확보
  - `style={{ width: collapsed ? 72 : 240 }}` + `transition-[width] duration-200`
  - `usePathname()`으로 `/admin/login` 경로 감지 → children만 렌더링 (레이아웃 분기)
- `src/app/(admin)/admin/page.tsx` 필수 — 없으면 (user) 레이아웃이 대신 렌더됨

## 관리자 로그인 페이지 패턴 (P4-003 완료)
- `src/app/(admin)/admin/login/page.tsx` — "use client", 독립 다크 레이아웃
- 디자인: `bg-slate-950` 전체 배경 + 방사형 그라데이션 글로우 오브 + 격자 패턴
- 카드: `bg-slate-900/80 border-slate-700/50 backdrop-blur-sm shadow-2xl rounded-2xl`
- 인풋: `bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500` + 포커스 `border-violet-500/60`
- 로그인 버튼: `bg-gradient-to-r from-violet-600 to-violet-700 shadow-lg shadow-violet-900/40`
- 에러 Alert: `border-red-500/20 bg-red-500/10 text-red-400 rounded-xl`
- 잠금 기능: 5회 실패 시 30초 잠금 (일반 로그인과 동일 패턴)
- 레이아웃 분기: layout.tsx에서 `usePathname() === "/admin/login"` 시 `<>{children}</>` 만 반환

## 관리자 공통 컴포넌트 구조 (P4-004 완료)
- `src/components/admin/AdminDataTable.tsx` — 제네릭 테이블, 컬럼 정렬, 페이지네이션, 체크박스 선택, 로딩/빈상태
  - `ColumnDef<T>` 타입으로 컬럼 정의, `rowKey` prop으로 행 식별자 지정
  - controlled/uncontrolled 이중 모드 (page/pageSize props 유무로 자동 전환)
  - 데모 페이지에서 제네릭 타입 호환 시: `type OrderRow = AdminOrderListItem & Record<string, unknown>`
- `src/components/admin/AdminSearchFilterPanel.tsx` — 검색 인풋 + 필터 토글(ChevronDown 회전), 적용된 필터 칩
  - `children`으로 필터 내용 주입, `activeFilters` prop으로 칩 목록 제어
- `src/components/admin/AdminCsvExportButton.tsx` — CSV 생성/다운로드, BOM 처리(한글 Excel 호환)
  - `getData()` 비동기 함수 지원, `CsvColumnDef<T>` 타입으로 컬럼/포맷 정의
- `src/components/admin/AdminDateRangePicker.tsx` — Popover 기반, 빠른선택 4종 + 직접입력
  - `DateRange { from: string|null, to: string|null }` 타입, 빠른 선택 활성 상태 추적
- `src/components/admin/AdminNumberRange.tsx` — 최소/최대 Input, 단위 표시, 유효성 검사(min>max)
  - `NumberRangeValue { min?: number, max?: number }` 타입
- `src/components/admin/AdminMultiSelect.tsx` — 검색 가능 드롭다운, 선택 칩 표시, 외부 클릭 닫기
  - `role="button"` 사용 (combobox는 aria-controls 필수여서 회피), 닫기 시 search 초기화는 이벤트에서 직접
  - `MultiSelectOption { value, label, disabled? }` 타입, `maxSelect` prop으로 최대 선택 제한

## 관리자 대시보드 컴포넌트 구조 (P4-005 완료)
- `src/components/admin/dashboard/` — 대시보드 서브 컴포넌트 디렉토리
  - `DashboardStatCard.tsx` — Stat Card (아이콘 + 수치 + 증감률 TrendingUp/Down 화살표)
  - `DashboardSalesChart.tsx` — Recharts ComposedChart (Bar=매출 + Line=주문건수, 기간 선택 7/14/30일)
  - `DashboardRecentOrders.tsx` — AdminDataTable 래핑, OrderRow 타입 `AdminOrderListItem & Record<string, unknown>`
  - `DashboardPinStock.tsx` — 상품별 재고 막대(대기/할당/소진), 5개 이하 빨간 경고
  - `AdminDashboardClient.tsx` — 메인 클라이언트 컴포넌트 (4행 레이아웃)
- `src/app/(admin)/adminmaster/page.tsx` — 서버 컴포넌트, mock 데이터 주입 후 AdminDashboardClient 렌더
- Recharts 설치: `npm install recharts --legacy-peer-deps`
- 차트 CSS 변수 활용: `stroke="hsl(var(--primary))"`, `fill="hsl(var(--primary))"`
- 금액 포맷: 만원/억원 단위 한국어 표기 (`formatKoreanMoney()` 유틸 함수)
- 증감률 계산: `calcChangeRate(current, prev)` — prev=0 시 100% or 0% 처리
- Phase 5: P5-001, P5-002, P5-006, P5-007 완료

## 관리자 주문 관리 패턴 (P4-006 완료)
- `src/components/admin/orders/AdminOrdersClient.tsx` — 메인 클라이언트 컴포넌트 (검색+필터+테이블+모달)
- `src/components/admin/orders/OrderDetailModal.tsx` — 8개 섹션 상세 모달
- `src/app/(admin)/adminmaster/orders/page.tsx` — 서버 컴포넌트, mockAdminOrders 주입
- OrderRow 타입: `AdminOrderListItem & Record<string, unknown>` (AdminDataTable 제네릭 호환)
- 필터 상태 분리: `filters`(조작 중) vs `appliedFilters`(적용된) — 필터 적용 버튼 클릭 시 동기화
- 검색도 동일 패턴: `search` vs `appliedSearch`
- 상태 Badge: `ORDER_STATUS_STYLE/LABEL`, `VOUCHER_STATUS_STYLE/LABEL` Record 맵으로 관리
- Dialog 경고 `Missing Description or aria-*`: shadcn Dialog 기본 동작, 기능에 영향 없음 (무시)

## 회원 관리 컴포넌트 구조 (P4-008 완료)
- `src/components/admin/members/AdminMembersClient.tsx` — 메인 클라이언트 컴포넌트 (검색+필터4종+테이블+모달)
- `src/components/admin/members/MemberDetailModal.tsx` — 4탭 상세 모달 (회원정보/구매내역/상품권/선물)
- `src/app/(admin)/adminmaster/members/page.tsx` — 서버 컴포넌트, mockAdminMemberList 주입
- 더미 데이터: `mockAdminMemberList` (기존 `mockAdminUsers_list` → 별칭 유지), `getMemberOrders()`, `getMemberGifts()` 유틸
- 전화번호 마스킹: `${digits.slice(0,3)}-****-${digits.slice(7)}` (11자리 기준)
- 탭 버튼 패턴: `border-b-2 border-primary text-primary` (활성) / `border-transparent text-muted-foreground` (비활성)
- 모달 내 탭 전환 시 스크롤 위치 유지: `flex flex-col` + `flex-1 overflow-y-auto`로 콘텐츠 영역만 스크롤
- react-hooks/static-components 오류: 함수 컴포넌트 내부에서 다른 컴포넌트(GiftTable 등)를 const로 정의하면 안 됨 → 파일 최상위로 이동
- AdminSidebar 경로: 회원관리 `/adminmaster/members`로 변경 (기존 `/adminmaster/users`에서)
- AdminTopBar PATH_LABELS에도 `/adminmaster/members` 항목 추가 필요

## 상품권 관리 컴포넌트 구조 (P4-009 완료)
- `src/components/admin/products/AdminProductsClient.tsx` — 메인 클라이언트 컴포넌트 (검색+필터5종+테이블+카테고리 관리)
- `src/components/admin/products/ProductFormModal.tsx` — 상품 등록/수정 모달 (RHF+Zod, 이미지 드래그앤드롭)
- `src/app/(admin)/adminmaster/products/page.tsx` — 서버 컴포넌트, mockAdminProducts/mockAdminCategories 주입
- 더미 데이터: `mockAdminCategories` (5개), `mockAdminProducts` (8개) — `src/mock/admin.ts`에 추가
- `type ProductRow = AdminProductListItem & Record<string, unknown>` — DataTable 제네릭 호환
- 액션 컬럼 key: `"_actions"` (상품ID 컬럼 `"id"`와 충돌 방지)
- 품절 자동 표시: `getDisplayStatus()` — `status === "active" && pin_stock_waiting === 0` → `"soldout"` 반환
- AlertDialog 직접 사용 (ConfirmDialog는 hook 패턴이라 직접 렌더 불가)
- Switch 컴포넌트: `npx shadcn@latest add switch --yes`로 설치
- Zod v4: `z.number({ invalid_type_error: "..." })` 옵션 지원 안 함 → `z.number()` 단독 사용

## 관리자 FAQ/공지 관리 패턴 (P5-012 완료)
- `src/components/admin/faq/AdminFaqClient.tsx`, `FaqFormModal.tsx`
- `src/components/admin/notices/AdminNoticesClient.tsx`, `NoticeFormModal.tsx`
- 더미 데이터: `mockAdminFaqs`, `mockAdminNotices` — `src/mock/admin.ts`에 존재
- Zod v4: `z.enum([...] as const, { required_error })` 지원 안 함 → `z.enum([...] as const)` 단독 사용
- 공지사항 미리보기: `.replace(/<[^>]*>/g, "")` HTML 태그 제거 후 줄바꿈 제거

## 업체 포털 패턴
→ 상세 내용: `business-portal-patterns.md`
- violet 테마, SMS 인증 3단계 흐름, 매입상세 테이블(BusinessGiftsClient) 구조

## 완료된 태스크 (Phase별)
- Phase 1: P1-001 ~ P1-020 모두 완료
- Phase 2: P2-001, P2-002, P2-003, P2-004 완료
- Phase 3: P3-004 완료
- Phase 4: P4-002, P4-003, P4-004, P4-005, P4-006, P4-008, P4-009, P4-010 완료
- Phase 5: P5-001, P5-002, P5-006, P5-007, P5-012 완료
- 업체 포털: 매입상세 페이지(BusinessGiftsClient) 완료, SMS인증+로그인(P4-003) 완료
