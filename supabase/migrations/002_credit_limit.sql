-- ═══════════════════════════════════════════════════════════
-- Migration: Müşteri Kredi Limiti
-- ═══════════════════════════════════════════════════════════

-- contacts tablosuna kredi limiti kolonu ekle
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT NULL;

-- NULL = limit yok (sınırsız)
-- 0 = peşin çalışır (bakiye biriktirmez)
-- > 0 = belirlenen kredi limiti

COMMENT ON COLUMN contacts.credit_limit IS 'Müşteri kredi limiti. NULL=sınırsız, 0=peşin, >0=limit tutarı';
