-- =============================================================
-- 17. Nueva categoría: Recarga de Agua + Producto Botellón 20L
-- =============================================================

-- 1. Agregar categoría "Recarga de Agua" a store_config (sin duplicar)
UPDATE store_config
SET categories = CASE
    WHEN NOT ('Recarga de Agua' = ANY(categories))
    THEN array_append(categories, 'Recarga de Agua')
    ELSE categories
END
WHERE id = 1;

-- 2. Insertar producto: Botellón de 20L ($0.50)
INSERT INTO products (
    nombre,
    descripcion,
    categoria,
    precio_usd,
    stock,
    imagen_urls,
    es_promo,
    es_nuevo,
    es_mas_vendido,
    delivery_gratis,
    activo,
    ingredientes,
    alergenos,
    disponibilidad
) VALUES (
    'Botellón de 20L',
    'Recarga de agua pura para tu botellón de 20 litros. Limpia y fresca.',
    ARRAY['Recarga de Agua']::TEXT[],
    0.50,
    100,
    ARRAY['/productos-pan/recarga_de_agua.webp']::TEXT[],
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    TRUE,
    ARRAY['Agua pura']::TEXT[],
    ARRAY[]::TEXT[],
    'Disponible'
)
ON CONFLICT DO NOTHING;
