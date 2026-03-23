# 배너/이미지 관리 태스크 목록

> 관리자에서 메인 배너, 사이드 배너, 카테고리 이미지를 업로드/관리할 수 있도록 기능 추가
> Supabase 새 프로젝트 마이그레이션 시 함께 진행

---

## Phase 1: DB 스키마 + Supabase Storage

### B-001: 메인 배너(히어로) 관리 테이블
- [ ] `banners` 테이블 생성 (id, image_url, link_url, alt_text, sort_order, is_active, created_at, updated_at)
- [ ] Supabase Storage `banners` 버킷 생성
- [ ] RLS 정책: 관리자만 CRUD, 일반 사용자 읽기 전용

### B-002: 사이드 배너 관리 테이블
- [ ] `side_banners` 테이블 생성 (id, image_url, link_url, alt_text, position, sort_order, is_active, created_at, updated_at)
- [ ] position: 'sidebar_top' | 'sidebar_middle' | 'sidebar_bottom'
- [ ] Supabase Storage `side-banners` 버킷 생성

### B-003: 카테고리 이미지 필드 추가
- [ ] `categories` 테이블에 `image_url` 컬럼 추가 (nullable)
- [ ] Supabase Storage `categories` 버킷 생성
- [ ] 이미지가 있으면 이미지 표시, 없으면 Lucide 아이콘 fallback

---

## Phase 2: 관리자 페이지

### B-004: 메인 배너 관리 페이지
- [ ] `/adminmaster/banners` 페이지 생성
- [ ] 배너 목록 (드래그 정렬)
- [ ] 배너 추가/수정 모달 (이미지 업로드, 링크 URL, 순서, 활성 여부)
- [ ] 이미지 미리보기
- [ ] 배너 삭제

### B-005: 사이드 배너 관리 페이지
- [ ] `/adminmaster/side-banners` 페이지 생성 또는 배너 관리에 탭으로 통합
- [ ] 사이드 배너 CRUD + 이미지 업로드
- [ ] 위치(position) 선택

### B-006: 카테고리 이미지 업로드 기능
- [ ] 기존 카테고리 관리 페이지에 이미지 업로드 필드 추가
- [ ] 이미지 미리보기 + 삭제
- [ ] 이미지 없으면 기존 아이콘 사용

---

## Phase 3: 프론트엔드 연동

### B-007: 메인 배너 API 연동
- [ ] `/api/banners` GET 엔드포인트
- [ ] `HeroBanner` 컴포넌트에서 실제 배너 데이터 fetch
- [ ] placeholder 제거

### B-008: 사이드 배너 API 연동
- [ ] `/api/side-banners` GET 엔드포인트
- [ ] `HomeSidebar` 컴포넌트에서 실제 사이드 배너 데이터 fetch
- [ ] placeholder 제거

### B-009: 카테고리 이미지 표시
- [ ] `CategoryGrid` 컴포넌트에서 image_url이 있으면 이미지 표시
- [ ] image_url이 없으면 기존 Lucide 아이콘 fallback
