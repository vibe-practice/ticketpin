# 상품권 교환권 플랫폼 - 개발 로드맵

> 작성일: 2026년 2월 27일
> 기준 문서: docs/PRD.md v1.0

---

## 1. 기술 스택

### 프론트엔드

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| UI 라이브러리 | shadcn/ui |
| 스타일링 | Tailwind CSS 4 |
| 상태관리 | Zustand |
| 폼 관리 | React Hook Form + Zod |
| 아이콘 | Lucide React |
| 차트 | Recharts (관리자 대시보드) |
| 애니메이션 | Framer Motion |

### 백엔드

| 항목 | 기술 |
|------|------|
| BaaS | Supabase |
| 인증 | Supabase Auth (사용자) + 커스텀 JWT (관리자) |
| 데이터베이스 | PostgreSQL (Supabase 내장) |
| 파일 저장소 | Supabase Storage (상품 이미지) |
| API | Next.js API Routes (결제/SMS 등 서버사이드 로직) |

### 인프라

| 항목 | 기술 |
|------|------|
| 호스팅 | Vercel |
| CDN | Vercel Edge Network (자동) |
| CI/CD | GitHub Actions + Vercel 자동 배포 |

### 개발 도구

| 항목 | 기술 |
|------|------|
| 패키지 매니저 | pnpm |
| 린터 | ESLint |
| 포맷터 | Prettier |
| 타입 검사 | TypeScript strict mode |
| E2E 테스트 | Playwright |

### 선정 사유

| 기술 | 선정 사유 |
|------|-----------|
| Next.js (App Router) | SSR/ISR로 상품 페이지 SEO 최적화, API Routes로 서버 로직 통합, React 생태계 활용 |
| Supabase | PRD에서 RLS 명시, PostgreSQL 기반으로 복잡한 관계형 데이터 처리에 적합, Auth/Storage/Realtime 통합 제공 |
| shadcn/ui + Tailwind | 컴포넌트 단위 커스터마이징 가능, PRD의 카카오 선물하기 감성 디자인 구현에 유연 |
| Zustand | 경량 상태관리, 보일러플레이트 최소화, 결제/바우처 상태 관리에 적합 |
| Vercel | Next.js 공식 호스팅, Preview Deployment로 PR별 확인 가능, Edge Functions 지원 |
| 워너페이먼츠 | PRD에서 지정한 PG사 |
| 알리고 | PRD에서 지정한 SMS 발송 서비스 |

---

## 2. 시스템 아키텍처

### 전체 구조도

```
[사용자 브라우저]
      │
      ▼
[Vercel (Next.js)]
      │
      ├── SSR/ISR ──────── 상품 페이지 (SEO)
      ├── CSR ──────────── 바우처, 마이페이지, 관리자
      │
      ├── API Routes ────┬── /api/payments/* ──→ [워너페이먼츠 PG]
      │                  ├── /api/sms/*      ──→ [알리고 SMS]
      │                  ├── /api/vouchers/* ──→ [Supabase DB]
      │                  └── /api/admin/*    ──→ [Supabase DB]
      │
      └── Supabase Client ──→ [Supabase]
                                  ├── PostgreSQL (DB + RLS)
                                  ├── Auth (사용자 인증)
                                  └── Storage (이미지)
```

- **Supabase Client 직접 호출**: 상품 조회, 카테고리 조회, 사용자 인증 등 일반 CRUD
- **API Routes 경유**: 결제 처리, SMS 발송, 핀 번호 복호화, 관리자 전용 작업 등 보안이 필요한 로직

### 폴더/디렉토리 구조

