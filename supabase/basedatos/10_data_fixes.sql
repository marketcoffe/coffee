-- ========================================================
-- MÓDULO: DATA FIXES (CORRECCIONES DE DATOS)
-- ARCHIVO: /supabase/basedatos/10_data_fixes.sql
-- PROPÓSITO: Correcciones de datos de producción (esquema, teléfonos, defaults, banners, sedes)
-- ÚLTIMA REVISIÓN: 2026-08-23
-- NOTA: Estos scripts son idempotent (solo actúan si el dato/esquema falta)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. FIX: Teléfono principal del negocio
-- El número correcto es 0412-4058904 -> +584124058904
-- ----------------------------------------------------------------------------
UPDATE public.store_config
SET telefono_soporte = '+584124058904'
WHERE id = 1
  AND (telefono_soporte IS NULL OR telefono_soporte = '' OR telefono_soporte LIKE '%4976451%');

-- Sede principal: alinear teléfono/whatsapp
UPDATE public.store_config
SET sedes = (
  SELECT jsonb_agg(
    CASE
      WHEN (sede->>'es_principal')::boolean
        THEN jsonb_set(
               jsonb_set(
                 sede,
                 '{telefono}',
                 to_jsonb('+584124058904'::text),
                 true
               ),
               '{whatsapp_numero}',
               to_jsonb('+584124058904'::text),
               true
             )
      ELSE sede
    END
  )
  FROM jsonb_array_elements(store_config.sedes) AS sede
)
WHERE id = 1
  AND sedes IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(store_config.sedes) s
    WHERE (s->>'es_principal')::boolean
      AND (s->>'telefono' LIKE '%4976451%' OR COALESCE(s->>'whatsapp_numero','') LIKE '%4976451%')
  );

-- Textos de pago: reemplazar número viejo
UPDATE public.store_config
SET pagomovil_data = replace(pagomovil_data, '0412-4976451', '0412-4058904')
WHERE id = 1 AND pagomovil_data LIKE '%4976451%';

UPDATE public.store_config
SET transferencia_data = replace(transferencia_data, '0412-4976451', '0412-4058904')
WHERE id = 1 AND transferencia_data LIKE '%4976451%';

UPDATE public.store_config
SET zelle_data = replace(zelle_data, '0412-4976451', '0412-4058904')
WHERE id = 1 AND zelle_data LIKE '%4976451%';

-- ----------------------------------------------------------------------------
-- 2. SYNC: Defaults de store_config con el código
-- Sincroniza colores, banners, categorías, delivery, SEO
-- ----------------------------------------------------------------------------
UPDATE store_config SET
    site_nombre = 'Market Coffee Sweet',
    direccion_fisica = 'Av. Principal El Trigal, justo al frente de Patio Trigal, Valencia, Carabobo',
    tienda_lat = 10.218500,
    tienda_lng = -68.002100,
    logo_url = '/logo.png',
    theme_color = '#6E472A',
    secondary_color = '#A4D045',
    banner_url_1 = '/imagen/descarga_app.webp',
    banner_url_2 = '/imagen/combo-banner.webp',
    banner_url_3 = '/imagen/panaderia_pc.webp',
    banner_url_1_mobile = '/imagen/descarga_appmovil.webp',
    banner_url_2_mobile = '/imagen/combos_movil.webp',
    banner_url_3_mobile = '/imagen/panaderia_movil.webp',
    banner_texts = ARRAY['', 'Combos Especiales para ti', 'Pan Artesanal Fresco'],
    banner_titles = ARRAY['', 'Combos Especiales para ti', 'Pan Artesanal Fresco'],
    banner_descriptions = ARRAY['', 'Ahorra más comprando en combo, ofertas listas para toda ocasión', 'Pan fresco, tortas, dulces y pastelería del día'],
    banner_cta_texts = ARRAY['', 'Ver combos', ''],
    banner_cta_urls = ARRAY['', '/catalog', ''],
    categories = ARRAY['Bebidas', 'Carnicería', 'Charcutería', 'Charcutería y Embutidos', 'Combos Familiares', 'Comida Rapida', 'Frutas y Verduras', 'Higiene Personal', 'Hogar', 'Lácteos', 'Licores', 'Limpieza', 'Mascotas', 'Panaderia', 'Dulces y Postres', 'Salsas y Condimentos', 'Snacks y Frituras', 'Viveres'],
    entrega_por_zonas = TRUE,
    costo_delivery_km = 1.50,
    delivery_zonas = '[{"id": "z1", "name": "Trigal / Prebo / Chimeneas", "cost": 1.00, "minKm": 0, "maxKm": 3}, {"id": "z2", "name": "Mañongo / Trigaleña / Naguanagua / Av Bolívar", "cost": 2.00, "minKm": 3, "maxKm": 7}, {"id": "z3", "name": "San Diego / Otras zonas", "cost": 3.00, "minKm": 7, "maxKm": 18}]',
    mensaje_bienvenida = 'Tu minimarket de confianza, panadería, comida rápida de la buena y víveres para resolver el mercado.',
    hero_cta_text = 'Descargar la app',
    hero_cta_url = '#download-app',
    seo_home_title = 'Market Coffee Sweet | Panadería, Comida Rápida y Víveres en Valencia',
    seo_home_description = 'Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida (hamburguesas, shawarmas, perros calientes), víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.',
    seo_home_keywords = 'panadería, comida rápida, hamburguesas, shawarmas, víveres, delivery, Valencia, El Trigal, Prebo, La Viña, Mañongo, Naguanagua, San Diego, minimarket, pan fresco, agua potable',
    seo_catalog_title = 'Catálogo de Productos',
    seo_catalog_description = 'Explora nuestro catálogo completo: panadería fresca, comida rápida, víveres, frutas, verduras, bebidas y más con delivery en Valencia y alrededores.',
    jsonld_type = 'FastFoodRestaurant',
    jsonld_servesCuisine = ARRAY['Panadería', 'Comida Rápida', 'Hamburguesas', 'Shawarma', 'Víveres', 'Bebidas'],
    push_webhook_url = 'https://marketcoffesweet.com/api/push-notify'
