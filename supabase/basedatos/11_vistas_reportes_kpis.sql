-- ========================================================
-- MÓDULO: VISTAS DE REPORTES Y ANALÍTICA
-- ARCHIVO: /supabase/basedatos/11_vistas_reportes_kpis.sql
-- PROPÓSITO: Vistas de dashboard, KPIs, estadísticas de ventas, app y productos
-- ÚLTIMA REVISIÓN: 2026-08-23
-- NOTA: Ejecutar AL FINAL, después de todos los módulos anteriores
-- ========================================================

-- 1. Dashboard summary
CREATE OR REPLACE VIEW public.v_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM orders WHERE status != 'Cancelado') AS total_orders,
    (SELECT COALESCE(SUM(total_usd), 0) FROM orders WHERE status != 'Cancelado') AS total_revenue_usd,
    (SELECT COALESCE(SUM(total_bs), 0) FROM orders WHERE status != 'Cancelado') AS total_revenue_bs,
    (SELECT COUNT(*) FROM usuarios_clientes) AS total_customers,
    (SELECT COUNT(*) FROM products WHERE activo = true) AS active_products,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pendiente') AS pending_orders,
    (SELECT COUNT(*) FROM orders WHERE fecha >= CURRENT_DATE) AS orders_today,
    (SELECT COALESCE(SUM(total_usd), 0) FROM orders WHERE fecha >= CURRENT_DATE AND status != 'Cancelado') AS revenue_today_usd;

-- 2. Ventas por categoría
CREATE OR REPLACE VIEW public.v_sales_by_category AS
SELECT
    p.categoria,
    COUNT(DISTINCT o.id) AS order_count,
    SUM((item->>'cantidad')::int) AS units_sold,
    SUM((item->>'precio_usd')::numeric * (item->>'cantidad')::int) AS total_sales_usd
FROM orders o
CROSS JOIN jsonb_array_elements(o.items) AS item
JOIN products p ON p.id = (item->>'food_id')::uuid
WHERE o.status != 'Cancelado'
GROUP BY p.categoria
ORDER BY total_sales_usd DESC;

-- 3. Top productos más vendidos
CREATE OR REPLACE VIEW public.v_top_products AS
SELECT
    p.id, p.nombre, p.categoria, p.precio_usd, p.stock, p.order_count, p.es_mas_vendido,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM((item->>'cantidad')::int) AS total_units_sold
FROM products p
LEFT JOIN orders o ON o.status != 'Cancelado'
LEFT JOIN jsonb_array_elements(o.items) AS item ON (item->>'food_id')::uuid = p.id
WHERE p.activo = true
GROUP BY p.id, p.nombre, p.categoria, p.precio_usd, p.stock, p.order_count, p.es_mas_vendido
ORDER BY total_units_sold DESC NULLS LAST;

-- 4. Ventas por día (últimos 30 días)
CREATE OR REPLACE VIEW public.v_daily_sales AS
SELECT
    DATE(fecha) AS sale_date,
    COUNT(*) AS order_count,
    COALESCE(SUM(total_usd), 0) AS revenue_usd,
    COALESCE(SUM(total_bs), 0) AS revenue_bs,
    COALESCE(AVG(total_usd), 0) AS avg_order_value
FROM orders
WHERE status != 'Cancelado' AND fecha >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(fecha)
ORDER BY sale_date DESC;

-- 5. Métodos de pago
CREATE OR REPLACE VIEW public.v_payment_methods_stats AS
SELECT
    metodo_pago,
    COUNT(*) AS order_count,
    COALESCE(SUM(total_usd), 0) AS total_usd,
    ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM orders WHERE status != 'Cancelado'), 0) * 100, 1) AS percentage
FROM orders WHERE status != 'Cancelado'
GROUP BY metodo_pago ORDER BY order_count DESC;

-- 6. Clientes frecuentes
CREATE OR REPLACE VIEW public.v_top_customers AS
SELECT
    u.id, u.nombre, u.email, u.telefono, u.loyalty_points, u.loyalty_lifetime_points, u.loyalty_tier_id,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_usd), 0) AS total_spent_usd,
    MAX(o.fecha) AS last_order_date