```
ticketpin/
├── docs/                        # 프로젝트 문서
│   ├── PRD.md
│   ├── ROADMAP.md
│   ├── DESIGN-SYSTEM.md
│   └── TASKS.md
├── public/                      # 정적 파일
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (public)/            # 사용자 영역
│   │   │   ├── page.tsx         # 메인 홈
│   │   │   ├── auth/            # 인증 (register, login, find-id, reset-password)
│   │   │   ├── category/        # 카테고리 목록
│   │   │   ├── product/         # 상품 상세
│   │   │   └── order/           # 주문/결제, 완료
│   │   ├── (voucher)/           # 바우처 영역 (GNB 없음)
│   │   │   └── v/[code]/        # 바우처 메인, set-pw, actions, gift, pin, cancel
│   │   ├── (mypage)/            # 마이페이지
│   │   │   └── my/              # orders, vouchers, gifts, profile
│   │   ├── (admin)/             # 관리자 영역 (사이드바 레이아웃)
│   │   │   └── admin/           # login, dashboard, orders, users, products, pins, gifts, refunds
│   │   ├── api/                 # API Routes
│   │   │   ├── auth/
│   │   │   ├── payments/
│   │   │   ├── vouchers/
│   │   │   ├── sms/
│   │   │   └── admin/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/              # 컴포넌트
│   │   ├── ui/                  # shadcn/ui 기본 컴포넌트
│   │   ├── layout/              # GNB, Footer, AdminSidebar
│   │   ├── product/             # 상품 관련
│   │   ├── voucher/             # 바우처 관련
│   │   ├── order/               # 주문 관련
│   │   ├── mypage/              # 마이페이지 관련
│   │   └── admin/               # 관리자 관련
│   ├── lib/                     # 유틸리티, 외부 연동
│   │   ├── supabase/            # Supabase 클라이언트 (client, server, admin)
│   │   ├── payments/            # 워너페이먼츠 SDK 래퍼
│   │   ├── sms/                 # 알리고 API 래퍼
│   │   ├── crypto/              # AES-256 암호화/복호화
│   │   └── utils.ts             # 공통 유틸
│   ├── hooks/                   # 커스텀 훅
│   ├── stores/                  # Zustand 스토어
│   ├── types/                   # TypeScript 타입/인터페이스
│   ├── constants/               # 상수 (에러 코드, 상태값 등)
│   └── mock/                    # 더미 데이터 (개발용)
├── supabase/                    # Supabase 로컬 설정
│   ├── migrations/              # DB 마이그레이션 SQL
│   └── seed.sql                 # 시드 데이터
├── .env.local                   # 환경 변수 (로컬, git 제외)
├── .env.example                 # 환경 변수 템플릿
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 환경 구성

| 환경 | 용도 | 배포 방식 |
|------|------|-----------|
| 개발 (local) | 로컬 개발 | `pnpm dev`, Supabase 로컬 또는 개발 프로젝트 |
| 프리뷰 (preview) | PR별 테스트 | Vercel Preview Deployment (PR 생성 시 자동) |
| 프로덕션 (production) | 실 서비스 | Vercel Production (main 브랜치 머지 시 자동) |

---

## 3. DB 스키마

### 테이블 목록

| 테이블명 | 용도 |
|----------|------|
| users | 사용자 회원 정보 |
| admin_users | 관리자 계정 |
| categories | 상품권 카테고리 |
| products | 상품권 상품 |
| pins | 핀 번호 (암호화 저장) |
| orders | 주문/결제 |
| vouchers | 바우처(교환권) |
| gifts | 선물 이력 |
| cancellations | 취소/환불 |
| sms_logs | SMS 발송 로그 |
| faqs | 자주 묻는 질문 |
| notices | 공지사항 |

### 테이블 상세

#### users

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 사용자 ID |
| auth_id | uuid | UNIQUE, NOT NULL | Supabase Auth UID |
| username | varchar(50) | UNIQUE, NOT NULL | 아이디 |
| email | varchar(200) | UNIQUE, NOT NULL | 이메일 (계정 복구·서비스 안내용) |
| name | varchar(50) | NOT NULL | 이름 (암호화) |
| phone | varchar(100) | NOT NULL | 휴대폰 번호 (암호화) |
| identity_verified | boolean | DEFAULT false | 본인인증 완료 여부 |
| status | varchar(20) | DEFAULT 'active' | active / inactive / suspended |
| total_purchase_count | integer | DEFAULT 0 | 총 구매 건수 (캐시) |
| total_purchase_amount | integer | DEFAULT 0 | 총 결제 금액 (캐시) |
| created_at | timestamptz | DEFAULT now() | 가입일 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |

#### admin_users

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 관리자 ID |
| username | varchar(50) | UNIQUE, NOT NULL | 아이디 |
| password_hash | text | NOT NULL | 비밀번호 해시 (bcrypt) |
| name | varchar(50) | NOT NULL | 이름 |
| created_at | timestamptz | DEFAULT now() | 생성일 |

#### categories

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 카테고리 ID |
| name | varchar(50) | NOT NULL | 카테고리명 |
| slug | varchar(50) | UNIQUE, NOT NULL | URL slug |
| icon | varchar(50) | | Lucide 아이콘 이름 |
| is_visible | boolean | DEFAULT true | 사용자 화면 노출 여부 |
| sort_order | integer | DEFAULT 0 | 정렬 순서 |
| created_at | timestamptz | DEFAULT now() | 생성일 |

#### products

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 상품 ID |
| category_id | uuid | FK → categories.id, NOT NULL | 카테고리 |
| name | varchar(200) | NOT NULL | 상품명 |
| price | integer | NOT NULL | 판매 가격 (원) |
| fee_amount | integer | NOT NULL | 수수료 금액 (원) |
| image_url | text | | 대표 이미지 URL |
| description | text | | 상품 설명 (사용처, 유의사항) |
| status | varchar(20) | DEFAULT 'active' | active / inactive |
| total_sales | integer | DEFAULT 0 | 총 판매량 (캐시) |
| created_at | timestamptz | DEFAULT now() | 등록일 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |

#### pins

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 핀 ID |
| product_id | uuid | FK → products.id, NOT NULL | 상품 |
| voucher_id | uuid | FK → vouchers.id | 할당된 바우처 (N:1 관계) |
| pin_number_encrypted | text | NOT NULL | AES-256 암호화된 핀 번호 |
| status | varchar(20) | DEFAULT 'waiting' | waiting / assigned / consumed |
| registration_method | varchar(20) | DEFAULT 'manual' | manual / csv |
| assigned_at | timestamptz | | 할당 일시 |
| consumed_at | timestamptz | | 소진 일시 |
| created_at | timestamptz | DEFAULT now() | 등록일 |

#### orders

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 주문 ID |
| order_number | varchar(20) | UNIQUE, NOT NULL | 주문 번호 |
| user_id | uuid | FK → users.id, NOT NULL | 구매자 |
| product_id | uuid | FK → products.id, NOT NULL | 상품 |
| quantity | integer | NOT NULL, DEFAULT 1 | 수량 |
| product_price | integer | NOT NULL | 상품 단가 |
| fee_type | varchar(20) | NOT NULL | included / separate |
| fee_amount | integer | NOT NULL | 수수료 단가 (원, 1개 기준) |
| total_amount | integer | NOT NULL | 총 결제 금액. 수수료 포함: (product_price + fee_amount) × quantity / 수수료 별도: product_price × quantity |
| payment_method | varchar(50) | | 결제 수단 |
| pg_transaction_id | varchar(100) | | PG 거래번호 |
| receiver_phone | varchar(100) | NOT NULL | 수신 번호 (암호화) |
| status | varchar(20) | DEFAULT 'paid' | paid / password_set / pin_revealed / gifted / cancelled |
| created_at | timestamptz | DEFAULT now() | 주문 일시 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |

#### vouchers

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 바우처 ID |
| code | varchar(50) | UNIQUE, NOT NULL | 바우처 코드 (URL 경로용, UUID v4) |
| order_id | uuid | FK → orders.id, NOT NULL | 주문 |
| owner_id | uuid | FK → users.id, NOT NULL | 현재 소유자 |
| temp_password_hash | text | | 임시 비밀번호 해시 |
| temp_password_expires_at | timestamptz | | 임시 비밀번호 만료 시간 |
| temp_password_attempts | integer | DEFAULT 0 | 임시 비밀번호 시도 횟수 |
| reissue_count | integer | DEFAULT 0 | 재발행 횟수 (최대 5) |
| user_password_hash | text | | 사용자 비밀번호 해시 (4자리) |
| user_password_attempts | integer | DEFAULT 0 | 사용자 비밀번호 시도 횟수 |
| is_password_locked | boolean | DEFAULT false | 비밀번호 잠금 여부 |
| fee_paid | boolean | DEFAULT false | 수수료 결제 여부 (별도 방식) |
| fee_pg_transaction_id | varchar(100) | | 수수료 PG 거래번호 |
| pin_revealed_at | timestamptz | | 핀 해제 일시 |
| is_gift | boolean | DEFAULT false | 선물받은 바우처 여부 |
| gift_sender_id | uuid | FK → users.id | 선물 보낸 사람 |
| gift_message | varchar(100) | | 선물 메시지 |
| source_voucher_id | uuid | FK → vouchers.id | 원본 바우처 (선물 시) |
| status | varchar(20) | DEFAULT 'issued' | issued / temp_verified / password_set / pin_revealed / gifted / cancelled |
| created_at | timestamptz | DEFAULT now() | 발급일 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |

#### gifts

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 선물 ID |
| sender_id | uuid | FK → users.id, NOT NULL | 보낸 사람 |
| receiver_id | uuid | FK → users.id, NOT NULL | 받는 사람 |
| source_voucher_id | uuid | FK → vouchers.id, NOT NULL | 기존 바우처 |
| new_voucher_id | uuid | FK → vouchers.id, NOT NULL | 새 바우처 |
| product_id | uuid | FK → products.id, NOT NULL | 상품 |
| message | varchar(100) | | 선물 메시지 |
| created_at | timestamptz | DEFAULT now() | 선물 일시 |

#### cancellations

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 취소 ID |
| order_id | uuid | FK → orders.id, NOT NULL | 주문 |
| voucher_id | uuid | FK → vouchers.id, NOT NULL | 바우처 |
| reason_type | varchar(20) | NOT NULL | simple_change / wrong_purchase / admin / other |
| reason_detail | text | | 기타 사유 상세 |
| cancelled_by | varchar(20) | NOT NULL | user / admin |
| refund_amount | integer | NOT NULL | 환불 금액 |
| refund_status | varchar(20) | DEFAULT 'pending' | pending / completed / failed |
| pg_cancel_transaction_id | varchar(100) | | PG 취소 거래번호 |
| refunded_at | timestamptz | | 환불 완료 일시 |
| created_at | timestamptz | DEFAULT now() | 취소 요청 일시 |

#### sms_logs

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 로그 ID |
| voucher_id | uuid | FK → vouchers.id | 바우처 |
| order_id | uuid | FK → orders.id | 주문 |
| recipient_phone | varchar(100) | NOT NULL | 수신 번호 (암호화) |
| message_type | varchar(50) | NOT NULL | purchase / reissue / gift / cancel / admin_resend |
| message_content | text | NOT NULL | 메시지 내용 |
| send_status | varchar(20) | DEFAULT 'pending' | pending / sent / failed |
| aligo_response | jsonb | | 알리고 API 응답 원본 |
| sent_by | varchar(20) | DEFAULT 'system' | system / admin |
| created_at | timestamptz | DEFAULT now() | 발송 일시 |

#### faqs

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | FAQ ID |
| category | varchar(50) | NOT NULL | 카테고리 (구매/바우처/선물/환불/기타) |
| question | text | NOT NULL | 질문 |
| answer | text | NOT NULL | 답변 |
| is_visible | boolean | DEFAULT true | 노출 여부 |
| sort_order | integer | DEFAULT 0 | 정렬 순서 |
| created_at | timestamptz | DEFAULT now() | 생성일 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |

#### notices

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 공지사항 ID |
| title | varchar(200) | NOT NULL | 제목 |
| content | text | NOT NULL | 본문 (HTML) |
| is_important | boolean | DEFAULT false | 중요 공지 여부 (목록 상단 고정) |
| is_visible | boolean | DEFAULT true | 노출 여부 |
| view_count | integer | DEFAULT 0 | 조회수 |
| created_by | uuid | FK → admin_users.id | 작성 관리자 |
| created_at | timestamptz | DEFAULT now() | 생성일 |
| updated_at | timestamptz | DEFAULT now() | 수정일 |


### 테이블 간 관계 (FK)

```
users ──1:N──→ orders
users ──1:N──→ vouchers (owner)
users ──1:N──→ gifts (sender / receiver)

