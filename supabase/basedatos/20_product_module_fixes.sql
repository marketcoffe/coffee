-- =============================================================
-- 20. MIGRACIÓN: Correcciones del módulo de productos
-- PROPÓSITO: parches de seguridad y consistencia para tablas pre-existentes
-- FECHA: 2026-08-24
-- NOTA: Ejecutar una sola vez sobre la base de datos existente.
--       Es idempotente: puede ejecutarse múltiples veces sin errores.
-- =============================================================

-- 1) Agregar columna 'descripcion_completa' si no existe
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'descripcion_completa'
    ) THEN
        ALTER TABLE products ADD COLUMN descripcion_completa TEXT DEFAULT '';
        RAISE NOTICE 'Columna descripcion_completa agregada a products';
    ELSE
        RAISE NOTICE 'Columna descripcion_completa ya existe en products';
    END IF;
END $$;

-- 2) Revocar INSERT de anon en products (solo authenticated puede insertar)
--    Esto es seguro porque la política RLS "Allow admin changes to catalog"
--    ya requiere authenticated + is_admin_or_operator().
REVOKE INSERT ON products FROM anon;
DO $$ BEGIN
    RAISE NOTICE 'INSERT revocado de role anon en tabla products';
END $$;

-- 3) Policy de storage: usuarios_select_own con fallback admin
--    (ya aplicado en 07_storage_imagenes_archivos.sql, reproducido aquí por si se ejecuta primero)
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
DO $$ BEGIN
    RAISE NOTICE 'Policy usuarios_select_own actualizada con fallback admin';
END $$;