FROM usuarios_clientes u
LEFT JOIN orders o ON o.cliente_uid = u.id AND o.status != 'Cancelado'
GROUP BY u.id, u.nombre, u.email, u.telefono, u.loyalty_points, u.loyalty_lifetime_points, u.loyalty_tier_id
HAVING COUNT(o.id) > 0
ORDER BY total_orders DESC;

-- 7. Estadísticas de productos
CREATE OR REPLACE VIEW public.v_product_stats AS
SELECT
    p.id, p.nombre, p.categoria, p.precio_usd, p.stock, p.order_count, p.activo, p.es_promo, p.es_nuevo,
    COALESCE(r.review_count, 0) AS review_count,
    COALESCE(r.avg_rating, 0) AS avg_rating,
    CASE WHEN p.stock <= 0 THEN 'out_of_stock' WHEN p.stock <= 5 THEN 'low_stock' ELSE 'in_stock' END AS stock_status
FROM products p
LEFT JOIN (SELECT product_id, COUNT(*) AS review_count, ROUND(AVG(rating), 1) AS avg_rating FROM product_reviews GROUP BY product_id) r ON r.product_id = p.id
ORDER BY p.order_count DESC;

-- 8. Performance de campañas
CREATE OR REPLACE VIEW public.v_campaign_performance AS
SELECT
    c.id, c.name, c.status, c.channel, c.segment_filter, c.title,
    c.total_recipients, c.total_sent, c.total_opened, c.total_clicked, c.total_rate_limited,
    CASE WHEN c.total_sent > 0 THEN ROUND(c.total_opened::numeric / c.total_sent * 100, 1) ELSE 0 END AS open_rate_pct,
    CASE WHEN c.total_sent > 0 THEN ROUND(c.total_clicked::numeric / c.total_sent * 100, 1) ELSE 0 END AS click_rate_pct,
    c.sent_at, c.created_at
FROM campaigns c ORDER BY c.created_at DESC;

-- 9. Tasa de conversión de coupons
CREATE OR REPLACE VIEW public.v_coupon_stats AS
SELECT
    c.id, c.code, c.description, c.coupon_type, c.discount_percent, c.discount_amount,
    c.usage_limit, c.usage_count, c.active, c.valid_until,
    CASE WHEN c.usage_limit IS NOT NULL AND c.usage_limit > 0 THEN ROUND(c.usage_count::numeric / c.usage_limit * 100, 1) ELSE 0 END AS usage_pct,
    CASE WHEN c.valid_until IS NOT NULL AND c.valid_until < NOW() THEN true ELSE false END AS is_expired
FROM coupons c ORDER BY c.usage_count DESC;

-- 10. Productos con stock bajo
CREATE OR REPLACE VIEW public.v_low_stock_products AS
SELECT p.id, p.nombre, p.categoria, p.stock, p.order_count, sc.stock_alert_threshold
FROM products p
CROSS JOIN store_config sc
WHERE sc.id = 1 AND p.activo = true AND p.stock <= sc.stock_alert_threshold
ORDER BY p.stock ASC;

-- 11. Resumen de calificaciones
CREATE OR REPLACE VIEW public.v_product_reviews_summary AS
SELECT
    p.id AS product_id, p.nombre AS product_name,
    COUNT(r.id) AS total_reviews,
    COALESCE(AVG(r.rating), 0) AS avg_rating,
    COUNT(r.id) FILTER (WHERE r.rating = 5) AS five_star_count,
    COUNT(r.id) FILTER (WHERE r.rating = 4) AS four_star_count,
    COUNT(r.id) FILTER (WHERE r.rating = 3) AS three_star_count,
    COUNT(r.id) FILTER (WHERE r.rating = 2) AS two_star_count,
    COUNT(r.id) FILTER (WHERE r.rating = 1) AS one_star_count
FROM products p
LEFT JOIN product_reviews r ON r.product_id = p.id
GROUP BY p.id, p.nombre;