WHERE id = 1;

-- ----------------------------------------------------------------------------
-- 3. FIX: Columnas de sedes (multi-sucursal)
-- Asegurar que existan las columnas sedes y multi_sucursal_enabled
-- ----------------------------------------------------------------------------
ALTER TABLE public.store_config ADD COLUMN IF NOT EXISTS sedes JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.store_config ADD COLUMN IF NOT EXISTS multi_sucursal_enabled BOOLEAN DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 4. FIX: Columnas de banners (títulos, descripciones, CTAs)
-- ----------------------------------------------------------------------------
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_titles TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_descriptions TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_cta_texts TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_cta_urls TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS hero_cta_url TEXT DEFAULT '';

-- ----------------------------------------------------------------------------
-- 5. FIX: Bucket de Storage 'productos' 
-- NOTA: Este bucket se crea en 07_storage_imagenes_archivos.sql
-- Solo mantener la configuracion de settings si es necesario
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = true, file_size_limit = NULL, allowed_mime_types = NULL
WHERE id = 'productos';

-- ----------------------------------------------------------------------------
-- 6. FIX: Asegurar que el admin exista en admin_users (requerido por RLS de Storage)
-- Sin esto, is_admin_or_operator() retorna false y los uploads fallan con 400
-- ----------------------------------------------------------------------------
INSERT INTO admin_users (id, email, nombre, role, active)
SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', 'Admin'), 'admin', true
FROM auth.users
WHERE email = 'kecho8a@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', active = true;

-- ----------------------------------------------------------------------------
-- 7. FIX: Columnas faltantes en products (disponibilidad, combo_ids)
-- Sincroniza el esquema real de producción con el tipo TypeScript FoodItem
-- Ejecutar después de 02_tienda_productos_inventario.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS disponibilidad TEXT NOT NULL DEFAULT 'Disponible';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS combo_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ----------------------------------------------------------------------------
-- 8. FIX: Migrar IDs no-UUID de products a UUIDs válidos
-- Los IDs tipo 'p1_012', 'prod_0071' rompen los UPDATE/DELETE en Supabase.
-- Este script genera UUIDs nuevos, actualiza todas las FK y reemplaza el PK.
-- SCRIPT IDEMPOTENTE: seguro de ejecutar múltiples veces.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  new_id UUID;
  bad_count INTEGER;
BEGIN
  SELECT count(*) INTO bad_count FROM public.products
    WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF bad_count = 0 THEN
    RAISE NOTICE 'No hay IDs no-UUID. Nada que migrar.';
    RETURN;
  END IF;

  RAISE NOTICE 'Encontrados % productos con IDs no-UUID. Migrando...', bad_count;

  -- Crear tabla temporal de mapeo old_id -> new_uuid
  CREATE TEMP TABLE IF NOT EXISTS _id_migration (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL DEFAULT gen_random_uuid()
  ) ON COMMIT DROP;

  INSERT INTO _id_migration (old_id)
  SELECT id::text FROM public.products
  WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ON CONFLICT (old_id) DO NOTHING;

  -- Actualizar FK: food_item_options.food_item_id
  UPDATE public.food_item_options foi
  SET food_item_id = m.new_id
  FROM _id_migration m
  WHERE foi.food_item_id::text = m.old_id;

  -- Actualizar FK: flash_sales.product_id
  UPDATE public.flash_sales fs
  SET product_id = m.new_id
  FROM _id_migration m
  WHERE fs.product_id::text = m.old_id;

  -- Actualizar FK: promotions.product_id
  UPDATE public.promotions pr
  SET product_id = m.new_id
  FROM _id_migration m
  WHERE pr.product_id::text = m.old_id;

  -- Actualizar FK: product_reviews.product_id
  UPDATE public.product_reviews pr
  SET product_id = m.new_id
  FROM _id_migration m
  WHERE pr.product_id::text = m.old_id;

  -- Actualizar FK: reward_catalog.product_id (sin constraint formal)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reward_catalog') THEN
    UPDATE public.reward_catalog rc
    SET product_id = m.new_id
    FROM _id_migration m
    WHERE rc.product_id::text = m.old_id;
  END IF;

  -- Actualizar FK: loyalty_rewards.product_id (sin constraint formal)
  -- Solo si la tabla existe (se crea en archivo 15)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='loyalty_rewards') THEN
    UPDATE public.loyalty_rewards lr
    SET product_id = m.new_id
    FROM _id_migration m
    WHERE lr.product_id::text = m.old_id;
  END IF;

  -- Ahora actualizar el PK de products
  -- PostgreSQL permite UPDATE de PK si no hay FK circulares activos
  FOR rec IN SELECT old_id, new_id FROM _id_migration LOOP
    UPDATE public.products SET id = rec.new_id WHERE id::text = rec.old_id;
  END LOOP;

  RAISE NOTICE 'Migración completada. % productos actualizados.', bad_count;
END $$;
