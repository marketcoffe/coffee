// schemas.js — SEO JSON-LD para Market Coffee Sweet
/* global window */

const SITE_URL = 'https://marketcoffeesweet.com';

export function getOrganizationSchema(config) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": "Market Coffee Sweet",
    "legalName": "Coffee Market Sweet C.A.",
    "taxID": "J500338260",
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": config.logo_url || `${SITE_URL}/logo.png`,
      "width": 512,
      "height": 512
    },
    "description": "Panadería, comida rápida, víveres y delivery en El Trigal, Valencia.",
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

export function getLocalBusinessSchema(config) {
  return {
    "@context": "https://schema.org",
    "@type": ["Bakery", "GroceryStore", "FastFoodRestaurant"],
    "@id": `${SITE_URL}/#localbusiness`,
    "name": "Market Coffee Sweet",
    "legalName": "Coffee Market Sweet C.A.",
    "taxID": "J500338260",
    "url": SITE_URL,
    "telephone": config.telefono_soporte || "+584123758879",
    "priceRange": config.jsonld_priceRange || "$$",
    "image": [
      config.banners?.[0] || config.logo_url || `${SITE_URL}/fachada.jpg`,
      config.logo_url || `${SITE_URL}/logo.png`
    ],
    "logo": config.logo_url || `${SITE_URL}/logo.png`,
    "description": "Panadería fresca, hamburguesas, shawarmas, víveres, frutas, verduras, bebidas y agua potable con delivery en El Trigal, Valencia.",
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
      "Panadería",
      "Comida Rápida",
      "Hamburguesas",
      "Shawarma",
      "Perros Calientes",
      "Víveres",
      "Bebidas"
    ],
    "hasMenu": {
      "@type": "Menu",
      "url": SITE_URL
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
    "sameAs": [
      "https://www.instagram.com/marketcoffeesweet",
      "https://www.tiktok.com/@marketcoffeesweet"
    ]
  };
}

export function getRestaurantSchema(config) {
  return {
    "@context": "https://schema.org",
    "@type": config.jsonld_type || "FastFoodRestaurant",
    "@id": `${SITE_URL}/#localbusiness`,
    "name": "Market Coffee Sweet",
    "legalName": "Coffee Market Sweet C.A.",
    "taxID": "J500338260",
    "image": config.banners?.[0] || config.logo_url || `${SITE_URL}/fachada.jpg`,
    "url": SITE_URL,
    "description": "Panadería fresca, hamburguesas, shawarmas, víveres, frutas, verduras, bebidas y agua potable con delivery en El Trigal, Valencia.",
    "priceRange": config.jsonld_priceRange || "$$",
    "telephone": config.telefono_soporte || "+584123758879",
    "servesCuisine": config.jsonld_servesCuisine || [
      "Panadería",
      "Comida Rápida",
      "Hamburguesas",
      "Shawarma",
      "Perros Calientes",
      "Víveres",
      "Bebidas"
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
      "url": SITE_URL
    },
    "acceptsReservations": config.tiene_mesas ? "True" : "False"
  };
}

export function getProductSchema(product, config) {
  const siteUrl = config.site_url || SITE_URL;

  const categoryMap = {
    'Mercado': 'Víveres y Supermercado',
    'Panaderia': 'Panadería y Pastelería',
    'Panadería': 'Panadería y Pastelería',
    'Comida Rapida': 'Comida Rápida',
    'Comida Rápida': 'Comida Rápida',
    'Bebidas': 'Bebidas y Licores',
    'Frutas y Verduras': 'Frutas y Verduras Frescas',
    'Snacks': 'Chucherías y Snacks',
    'Chucherias': 'Chucherías y Snacks',
    'Agua Potable': 'Agua Potable',
    'Licores': 'Bebidas y Licores',
    'Limpieza': 'Víveres y Supermercado',
    'Higiene': 'Víveres y Supermercado'
  };

  const cats = Array.isArray(product.categoria) ? product.categoria : [product.categoria];
  const categoryPath = product.subcategoria
    ? `${cats.map(c => categoryMap[c] || c).join(', ')} > ${product.subcategoria}`
    : cats.map(c => categoryMap[c] || c).join(', ');

  const getAvailability = () => {
    if (product.disponibilidad === 'Agotado') return 'https://schema.org/OutOfStock';
    if (product.disponibilidad === 'En Reposición') return 'https://schema.org/PreOrder';
    if (product.stock > 0) return 'https://schema.org/InStock';
    return 'https://schema.org/OutOfStock';
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.nombre,
    "description": product.descripcion
      ? `${product.descripcion}. Ingredientes: ${(product.ingredientes || []).join(', ')}.`
      : `${product.nombre} de Market Coffee Sweet. Delivery en Valencia, El Trigal y alrededores.`,
    "image": product.imagen_urls?.filter(Boolean).length > 0
      ? product.imagen_urls.filter(Boolean)
      : [`${siteUrl}/logo.png`],
    "url": siteUrl,
    "brand": {
      "@type": "Brand",
      "name": "Market Coffee Sweet",
      "url": siteUrl
    },
    "category": categoryPath,
    "offers": {
      "@type": "Offer",
      "url": siteUrl,
      "priceCurrency": "USD",
      "price": product.precio_usd,
      "availability": getAvailability(),
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        "name": "Market Coffee Sweet"
      }
    },
    "aggregateRating": product.averageRating ? {
      "@type": "AggregateRating",
      "ratingValue": product.averageRating,
      "reviewCount": product.reviewCount || 1,
      "bestRating": 5,
      "worstRating": 1
    } : undefined
  };

  if (product.es_promo && product.precio_anterior_usd) {
    schema.offers = {
      ...schema.offers,
      "@type": "AggregateOffer",
      "lowPrice": product.precio_usd,
      "highPrice": product.precio_anterior_usd,
      "priceValidUntil": product.promo_end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  return schema;
}

export function getFAQSchema(faqItems) {
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

export function getBreadcrumbSchema(config, items) {
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

export function getWebsiteSchema(config) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "name": "Market Coffee Sweet",
    "url": SITE_URL,
    "description": "Panadería, comida rápida, víveres y delivery en El Trigal, Valencia.",
    "publisher": {
      "@id": `${SITE_URL}/#organization`
    }
  };
}
