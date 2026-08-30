/**
 * schemaGenerator.ts — Generador consolidado de Schema.org JSON-LD
 * Reemplaza schemas.js (obsoleto) y productSchema.ts.
 * Soporta: Product, GroceryStore, Bakery, LocalBusiness, WebSite, FAQ, Breadcrumb
 * Optimizado para GEO (Generative Engine Optimization) + LLM SEO
 */

const SITE_URL = 'https://marketcoffesweet.com';
const SITE_NAME = 'Market Coffee Sweet';

// ─── Mapeo de categorías SEO-friendly (anti-canibalización) ───
const CATEGORY_MAP: Record<string, string> = {
  'Mercado': 'Víveres y Supermercado',
  'Panaderia': 'Panadería y Pastelería',
  'Panadería': 'Panadería y Pastelería',
  'Comida Rapida': 'Comida Rápida para Llevar',
  'Comida Rápida': 'Comida Rápida para Llevar',
  'Bebidas': 'Bebidas y Refrescos',
  'Frutas y Verduras': 'Frutas y Verduras Frescas del Día',
  'Snacks': 'Snacks y Chucherías',
  'Chucherias': 'Snacks y Chucherías',
  'Chucherías': 'Snacks y Chucherías',
  'Agua Potable': 'Agua Potable y Botellones',
  'Licores': 'Licores y Bebidas Alcohólicas',
  'Limpieza': 'Productos de Limpieza del Hogar',
  'Higiene': 'Artículos de Higiene Personal',
  'Higiene Personal': 'Artículos de Higiene Personal',
  'Carniceria': 'Carnicería y Cortes Frescos',
  'Carnicería': 'Carnicería y Cortes Frescos',
  'Charcuteria y Embutidos': 'Charcutería y Embutidos Artesanales',
  'Lacteos': 'Lácteos y Quesos Frescos',
  'Lácteos': 'Lácteos y Quesos Frescos',
  'Reposteria': 'Repostería y Pastelería',
  'Repostería': 'Repostería y Pastelería',
  'Mascotas': 'Alimento y Accesorios para Mascotas',
  'Combos': 'Combos y Ofertas Especiales',
  'Combos Familiares': 'Combos Familiares con Descuento',
  'Hogar': 'Artículos para el Hogar',
  'Salsas y Condimentos': 'Salsas y Condimentos',
};

function buildCategoryPath(categorias: string | string[], subcategoria?: string): string {
  const cats = Array.isArray(categorias) ? categorias : [categorias];
  const mainCategory = cats.map(c => CATEGORY_MAP[c] || c).join(' · ');
  return subcategoria ? `${mainCategory} › ${subcategoria}` : mainCategory;
}

function getAvailability(product: { disponibilidad?: string; stock?: number }): string {
  if (product.disponibilidad === 'Agotado') return 'https://schema.org/OutOfStock';
  if (product.disponibilidad === 'En Reposición') return 'https://schema.org/PreOrder';
  if ((product.stock ?? 0) > 0) return 'https://schema.org/InStock';
  return 'https://schema.org/OutOfStock';
}

function calculateAverageRating(orderCount: number): number {
  const baseRating = 4.3;
  const bonus = Math.min(orderCount / 80, 0.7);
  return Math.round((baseRating + bonus) * 10) / 10;
}

function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════
// SCHEMAS DE NEGOCIO (GEO + Local Business)
// ═══════════════════════════════════════════════════════════

export function getOrganizationSchema(config: Record<string, any>) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": SITE_NAME,
    "legalName": "Market Coffee Sweet C.A.",
    "taxID": "J500338260",
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": config.logo_url || `${SITE_URL}/logo.png`,
      "width": 512,
      "height": 512
    },
    "description": "Panadería artesanal, comida rápida, víveres frescos y delivery express en El Trigal, Valencia, Carabobo. Horneamos pan todos los días desde las 7:00 AM.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": config.direccion_fisica || "Av. Principal El Trigal, justo al frente de Patio Trigal",
      "addressLocality": "Valencia",
      "addressRegion": "Carabobo",
      "postalCode": "2001",
      "addressCountry": "VE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": config.coordenadas_tienda?.lat || 10.2185,
      "longitude": config.coordenadas_tienda?.lng || -68.0021
    },
    "sameAs": [
      "https://www.instagram.com/marketcoffeesweet",
      "https://www.tiktok.com/@marketcoffeesweet"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": config.telefono_soporte || "+584123758879",
      "contactType": "customer service",
      "availableLanguage": "Spanish",
      "areaServed": "VE"
    }
  };
}

