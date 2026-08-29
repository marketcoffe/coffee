/**
 * sitemapGenerator.ts — Generador dinámico de sitemap.xml
 * Construye un sitemap válido con Home, Categorías y Productos.
 * Integrado con Supabase para actualización automática.
 */

const SITE_URL = 'https://marketcoffeesweet.com';

interface SitemapProduct {
  slug?: string;
  nombre: string;
  updated_at?: string;
  categoria?: string | string[];
}

interface SitemapCategory {
  slug: string;
  name: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date?: string): string {
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Genera el XML del sitemap completo.
 * Prioridades: Home (1.0) > Catálogo (0.9) > Categorías (0.8) > Productos (0.7)
 */
export function generateSitemapXML(
  categories: SitemapCategory[],
  products: SitemapProduct[]
): string {
  const today = formatDate();
  const urls: string[] = [];

  // ═══ PÁGINAS PRINCIPALES ═══
  urls.push(`
  <url>
    <loc>${escapeXml(SITE_URL)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

  urls.push(`
  <url>
    <loc>${escapeXml(SITE_URL)}/catalog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);

  // ═══ CATEGORÍAS ═══
  for (const cat of categories) {
    urls.push(`
  <url>
    <loc>${escapeXml(SITE_URL)}/catalogo/${escapeXml(cat.slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  // ═══ PRODUCTOS ═══
  for (const product of products) {
    const slug = product.slug || generateSlug(product.nombre);
    if (!slug) continue;

    urls.push(`
  <url>
    <loc>${escapeXml(SITE_URL)}/producto/${escapeXml(slug)}</loc>
    <lastmod>${formatDate(product.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">${urls.join('')}
</urlset>`;
}

/**
 * Genera sitemap solo con categorías (para uso rápido).
 */
export function generateCategorySitemap(categories: SitemapCategory[]): string {
  const today = formatDate();
  const urls = categories.map(cat => `
  <url>
    <loc>${escapeXml(SITE_URL)}/catalogo/${escapeXml(cat.slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`;
}

/**
 * Genera sitemap con productos de Supabase.
 * Llamar desde un endpoint o script de build.
 */
export function generateFullSitemap(
  categories: Array<{ name: string }>,
  products: SitemapProduct[]
): string {
  const categoryEntries: SitemapCategory[] = categories.map(cat => ({
    slug: generateSlug(cat.name),
    name: cat.name,
  }));

  return generateSitemapXML(categoryEntries, products);
}
