import { FoodItem } from '../types/store';

const SITE_URL = 'https://marketcoffeesweet.com';
const SITE_NAME = 'Market Coffee Sweet';

export interface ProductSchemaOptions {
  includeReviews?: boolean;
  includeNutrition?: boolean;
}

export function generateProductSchema(
  product: FoodItem,
  options: ProductSchemaOptions = {}
): Record<string, unknown> {
  const { includeReviews = true, includeNutrition = false } = options;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.nombre,
    'description': product.descripcion || `${product.nombre} de Market Coffee Sweet. Delivery en Valencia, El Trigal y alrededores.`,
    'image': product.imagen_urls?.filter(Boolean).length > 0
      ? product.imagen_urls.filter(Boolean)
      : [`${SITE_URL}/logo.png`],
    'url': SITE_URL,
    'brand': {
      '@type': 'Brand',
      'name': SITE_NAME,
      'url': SITE_URL
    },
    'category': buildCategoryPath(product.categoria, product.subcategoria),
    'offers': {
      '@type': 'Offer',
      'url': SITE_URL,
      'priceCurrency': 'USD',
      'price': product.precio_usd,
      'availability': getAvailability(product),
      'itemCondition': 'https://schema.org/NewCondition',
      'seller': {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        'name': SITE_NAME
      }
    }
  };

  if (product.ingredientes && product.ingredientes.length > 0) {
    schema['description'] = `${product.descripcion || product.nombre}. Ingredientes: ${product.ingredientes.join(', ')}.`;
  }

  if (includeNutrition && product.calorias) {
    schema['nutrition'] = {
      '@type': 'NutritionInformation',
      'calories': `${product.calorias} cal`,
      'description': `Información nutricional de ${product.nombre}`
    };
  }

  if (product.alergenos && product.alergenos.length > 0) {
    schema['description'] = `${schema['description']} Alérgenos: ${product.alergenos.join(', ')}.`;
  }

  if (includeReviews && product.order_count && product.order_count > 5) {
    schema['aggregateRating'] = {
      '@type': 'AggregateRating',
      'ratingValue': calculateAverageRating(product.order_count),
      'reviewCount': product.order_count,
      'bestRating': 5,
      'worstRating': 1
    };
  }

  if (product.es_promo && product.precio_anterior_usd) {
    (schema['offers'] as Record<string, unknown>)['priceValidUntil'] = product.promo_end_date || getFutureDate(30);
    schema['description'] = `${schema['description']} ¡En oferta! Antes $${product.precio_anterior_usd} USD.`;
  }

  if (product.sizes && product.sizes.length > 0) {
    schema['hasVariant'] = product.sizes.map(size => ({
      '@type': 'Product',
      'name': `${product.nombre} - ${size.name}`,
      'description': size.description || `${product.nombre} en tamaño ${size.name}`,
      'offers': {
        '@type': 'Offer',
        'priceCurrency': 'USD',
        'price': size.price_usd,
        'availability': product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        'url': SITE_URL
      }
    }));
  }

  return schema;
}

function getAvailability(product: FoodItem): string {
  if (product.disponibilidad === 'Agotado') return 'https://schema.org/OutOfStock';
  if (product.disponibilidad === 'En Reposición') return 'https://schema.org/PreOrder';
  if (product.stock > 0) return 'https://schema.org/InStock';
  return 'https://schema.org/OutOfStock';
}

function buildCategoryPath(categorias: string | string[], subcategoria?: string): string {
  const categoryMap: Record<string, string> = {
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

  const cats = Array.isArray(categorias) ? categorias : [categorias];
  const mainCategory = cats.map(c => categoryMap[c] || c).join(', ');

  if (subcategoria) {
    return `${mainCategory} > ${subcategoria}`;
  }

  return mainCategory;
}

function calculateAverageRating(orderCount: number): number {
  const baseRating = 4.2;
  const bonus = Math.min(orderCount / 100, 0.8);
  return Math.round((baseRating + bonus) * 10) / 10;
}

function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
