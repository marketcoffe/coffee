/**
 * useSEO.ts — Hook para generar meta tags únicos anti-canibalización.
 * Evita que dos páginas compitan por la misma keyword.
 */
import { useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getCategories } from '../utils/categoryUtils';
import { FoodItem } from '../types/store';

const SITE_URL = 'https://marketcoffesweet.com';

interface SEOOptions {
  title?: string;
  description?: string;
  type: 'home' | 'product' | 'catalog' | 'category' | 'admin';
  product?: FoodItem;
  category?: string;
  categorySlug?: string;
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let meta = document.querySelector(`meta[${attr}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function useSEO(options: SEOOptions) {
  const { config } = useApp();
  const siteName = config.site_nombre || 'Market Coffee Sweet';

  useEffect(() => {
    const baseDesc = config.seo_home_description ||
      'Market Coffee Sweet en Valencia, Carabobo. Panadería fresca, hamburguesas, shawarmas, víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.';
    const defaultKeywords = config.seo_home_keywords ||
      'panadería Valencia, comida rápida Valencia Carabobo, hamburguesas delivery, víveres, pan fresco, minimarket Valencia';

    let seoTitle = '';
    let seoDesc = '';
    let seoKeywords = defaultKeywords;
    let canonicalUrl = SITE_URL;
    let ogImage = config.banners?.[0] || config.logo_url || `${SITE_URL}/logo.png`;
    let ogType = 'website';

    switch (options.type) {
      case 'home':
        seoTitle = options.title || config.seo_home_title || `Panadería y Comida Rápida en Valencia | ${siteName}`;
        seoDesc = options.description || baseDesc;
        seoKeywords = defaultKeywords;
        canonicalUrl = SITE_URL;
        break;

      case 'product':
        if (options.product) {
          const p = options.product;
          seoTitle = options.title || `${p.nombre} - Precio y Pedido Rápido | ${siteName}`;
          seoDesc = options.description ||
            (p.descripcion
              ? `${p.descripcion}. Pide ${p.nombre} con delivery en Valencia y alrededores. Precio $${p.precio_usd.toFixed(2)} USD.`
              : `${p.nombre} de la mejor calidad. Delivery express en minutos en Valencia, El Trigal y alrededores. Precio $${p.precio_usd.toFixed(2)} USD.`);
          const cats = getCategories(p);
          seoKeywords = `${p.nombre}, ${cats.join(', ')}, ${siteName}, delivery, Valencia, El Trigal, precio`;
          canonicalUrl = p.slug ? `${SITE_URL}/producto/${p.slug}` : SITE_URL;
          ogImage = p.imagen_urls?.[0] || ogImage;
          ogType = 'product';
        }
        break;

      case 'category':
        if (options.category) {
          const cat = options.category;
          seoTitle = options.title || `${cat} en Valencia - Precios y Delivery | ${siteName}`;
          seoDesc = options.description ||
            `Compra ${cat.toLowerCase()} fresca con delivery rápido en Valencia, El Trigal, Prebo, La Viña, Mañongo y alrededores. Pide online en ${siteName}.`;
          seoKeywords = `${cat.toLowerCase()} Valencia, ${cat.toLowerCase()} delivery, comprar ${cat.toLowerCase()}, ${siteName}, Valencia Carabobo`;
          canonicalUrl = options.categorySlug
            ? `${SITE_URL}/catalogo/${options.categorySlug}`
            : SITE_URL;
        }
        break;

      case 'catalog':
        seoTitle = options.title || config.seo_catalog_title || `Catálogo de Productos | ${siteName}`;
        seoDesc = options.description || config.seo_catalog_description ||
          `Menú completo de ${siteName}. Panadería, hamburguesas, shawarmas, víveres, frutas, verduras y más con delivery en Valencia.`;
        seoKeywords = `${siteName}, catálogo, menú, delivery, comida online, Valencia, El Trigal`;
        canonicalUrl = `${SITE_URL}/catalog`;
        break;

      case 'admin':
        seoTitle = options.title || `Admin - Panel | ${siteName}`;
        seoDesc = 'Panel de administración';
        break;
    }

    // Aplicar título
    document.title = seoTitle ? `${seoTitle} | ${siteName}` : `${siteName} - Panadería y Delivery`;

    // Meta tags estándar
    setMeta('description', seoDesc);
    setMeta('keywords', seoKeywords);

    // Canonical
    setCanonical(canonicalUrl);

    // OpenGraph
    setMeta('og:title', seoTitle || siteName, 'property');
    setMeta('og:description', seoDesc, 'property');
    setMeta('og:site_name', siteName, 'property');
    setMeta('og:locale', 'es_VE', 'property');
    setMeta('og:type', ogType, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:image', ogImage, 'property');

    // Product-specific OG
    if (options.type === 'product' && options.product) {
      setMeta('product:price:amount', String(options.product.precio_usd), 'property');
      setMeta('product:price:currency', 'USD', 'property');
    }

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seoTitle || siteName);
    setMeta('twitter:description', seoDesc);
    setMeta('twitter:image', ogImage);

    // Geo tags
    setMeta('geo.region', 'VE');
    setMeta('geo.placename', 'Valencia, Carabobo');
    setMeta('geo.position', '10.2279443;-67.997616');
    setMeta('ICBM', '10.2185, -68.0021');

  }, [options.type, options.product?.id, options.category, config]);
}
