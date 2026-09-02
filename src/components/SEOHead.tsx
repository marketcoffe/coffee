import React, { useEffect, useRef } from 'react';
import { FoodItem } from '../types/store';
import { useApp } from '../store/AppContext';
import {
  getOrganizationSchema,
  getRestaurantSchema,
  getProductSchema,
  getFAQSchema,
  getWebsiteSchema,
  getBreadcrumbSchema
} from '../seo/schemaGenerator';
import { useSEOProduct, useSEOHome } from '../seo/useSEO';
import { escapeJsonForScript } from '../security/security';
import { slugify } from '../utils/slug';

interface SEOHeadProps {
  title?: string;
  description?: string;
  type?: 'home' | 'product' | 'catalog' | 'admin';
  product?: FoodItem;
  filters?: {
    category?: string;
  };
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  type = 'home',
  product,
  filters
}) => {
  const { config, foodItems } = useApp();
  const indexedDBTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hooks SEO anti-canibalización
  const homeSEO = useSEOHome(config);
  const productSEO = useSEOProduct(product, config);

  const seo = type === 'product' ? productSEO : homeSEO;
  const siteName = config.site_nombre || 'Market Coffee Sweet';

  useEffect(() => {
    let seoTitle = title || seo.title;
    let seoDesc = description || seo.description;
    let seoKeywords = seo.keywords;
    let ogImage = seo.ogImage;
    let ogUrl = seo.ogUrl;

    // Override por tipo
    if (type === 'product' && product) {
      seoTitle = productSEO.title;
      seoDesc = productSEO.description;
      seoKeywords = productSEO.keywords;
      ogImage = productSEO.ogImage;
      ogUrl = productSEO.ogUrl;
    }

    if (type === 'catalog') {
      const category = filters?.category || '';
      const siteUrl = config.site_url || 'https://marketcoffesweet.com';
      seoTitle = config.seo_catalog_title || `Comprar ${category || 'Menú Completo'} Online | ${siteName}`;
      seoDesc = config.seo_catalog_description || `Menú de ${category || 'todos nuestros productos'}. Panadería, hamburguesas, shawarmas, víveres y más con delivery en Valencia.`;
      seoKeywords = `${category.toLowerCase()}, delivery valencia, comprar online, ${siteName.toLowerCase()}`;
      ogUrl = `${siteUrl}/catalog/${slugify(category)}`;
    }

    document.title = `${seoTitle} | ${siteName}`;

    const setMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    setMeta('description', seoDesc);
    setMeta('keywords', seoKeywords);

    // Noindex para páginas privadas (admin, checkout, etc.)
    if (type === 'admin') {
      setMeta('robots', 'noindex, nofollow');
      setMeta('googlebot', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      setMeta('googlebot', 'index, follow');
    }
    setMeta('og:title', seoTitle, 'property');
    setMeta('og:description', seoDesc, 'property');
    setMeta('og:site_name', siteName, 'property');
    setMeta('og:locale', 'es_VE', 'property');
    setMeta('og:url', ogUrl, 'property');

    if (type === 'product' && product) {
      setMeta('og:type', 'product', 'property');
      setMeta('og:image', ogImage, 'property');
      setMeta('product:price:amount', String(product.precio_usd), 'property');
      setMeta('product:price:currency', 'USD', 'property');
    } else {
      setMeta('og:type', 'website', 'property');
      setMeta('og:image', ogImage, 'property');
    }

    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seoTitle);
    setMeta('twitter:description', seoDesc);
    setMeta('twitter:image', ogImage);

    // Geo tags
    setMeta('geo.region', 'VE', 'name');
    setMeta('geo.placename', 'Valencia, Carabobo', 'name');
    setMeta('geo.position', '10.2185;-68.0021', 'name');
    setMeta('ICBM', '10.2185, -68.0021', 'name');

    // Canonical link
    const canonicalUrl = type === 'product' && product?.slug
      ? `${config.site_url || 'https://marketcoffesweet.com'}/producto/${product.slug}`
      : ogUrl;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Hreflang para SEO geográfico
    let hreflangLink = document.querySelector('link[rel="alternate"][hreflang="es-ve"]') as HTMLLinkElement | null;
    if (!hreflangLink) {
      hreflangLink = document.createElement('link');
      hreflangLink.setAttribute('rel', 'alternate');
      hreflangLink.setAttribute('hreflang', 'es-ve');
      document.head.appendChild(hreflangLink);
    }
    hreflangLink.setAttribute('href', canonicalUrl);

    // PWA: Guardar config en IndexedDB
    if (indexedDBTimeoutRef.current) {
      clearTimeout(indexedDBTimeoutRef.current);
    }
    indexedDBTimeoutRef.current = setTimeout(() => {
      try {
        const DB_NAME = 'foodapp-pwa';
        const DB_VERSION = 1;
        const STORE_NAME = 'config';
        const openReq = indexedDB.open(DB_NAME, DB_VERSION);
        openReq.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME);
        };
        openReq.onsuccess = (e: Event) => {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);

          if (config.logo_url) store.put(config.logo_url, 'logo_url');
          if (config.pwa_icon_url) store.put(config.pwa_icon_url, 'pwa_icon_url');
          if (config.site_nombre) store.put(config.site_nombre, 'site_name');
          if (config.theme_color) store.put(config.theme_color, 'theme_color');
        };
      } catch { /* IndexedDB no disponible */ }
    }, 500);

    // Apple Touch Icon dinámico
    const appleTouchUrl = config.pwa_icon_url || config.logo_url || config.favicon_url || '/icon.png';
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.setAttribute('rel', 'apple-touch-icon');
      document.head.appendChild(appleLink);
    }
    appleLink.setAttribute('href', appleTouchUrl);

    if (config.favicon_url || config.pwa_icon_url || config.logo_url) {
      let iconLink = document.querySelector('link[rel="icon"]');
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.setAttribute('rel', 'icon');
        document.head.appendChild(iconLink);
      }
      iconLink.setAttribute('href', config.favicon_url || config.pwa_icon_url || config.logo_url || '/icon.png');
    }

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', config.theme_color || '#A4D045');

    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.setAttribute('content', siteName);

    // ═══ JSON-LD Schema — SEO Premium ═══
    // Limpiar scripts existentes
    const schemaIds = [
      'marketcoffee-jsonld-schema',
      'marketcoffee-jsonld-org',
      'marketcoffee-jsonld-web',
      'marketcoffee-jsonld-faq',
      'marketcoffee-jsonld-bc'
    ];
    schemaIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    let schemaObj: Record<string, unknown> | null = null;

    if (type === 'home') {
      schemaObj = getRestaurantSchema(config);

      // Organization schema
      const orgScript = document.createElement('script');
      orgScript.id = 'marketcoffee-jsonld-org';
      orgScript.type = 'application/ld+json';
      orgScript.innerHTML = escapeJsonForScript(getOrganizationSchema(config));
      document.head.appendChild(orgScript);

      // Website schema
      const webScript = document.createElement('script');
      webScript.id = 'marketcoffee-jsonld-web';
      webScript.type = 'application/ld+json';
      webScript.innerHTML = escapeJsonForScript(getWebsiteSchema(config));
      document.head.appendChild(webScript);

      // FAQ schema
      const faqSchema = getFAQSchema(config.faq_items || []);
      if (faqSchema) {
        const faqScript = document.createElement('script');
        faqScript.id = 'marketcoffee-jsonld-faq';
        faqScript.type = 'application/ld+json';
        faqScript.innerHTML = escapeJsonForScript(faqSchema);
        document.head.appendChild(faqScript);
      }

      // Breadcrumb for home
      const bcScript = document.createElement('script');
      bcScript.id = 'marketcoffee-jsonld-bc';
      bcScript.type = 'application/ld+json';
      bcScript.innerHTML = escapeJsonForScript(getBreadcrumbSchema(config, [{ name: 'Inicio' }]));
      document.head.appendChild(bcScript);
    } else if (type === 'product' && product) {
      schemaObj = getProductSchema(product, config);

      // Breadcrumb for product (con categoría)
      const category = Array.isArray(product.categoria) ? product.categoria[0] : product.categoria;
      const siteUrl = config.site_url || 'https://marketcoffesweet.com';
      const breadcrumbItems: Array<{ name: string; url?: string }> = [
        { name: 'Inicio', url: siteUrl },
      ];
      if (category) {
        breadcrumbItems.push({
          name: category,
          url: `${siteUrl}/catalog/${slugify(category)}`
        });
      }
      breadcrumbItems.push({ name: product.nombre });

      const bcScript = document.createElement('script');
      bcScript.id = 'marketcoffee-jsonld-bc';
      bcScript.type = 'application/ld+json';
      bcScript.innerHTML = escapeJsonForScript(getBreadcrumbSchema(config, breadcrumbItems));
      document.head.appendChild(bcScript);
    } else if (type === 'catalog') {
      const category = filters?.category || '';
      const siteUrl = config.site_url || 'https://marketcoffesweet.com';
      const breadcrumbItems: Array<{ name: string; url?: string }> = [
        { name: 'Inicio', url: siteUrl },
      ];
      if (category) {
        breadcrumbItems.push({ name: category });
      } else {
        breadcrumbItems.push({ name: 'Catálogo' });
      }

      const bcScript = document.createElement('script');
      bcScript.id = 'marketcoffee-jsonld-bc';
      bcScript.type = 'application/ld+json';
      bcScript.innerHTML = escapeJsonForScript(getBreadcrumbSchema(config, breadcrumbItems));
      document.head.appendChild(bcScript);
    }

    if (schemaObj) {
      const script = document.createElement('script');
      script.id = 'marketcoffee-jsonld-schema';
      script.type = 'application/ld+json';
      script.innerHTML = escapeJsonForScript(schemaObj);
      document.head.appendChild(script);
    }

    return () => {
      if (indexedDBTimeoutRef.current) clearTimeout(indexedDBTimeoutRef.current);
    };
  }, [config, title, description, type, product, filters, siteName, seo, productSEO, foodItems]);

  return null;
};
