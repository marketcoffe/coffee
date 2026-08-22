-- Sincronizar valores de store_config con los defaults del codigo
-- Soluciona el problema de colores rosa y banners de Unsplash que persisten
-- aunque se hayan actualizado los DEFAULT del schema

UPDATE store_config SET
    -- Identidad
    site_nombre = 'Market Coffee Sweet',
    direccion_fisica = 'Av. Principal El Trigal, justo al frente de Patio Trigal, Valencia, Carabobo',
    tienda_lat = 10.218500,
    tienda_lng = -68.002100,

    -- Logo
    logo_url = '/logo.png',

    -- Colores (el cambio principal: rosa -> cafe, naranja -> verde)
    theme_color = '#6E472A',
    secondary_color = '#A4D045',

    -- Banners: rutas locales en vez de URLs de Unsplash
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

    -- Categorias: las 18 actuales del codigo
    categories = ARRAY['Bebidas', 'Carnicería', 'Charcutería', 'Charcutería y Embutidos', 'Combos Familiares', 'Comida Rapida', 'Frutas y Verduras', 'Higiene Personal', 'Hogar', 'Lácteos', 'Licores', 'Limpieza', 'Mascotas', 'Panaderia', 'Dulces y Postres', 'Salsas y Condimentos', 'Snacks y Frituras', 'Viveres'],

    -- Delivery
    entrega_por_zonas = TRUE,
    costo_delivery_km = 1.50,
    delivery_zonas = '[{"id": "z1", "name": "El Trigal (0-3 km)", "cost": 2.00, "minKm": 0, "maxKm": 3}, {"id": "z2", "name": "La Trigaleña / Prebo (3-8 km)", "cost": 4.50, "minKm": 3, "maxKm": 8}, {"id": "z3", "name": "La Viña / Mañongo / Naguanagua / San Diego (8-18 km)", "cost": 7.00, "minKm": 8, "maxKm": 18}]',

    -- Textos
    mensaje_bienvenida = 'Tu minimarket de confianza, panadería, comida rápida de la buena y víveres para resolver el mercado.',
    hero_cta_text = 'Descargar la app',
    hero_cta_url = '#download-app',

    -- SEO
    seo_home_title = 'Market Coffee Sweet | Panadería, Comida Rápida y Víveres en Valencia',
    seo_home_description = 'Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida (hamburguesas, shawarmas, perros calientes), víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.',
    seo_home_keywords = 'panadería, comida rápida, hamburguesas, shawarmas, víveres, delivery, Valencia, El Trigal, Prebo, La Viña, Mañongo, Naguanagua, San Diego, minimarket, pan fresco, agua potable',
    seo_catalog_title = 'Catálogo de Productos',
    seo_catalog_description = 'Explora nuestro catálogo completo: panadería fresca, comida rápida, víveres, frutas, verduras, bebidas y más con delivery en Valencia y alrededores.',
    jsonld_type = 'FastFoodRestaurant',
    jsonld_servesCuisine = ARRAY['Panadería', 'Comida Rápida', 'Hamburguesas', 'Shawarma', 'Víveres', 'Bebidas']
WHERE id = 1;
