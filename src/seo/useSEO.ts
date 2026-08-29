/**
 * useSEO.ts — Hook para metas SEO anti-canibalización
 * Genera títulos, descripciones y OpenGraph únicos por producto/categoría
 * Evita que dos páginas compitan por la misma keyword
 */
import { useMemo } from 'react';
import { FoodItem, StoreConfig } from '../types/store';
import { slugify } from '../utils/slug';

const SITE_NAME = 'Market Coffee Sweet';
const SITE_URL = 'https://marketcoffeesweet.com';

// ─── Plantillas de título anti-canibalización ───
const TITLE_TEMPLATES = {
  product: [
    '{nombre} - Precio y Delivery | {site}',
    '{nombre} Online - Pedido Rápido | {site}',
    'Comprar {nombre} - Envío a Domicilio | {site}',
  ],
  category: [
    '{category} con Delivery en Valencia | {site}',
    'Comprar {category} Online | {site}',
    '{category} - Pedido Rápido a Domicilio | {site}',
  ],
  catalog: [
    'Catálogo Completo - Panadería y Mercado | {site}',
    'Menú y Precios - Todo Online | {site}',
    'Explora Nuestros Productos | {site}',
  ],
  home: [
    'Panadería, Comida Rápida y Víveres en Valencia | {site}',
    'Market Coffee Sweet - Delivery Express El Trigal | {site}',
    'Tu Panadería y Minimarket de Confianza | {site}',
  ],
};

// ─── Plantillas de descripción anti-canibalización ───
const DESC_TEMPLATES = {
  product: [
    '{nombre} de Market Coffee Sweet. Precio ${precio} USD. Delivery rápido en Valencia, El Trigal, Prebo, La Viña y Mañongo. Pedido en minutos.',
    'Pide tu {nombre} por solo ${precio} USD. Envío a domicilio en menos de 45 minutos en Valencia y alrededores. Paga en dólares o bolívares.',
    '{nombre} disponible en Market Coffee Sweet. Delivery express en El Trigal y Valencia. Precio: ${precio} USD. ¡Ordena ahora!',
  ],
  category: [
    'Descubre nuestra selección de {category} en Market Coffee Sweet. Precios desde ${precioMin} USD. Delivery rápido en Valencia.',
    'Los mejores {category} con delivery en El Trigal, Valencia. Precios desde ${precioMin} USD. Pide online en minutos.',
    'Compra {category} frescos en Market Coffee Sweet. Delivery a domicilio en Valencia, Prebo, La Viña y Mañongo.',
  ],
};

// ─── Descripciones únicas por categoría (sin canibalización) ───
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Panadería': 'Pan artesanal fresco horneado todos los días. Pan de jamón, canilla, guayaba y más con delivery en Valencia.',
  'Comida Rapida': 'Hamburguesas, shawarmas y perros calientes preparados al momento. Delivery rápido en El Trigal y Valencia.',
  'Mercado': 'Víveres, frutas, verduras, lácteos y productos de limpieza. Todo fresco con delivery en Valencia.',
  'Frutas y Verduras': 'Frutas y verduras frescas del día directo a tu puerta. Delivery en Valencia, El Trigal y alrededores.',
  'Bebidas': 'Refrescos, jugos, agua potable y bebidas variadas. Delivery rápido en Valencia.',
  'Lacteos': 'Leche, queso, mantequilla y productos lácteos frescos. Delivery en Valencia.',
  'Carnicería': 'Carnes frescas, pollo, res y cerdo de primera calidad. Delivery en Valencia.',
  'Snacks': 'Chucherías, papas fritas, galletas y snacks para picar. Delivery en Valencia.',
  'Licores': 'Whisky, ron, vodka y cervezas premium. Delivery en Valencia y alrededores.',
  'Limpieza': 'Productos de limpieza para tu hogar. Detergentes, jabones y más. Delivery en Valencia.',
};

interface SEOData {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  canonical: string;
  keywords: string;
}