export function getLocalBusinessSchema(config: Record<string, any>) {
  return {
    "@context": "https://schema.org",
    "@type": ["Bakery", "GroceryStore", "FastFoodRestaurant"],
    "@id": `${SITE_URL}/#localbusiness`,
    "name": SITE_NAME,
    "legalName": "Market Coffee Sweet C.A.",
    "taxID": "J500338260",
    "url": SITE_URL,
    "telephone": config.telefono_soporte || "+584123758879",
    "priceRange": config.jsonld_priceRange || "$$",
    "image": [
      config.banners?.[0] || config.logo_url || `${SITE_URL}/fachada.jpg`,
      config.logo_url || `${SITE_URL}/logo.png`
    ],
    "logo": config.logo_url || `${SITE_URL}/logo.png`,
    "description": "Panadería artesanal con pan fresco horneado diario, hamburguesas premium, shawarmas, víveres, frutas, verduras, bebidas y agua potable. Delivery rápido en El Trigal, Valencia.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": config.direccion_fisica || "Av. Principal El Trigal, justo al frente de Patio Trigal",
      "addressLocality": "Valencia",
      "addressRegion": "Carabobo",
      "postalCode": "2001",
      "addressCountry": "VE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": config.coordenadas_tienda?.lat || 10.2185,
      "longitude": config.coordenadas_tienda?.lng || -68.0021
    },
    "areaServed": [
      { "@type": "Place", "name": "El Trigal" },
      { "@type": "Place", "name": "La Trigaleña" },
      { "@type": "Place", "name": "Prebo" },
      { "@type": "Place", "name": "La Viña" },
      { "@type": "Place", "name": "Mañongo" },
      { "@type": "AdministrativeArea", "name": "Valencia" },
      { "@type": "AdministrativeArea", "name": "Naguanagua" },
      { "@type": "AdministrativeArea", "name": "San Diego" }
    ],
    "servesCuisine": config.jsonld_servesCuisine || [
      "Panadería Artesanal", "Comida Rápida", "Hamburguesas",
      "Shawarma", "Perros Calientes", "Víveres Frescos", "Bebidas"
    ],
    "hasMenu": {
      "@type": "Menu",
      "url": `${SITE_URL}/catalog`
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "opens": "07:00",
        "closes": "22:00"
      }
    ],
    "acceptsReservations": "False",
    "paymentAccepted": "Efectivo, Pago Móvil, Zelle, Punto de Venta, Transferencia",
    "currenciesAccepted": "USD, VES",
    "sameAs": [
      "https://www.instagram.com/marketcoffeesweet",
      "https://www.tiktok.com/@marketcoffeesweet"
    ]
  };
}

export function getRestaurantSchema(config: Record<string, any>) {
  return {
    "@context": "https://schema.org",
    "@type": config.jsonld_type || "FastFoodRestaurant",
    "@id": `${SITE_URL}/#localbusiness`,
    "name": SITE_NAME,
    "legalName": "Market Coffee Sweet C.A.",
    "taxID": "J500338260",
    "image": config.banners?.[0] || config.logo_url || `${SITE_URL}/fachada.jpg`,
    "url": SITE_URL,
    "description": "Panadería artesanal, hamburguesas, shawarmas, víveres frescos, frutas, verduras, bebidas y agua potable con delivery express en El Trigal, Valencia.",
    "priceRange": config.jsonld_priceRange || "$$",
    "telephone": config.telefono_soporte || "+584123758879",
    "servesCuisine": config.jsonld_servesCuisine || [
      "Panadería Artesanal", "Comida Rápida", "Hamburguesas",
      "Shawarma", "Perros Calientes", "Víveres", "Bebidas"
    ],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": config.direccion_fisica || "Av. Principal El Trigal, justo al frente de Patio Trigal",
      "addressLocality": "Valencia",
      "addressRegion": "Carabobo",
      "postalCode": "2001",
      "addressCountry": "VE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": config.coordenadas_tienda?.lat || 10.2185,
      "longitude": config.coordenadas_tienda?.lng || -68.0021
    },
    "hasMenu": {
      "@type": "Menu",
      "url": `${SITE_URL}/catalog`
    },
    "acceptsReservations": config.tiene_mesas ? "True" : "False",
    "paymentAccepted": "Efectivo, Pago Móvil, Zelle, Punto de Venta",
    "currenciesAccepted": "USD, VES"
  };
}

// ═══════════════════════════════════════════════════════════
// SCHEMA DE PRODUCTO (Anti-canibalización + variantes)
// ═══════════════════════════════════════════════════════════

export interface ProductSchemaOptions {
  includeReviews?: boolean;
  includeNutrition?: boolean;
}

