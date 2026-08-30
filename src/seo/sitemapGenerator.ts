/**
 * sitemapGenerator.ts — Generador dinámico de sitemap.xml
 * Solo incluye páginas reales del SPA: Home y Catálogo.
 * NO incluye categorías (filtran por state) ni productos (modales).
 */

const SITE_URL = 'https://marketcoffesweet.com';

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
 * Solo Home y Catálogo — las únicas URLs reales del SPA.
 */
export function generateSitemapXML(): string {
  const today = formatDate();

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

</urlset>`;
}
