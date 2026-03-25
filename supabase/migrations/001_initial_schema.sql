-- ============================================================
-- 티켓매니아 초기 DB 스키마
-- 테이블: users, admin_users, categories, products, pins
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. users (사용자 회원 정보)
-- ============================================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE NOT NULL,
  username varchar(50) UNIQUE NOT NULL,
  email varchar(200) UNIQUE NOT NULL,
  name varchar(50) NOT NULL,
  phone varchar(100) NOT NULL,
  identity_verified boolean DEFAULT false,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  total_purchase_count integer DEFAULT 0,
  total_purchase_amount integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- users 인덱스
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_auth_id ON users (auth_id);
CREATE INDEX idx_users_phone ON users (phone);

-- ============================================================
-- 2. admin_users (관리자 계정)
-- ============================================================
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name varchar(50) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. categories (상품권 카테고리)
-- ============================================================
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  slug varchar(50) UNIQUE NOT NULL,
  icon varchar(50),
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. products (상품권 상품)
-- ============================================================
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  price integer NOT NULL,
  fee_amount integer NOT NULL,
  image_url text,
  description text,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  total_sales integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- products 인덱스
CREATE INDEX idx_products_category_status ON products (category_id, status);

-- ============================================================
-- 5. pins (핀 번호)
-- ============================================================
CREATE TABLE pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  pin_number_encrypted text NOT NULL,
  status varchar(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'consumed')),
  registration_method varchar(20) DEFAULT 'manual' CHECK (registration_method IN ('manual', 'csv')),
  assigned_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- pins 인덱스
CREATE INDEX idx_pins_product_status ON pins (product_id, status);

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

-- users: 본인 정보만 조회 가능
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = auth_id);

-- admin_users: 클라이언트 직접 접근 불가
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- (정책 없음 = anon/authenticated 모두 접근 불가, service role만 가능)

-- categories: 모든 사용자 조회 가능
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all" ON categories
  FOR SELECT
  USING (is_visible = true);

-- products: 모든 사용자 조회 가능
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_all" ON products
  FOR SELECT
  USING (true);

-- pins: 클라이언트 직접 접근 불가 (API Routes 경유)
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
-- (정책 없음 = anon/authenticated 모두 접근 불가, service role만 가능)
