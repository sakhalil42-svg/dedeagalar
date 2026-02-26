-- ══════════════════════════════════════════════════════════
-- 004: Carrier Transactions (Nakliyeci Cari Hesap)
-- ══════════════════════════════════════════════════════════

-- Nakliyeci borç/ödeme takibi
CREATE TABLE IF NOT EXISTS carrier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id) NOT NULL,
  type TEXT CHECK (type IN ('freight_charge', 'payment')) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  reference_id UUID, -- delivery id referansı (freight_charge için)
  transaction_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT, -- nakit/havale (sadece payment için)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Carrier bakiye view
CREATE OR REPLACE VIEW v_carrier_balance AS
SELECT
  c.id,
  c.name,
  c.phone,
  COALESCE(SUM(CASE WHEN ct.type = 'freight_charge' THEN ct.amount ELSE 0 END), 0) as total_freight,
  COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE WHEN ct.type = 'freight_charge' THEN ct.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as balance
FROM carriers c
LEFT JOIN carrier_transactions ct ON c.id = ct.carrier_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.phone;

-- RLS
ALTER TABLE carrier_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON carrier_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_carrier_tx_carrier ON carrier_transactions(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_tx_ref ON carrier_transactions(reference_id);
