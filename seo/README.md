# SEO - Market Coffee Sweet

Estructura de schemas JSON-LD para SEO optimizado de Market Coffee Sweet.

## Estructura de Archivos

```
seo/
├── schemas/
│   ├── global-site.json          # Schema global del sitio (Organization + LocalBusiness)
│   ├── categories/
│   │   ├── panaderia.json        # Schema para Panadería y Pastelería
│   │   ├── comida-rapida.json    # Schema para Comida Rápida
│   │   ├── viveres.json          # Schema para Víveres y Supermercado
│   │   ├── frutas-verduras.json  # Schema para Frutas y Verduras
│   │   ├── bebidas.json          # Schema para Bebidas y Licores
│   │   ├── agua-potable.json     # Schema para Agua Potable
│   │   └── chucherias.json       # Schema para Chucherías y Snacks
│   └── pages/
│       ├── home.json             # Schema para página de inicio
│       ├── catalog.json          # Schema para catálogo
│       └── faq.json              # Schema FAQ con preguntas frecuentes
└── README.md                     # Este archivo
```

## Generación Automática de Schemas

Los schemas de productos se generan automáticamente en `src/schemas.js` cuando:

1. **Un usuario visita la página de inicio** → Se genera el schema `FastFoodRestaurant` + `Organization` + `WebSite` + `FAQPage`
2. **Un usuario visita un producto** → Se genera el schema `Product` con `Offer`, `Brand`, `AggregateRating`
3. **Un usuario visita el catálogo** → Se genera el schema `CollectionPage` + `ItemList`

## Archivos TypeScript

- `src/schemas.js` - Funciones generadoras de schemas JSON-LD
- `src/components/SEOHead.tsx` - Componente React que inyecta los schemas en el `<head>`
- `src/seo/productSchema.ts` - Utilidades adicionales para generación de schemas

## Cómo Funciona

### Al Crear un Producto (Admin)

Cuando un admin crea o edita un producto en el panel de administración:

1. El producto se guarda en Supabase
2. Cuando un usuario visita la página del producto, `SEOHead` genera automáticamente:
   - Schema `Product` con nombre, descripción, precio, disponibilidad
   - `Offer` con moneda USD, disponibilidad (InStock/OutOfStock)
   - `Brand` con nombre "Market Coffee Sweet"
   - `BreadcrumbList` para navegación
   - `AggregateRating` si hay suficientes pedidos

### Categorías Automáticas

Los productos se clasifican automáticamente en categorías SEO:

| Categoría Original | Categoría SEO |
|-------------------|---------------|
| Mercado | Víveres y Supermercado |
| Panaderia | Panadería y Pastelería |
| Comida Rapida | Comida Rápida |
| Bebidas | Bebidas y Licores |
| Frutas y Verduras | Frutas y Verduras Frescas |
| Snacks | Chucherías y Snacks |
| Agua Potable | Agua Potable |

## Zonas de Cobertura SEO

Los schemas incluyen automáticamente las zonas de cobertura:

- El Trigal
- La Trigaleña
- Prebo
- La Viña
- Mañongo
- Valencia
- Naguanagua
- San Diego

## Configuración

Las configuraciones SEO se pueden personalizar desde el panel de admin en:

**Admin → Configuración → SEO**

- Título de página de inicio
- Descripción de página de inicio
- Palabras clave
- Título de catálogo
- Descripción de catálogo
- Tipo de schema JSON-LD
- Rango de precios
- Tipos de cocina

## Schema Global (global-site.json)

El schema global incluye:

```json
{
  "@type": ["Bakery", "GroceryStore", "FastFoodRestaurant"],
  "name": "Market Coffee Sweet",
  "address": {
    "streetAddress": "Av. Principal El Trigal, justo al frente de Patio Trigal",
    "addressLocality": "Valencia",
    "addressRegion": "Carabobo",
    "addressCountry": "VE"
  },
  "geo": {
    "latitude": 10.2185,
    "longitude": -68.0021
  },
  "areaServed": ["El Trigal", "La Trigaleña", "Prebo", "La Viña", "Mañongo", "Valencia", "Naguanagua", "San Diego"],
  "servesCuisine": ["Panadería", "Comida Rápida", "Hamburguesas", "Shawarma"]
}
```

## Palabras Clave SEO Implementadas

### GEO-SEO
- "Panadería cerca de Patio Trigal Valencia"
- "Delivery de comida rápida en El Trigal y La Trigaleña"
- "Hamburguesas y shawarmas delivery Prebo y La Viña"
- "Delivery de víveres en Mañongo, Naguanagua y San Diego"
- "Botellones de agua potable a domicilio El Trigal Valencia"

### AIO (AI Optimization)
- Descripción directa para SearchGPT, Gemini, Perplexity
- Respuestas FAQ estructuradas
- Datos de contacto y ubicación claros

## Verificación

Para verificar que los schemas están correctamente implementados:

1. Ve a https://marketcoffesweet.com
2. Abre las herramientas de desarrollador (F12)
3. Busca `<script type="application/ld+json">` en el `<head>`
4. Valida el schema en https://search.google.com/structured-data/testing-tool
