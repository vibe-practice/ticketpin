-- ============================================================
-- 배너/사이드 배너 테이블 + 카테고리 이미지 필드
-- B-001, B-002, B-003
-- ============================================================

-- ============================================================
-- 1. banners (메인 배너)
-- ============================================================
CREATE TABLE banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_active_sort ON banners (is_active, sort_order);

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. side_banners (사이드 배너)
-- ============================================================
CREATE TABLE side_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  alt_text text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT 'sidebar_top'
    CHECK (position IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_side_banners_active_position ON side_banners (is_active, position, sort_order);

CREATE TRIGGER update_side_banners_updated_at
  BEFORE UPDATE ON side_banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. categories 테이블에 image_url 컬럼 추가
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;

-- ============================================================
-- 4. RLS 정책
-- ============================================================

-- banners: 비인증/인증 사용자 모두 활성 배너 조회 가능
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banners_select_active" ON banners
  FOR SELECT
  USING (is_active = true);

-- side_banners: 비인증/인증 사용자 모두 활성 배너 조회 가능
ALTER TABLE side_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "side_banners_select_active" ON side_banners
  FOR SELECT
  USING (is_active = true);

-- 관리자 CRUD는 service_role key로 RLS 우회하므로 별도 정책 불필요

-- ============================================================
-- 5. Supabase Storage 버킷 (수동 생성 필요 시 참고)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('side-banners', 'side-banners', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('categories', 'categories', true);
--
-- Storage 정책 (public 읽기):
-- CREATE POLICY "public_read_banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
-- CREATE POLICY "public_read_side_banners" ON storage.objects FOR SELECT USING (bucket_id = 'side-banners');
-- CREATE POLICY "public_read_categories" ON storage.objects FOR SELECT USING (bucket_id = 'categories');
