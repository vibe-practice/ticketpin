-- ============================================================
-- FAQs, Notices 테이블 생성
-- P5-010: 고객센터 DB 스키마
-- ============================================================

-- ============================================================
-- 1. faqs (자주 묻는 질문)
-- ============================================================
CREATE TABLE faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(20) NOT NULL CHECK (category IN ('구매', '교환권', '선물', '환불', '계정')),
  question text NOT NULL,
  answer text NOT NULL,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- faqs 인덱스
CREATE INDEX idx_faqs_category_visible ON faqs (category, is_visible);
CREATE INDEX idx_faqs_sort_order ON faqs (sort_order);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. notices (공지사항)
-- ============================================================
CREATE TABLE notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  content text NOT NULL,
  category varchar(20) NOT NULL CHECK (category IN ('일반', '이벤트', '점검')),
  is_important boolean DEFAULT false,
  is_visible boolean DEFAULT true,
  view_count integer DEFAULT 0,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- notices 인덱스
CREATE INDEX idx_notices_category_visible ON notices (category, is_visible);
CREATE INDEX idx_notices_is_important ON notices (is_important) WHERE is_important = true;
CREATE INDEX idx_notices_created_at ON notices (created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

-- faqs: is_visible=true인 항목만 모든 사용자 조회 가능
-- CUD는 관리자 API(service role)에서만 수행 — INSERT/UPDATE/DELETE 정책 없음
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faqs_select_visible" ON faqs
  FOR SELECT
  USING (is_visible = true);

-- notices: is_visible=true인 항목만 모든 사용자 조회 가능
-- CUD는 관리자 API(service role)에서만 수행 — INSERT/UPDATE/DELETE 정책 없음
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices_select_visible" ON notices
  FOR SELECT
  USING (is_visible = true);
