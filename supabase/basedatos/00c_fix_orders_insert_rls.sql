-- ============================================================
-- 00c. FIX URGENTE: Permisos INSERT para anon en orders
-- PROBLEMA: El INSERT de anon en orders falla con RLS violation
-- aunque la policy existe. Causa: falta GRANT o policy corrupta.
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- PASO 1: Asegurar que orders tiene RLS habilitado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- PASO 2: Asegurar permisos GRANT para anon
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON store_config, usuarios_clientes TO anon;
GRANT SELECT, INSERT ON orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- PASO 3: Eliminar TODAS las policies INSERT existentes en orders (las que bloquean)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policy 
        WHERE polrelid = 'public.orders'::regclass 
        AND polcmd IN ('a', '*')  -- 'a' = INSERT, '*' = ALL
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON orders', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- PASO 4: Crear policy INSERT limpia para anon (sin TO = todos los roles)
DROP POLICY IF EXISTS "orders_insert_anon_v2" ON orders;
CREATE POLICY "orders_insert_anon_v2" ON orders
    FOR INSERT
    WITH CHECK (
        cliente_nombre IS NOT NULL AND TRIM(cliente_nombre) != ''
        AND cliente_telefono IS NOT NULL AND TRIM(cliente_telefono) != ''
        AND total_usd > 0
    );

-- PASO 5: Policy SELECT (admin puede ver todo, cliente ve lo suyo)
DROP POLICY IF EXISTS "orders_select_v2" ON orders;
CREATE POLICY "orders_select_v2" ON orders
    FOR SELECT USING (
        auth.uid()::text = cliente_uid
        OR public.is_admin_or_operator()
    );

-- PASO 6: Policy UPDATE solo admin
DROP POLICY IF EXISTS "orders_update_v2" ON orders;
CREATE POLICY "orders_update_v2" ON orders
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- PASO 7: Verificar que is_admin() funciona
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text AND a.active = true AND a.role = 'admin'
  ) OR (auth.email() = 'kecho8a@gmail.com');
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text AND a.active = true AND a.role IN ('admin', 'operator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (public.is_admin() OR public.is_operator());
$$;

-- PASO 8: Verificacion
DO $$
BEGIN
    RAISE NOTICE 'FIX COMPLETADO';
    RAISE NOTICE 'Permisos: GRANT INSERT ON orders TO anon aplicado';
    RAISE NOTICE 'RLS: Policy orders_insert_anon_v2 creada';
    RAISE NOTICE 'RLS: Policy orders_select_v2 creada';
    RAISE NOTICE 'RLS: Policy orders_update_v2 creada';
    RAISE NOTICE 'Funciones: is_admin, is_operator, is_admin_or_operator recreadas';
END $$;
