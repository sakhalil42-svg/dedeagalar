-- ══════════════════════════════════════════════════════════
-- 008: Fix v_carrier_balance to exclude soft-deleted transactions
-- ══════════════════════════════════════════════════════════

-- The original view (004) didn't filter deleted_at because soft-delete
-- was added later in 005. This caused carrier balances to remain
-- inflated after delivery deletions.

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
LEFT JOIN carrier_transactions ct ON c.id = ct.carrier_id AND ct.deleted_at IS NULL
WHERE c.is_active = true
GROUP BY c.id, c.name, c.phone;
