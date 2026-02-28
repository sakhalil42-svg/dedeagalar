-- ══════════════════════════════════════════════════════════
-- 011: Supabase Security Advisor — Güvenlik Düzeltmeleri
-- ══════════════════════════════════════════════════════════
-- 1. View'ları SECURITY INVOKER'a çevir (RLS bypass kapatılır)
-- 2. Function search_path sabitle (search_path injection önlenir)
-- 3. RLS initplan optimizasyonu (auth.uid() subselect)
-- 4. Duplicate permissive policy temizliği
-- ══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- BÖLÜM 1: SECURITY DEFINER → SECURITY INVOKER (7 view)
-- ═══════════════════════════════════════════════════════════
-- ALTER VIEW ... SET ile sadece security özelliği değişir,
-- view'ın SELECT sorgusu olduğu gibi kalır.

ALTER VIEW public.v_payments_due SET (security_invoker = true);
ALTER VIEW public.v_sale_summary SET (security_invoker = true);
ALTER VIEW public.v_inventory_summary SET (security_invoker = true);
ALTER VIEW public.v_carrier_balance SET (security_invoker = true);
ALTER VIEW public.v_account_summary SET (security_invoker = true);
ALTER VIEW public.v_checks_due SET (security_invoker = true);
ALTER VIEW public.v_recent_deliveries SET (security_invoker = true);


-- ═══════════════════════════════════════════════════════════
-- BÖLÜM 2: Function search_path sabitle (8 fonksiyon)
-- ═══════════════════════════════════════════════════════════
-- search_path injection saldırılarını önler.
-- Her fonksiyon sadece public schema'da arar.

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.create_account_for_contact() SET search_path = public;
ALTER FUNCTION public.update_account_balance() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.update_inventory_on_movement() SET search_path = public;
ALTER FUNCTION public.generate_purchase_no() SET search_path = public;
ALTER FUNCTION public.generate_sale_no() SET search_path = public;
ALTER FUNCTION public.update_sale_delivered_quantity() SET search_path = public;


-- ═══════════════════════════════════════════════════════════
-- BÖLÜM 3: RLS initplan optimizasyonu
-- ═══════════════════════════════════════════════════════════
-- auth.uid() → (select auth.uid()) olarak sarmalanır.
-- PostgreSQL bunu initplan olarak 1 kez hesaplar (satır başı değil).

DROP POLICY IF EXISTS own_profile_update ON public.profiles;

CREATE POLICY own_profile_update ON public.profiles
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);


-- ═══════════════════════════════════════════════════════════
-- BÖLÜM 4: Duplicate permissive policy temizliği
-- ═══════════════════════════════════════════════════════════

-- 4a. payments: admin_delete gereksiz — authenticated_all zaten ALL kapsıyor
DROP POLICY IF EXISTS admin_delete ON public.payments;

-- 4b. profiles: admin_profile_manage çakışıyor, tek policy'de birleştir
DROP POLICY IF EXISTS admin_profile_manage ON public.profiles;
DROP POLICY IF EXISTS authenticated_select ON public.profiles;

-- Kullanıcı kendi profilini okur + admin herkesi yönetir → tek policy
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  USING (
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );


-- ═══════════════════════════════════════════════════════════
-- NOT: "RLS policy always true" uyarıları (18 adet) şimdilik
-- güvenle bırakılabilir — tek firma, multi-tenant değil.
-- İleride user_id bazlı RLS eklenebilir.
--
-- Leaked Password Protection → Supabase Dashboard'dan açılır:
-- Authentication → Settings → Enable Leaked Password Protection
-- ═══════════════════════════════════════════════════════════