export function useSEOProduct(
  product: FoodItem | undefined,
  config: StoreConfig
): SEOData {
  return useMemo(() => {
    if (!product) {
      return getDefaultSEO(config);
    }

    const siteUrl = config.site_url || SITE_URL;
    const siteName = config.site_nombre || SITE_NAME;
    const productSlug = product.slug || slugify(product.nombre);
    const productUrl = `${siteUrl}/producto/${productSlug}`;

    // Título único por producto
    const titleTemplate = TITLE_TEMPLATES.product[
      product.nombre.length % TITLE_TEMPLATES.product.length
    ];
    const title = titleTemplate
      .replace('{nombre}', product.nombre)
      .replace('{site}', siteName);

    // Descripción única por producto
    const descIndex = (product.precio_usd * 7) % DESC_TEMPLATES.product.length | 0;
    const descTemplate = DESC_TEMPLATES.product[descIndex];
    const description = descTemplate
      .replace('{nombre}', product.nombre)
      .replace('{precio}', product.precio_usd.toFixed(2));

    // Keywords únicas (anti-canibalización)
    const categories = Array.isArray(product.categoria) ? product.categoria : [product.categoria];
    const keywords = [
      product.nombre.toLowerCase(),
      ...categories.map(c => c.toLowerCase()),
      'delivery valencia',
      'precio',
      siteName.toLowerCase(),
    ].join(', ');

    return {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogImage: product.imagen_urls?.[0] || config.logo_url || `${siteUrl}/logo.png`,
      ogUrl: productUrl,
      canonical: productUrl,
      keywords,
    };
  }, [product, config]);
}

export function useSEOCategory(
  category: string,
  products: FoodItem[],
  config: StoreConfig
): SEOData {
  return useMemo(() => {
    const siteUrl = config.site_url || SITE_URL;
    const siteName = config.site_nombre || SITE_NAME;
    const categorySlug = slugify(category);
    const categoryUrl = `${siteUrl}/catalogo/${categorySlug}`;

    // Título único por categoría
    const titleTemplate = TITLE_TEMPLATES.category[
      category.length % TITLE_TEMPLATES.category.length
    ];
    const title = titleTemplate
      .replace('{category}', category)
      .replace('{site}', siteName);

    // Descripción única por categoría
    const description = CATEGORY_DESCRIPTIONS[category]
      || `${category} disponibles en Market Coffee Sweet. Delivery rápido en Valencia, El Trigal y alrededores. Precios desde $3.50 USD.`;

    // Precio mínimo de la categoría
    const precioMin = products.length > 0
      ? Math.min(...products.map(p => p.precio_usd)).toFixed(2)
      : '3.50';

    const finalDesc = description.replace('{precioMin}', precioMin);

    // Keywords únicas por categoría
    const keywords = [
      category.toLowerCase(),
      'delivery valencia',
      'comprar online',
      'precio',
      'domicilio',
      siteName.toLowerCase(),
    ].join(', ');

    return {
      title,
      description: finalDesc,
      ogTitle: title,
      ogDescription: finalDesc,
      ogImage: config.banners?.[0] || config.logo_url || `${siteUrl}/logo.png`,
      ogUrl: categoryUrl,
      canonical: categoryUrl,
      keywords,
    };
  }, [category, products, config]);
}

export function useSEOHome(config: StoreConfig): SEOData {
  return useMemo(() => {
    const siteUrl = config.site_url || SITE_URL;
    const siteName = config.site_nombre || SITE_NAME;

    return {
      title: config.seo_home_title || `${siteName} - Panadería, Comida Rápida y Víveres en Valencia`,
      description: config.seo_home_description || `${siteName} en El Trigal, Valencia. Panadería fresca horneada diario, hamburguesas, shawarmas, víveres, frutas, verduras, bebidas y agua potable. Delivery a domicilio en menos de 45 minutos.`,
      ogTitle: config.seo_home_title || `${siteName} | Panadería, Comida Rápida y Víveres`,
      ogDescription: config.seo_home_description || `Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida, víveres y más con delivery express.`,
      ogImage: config.banners?.[0] || config.logo_url || `${siteUrl}/logo.png`,
      ogUrl: siteUrl,
      canonical: siteUrl,
      keywords: config.seo_home_keywords || `panadería El Trigal Valencia, comida rápida Valencia, hamburguesas delivery, shawarmas, víveres Valencia, pan fresco, minimarket, delivery express, market coffee sweet`,
    };
  }, [config]);
}

function getDefaultSEO(config: StoreConfig): SEOData {
  const siteUrl = config.site_url || SITE_URL;
  const siteName = config.site_nombre || SITE_NAME;
  return {
    title: config.seo_home_title || `${siteName} - Panadería y Comida Rápida`,
    description: config.seo_home_description || `Market Coffee Sweet - Panadería, comida rápida y víveres con delivery en Valencia.`,
    ogTitle: siteName,
    ogDescription: config.seo_home_description || `Panadería, comida rápida y víveres en Valencia.`,
    ogImage: config.logo_url || `${siteUrl}/logo.png`,
    ogUrl: siteUrl,
    canonical: siteUrl,
    keywords: config.seo_home_keywords || `panadería valencia, comida rápida, delivery`,
  };
}
