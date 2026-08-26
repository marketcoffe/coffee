-- =============================================================
-- 25. Corregir columna categoria: TEXT → TEXT[]
-- =============================================================
-- Ejecutado: 2026-08-26
-- Resultado: 481 productos migrados, 16 categorías

-- 1. Eliminar índice existente sobre categoria
DROP INDEX IF EXISTS idx_products_categoria;

-- 2. Crear función helper para conversión segura
CREATE OR REPLACE FUNCTION public.text_to_array_safe(p_text text)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  IF p_text LIKE '[%' THEN
    RETURN ARRAY(SELECT jsonb_array_elements_text(p_text::jsonb));
  ELSE
    RETURN ARRAY[p_text];
  END IF;
END;
$$;

-- 3. Agregar columna temporal TEXT[]
ALTER TABLE products ADD COLUMN IF NOT EXISTS categoria_arr TEXT[];

-- 4. Copiar datos convertidos
UPDATE products SET categoria_arr = text_to_array_safe(categoria) WHERE categoria_arr IS NULL;

-- 5. Intercambiar columnas
ALTER TABLE products RENAME COLUMN categoria TO categoria_old;
ALTER TABLE products RENAME COLUMN categoria_arr TO categoria;

-- 6. Configurar columna
ALTER TABLE products ALTER COLUMN categoria SET DEFAULT ARRAY[]::TEXT[];

-- 7. Crear índice GIN
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products USING GIN(categoria);

-- 8. Limpiar función helper
DROP FUNCTION IF EXISTS text_to_array_safe(text);

-- 9. Recrear vistas afectadas
-- (Ejecutar 11_vistas_reportes_kpis.sql completo)

-- NOTA: La columna categoria_old se mantiene temporalmente
-- hasta verificar que no hay dependencias. Puede dropearse con:
-- ALTER TABLE products DROP COLUMN IF EXISTS categoria_old;
