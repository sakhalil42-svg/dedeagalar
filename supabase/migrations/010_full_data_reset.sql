-- ══════════════════════════════════════════════════════════
-- 010: DEDEAĞALAR GRUP — Tam Veri Sıfırlama
-- ══════════════════════════════════════════════════════════
-- Tüm işlem verileri silinir.
-- Korunan: feed_types, warehouses, seasons, profiles, carriers
--
-- ⚠️  BU İŞLEM GERİ ALINAMAZ!
-- ⚠️  Supabase Storage'daki fotoğraflar ayrıca silinmelidir.
-- ══════════════════════════════════════════════════════════

-- Sıra: önce bağımlı (child) tablolar, sonra parent tablolar

-- 1. Audit log (işlem geçmişi)
TRUNCATE audit_log CASCADE;

-- 2. Account transactions (hesap hareketleri)
TRUNCATE account_transactions CASCADE;

-- 3. Carrier transactions (nakliyeci hareketleri)
TRUNCATE carrier_transactions CASCADE;

-- 4. Checks (çek/senet)
TRUNCATE checks CASCADE;

-- 5. Payments (ödemeler)
TRUNCATE payments CASCADE;

-- 6. Deliveries (sevkiyatlar)
TRUNCATE deliveries CASCADE;

-- 7. Sales (satışlar)
TRUNCATE sales CASCADE;

-- 8. Purchases (alımlar)
TRUNCATE purchases CASCADE;

-- 9. Inventory movements (stok hareketleri)
TRUNCATE inventory_movements CASCADE;

-- 10. Inventory (stok)
TRUNCATE inventory CASCADE;

-- 11. Vehicles (araçlar)
TRUNCATE vehicles CASCADE;

-- 12. Accounts (cari hesaplar)
TRUNCATE accounts CASCADE;

-- 13. Contacts (kişiler — en son, diğerleri buna bağlı)
TRUNCATE contacts CASCADE;

-- ══════════════════════════════════════════════════════════
-- KORUNAN TABLOLAR (SİLİNMEZ):
-- ──────────────────────────────────────────────────────────
--   feed_types      — Yem türleri (Yonca, Saman, Silaj…)
--   warehouses      — Depolar
--   seasons         — Sezonlar
--   carriers        — Nakliyeciler (istenirse ayrıca silinir)
--   profiles        — Kullanıcı profilleri
--   auth.users      — Supabase Auth kullanıcıları
-- ══════════════════════════════════════════════════════════

-- NOT: Supabase Storage'daki fotoğraflar (kantar fişleri vb.)
-- bu SQL ile SİLİNMEZ. Dashboard > Storage > ilgili bucket
-- üzerinden manuel temizlenmeli.
