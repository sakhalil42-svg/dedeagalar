-- ══════════════════════════════════════════════════════════
-- 009: Orphaned transaction cleanup + full balance recalc
-- ══════════════════════════════════════════════════════════
--
-- Problem: When deliveries/payments/checks were deleted,
-- their related account_transactions were NOT soft-deleted,
-- leaving orphaned records that inflated account balances.
-- This migration cleans up orphans and recalculates all balances.

-- ─── 1. Supplier transactions: reference_type='purchase', reference_id=delivery_id ───
UPDATE account_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND reference_type = 'purchase'
  AND reference_id IN (
    SELECT id FROM deliveries WHERE deleted_at IS NOT NULL
  );

-- ─── 2. Customer transactions for FULLY deleted sales ───
-- (All deliveries of the sale are deleted → safe to soft-delete all sale transactions)
UPDATE account_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND reference_type = 'sale'
  AND reference_id IN (
    SELECT s.id FROM sales s
    WHERE EXISTS (
      SELECT 1 FROM deliveries d WHERE d.sale_id = s.id AND d.deleted_at IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM deliveries d WHERE d.sale_id = s.id AND d.deleted_at IS NULL
    )
  );

-- ─── 3. Customer transactions for PARTIALLY deleted sales ───
-- For sales where some deliveries were deleted but others remain,
-- we need to trim excess debit transactions.
-- Each active delivery should have exactly 1 active debit transaction.
-- Soft-delete the excess (most recently created first).
DO $$
DECLARE
  sale_rec RECORD;
  active_delivery_count INT;
  active_debit_count INT;
  excess INT;
  tx_id UUID;
BEGIN
  FOR sale_rec IN
    SELECT DISTINCT s.id AS sale_id
    FROM sales s
    WHERE EXISTS (
      SELECT 1 FROM deliveries d WHERE d.sale_id = s.id AND d.deleted_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM deliveries d WHERE d.sale_id = s.id AND d.deleted_at IS NULL
    )
  LOOP
    -- Count active deliveries
    SELECT COUNT(*) INTO active_delivery_count
    FROM deliveries
    WHERE sale_id = sale_rec.sale_id AND deleted_at IS NULL;

    -- Count active debit transactions for this sale
    SELECT COUNT(*) INTO active_debit_count
    FROM account_transactions
    WHERE reference_type = 'sale'
      AND reference_id = sale_rec.sale_id
      AND type = 'debit'
      AND deleted_at IS NULL;

    excess := active_debit_count - active_delivery_count;

    -- Soft-delete excess transactions (most recent first)
    IF excess > 0 THEN
      FOR tx_id IN
        SELECT id FROM account_transactions
        WHERE reference_type = 'sale'
          AND reference_id = sale_rec.sale_id
          AND type = 'debit'
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT excess
      LOOP
        UPDATE account_transactions
        SET deleted_at = NOW()
        WHERE id = tx_id;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ─── 4. Also soft-delete any orphaned REVERSAL credits from old delete logic ───
-- The old code inserted credit reversals. Now that we soft-delete debits,
-- these reversals would double-count. Remove them.
-- They are identifiable by description containing 'Sevkiyat silindi'.
UPDATE account_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND description LIKE 'Sevkiyat silindi%';

-- ─── 5. Payment orphans: deleted payments with active transactions ───
UPDATE account_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND reference_type = 'payment'
  AND reference_id IN (
    SELECT id FROM payments WHERE deleted_at IS NOT NULL
  );

-- ─── 6. Check orphans: deleted checks with active transactions ───
UPDATE account_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND reference_type = 'payment'
  AND reference_id IN (
    SELECT id FROM checks WHERE deleted_at IS NOT NULL
  );

-- ─── 7. Carrier transaction orphans ───
UPDATE carrier_transactions
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND reference_id IN (
    SELECT id FROM deliveries WHERE deleted_at IS NOT NULL
  );

-- ─── 8. Recalculate ALL account balances from active transactions ───
UPDATE accounts SET
  total_debit = COALESCE((
    SELECT SUM(amount) FROM account_transactions
    WHERE account_id = accounts.id AND type = 'debit' AND deleted_at IS NULL
  ), 0),
  total_credit = COALESCE((
    SELECT SUM(amount) FROM account_transactions
    WHERE account_id = accounts.id AND type = 'credit' AND deleted_at IS NULL
  ), 0),
  balance = COALESCE((
    SELECT SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) -
           SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END)
    FROM account_transactions
    WHERE account_id = accounts.id AND deleted_at IS NULL
  ), 0);