categories ──1:N──→ products
products ──1:N──→ pins
products ──1:N──→ orders

orders ──1:1──→ vouchers
orders ──1:0..1─→ cancellations

vouchers ──1:N──→ pins (1 바우처 = N 핀)
vouchers ──self──→ vouchers (source_voucher_id, 선물 시)
vouchers ──1:0..1─→ cancellations

gifts ──→ vouchers (source + new)
gifts ──→ users (sender + receiver)
```

### 인덱스 전략

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| users | username | 로그인, 중복 확인 |
| users | auth_id | Supabase Auth 연동 |
| users | phone | 회원 검색 (관리자) |
| products | category_id, status | 카테고리별 상품 조회 |
| pins | product_id, status | 상품별 재고 조회 (대기 핀 카운트) |
| pins | voucher_id | 바우처별 핀 목록 조회 |
| orders | user_id, created_at | 내 주문 내역 조회 |
| orders | order_number | 주문번호 검색 |
| orders | status, created_at | 관리자 필터 |
| vouchers | code | 바우처 URL 접속 |
| vouchers | owner_id, status | 내 상품권 조회 |
| gifts | sender_id, created_at | 보낸 선물 내역 |
| gifts | receiver_id, created_at | 받은 선물 내역 |
| cancellations | order_id | 취소 정보 조회 |
| sms_logs | voucher_id | SMS 발송 이력 |

### 보안 정책 (RLS)

| 테이블 | 정책 | 설명 |
|--------|------|------|
| users | SELECT own | 본인 정보만 조회 가능 |
| orders | SELECT own | 본인 주문만 조회 가능 |
| vouchers | SELECT own | 본인 소유 바우처만 조회 가능 |
| gifts | SELECT own | 본인이 보내거나 받은 선물만 조회 |
| products | SELECT all | 모든 사용자 조회 가능 |
| categories | SELECT all | 모든 사용자 조회 가능 |
| faqs | SELECT all (visible only) | 노출 여부 true인 항목만 사용자 조회 가능 |
| notices | SELECT all (visible only) | 노출 여부 true인 항목만 사용자 조회 가능 |
| pins | SELECT none | 클라이언트 직접 접근 불가, API Routes 경유 |
| admin_users | SELECT none | 클라이언트 직접 접근 불가 |

- 관리자 작업은 Supabase Service Role Key를 사용하는 API Routes에서 처리 (RLS 우회)
- 핀 번호, 관리자 테이블 등 민감 데이터는 클라이언트에서 직접 접근 불가

---

## 4. API 설계

### 엔드포인트 목록

#### 인증 (Auth)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/register | 회원가입 | 불필요 |
| POST | /api/auth/login | 로그인 (Supabase Auth) | 불필요 |
| POST | /api/auth/logout | 로그아웃 (세션 해제) | 회원 |
| GET | /api/auth/me | 현재 사용자 정보 조회 | 회원 |
| POST | /api/auth/check-username | 아이디 중복 확인 | 불필요 |
| POST | /api/auth/verify-identity | 본인인증 (휴대폰) | 불필요 |
| POST | /api/auth/find-id | 아이디 찾기 | 불필요 |
| POST | /api/auth/reset-password | 비밀번호 재설정 | 불필요 |

#### 상품 (Products)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | /api/products | 상품 목록 (카테고리, 정렬, 검색) | 불필요 |
| GET | /api/products/[id] | 상품 상세 (재고 포함) | 불필요 |
| GET | /api/categories | 카테고리 목록 | 불필요 |

#### 주문/결제 (Orders/Payments)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/orders | 주문 생성 | 회원 |
| GET | /api/orders/[id] | 주문 상세 | 회원 (본인) |
| POST | /api/payments/prepare | PG 결제 준비 (토큰 발급) | 회원 |
| POST | /api/payments/confirm | PG 결제 승인 (웹훅/콜백) | 서버 |
| POST | /api/payments/fee | 수수료 결제 (별도 방식) | 회원 |

#### 바우처 (Vouchers)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | /api/vouchers/[code] | 바우처 정보 조회 | 불필요 (URL 보유자) |
| POST | /api/vouchers/[code]/verify-temp-password | 임시 비밀번호 검증 | 불필요 |
| POST | /api/vouchers/[code]/set-password | 사용자 비밀번호 설정 | 불필요 |
| POST | /api/vouchers/[code]/verify-password | 사용자 비밀번호 검증 | 불필요 |
| POST | /api/vouchers/[code]/unlock-pins | 핀 번호 해제 | 불필요 |
| POST | /api/vouchers/[code]/fee-payment/prepare | 수수료 결제 준비 | 불필요 |
| POST | /api/vouchers/[code]/fee-payment/confirm | 수수료 결제 승인 | 불필요 |
| POST | /api/vouchers/[code]/reissue | 임시 비밀번호 재발행 | 불필요 |
| POST | /api/vouchers/[code]/cancel | 결제 취소 요청 | 불필요 |
| POST | /api/vouchers/[code]/gift | 선물 전송 | 회원 |

#### 마이페이지 (My)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | /api/mypage/summary | 마이페이지 요약 | 회원 |
| GET | /api/mypage/orders | 내 주문 목록 | 회원 |
| GET | /api/mypage/vouchers | 내 상품권 목록 | 회원 |
| GET | /api/mypage/gifts?type=sent | 보낸 선물 내역 | 회원 |
| GET | /api/mypage/gifts?type=received | 받은 선물 내역 | 회원 |
| GET | /api/mypage/profile | 내 정보 조회 | 회원 |
| PUT | /api/mypage/profile | 내 정보 수정 | 회원 |
| PUT | /api/mypage/profile/password | 비밀번호 변경 | 회원 |
| GET | /api/users/search | 회원 검색 (선물하기용) | 회원 |

#### 관리자 (Admin)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/admin/login | 관리자 로그인 | 불필요 (IP 화이트리스트) |
| POST | /api/auth/admin/logout | 관리자 로그아웃 | 관리자 |
| GET | /api/admin/auth/me | 현재 관리자 정보 조회 | 관리자 |
| GET | /api/admin/dashboard/stats | 대시보드 통계 | 관리자 |
| GET | /api/admin/dashboard/chart | 대시보드 차트 데이터 | 관리자 |
| GET | /api/admin/dashboard/recent-orders | 대시보드 최근 주문 | 관리자 |
| GET | /api/admin/orders | 주문 목록 (필터/검색) | 관리자 |
| GET | /api/admin/orders/[id] | 주문 상세 | 관리자 |
| POST | /api/admin/orders/[id]/cancel | 관리자 주문 취소 | 관리자 |
| POST | /api/admin/orders/[id]/resend-sms | SMS 재발송 | 관리자 |
| GET | /api/admin/members | 회원 목록 (필터/검색) | 관리자 |
| GET | /api/admin/members/[id] | 회원 상세 | 관리자 |
| PATCH | /api/admin/members/[id]/status | 회원 상태 변경 | 관리자 |
| GET | /api/admin/products | 상품 목록 | 관리자 |
| POST | /api/admin/products | 상품 등록 | 관리자 |
| PUT | /api/admin/products/[id] | 상품 수정 | 관리자 |
| GET | /api/admin/categories | 카테고리 목록 | 관리자 |
| POST | /api/admin/categories | 카테고리 등록 | 관리자 |
| PUT | /api/admin/categories/[id] | 카테고리 수정 | 관리자 |
| DELETE | /api/admin/categories/[id] | 카테고리 삭제 | 관리자 |
| GET | /api/admin/pins | 핀 목록 (필터/검색) | 관리자 |
| POST | /api/admin/pins | 핀 개별 등록 | 관리자 |
| POST | /api/admin/pins/bulk | 핀 CSV 대량 등록 | 관리자 |
| GET | /api/admin/pins/stock | 핀 재고 현황 | 관리자 |
| GET | /api/admin/gifts | 선물 이력 (필터/검색) | 관리자 |
| GET | /api/admin/refunds | 취소/환불 목록 | 관리자 |
| PUT | /api/admin/refunds/[id]/retry | 환불 재시도 | 관리자 |
| GET | /api/admin/faq | FAQ 목록 | 관리자 |
| POST | /api/admin/faq | FAQ 등록 | 관리자 |
| PUT | /api/admin/faq/[id] | FAQ 수정 | 관리자 |
| DELETE | /api/admin/faq/[id] | FAQ 삭제 | 관리자 |
| GET | /api/admin/notices | 공지사항 목록 | 관리자 |
| POST | /api/admin/notices | 공지사항 등록 | 관리자 |
| PUT | /api/admin/notices/[id] | 공지사항 수정 | 관리자 |
| DELETE | /api/admin/notices/[id] | 공지사항 삭제 | 관리자 |
| GET | /api/admin/export/[type] | CSV 내보내기 (orders/users/pins/gifts/refunds) | 관리자 |
| GET | /api/admin/settings/current-ip | 현재 클라이언트 IP 조회 | 관리자 |
| GET | /api/admin/settings/allowed-ips | IP 화이트리스트 조회 | 관리자 |
| POST | /api/admin/settings/allowed-ips | IP 화이트리스트 추가 | 관리자 |
| DELETE | /api/admin/settings/allowed-ips | IP 화이트리스트 삭제 | 관리자 |
| GET | /api/admin/settings/accounts | 관리자 계정 목록 | 관리자 |
| POST | /api/admin/settings/accounts | 관리자 계정 생성 | 관리자 |
| DELETE | /api/admin/settings/accounts | 관리자 계정 삭제 | 관리자 |

### 인증/인가 방식

| 영역 | 방식 | 상세 |
|------|------|------|
| 사용자 인증 | Supabase Auth (JWT) | 회원가입 시 Supabase Auth 계정 생성, 세션 토큰 자동 관리 |
| 관리자 인증 | IP 화이트리스트 + 세션 쿠키 | admin_users 테이블로 별도 인증, IP 체크 + httpOnly 세션 쿠키 + bcrypt 비밀번호, 8시간 만료 |
| 바우처 접근 | URL 코드 | 바우처 코드(UUID v4) 자체가 접근 토큰 역할 |
| API Routes 보호 | middleware | Next.js middleware에서 JWT 검증 후 요청 전달 |

### 에러 코드 정의

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| AUTH_001 | 401 | 인증 토큰 없음 또는 만료 |
| AUTH_002 | 401 | 아이디 또는 비밀번호 불일치 |
| AUTH_003 | 409 | 이미 사용 중인 아이디 |
| AUTH_004 | 403 | 계정 비활성/정지 상태 |
| VOUCHER_001 | 404 | 존재하지 않는 바우처 코드 |
| VOUCHER_002 | 400 | 임시 비밀번호 불일치 |
| VOUCHER_003 | 400 | 임시 비밀번호 만료 |
| VOUCHER_004 | 423 | 임시 비밀번호 5회 실패 잠금 |
| VOUCHER_005 | 400 | 사용자 비밀번호 불일치 |
| VOUCHER_006 | 423 | 사용자 비밀번호 5회 실패 잠금 |
| VOUCHER_007 | 400 | 재발행 횟수 초과 (5회) |
| VOUCHER_008 | 400 | 이미 비밀번호 설정됨 |
| CANCEL_001 | 400 | 비밀번호 설정 후 취소 불가 |
| CANCEL_002 | 400 | 선물받은 바우처 취소 불가 |
| CANCEL_003 | 400 | 이미 취소된 주문 |
| GIFT_001 | 400 | 자기 자신에게 선물 불가 |
| GIFT_002 | 400 | 핀 해제 후 선물 불가 |
| GIFT_003 | 404 | 수신자를 찾을 수 없음 |
| PAYMENT_001 | 400 | 결제 실패 |
| PAYMENT_002 | 400 | 품절 (핀 재고 없음) |
| PAYMENT_003 | 400 | PG 취소 실패 |
| ADMIN_001 | 403 | 관리자 권한 없음 |
| ADMIN_002 | 400 | 비밀번호 설정 건 취소 불가 (관리자) |
| SMS_001 | 500 | SMS 발송 실패 |
| GENERAL_001 | 500 | 서버 내부 오류 |
| GENERAL_002 | 400 | 잘못된 요청 파라미터 |

### API 버전 관리

- MVP 단계에서는 별도 API 버전 관리 없이 `/api/*` 경로 사용
- 추후 Breaking Change 발생 시 `/api/v2/*` 경로 추가 방식으로 확장

---

## 5. 외부 연동 상세

### 연동 서비스 목록

| 서비스 | 용도 | 연동 방식 |
|--------|------|-----------|
| 워너페이먼츠 | PG 결제 (상품 구매 + 수수료 별도 결제) | REST API + 결제창 SDK |
| 알리고 | SMS 발송 (바우처 URL, 임시 비밀번호 등) | REST API |
| 본인인증 서비스 (다날) | 휴대폰 본인인증 (회원가입, 아이디 찾기, 비밀번호 재설정) | 팝업 연동 — 🚫 계약 진행 중 |

#### 워너페이먼츠 연동 상세

| 항목 | 상세 |
|------|------|
| 결제 요청 | 결제창 SDK 호출 → 사용자 결제 → 승인 결과 콜백/웹훅 |
| 결제 승인 | 서버에서 승인 API 호출 (2단계 결제) |
| 결제 취소 | 서버에서 취소 API 호출 (pg_transaction_id 기반) |
| 수수료 결제 | 상품 결제와 동일 플로우 (별도 거래) |

#### 알리고 연동 상세

| 항목 | 상세 |
|------|------|
| 발송 방식 | REST API (`POST /send/`) |
| 메시지 유형 | SMS (90byte 이하) 또는 LMS (장문) |
| 발송 시점 | 구매 완료, 재발행, 선물 수신, 결제 취소, 관리자 재발송 |
| 구매 완료 SMS 필수 포함 문구 | "결제 취소는 구매 당일 자정까지만 가능합니다" |
| 발신번호 | 사전 등록된 발신번호 사용 |

### API 키 관리

| 키 | 저장 위치 | 용도 |
|----|-----------|------|
| SUPABASE_URL | .env.local | Supabase 프로젝트 URL |
| SUPABASE_ANON_KEY | .env.local | Supabase 공개 키 (RLS 적용) |
| SUPABASE_SERVICE_ROLE_KEY | .env.local (서버 전용) | Supabase 관리 키 (RLS 우회) |
| WONERPAY_MERCHANT_ID | .env.local | 워너페이먼츠 가맹점 ID |
| WONERPAY_API_KEY | .env.local | 워너페이먼츠 API 키 |
| WONERPAY_SECRET_KEY | .env.local | 워너페이먼츠 시크릿 키 |
| ALIGO_API_KEY | .env.local | 알리고 API 키 |
| ALIGO_USER_ID | .env.local | 알리고 사용자 ID |
| ALIGO_SENDER | .env.local | 알리고 발신번호 |
| PIN_ENCRYPTION_KEY | .env.local | AES-256 핀 암호화 키 |
| ADMIN_JWT_SECRET | .env.local | 관리자 JWT 서명 키 |

- 모든 API 키는 `.env.local`에 저장, `.env.example`에 키 이름만 기재
- Vercel 배포 시 Environment Variables에 등록 (Production/Preview 분리)
- `SUPABASE_SERVICE_ROLE_KEY`, `PIN_ENCRYPTION_KEY` 등 민감 키는 서버 사이드(API Routes)에서만 사용

### 에러 처리 / 재시도 정책

| 서비스 | 에러 처리 | 재시도 |
|--------|-----------|--------|
| 워너페이먼츠 | 결제 실패 시 사용자에게 에러 메시지 표시 + 재시도 버튼 제공 | 자동 재시도 없음, 사용자 수동 재시도 |
| 워너페이먼츠 (취소) | 취소 실패 시 cancellations.refund_status = 'failed' 저장, 관리자 수동 재시도 | 관리자가 환불 관리에서 재시도 |
| 알리고 | 발송 실패 시 sms_logs.send_status = 'failed' 저장, 관리자 알림 | 최대 3회 자동 재시도 (1초, 5초, 30초 간격) |
| 본인인증 (다날) | 인증 실패 시 사용자에게 재시도 안내 | 자동 재시도 없음 — 🚫 계약 진행 중 |

---

## 6. 상태 관리

### 핵심 엔티티 상태 전이도

#### 바우처 (Voucher) 상태

```
[issued] ──임시비밀번호 인증──→ [temp_verified] ──비밀번호 설정──→ [password_set]
   │                                                                    │
   │                                                              ┌─────┴─────┐
   │                                                              ▼           ▼
   │                                                       [pin_revealed] [gifted]
   │
   └──결제취소──→ [cancelled]

temp_verified ──결제취소──→ [cancelled]
```

#### 주문 (Order) 상태

```
[paid] ──바우처 비밀번호 설정──→ [password_set] ──핀 해제──→ [pin_revealed]
  │                                │
  │                                └──선물──→ [gifted]
  │
  └──결제취소──→ [cancelled]
```

#### 핀 (Pin) 상태

```
[waiting] ──주문 배정──→ [assigned] ──핀 해제──→ [consumed]
                             │
                             └──주문 취소──→ [waiting]
```

### 상태별 허용 액션

#### 바우처 상태별 허용 액션

| 상태 | 허용 액션 |
|------|-----------|
| issued | 임시 비밀번호 입력, 재발행, 결제취소 |
| temp_verified | 비밀번호 설정, 결제취소 |
| password_set | 핀 해제, 선물하기 |
| pin_revealed | 핀 재조회 (비밀번호 재입력) |
| gifted | 없음 (기존 URL 접속 시 "선물 완료" 안내) |
| cancelled | 없음 (URL 접속 시 "취소됨" 안내) |

#### 결제취소 가능 조건

| 조건 | 취소 가능 |
|------|-----------|
| issued + 직접 구매 | O |
| temp_verified + 직접 구매 | O |
| password_set | X (영구 차단) |
| pin_revealed | X (영구 차단) |
| gifted | X (영구 차단) |
| 선물받은 바우처 (모든 상태) | X (취소 버튼 미노출) |

#### 결제취소 시간 제한

| 주체 | 제한 |
|------|------|
| 사용자 | 결제 당일 자정까지만 취소 가능 (자정 이후 취소 버튼 비활성화, "결제 취소는 결제 당일 자정까지만 가능합니다" 안내 표시) |
| 관리자 | 시간 제한 없이 PG 취소 API 호출 가능 |

---

## 7. 보안 구현

### 암호화 방식

| 대상 | 방식 | 상세 |
|------|------|------|
| 사용자 로그인 비밀번호 | bcrypt | Supabase Auth 기본 제공 |
| 관리자 로그인 비밀번호 | bcrypt | salt rounds: 12 |
| 핀 번호 | AES-256-GCM | 서버 사이드 암호화/복호화, IV 랜덤 생성 |
| 바우처 임시 비밀번호 | bcrypt | 3자리 영숫자 해싱 저장 |
| 바우처 사용자 비밀번호 | bcrypt | 4자리 숫자 해싱 저장 |
| 개인정보 (이름, 전화번호) | AES-256-GCM | DB 저장 시 암호화, 조회 시 복호화 |

### 인증 흐름

#### 사용자 인증

```
1. 로그인 → Supabase Auth signInWithPassword()
2. Supabase가 JWT 액세스 토큰 + 리프레시 토큰 발급
3. 클라이언트에서 자동 세션 관리 (supabase-js)
4. API 요청 시 Authorization: Bearer <token> 헤더 자동 첨부
5. 서버에서 supabase.auth.getUser()로 검증
```

#### 관리자 인증 ✅ 완료

```
1. middleware에서 IP 화이트리스트 체크 (admin_allowed_ips 테이블)
2. /api/auth/admin/login 호출 → admin_users 테이블에서 검증
3. bcrypt로 비밀번호 비교
4. 세션 토큰 생성 → admin_sessions 테이블 저장 (만료: 8시간)
5. httpOnly + secure + sameSite=strict 쿠키에 저장
6. 관리자 API 요청 시 쿠키 자동 전송
7. middleware에서 세션 검증
8. 관리자 설정 페이지에서 IP 추가/삭제 관리
```

### CORS, CSP 설정

| 설정 | 값 |
|------|-----|
| CORS | Next.js 기본 (동일 origin, API Routes는 동일 도메인) |
| CSP | `default-src 'self'; script-src 'self' 워너페이먼츠도메인; style-src 'self' 'unsafe-inline'; img-src 'self' supabase-storage-url data:;` |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |

### 환경 변수 관리

- 모든 시크릿은 `.env.local`에 저장, git에 커밋하지 않음
- `.env.example`에 필요한 변수 이름과 형식만 기재
- Vercel 배포 시 Environment Variables에 등록 (Production / Preview / Development 분리)
- `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에 노출
- 핀 암호화 키, PG 시크릿 키 등은 절대 `NEXT_PUBLIC_` 접두사 사용 금지

---

## 8. 데이터 흐름

### 구매 플로우 데이터 흐름

```
사용자가 구매 버튼 클릭
  → [프론트] 주문 정보 수집 (상품, 수량, 수수료 방식)
  → [API] POST /api/orders → 주문 생성 (status: pending)
  → [API] POST /api/payments/prepare → 워너페이먼츠 토큰 발급
  → [프론트] 워너페이먼츠 결제창 호출
  → [PG] 결제 완료 → 콜백/웹훅
  → [API] POST /api/payments/confirm
       → 주문 status: paid
       → 핀 N개 배정 (waiting → assigned, 수량만큼)
       → 바우처 1개 생성 (임시 비밀번호 생성, 만료시간 설정, 핀 N개 연결)
       → 알리고 SMS 발송 (바우처 URL + 임시 비밀번호)
       → sms_logs 기록
  → [프론트] 주문 완료 페이지 표시
```

### 바우처 플로우 데이터 흐름

```
SMS 링크 클릭 → /v/[code] 접속
  → [프론트] 보이스피싱 주의 화면 표시 (최초 접속 시) → 사용자 확인
  → [API] GET /api/vouchers/[code] → 바우처 정보 + 남은 시간 반환
  → [프론트] 타이머 표시 + 임시 비밀번호 입력 UI

임시 비밀번호 입력
  → [API] POST /api/vouchers/[code]/verify-temp → bcrypt 비교
  → 성공 → status: temp_verified → 비밀번호 설정 화면

비밀번호 설정
  → [API] POST /api/vouchers/[code]/set-password → bcrypt 해싱 저장
  → status: password_set → 액션 선택 화면

핀 해제 (수수료 포함)
  → [API] POST /api/vouchers/[code]/verify-password → bcrypt 비교
  → 성공 → 핀 번호 N개 AES-256 복호화 → 전체 응답
  → voucher status: pin_revealed, 연결된 pin N개 status: consumed

핀 해제 (수수료 별도)
  → 비밀번호 인증 → 수수료 결제 (워너페이먼츠) → 결제 확인
  → 핀 번호 복호화 → 응답
```

### 선물하기 데이터 흐름

```
선물하기 클릭 → 회원 검색 → 수신자 선택 → 확인
  → [API] POST /api/vouchers/[code]/gift
       → 기존 바우처 status: gifted
       → 새 바우처 생성 (새 code, 새 임시 비밀번호, owner: 수신자)
       → 핀 N개의 voucher_id를 새 바우처로 업데이트
       → gifts 레코드 생성
       → 알리고 SMS 발송 (수신자에게 새 URL + 임시 비밀번호)
  → [프론트] 선물 완료 화면
```

### 이벤트 기반 데이터 처리

| 이벤트 | 트리거 | 처리 |
|--------|--------|------|
| 핀 재고 0 도달 | pins 테이블 UPDATE/DELETE 시 | DB 트리거 또는 API에서 재고 확인 후 상품 품절 표시 |
| 핀 추가 등록 | pins INSERT 시 | 해당 상품의 대기 재고가 1 이상이면 자동 판매 복구 |
| 결제 취소 | cancellations INSERT 시 | 바우처에 연결된 핀 N개 모두 waiting으로 복구 |

### 데이터 마이그레이션 계획

- 신규 프로젝트이므로 기존 데이터 이관 불필요
- 초기 시드 데이터: 카테고리, 테스트 상품, 테스트 핀 번호, 관리자 계정

---

## 9. 캐싱 전략

| 항목 | 전략 | 상세 |
|------|------|------|
| 서버 캐시 | MVP 미적용 | 동시 접속 500명 기준, Supabase 커넥션 풀링으로 충분. 추후 트래픽 증가 시 Redis 도입 검토 |
| CDN 캐시 | Vercel Edge 자동 | 정적 자산 (이미지, JS, CSS) 자동 CDN 캐싱 |
| 브라우저 캐시 | Next.js 기본 | 정적 자산: Cache-Control max-age, 상품 이미지: Supabase Storage CDN |
| ISR | 상품 목록/상세 | revalidate: 60초, 상품 정보 변경 시 on-demand revalidation |
| 캐시 무효화 | 관리자 상품 수정 시 | revalidatePath/revalidateTag 호출로 ISR 캐시 갱신 |

---

## 10. 로깅 / 모니터링

| 항목 | 도구 | 상세 |
|------|------|------|
| 에러 로깅 | Sentry (무료 티어) | 프론트엔드 + API Routes 에러 자동 수집, 소스맵 연동 |
| 성능 모니터링 | Vercel Analytics (기본 제공) | Web Vitals (LCP, FID, CLS), 페이지별 로딩 속도 |
| DB 모니터링 | Supabase Dashboard | 쿼리 성능, 커넥션 수, 스토리지 사용량 |
| 비즈니스 지표 | 관리자 대시보드 (자체 구현) | 매출, 주문 건수, 신규 회원, 취소 현황 |
| 알림 체계 | Sentry Alerts | 에러 급증 시 이메일/슬랙 알림. 추후 PagerDuty 연동 검토 |
| SMS 발송 로그 | sms_logs 테이블 | 발송 성공/실패, 알리고 응답 원본 저장, 관리자 화면에서 조회 |

---

## 11. 테스트 전략

| 항목 | 도구 | 범위 |
|------|------|------|
| 단위 테스트 | Vitest | 비즈니스 로직 (가격 계산, 상태 전이 검증, 암호화/복호화, 에러 코드 매핑) |
| 통합 테스트 | Vitest + Supabase 로컬 | API Routes (주문 생성, 바우처 플로우, 결제 취소 로직) |
| E2E 테스트 | Playwright | 핵심 사용자 플로우 (구매 → 바우처 → 핀 해제, 선물하기, 결제취소) |
| 커버리지 목표 | 핵심 비즈니스 로직 80%+ | 상태 전이, 결제, 보안 관련 코드 우선 |
| QA 프로세스 | Playwright MCP + 수동 | 빌드/린트 통과 후 브라우저 테스트, PR별 Preview 환경에서 확인 |

---

## 12. 배포 전략

| 항목 | 상세 |
|------|------|
| CI/CD 파이프라인 | GitHub → Vercel 자동 배포. PR 생성 시 Preview, main 머지 시 Production |
| 빌드 검증 | GitHub Actions: TypeScript 타입 체크 → ESLint → 빌드 → 테스트 (Vitest) |
| 배포 방식 | Vercel Instant Rollback (문제 발생 시 이전 배포로 즉시 롤백) |
| 롤백 절차 | Vercel Dashboard에서 이전 성공 배포 선택 → Promote to Production |
| 환경별 배포 흐름 | 로컬 개발 → PR (Preview) → main 머지 (Production) |
| DB 마이그레이션 | Supabase CLI (`supabase db push`) 또는 Dashboard에서 수동 실행 |

---

## 13. 마일스톤

### Phase 1: 프로젝트 기반 + 인증 + 상품 조회

**목표:** 사용자가 상품권을 조회하고 회원가입/로그인할 수 있는 기반 완성
**예상 기간:** 3주

#### 포함 기능

- [x] 프로젝트 초기 설정 (Next.js 16, Tailwind CSS 4, shadcn/ui, ESLint, Prettier, pnpm, src/ 구조) ✅ 완료
- [x] DB 스키마 생성 (users, categories, products, pins) ✅ 완료
- [x] 공통 레이아웃 (GNB sticky 헤더 + 모바일 햄버거, Footer, 5종 레이아웃, 반응형 컨테이너) ✅ 완료
- [x] 공통 컴포넌트 (Toast, Loading Skeleton/Shimmer, Empty State, Confirm Dialog, Pagination, Error Page 404/500/403) ✅ 완료
- [x] 회원가입 (본인인증 → 정보 입력 → 완료, 3단계) ✅ 완료
- [x] 로그인 / 로그아웃 ✅ 완료
- [x] 아이디 찾기 (본인인증) ✅ 완료 (UI만, 본인인증 실제 연동은 다날 계약 후)
- [x] 비밀번호 재설정 (본인인증 → 재설정 → 완료) ✅ 완료 (UI만, 본인인증 실제 연동은 다날 계약 후)
- [x] 메인 페이지 (히어로 배너, 카테고리 바로가기, 인기/신규 상품) ✅ 완료
- [x] 카테고리 목록 페이지 (필터, 정렬, 검색) ✅ 완료
- [x] 상품 상세 페이지 (수수료 포함/별도 선택, 수량, 품절 표시) ✅ 완료

#### 릴리즈 기준 (Definition of Done)

- 빌드 및 린트 통과
- 사용자가 회원가입/로그인 후 상품권 목록을 조회하고 상세를 확인할 수 있음
- 모바일/데스크톱 반응형 동작 확인
- 더미 데이터로 상품/카테고리 표시 정상 동작

---

### Phase 2: 결제 + 바우처 + SMS

**목표:** 상품권 구매부터 핀 번호 확인까지 핵심 비즈니스 플로우 완성
**예상 기간:** 4주

#### 포함 기능

- [x] DB 스키마 추가 (orders, vouchers, sms_logs) ✅ 완료 (타입 정의 + 더미 데이터 + DB 마이그레이션)
- [x] 주문/결제 페이지 UI (상품 확인 카드, 수수료 방식 표시, 금액 요약, 구매자 정보, 결제 버튼 로딩 상태) ✅ 완료
- [x] 주문 완료 페이지 UI (체크마크, 주문번호, 문자 발송 안내, 이동 버튼) ✅ 완료
- [x] 바우처 메인 (`/v/[code]`) - 20분 타이머, 임시 비밀번호 입력 ✅ 완료
- [x] 보이스피싱 주의 화면 (바우처 URL 최초 접속 시) ✅ 완료
- [x] 바우처 비밀번호 설정 (`/v/[code]/set-pw`) ✅ 완료
- [x] 바우처 액션 화면 (`/v/[code]/actions`)
- [x] 핀 번호 확인 (`/v/[code]/pin`) - 수수료 포함/별도 분기
- [x] 수수료 별도 결제 (워너페이먼츠 추가 결제) ✅ 완료 (시뮬레이션)
- [x] 임시 비밀번호 재발행 (최대 5회) ✅ 완료
- [x] 결제취소 UI (`/v/[code]/cancel`) - 사유 입력, 확인 모달, 취소 완료 화면 ✅ 완료
- [x] 결제취소 API 연동 (PG stub) ✅ 완료
- [x] SMS 연동 (알리고) - 구매 완료, 재발행, 취소 완료 문자 ✅ 완료
- [x] 핀 번호 AES-256-GCM 암호화/복호화 구현 ✅ 완료
- [ ] 본인인증 연동 (다날) — 🚫 블로킹: 계약 진행 중

#### 릴리즈 기준 (Definition of Done)

- 빌드 및 린트 통과
- 상품 구매 → SMS 수신 → 바우처 URL 접속 → 보이스피싱 주의 확인 → 임시 비밀번호 입력 → 비밀번호 설정 → 핀 확인 전체 플로우 동작
- 수수료 포함/별도 두 가지 경로 모두 정상 동작
- 결제 취소 → 환불 → 핀 재고 복구 동작
- 타이머 만료 → 재발행 동작

---

### Phase 3: 선물하기 + 마이페이지

**목표:** 회원 간 선물하기 기능과 마이페이지 완성
**예상 기간:** 3주

#### 포함 기능

- [x] DB 스키마 추가 (gifts, cancellations) ✅ 완료 (Phase 2 마이그레이션에서 이미 생성, Gift 타입 message 필드 동기화)
- [x] 선물하기 (`/v/[code]/gift`) - 회원 검색, 수신자 선택, 확인 모달 ✅ 완료
- [x] 선물 수신 처리 - 새 바우처 생성, 기존 바우처 비활성화, SMS 발송 ✅ 완료
- [x] 선물 완료 후 기존 URL 접속 시 안내 화면 (`/v/[code]/gifted`) ✅ 완료
- [x] 마이페이지 홈 (`/my`) - 요약 대시보드 ✅ 완료
- [x] 구매 내역 (`/my/orders`) - 기간/상태 필터 ✅ 완료
- [x] 내 상품권 (`/my/vouchers`) - 상태별 필터 ✅ 완료
- [x] 선물 보낸 내역 (`/my/gifts/sent`) ✅ 완료
- [x] 선물 받은 내역 (`/my/gifts/received`) ✅ 완료
- [x] 회원 정보 수정 (`/my/profile`) - 비밀번호 변경, 휴대폰 변경 ✅ 완료

#### 릴리즈 기준 (Definition of Done)

- 빌드 및 린트 통과
- 선물하기 전체 플로우 동작 (보내기 → 수신자 SMS → 새 URL → 핀 확인)
- 마이페이지 모든 화면 정상 표시
- 선물 후 기존 URL 접속 시 "선물 완료" 안내 표시

---

### Phase 4: 관리자 시스템

**목표:** 운영에 필요한 관리자 대시보드와 전체 관리 기능 완성 (MVP 완료)
**예상 기간:** 4주

#### 포함 기능

- [x] 관리자 로그인 (`/admin/login`) - 커스텀 JWT 인증 ✅ 완료
- [x] 관리자 레이아웃 (사이드바 네비게이션) ✅ 완료
- [x] 대시보드 (`/admin`) - 매출 통계, 차트, 재고 현황, 신규 회원 ✅ 완료
- [x] 주문 관리 (`/admin/orders`) - 통합 검색, 필터 7종, DataTable, 상세 모달, 관리자 액션(취소/SMS재발송/비밀번호초기화/잠금해제/재발행) ✅ 완료 (UI+인터랙션)
- [x] 회원 관리 (`/adminmaster/members`) - 통합 검색, 필터 4종(상태/가입일/로그인기간/구매횟수), DataTable(전화번호 마스킹), 상세 모달(회원정보/구매내역/상품권/선물 탭), 상태 변경, CSV 내보내기 ✅ 완료
- [x] 상품권 관리 (`/adminmaster/products`) - CRUD, 카테고리 관리, 이미지 업로드, 필터 5종, 품절 자동 표시 ✅ 완료
- [x] 핀 번호 관리 (`/adminmaster/pins`) - 개별/CSV 등록, 재고 현황 Stat Cards, 필터 4종, DataTable, 핀 번호 마스킹 ✅ 완료
- [x] 선물 이력 (`/adminmaster/gifts`) - 통합 검색, 필터 4종, DataTable, 상세 펼치기(바우처 코드 연결+연락처), CSV 내보내기 ✅ 완료
- [x] 취소/환불 관리 (`/adminmaster/refunds`) - 통합 검색, 필터 5종, 요약 Stat Cards, DataTable, 상세 펼치기, 환불 재시도, CSV 내보내기 ✅ 완료
- [x] 관리자 공통 컴포넌트 (DataTable, SearchFilterPanel, CsvExport, DateRangePicker, NumberRange, MultiSelect) ✅ 완료
- [ ] 선물 바우처 체인 추적 (source_voucher_code로 A→B→C 이동 경로 역추적 + UI) — 백엔드 연동 시 구현
- [x] CSV 내보내기 (주문, 회원, 핀, 선물, 취소/환불) ✅ 완료

#### 릴리즈 기준 (Definition of Done)

- 빌드 및 린트 통과
- 관리자가 모든 데이터를 검색/필터/조회 가능
- 관리자 주문 취소, SMS 재발송 동작
- 핀 번호 개별/CSV 등록 동작
- CSV 내보내기 동작
- **MVP v1.0 전체 기능 완료**

---

### Phase 5: GNB 확장 + 이용안내·고객센터·약관

**목표:** GNB 메뉴 확장 및 이용안내/고객센터/약관 정책 페이지 구현
**예상 기간:** 2주

#### 포함 기능

- [x] GNBHeader 컴포넌트 — 이용안내·고객센터 드롭다운, 모바일 햄버거 메뉴 확장 ✅ 완료
- [x] Footer 컴포넌트 — 4컬럼 구조 업데이트 ✅ 완료
- [x] 이용방법 페이지 (`/guide`) ✅ 완료
- [x] 선물하기 안내 페이지 (`/guide/gift`) ✅ 완료
- [x] FAQ 페이지 (`/support/faq`) — 카테고리 필터 + 아코디언 ✅ 완료
- [x] 공지사항 목록·상세 페이지 (`/support/notice`, `/support/notice/[id]`) ✅ 완료
- [x] 이용약관 페이지 (`/terms`) ✅ 완료
- [x] 개인정보처리방침 페이지 (`/privacy`) ✅ 완료
- [x] 환불/취소 정책 페이지 (`/refund-policy`) ✅ 완료
- [x] DB 스키마 추가 (faqs, notices) + RLS 정책 + 시드 데이터 ✅ 완료
- [ ] FAQ·공지사항 API 연동 + 더미→실제 교체
- [x] 관리자 FAQ·공지사항 관리 UI ✅ 완료
- [ ] 관리자 카테고리 관리 UI — 독립 페이지 분리
- [x] 모바일 검색 모달 기능 구현 — 검색 실행 + 최근 검색어 ✅ 완료

#### 릴리즈 기준 (Definition of Done)

- 빌드 및 린트 통과
- GNB/Footer에서 이용안내·고객센터·약관 링크 정상 동작
- FAQ 카테고리 필터, 공지사항 목록/상세 정상 표시
- 관리자 FAQ·공지사항 CRUD 동작
- 모바일 검색 모달 실행 + 최근 검색어 저장/표시

---

### 백엔드 연동 작업 순서 (Phase 횡단)

> 모든 UI 태스크 완료 후, Phase 구분 없이 아래 순서대로 백엔드 연동을 진행한다.

| 순서 | 태스크 | 작업 내용 | 상태 |
|------|--------|-----------|------|
| 1 | P1-017 | Supabase 클라이언트 설정 | ✅ 완료 |
| 2 | P1-018 | Supabase Auth 연동 | ✅ 완료 |
| 2.5 | P1-021 | 사용자 인증 API (`/api/auth/me`, login, logout) | ✅ 완료 |
| 3 | P1-019 | 상품/카테고리 API + mock→DB 교체 | ✅ 완료 |
| 4 | P2-019 | 핀 암호화 유틸 | ✅ 완료 |
| 5 | P2-017 | 주문 생성 + 핀 배정 + 바우처 생성 | ✅ 완료 |
| 6 | P2-018 | 바우처 API 연동 | ✅ 완료 |
| 7 | P2-020 | SMS 연동 | ✅ 완료 |
| 8 | P2-021 | 결제취소 API (PG stub) | ✅ 완료 |
| 9 | P2-022 | 수수료 별도 결제 (PG stub) | ✅ 완료 |
| 10 | P3-011 | DB 스키마 추가 (gifts, cancellations) + RLS | ✅ 완료 |
| 11 | P3-012 | 선물하기 API (바우처 이전 + SMS) | ✅ 완료 |
| 12 | P3-013 | 마이페이지 API 연동 + mock→실제 교체 | ✅ 완료 |
| 13 | P3-014 | 회원 검색 API + 프로필 수정 API | ✅ 완료 |
| 13.5 | P3-015 | 관리자 회원 직접 추가 (API + UI) | ✅ 완료 |
| 14 | P4-013 | 관리자 인증 (IP 화이트리스트 + 세션 쿠키) | ✅ 완료 |
| 15 | P4-014 | 관리자 대시보드 API | ✅ 완료 |
| 16 | P4-015 | 관리자 주문 API | ✅ 완료 |
| 17 | P4-016 | 관리자 회원 API | ✅ 완료 |
| 18 | P4-017 | 관리자 상품/카테고리 CRUD API | ✅ 완료 |
| 19 | P4-018 | 관리자 핀 등록 API (개별 + CSV) | ✅ 완료 |
| 20 | P4-019 | 관리자 선물/취소환불 API | ✅ 완료 |
| 21 | P4-020 | 관리자 CSV 내보내기 | ✅ 완료 |
| 22 | P4-021 | 관리자 주문관리 UI ↔ API 연동 | ✅ 완료 |
| 23 | P4-022 | 관리자 회원관리 UI ↔ API 연동 | ✅ 완료 |
| 24 | P4-023 | 관리자 상품관리 UI ↔ API 연동 | ✅ 완료 |
| 25 | P4-024 | 관리자 UI ↔ API 연동 (핀관리) | ✅ 완료 |
| 26~27 | P4-025~026 | 관리자 UI ↔ API 연동 (선물이력/취소환불) | ✅ 완료 |
| 28 | P4-027 | 핀 재고 DB View 전환 (메모리 카운팅 → DB 집계) | ✅ 완료 |
| 29 | P4-028 | 관리자 상품 목록 서버사이드 페이지네이션 전환 | ✅ 완료 |
| 30 | P5-010 | DB 스키마 (faqs, notices) + 시드 | ✅ |
| 31 | P5-011 | FAQ·공지사항 API 연동 | ✅ |
| 32 | P2-016 | MainPay PG 결제 연동 + stub 교체 | ✅ 완료 |
| 33 | P6-001 | 결제 세션 기반 금액 검증 | ✅ 완료 |
| 34 | P6-002 | 결제 승인 + 주문 생성 서버 통합 | ✅ 완료 |
| 35 | P6-003 | 수수료 결제 API 인증/권한 검증 강화 | ✅ 완료 |
| 36 | P6-004 | 수수료 결제 핀 전달 상태 전이 원자성 (RPC) | ✅ 완료 |
| — | P1-020 | 본인인증 (다날) | 🚫 계약 완료 후 |

---

### Post-MVP: 확장

**목표:** 사용자 경험 강화 및 비즈니스 확장
**예상 기간:** 미정

#### 포함 기능

- [ ] 소셜 로그인 (카카오, 네이버, 구글)
- [ ] 장바구니 기능
- [ ] 쿠폰/프로모션 시스템
- [ ] 다국어 지원
- [ ] 네이티브 앱 (iOS/Android)
- [ ] 관리자 권한 분리 (슈퍼관리자/일반관리자)
- [ ] B2B 대량 구매 기능
- [ ] 통계/리포트 고도화 (BI 연동)
- [ ] 다크모드

#### 릴리즈 기준 (Definition of Done)

- 각 기능별 별도 릴리즈 기준 수립

---

## 14. 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 워너페이먼츠 SDK 문서 부족 또는 테스트 환경 제한 | 높음 | 사전에 테스트 가맹점 발급, 샌드박스 환경 확보. 문서 부족 시 기술지원 요청 |
| 핀 번호 암호화 키 유출 | 높음 | 환경 변수 분리, 서버 사이드 전용, Vercel 시크릿 관리, 키 로테이션 절차 수립 |
| 알리고 SMS 발송 실패/지연 | 중간 | 3회 자동 재시도, 실패 로그 기록, 관리자 재발송 기능으로 보완 |
| Supabase 무료 티어 제한 (DB 크기, API 호출) | 중간 | 초기 Pro 플랜 사용 검토, DB 사이즈 모니터링, 불필요한 로그 정리 정책 |
| 20분 타이머 서버-클라이언트 시간 불일치 | 중간 | 서버 기준 `temp_password_expires_at` 사용, 클라이언트는 잔여 시간만 계산, NTP 의존하지 않음 |
| PG 결제 취소 API 실패 (네트워크/PG 장애) | 중간 | refund_status로 상태 추적, 관리자 수동 재시도, PG사 장애 시 고객 안내 |
| 본인인증 서비스 연동 (다날) | 중간 | 다날과 계약 진행 중. 계약 완료 후 팝업 연동 방식으로 구현 예정 |
| 동시 주문으로 인한 핀 중복 배정 | 높음 | DB 트랜잭션 + `SELECT ... FOR UPDATE`로 핀 배정 시 락 처리 |
| CSV 대량 등록 시 타임아웃 | 낮음 | 청크 단위 처리 (100개씩), 프로그레스 표시, 실패 건 리포트 |
