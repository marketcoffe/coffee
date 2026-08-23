-- ========================================================
-- MÓDULO: HELPERS Y MIGRACIONES
-- ARCHIVO: /supabase/basedatos/08_helpers_migraciones.sql
-- PROPÓSITO: Funciones helper para migraciones idempotentes, utilidades del sistema
-- ÚLTIMA REVISIÓN: 2026-08-23
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. RPC: Agregar columna si no existe (migración idempotente)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_column_if_not_exists(
    p_table TEXT, p_column TEXT, p_type TEXT
) RETURNS VOID
SET search_path = public
AS $func$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
    ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. RPC: Verificar si una tabla existe
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_exists(p_table_name TEXT)
RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = p_table_name
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: Obtener número de filas de una tabla
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimate_row_count(p_table_name TEXT)
RETURNS BIGINT
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count BIGINT;
BEGIN
    EXECUTE format('SELECT COUNT(*) FROM public.%I', p_table_name) INTO v_count;
    RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Función: Actualizar timestamp updated_at automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_store_config_updated_at ON store_config;
CREATE TRIGGER update_store_config_updated_at
    BEFORE UPDATE ON store_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
