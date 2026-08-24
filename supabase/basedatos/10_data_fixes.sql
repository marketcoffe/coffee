-- ========================================================
-- MÓDULO: DATA FIXES (CORRECCIONES DE DATOS)
-- ARCHIVO: /supabase/basedatos/10_data_fixes.sql
-- PROPÓSITO: Correcciones de datos de producción (teléfono, defaults, banners, sedes)
-- ÚLTIMA REVISIÓN: 2026-08-23
-- NOTA: Estos UPDATE son idempotentes (solo actúan si los datos están desactualizados)
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
    delivery_zonas = '[{"id": "z1", "name": "El Trigal (0-3 km)", "cost": 2.00, "minKm": 0, "maxKm": 3}, {"id": "z2", "name": "La Trigaleña / Prebo (3-8 km)", "cost": 4.50, "minKm": 3, "maxKm": 8}, {"id": "z3", "name": "La Viña / Mañongo / Naguanagua / San Diego (8-18 km)", "cost": 7.00, "minKm": 8, "maxKm": 18}]',
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
-- 5. FIX: Bucket de Storage 'productos' (faltaba en producción)
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
-- 6. FIX: Asegurar que el admin exista en admin_users (requerido por RLS de Storage)
-- Sin esto, is_admin_or_operator() retorna false y los uploads fallan con 400
-- ----------------------------------------------------------------------------
INSERT INTO admin_users (id, email, nombre, role, active)
SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', 'Admin'), 'admin', true
FROM auth.users
WHERE email = 'kecho8a@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', active = true;

-- ----------------------------------------------------------------------------
-- 7. FIX: Configurar bucket 'productos' con settings correctos
-- file_size_limit NULL = sin límite, allowed_mime_types NULL = todos los tipos
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = true, file_size_limit = NULL, allowed_mime_types = NULL
WHERE id = 'productos';
