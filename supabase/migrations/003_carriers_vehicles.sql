-- ══════════════════════════════════════════════════════════
-- FAZ 2: Nakliyeci ve Araç Yönetimi
-- ══════════════════════════════════════════════════════════

-- carriers (Nakliyeciler)
CREATE TABLE IF NOT EXISTS carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  phone2 TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON carriers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vehicles (Araçlar)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  carrier_id UUID REFERENCES carriers(id),
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_type TEXT DEFAULT 'tir',
  capacity_ton NUMERIC(8,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
