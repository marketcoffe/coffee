/**
 * sitemapGenerator.ts — Generador dinámico de sitemap.xml
 * Incluye Home, Catálogo y URLs de categorías (ahora rastreables).
 */

const SITE_URL = 'https://marketcoffesweet.com';

const CATEGORY_PATHS = [
  'panaderia', 'comida-rapida', 'reposteria', 'viveres',
  'frutas-y-verduras', 'bebidas', 'charcuteria-y-embutidos', 'carniceria',
  'lacteos', 'snacks', 'licores', 'limpieza', 'higiene-personal',
  'mascotas', 'combos-familiares', 'agua-potable',
  'salsas-y-condimentos', 'hogar', 'combos', 'recarga-de-agua'
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Genera el XML del sitemap.
 * Home, Catálogo y todas las categorías.
 */
export function generateSitemapXML(): string {
  const today = formatDate();

  const categoryUrls = CATEGORY_PATHS.map(slug => `
  <url>
    <loc>${escapeXml(SITE_URL)}/catalog/${escapeXml(slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <url>
    <loc>${escapeXml(SITE_URL)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>${escapeXml(SITE_URL)}/catalog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  ${categoryUrls}

</urlset>`;
}
