-- ============================================================
-- 00d. FIX DIRECTO: Sin DO blocks, todo en lineas simples
-- Copiar y pegar TODO de una sola vez en SQL Editor
-- ============================================================

-- Habilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Permisos
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Eliminar TODAS las policies viejas de INSERT/ALL en orders
DROP POLICY IF EXISTS "orders_insert_allow_anon" ON orders;
DROP POLICY IF EXISTS "orders_insert_anon_v2" ON orders;
DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
DROP POLICY IF EXISTS "orders_select_v2" ON orders;
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
DROP POLICY IF EXISTS "orders_update_v2" ON orders;

-- Policy INSERT: cualquiera puede crear pedidos (anon o auth)
CREATE POLICY "orders_insert_v3" ON orders FOR INSERT WITH CHECK (total_usd > 0);

-- Policy SELECT: admin ve todo, cliente ve lo suyo
CREATE POLICY "orders_select_v3" ON orders FOR SELECT USING (
    auth.uid()::text = cliente_uid
    OR public.is_admin_or_operator()
);

-- Policy UPDATE: solo admin
CREATE POLICY "orders_update_v3" ON orders FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- Funciones de rol
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
