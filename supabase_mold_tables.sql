-- 금형현황 테이블 생성
CREATE TABLE IF NOT EXISTS mold_status_data (
  id BIGSERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 금형수리현황 테이블 생성
CREATE TABLE IF NOT EXISTS mold_repair_data (
  id BIGSERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_mold_status_data_created_at ON mold_status_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mold_repair_data_created_at ON mold_repair_data(created_at DESC);

-- JSONB 필드 인덱스 (자주 검색하는 필드)
CREATE INDEX IF NOT EXISTS idx_mold_status_mold_no ON mold_status_data ((data->>'금형번호'));
CREATE INDEX IF NOT EXISTS idx_mold_repair_mold_no ON mold_repair_data ((data->>'금형번호'));
CREATE INDEX IF NOT EXISTS idx_mold_repair_date ON mold_repair_data ((data->>'수리일자'));

-- RLS(Row Level Security) 정책 설정
ALTER TABLE mold_status_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE mold_repair_data ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자에게 읽기/쓰기 권한 부여
CREATE POLICY "Enable read access for authenticated users" ON mold_status_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON mold_status_data
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON mold_status_data
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON mold_status_data
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON mold_repair_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON mold_repair_data
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON mold_repair_data
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON mold_repair_data
  FOR DELETE TO authenticated USING (true);

-- anon 사용자에게도 권한 부여 (필요시)
CREATE POLICY "Enable read access for anon" ON mold_status_data
  FOR SELECT TO anon USING (true);

CREATE POLICY "Enable insert access for anon" ON mold_status_data
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Enable update access for anon" ON mold_status_data
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Enable delete access for anon" ON mold_status_data
  FOR DELETE TO anon USING (true);

CREATE POLICY "Enable read access for anon" ON mold_repair_data
  FOR SELECT TO anon USING (true);

CREATE POLICY "Enable insert access for anon" ON mold_repair_data
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Enable update access for anon" ON mold_repair_data
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Enable delete access for anon" ON mold_repair_data
  FOR DELETE TO anon USING (true);
