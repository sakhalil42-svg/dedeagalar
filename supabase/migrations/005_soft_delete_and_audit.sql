-- ============================================================
-- Migration 005: Soft Delete + Audit Log
-- ============================================================

-- 1. Soft delete columns
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE carrier_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE checks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted ON deliveries(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_tx_deleted ON account_transactions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_carrier_tx_deleted ON carrier_transactions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checks_deleted ON checks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON payments(deleted_at) WHERE deleted_at IS NULL;

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT CHECK (action IN ('create', 'update', 'delete', 'restore')) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read and write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_all' AND tablename = 'audit_log') THEN
    CREATE POLICY "authenticated_all" ON audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