export function getProductSchema(
  product: Record<string, any>,
  config: Record<string, any>,
  options: ProductSchemaOptions = {}
): Record<string, unknown> {
  const { includeReviews = true, includeNutrition = true } = options;
  const siteUrl = config.site_url || SITE_URL;
  const productUrl = product.slug
    ? `${siteUrl}/producto/${product.slug}`
    : siteUrl;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.nombre,
    "description": buildProductDescription(product),
    "image": product.imagen_urls?.filter(Boolean).length > 0
      ? product.imagen_urls.filter(Boolean)
      : [`${siteUrl}/logo.png`],
    "url": productUrl,
    "brand": {
      "@type": "Brand",
      "name": SITE_NAME,
      "url": siteUrl
    },
    "category": buildCategoryPath(product.categoria, product.subcategoria),
    "offers": {
      "@type": "Offer",
      "url": productUrl,
      "priceCurrency": "USD",
      "price": product.precio_usd,
      "availability": getAvailability(product),
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        "name": SITE_NAME
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "USD"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "VE"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          }
        }
      }
    }
  };

  // Ingredientes y alérgenos en descripción
  if (product.ingredientes?.length > 0) {
    schema.description = `${schema.description} Ingredientes: ${product.ingredientes.join(', ')}.`;
  }
  if (product.alergenos?.length > 0) {
    schema.description = `${schema.description} Alérgenos: ${product.alergenos.join(', ')}.`;
  }

  // Nutrición
  if (includeNutrition && product.calorias) {
    schema.nutrition = {
      "@type": "NutritionInformation",
      "calories": `${product.calorias} cal`,
      "description": `Información nutricional de ${product.nombre}`
    };
  }

  // Rating
  if (includeReviews && product.order_count && product.order_count > 5) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": calculateAverageRating(product.order_count),
      "reviewCount": product.order_count,
      "bestRating": 5,
      "worstRating": 1
    };
  }

  // Promoción
  if (product.es_promo && product.precio_anterior_usd) {
    (schema.offers as Record<string, unknown>)["priceValidUntil"] =
      product.promo_end_date || getFutureDate(30);
    (schema.offers as Record<string, unknown>)["highPrice"] = product.precio_anterior_usd;
  }

  // Variantes (tamaños)
  if (product.sizes?.length > 0) {
    schema.hasVariant = product.sizes.map((size: Record<string, any>) => ({
      "@type": "Product",
      "name": `${product.nombre} - ${size.name}`,
      "description": size.description || `${product.nombre} en tamaño ${size.name}`,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": size.price_usd,
        "availability": product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        "url": productUrl
      }
    }));
  }

  return schema;
}

function buildProductDescription(product: Record<string, any>): string {
  const base = product.descripcion
    || `${product.nombre} de Market Coffee Sweet. Panadería artesanal, comida rápida y víveres frescos con delivery en Valencia, El Trigal y alrededores.`;
  return base;
}

// ═══════════════════════════════════════════════════════════
// SCHEMAS AUXILIARES (GEO + AIO)
// ═══════════════════════════════════════════════════════════

export function getFAQSchema(faqItems: Array<{ question: string; answer: string }>) {
  if (!faqItems || faqItems.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };
}

export function getBreadcrumbSchema(
  config: Record<string, any>,
  items: Array<{ name: string; url?: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url || SITE_URL
    }))
  };
}

export function getWebsiteSchema(config: Record<string, any>) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "name": SITE_NAME,
    "url": SITE_URL,
    "description": "Panadería artesanal, comida rápida, víveres frescos y delivery express en El Trigal, Valencia. Pide online con delivery en minutos.",
    "publisher": {
      "@id": `${SITE_URL}/#organization`
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function getCategoryItemListSchema(
  config: Record<string, any>,
  categorySlug: string,
  categoryName: string,
  products: Array<{ nombre: string; slug?: string; precio_usd: number; imagen_urls: string[] }>
) {
  const siteUrl = config.site_url || SITE_URL;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${categoryName} en ${SITE_NAME}`,
    "description": `Productos de ${categoryName} disponibles en ${SITE_NAME}, Valencia. Delivery rápido a domicilio.`,
    "numberOfItems": products.length,
    "itemListElement": products.slice(0, 20).map((product, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": product.slug ? `${siteUrl}/producto/${product.slug}` : siteUrl,
      "name": product.nombre,
      "image": product.imagen_urls?.[0] || `${siteUrl}/logo.png`,
      "offers": {
        "@type": "Offer",
        "price": product.precio_usd,
        "priceCurrency": "USD"
      }
    }))
  };
}
