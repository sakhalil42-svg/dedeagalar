-- ══════════════════════════════════════════════════════════
-- 012: Profiles RLS infinite recursion düzeltmesi
-- ══════════════════════════════════════════════════════════
-- 011'deki profiles_select policy'si admin kontrolü için
-- profiles tablosunu sorguluyor → bu da aynı policy'den geçiyor
-- → infinite recursion hatası.
--
-- Çözüm: SECURITY DEFINER fonksiyon ile RLS bypass eden
-- admin kontrol fonksiyonu oluştur.
-- ══════════════════════════════════════════════════════════


-- 1. RLS'i bypass eden admin kontrol fonksiyonu
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- 2. SELECT policy'sini düzelt (recursion kaldır)
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  USING (
    (select auth.uid()) = id
    OR
    (select public.is_admin())
  );


-- 3. UPDATE policy — kendi profili + admin herkesi güncelleyebilir
DROP POLICY IF EXISTS own_profile_update ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (
    (select auth.uid()) = id
    OR
    (select public.is_admin())
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR
    (select public.is_admin())
  );
