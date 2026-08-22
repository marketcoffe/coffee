-- Agregar columnas de titulos, descripciones y CTAs para banners
-- y hero_cta_url para el enlace del boton hero

ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_titles TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_descriptions TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_cta_texts TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS banner_cta_urls TEXT[] DEFAULT ARRAY['', '', '']::TEXT[];
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS hero_cta_url TEXT DEFAULT '';

-- Ahora si actualizar los valores
UPDATE store_config SET
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
    hero_cta_text = 'Descargar la app',
    hero_cta_url = '#download-app'
WHERE id = 1;
