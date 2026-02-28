-- ══════════════════════════════════════════════════════════
-- 006_seasons.sql — Sezon Yönetimi
-- ══════════════════════════════════════════════════════════

-- 1. Seasons tablosu
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_all" ON seasons FOR ALL USING (true) WITH CHECK (true);

-- 2. season_id FK sütunları (5 tablo)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

ALTER TABLE account_transactions
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

ALTER TABLE carrier_transactions
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

-- 3. Indexler
CREATE INDEX IF NOT EXISTS idx_sales_season_id ON sales(season_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_season_id ON deliveries(season_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_season_id ON account_transactions(season_id);
CREATE INDEX IF NOT EXISTS idx_carrier_transactions_season_id ON carrier_transactions(season_id);
CREATE INDEX IF NOT EXISTS idx_checks_season_id ON checks(season_id);
CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON seasons(is_active);
