-- ========================================================
-- MÓDULO: VISTAS DE CONFIGURACIÓN PWA
-- ARCHIVO: /supabase/basedatos/12_vistas_configuracion_pwa.sql
-- PROPÓSITO: Vistas auxiliares de personalización, SEO, banners, hero, delivery
-- ÚLTIMA REVISIÓN: 2026-08-23
-- NOTA: Ejecutar AL FINAL, después de todos los módulos anteriores
-- ========================================================

CREATE OR REPLACE VIEW public.v_store_theme AS
SELECT theme_color, secondary_color, accent_color, theme_mode, font_display,
    logo_url, secondary_logo_url, pwa_icon_url, splash_logo_url, favicon_url
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_banners AS
SELECT banner_url_1, banner_url_2, banner_url_3,
    banner_url_1_mobile, banner_url_2_mobile, banner_url_3_mobile,
    banner_texts, banner_titles, banner_descriptions, banner_cta_texts, banner_cta_urls
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_seo AS
SELECT site_nombre, seo_home_title, seo_home_description, seo_home_keywords,
    seo_catalog_title, seo_catalog_description,
    jsonld_type, jsonld_priceRange, jsonld_servesCuisine, site_url
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_hero AS
SELECT hero_title, hero_subtitle, hero_cta_text, hero_cta_url,
    hero_effect, hero_height, hero_overlay_opacity, mensaje_bienvenida
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_footer AS
SELECT footer_text, footer_copyright, footer_about_title, footer_about_text,
    instagram_url, twitter_url, facebook_url, tiktok_url, youtube_url
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_delivery AS
SELECT esta_abierta, entrega_por_zonas, delivery_gratis, delivery_gratis_threshold,
    costo_delivery_km, envio_nacional, costo_envio_nacional, delivery_zonas,
    recogida_en_local, tiene_mesas, total_mesas
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_payments AS
SELECT zelle_enabled, zelle_data, zelle_discount_percent,
    pagomovil_enabled, pagomovil_data, pagomovil_discount_percent,
    efectivo_enabled, efectivo_data, efectivo_discount_percent,
    transferencia_enabled, transferencia_data, transferencia_discount_percent,
    tasa_cambio
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_loyalty AS
SELECT loyalty, section_rewards_title, section_rewards_description,
    rewards_step1_title, rewards_step1_desc,
    rewards_step2_title, rewards_step2_desc,
    rewards_step3_title, rewards_step3_desc
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_categories AS
SELECT categories, categories_images, categories_colors
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_sedes AS
SELECT sedes, multi_sucursal_enabled, sede_activa_id
FROM store_config WHERE id = 1;

CREATE OR REPLACE VIEW public.v_store_sections AS
SELECT section_highlights_title, section_categories_title,
    section_bestseller_title, section_rewards_title, section_rewards_description
FROM store_config WHERE id = 1;
