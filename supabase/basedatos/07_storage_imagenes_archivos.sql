-- ========================================================
-- MÓDULO: STORAGE, IMÁGENES Y ARCHIVOS
-- ARCHIVO: /supabase/basedatos/07_storage_imagenes_archivos.sql
-- PROPÓSITO: Buckets de Supabase Storage, políticas RLS para imágenes/archivos
-- ÚLTIMA REVISIÓN: 2026-08-23
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. BUCKET: settings (Logos, iconos, banners, imágenes de configuración)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('settings', 'settings', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir subida de logos al admin" ON storage.objects;
CREATE POLICY "Permitir subida de logos al admin" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'settings'
    AND public.is_admin_or_operator()
);

DROP POLICY IF EXISTS "Permitir lectura publica de logos" ON storage.objects;
CREATE POLICY "Permitir lectura publica de logos" ON storage.objects
FOR SELECT USING (bucket_id = 'settings');

DROP POLICY IF EXISTS "settings_update_admin" ON storage.objects;
CREATE POLICY "settings_update_admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'settings' AND public.is_admin_or_operator())
WITH CHECK (bucket_id = 'settings' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "settings_delete_admin" ON storage.objects;
CREATE POLICY "settings_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'settings' AND public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. BUCKET: productos (Imágenes de productos del catálogo)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "productos_select_public" ON storage.objects;
CREATE POLICY "productos_select_public" ON storage.objects
FOR SELECT USING (bucket_id = 'productos');

DROP POLICY IF EXISTS "productos_insert_admin" ON storage.objects;
CREATE POLICY "productos_insert_admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'productos' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "productos_update_admin" ON storage.objects;
CREATE POLICY "productos_update_admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'productos' AND public.is_admin_or_operator())
WITH CHECK (bucket_id = 'productos' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "productos_delete_admin" ON storage.objects;
CREATE POLICY "productos_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'productos' AND public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. BUCKET: banners (Imágenes de banners promocionales)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "banners_select_public" ON storage.objects;
CREATE POLICY "banners_select_public" ON storage.objects
FOR SELECT USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "banners_insert_admin" ON storage.objects;
CREATE POLICY "banners_insert_admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "banners_delete_admin" ON storage.objects;
CREATE POLICY "banners_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'banners' AND public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. BUCKET: usuarios (Avatares de perfil de clientes)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('usuarios', 'usuarios', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "usuarios_select_own" ON storage.objects;
CREATE POLICY "usuarios_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'usuarios'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_admin()
    )
);

DROP POLICY IF EXISTS "usuarios_insert_own" ON storage.objects;
CREATE POLICY "usuarios_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'usuarios'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "usuarios_update_own" ON storage.objects;
CREATE POLICY "usuarios_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "usuarios_delete_own" ON storage.objects;
CREATE POLICY "usuarios_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "usuarios_admin_all" ON storage.objects;
CREATE POLICY "usuarios_admin_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'usuarios' AND public.is_admin())
WITH CHECK (bucket_id = 'usuarios' AND public.is_admin());
