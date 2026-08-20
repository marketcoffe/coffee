const fs = require('fs');
const path = require('path');

// Leer el CSV
const csvPath = path.join(__dirname, '../public/productos-lista.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Leer imágenes disponibles
const imagesDir = path.join(__dirname, '../public/productos');
const availableImages = fs.readdirSync(imagesDir).filter(f => f.endsWith('.webp'));

// Función para generar slug limpio
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Función para limpiar nombre de producto
function cleanProductName(name) {
  let cleaned = name.replace(/^\d+\.\s*/, '');
  cleaned = cleaned.replace(/^Código:\s*[^\|]*\|\s*Producto:\s*/i, '');
  cleaned = cleaned.replace(/\s*\|\s*Precio:.*$/i, '');
  cleaned = cleaned.replace(/^.*\|\s*Producto:\s*/i, '');
  return cleaned.trim();
}

// Función para extraer el peso/presentación del nombre
function extractWeightFromName(name) {
  // Buscar patrones como "250ml", "1.5 Lt", "500gr", "4 Und", etc.
  const match = name.match(/\s+(\d+(?:\.\d+)?\s*(?:und|kg|g|ml|lt|l|gr|ltrs?|onzas?))\s*$/i);
  if (match) {
    return match[1].trim().toUpperCase();
  }
  return null;
}

// Función para normalizar peso para comparación
function normalizeWeight(weight) {
  if (!weight) return '';
  return weight
    .toUpperCase()
    .replace(/\s+/g, '') // Remover todos los espacios
    .replace(/^(\d+\.?\d*)\s*(.*)$/, '$1$2') // Asegurar que no haya espacio entre número y unidad
    .replace(/LT$/g, 'L')
    .replace(/LTRS?$/g, 'L')
    .trim();
}

// Función para obtener el nombre base (sin el peso)
function getBaseName(name) {
  // Remover el peso del final del nombre
  return name.replace(/\s+\d+(?:\.\d+)?\s*(?:und|kg|g|ml|lt|l|gr|ltrs?|onzas?)\s*$/i, '').trim();
}

// Función para asignar categoría basada en el nombre del producto
function assignCategory(name, existingCategory) {
  if (existingCategory && existingCategory !== 'Sin categoría' && existingCategory !== '') {
    return existingCategory;
  }
  
  const nameLower = name.toLowerCase();
  
  // Bebidas
  if (nameLower.match(/\b(agua|jugo|té|refresco|gaseosa|naranjada|chicha|leche|yogurt|malt|bebida|néctar)\b/)) {
    return 'Bebidas';
  }
  
  // Lácteos
  if (nameLower.match(/\b(leche|yogurt|mantequilla|queso|crema)\b/)) {
    return 'Lácteos';
  }
  
  // Carnicería
  if (nameLower.match(/\b(cerdo|res|pollo|carne|pork|beef|chicken|chorizo|morcilla|hamburguesa|punta|lomo|copa|asado)\b/)) {
    return 'Carnicería';
  }
  
  // Charcutería y Embutidos
  if (nameLower.match(/\b(chorizo|morcilla|embutido|salchicha|longaniza|jamón)\b/)) {
    return 'Charcutería y Embutidos';
  }
  
  // Congelados
  if (nameLower.match(/\b(congelado|tequeño|pizza|helado|papas)\b/)) {
    return 'Congelados';
  }
  
  // Snacks y Frituras
  if (nameLower.match(/\b(chips|papas|tostón|chicharrón|snack|fritura|nachos)\b/)) {
    return 'Snacks y Frituras';
  }
  
  // Abarrotes y Despensa
  if (nameLower.match(/\b(arroz|pasta|harina|aceite|vinagre|azúcar|sal|café|chocolate|cereal|avena|maíz|fideo)\b/)) {
    return 'Abarrotes y Despensa';
  }
  
  // Salsas y Condimentos
  if (nameLower.match(/\b(salsa|ketchup|mayonesa|mostaza|adobo|sazonador|especia|canela)\b/)) {
    return 'Salsas y Condimentos';
  }
  
  // Limpieza
  if (nameLower.match(/\b(limpiador|detergente|suavizante|desinfectante|jabón|lavaplatos|cloro|ajax|pato|vanish)\b/)) {
    return 'Limpieza';
  }
  
  // Higiene Personal
  if (nameLower.match(/\b(shampoo|acondicionador|crema dental|cepillo|desodorante|jabón|toalla|pañal|gel|loción)\b/)) {
    return 'Higiene Personal';
  }
  
  // Mascotas
  if (nameLower.match(/\b(perrina|gatarina|perro|gato|mascota|pet|canino|felino)\b/)) {
    return 'Mascotas';
  }
  
  // Electrónica y Hogar
  if (nameLower.match(/\b(papel|aluminio|bolsa|vela|fósforo|pila|batería|cinta|pegamento)\b/)) {
    return 'Hogar';
  }
  
  // Bebidas Alcohólicas
  if (nameLower.match(/\b(vino|cerveza|ron|whisky|vodka|GINEBRA|pisco|aguardiente)\b/)) {
    return 'Bebidas Alcohólicas';
  }
  
  // Conservas
  if (nameLower.match(/\b(atún|sardina|pasta|tomate|maíz|arveja|champiñón|palmito|aceituna|pepinillo|alcaparra|garbanzo)\b/)) {
    return 'Conservas';
  }
  
  // Parrilla y Carbón
  if (nameLower.match(/\b(carbón|parrilla|brasa|leña)\b/)) {
    return 'Parrilla y Carbón';
  }
  
  // Repostería
  if (nameLower.match(/\b(pastel|torta|galleta|mermelada|chocolate|vainilla|esencia|harina|azúcar|canela)\b/)) {
    return 'Repostería';
  }
  
  // Carnes y Embutidos
  if (nameLower.match(/\b(ricci|montserratina|pork|carne|cerdo|pollo)\b/)) {
    return 'Carnicería';
  }
  
  // Abarrotes y Despensa (categoría más amplia)
  if (nameLower.match(/\b(salsa|ketchup|mayonesa|mostaza|aceite|vinagre|tomate|pasta|arroz|harina|café|chocolate|cereal)\b/)) {
    return 'Abarrotes y Despensa';
  }
  
  // Bebidas (categoría más amplia)
  if (nameLower.match(/\b(agua|jugo|té|refresco|gaseosa|naranjada|chicha|leche|yogurt|malt|bebida|néctar|ron|whisky|vodka|cerveza|vino)\b/)) {
    return 'Bebidas';
  }
  
  // Limpieza (categoría más amplia)
  if (nameLower.match(/\b(limpiador|detergente|suavizante|desinfectante|jabón|lavaplatos|cloro|ajax|pato|vanish|toallita)\b/)) {
    return 'Limpieza';
  }
  
  // Higiene Personal (categoría más amplia)
  if (nameLower.match(/\b(shampoo|acondicionador|crema dental|cepillo|desodorante|jabón|toalla|pañal|gel|loción|papel|servilleta)\b/)) {
    return 'Higiene Personal';
  }
  
  // Mascotas (categoría más amplia)
  if (nameLower.match(/\b(perrina|gatarina|perro|gato|mascota|pet|canino|felino|ringo|mirringo)\b/)) {
    return 'Mascotas';
  }
  
  // Electrónica y Hogar (categoría más amplia)
  if (nameLower.match(/\b(papel|aluminio|bolsa|vela|fósforo|pila|batería|cinta|pegamento|esponja|trapeador)\b/)) {
    return 'Hogar';
  }
  
  // Conservas (categoría más amplia)
  if (nameLower.match(/\b(atún|sardina|pasta|tomate|maíz|arveja|champiñón|palmito|aceituna|pepinillo|alcaparra|garbanzo|pure)\b/)) {
    return 'Conservas';
  }
  
  // Snacks y Frituras (categoría más amplia)
  if (nameLower.match(/\b(chips|papas|tostón|chicharrón|snack|fritura|nachos|galleta)\b/)) {
    return 'Snacks y Frituras';
  }
  
  // Congelados (categoría más amplia)
  if (nameLower.match(/\b(congelado|tequeño|pizza|helado|papas)\b/)) {
    return 'Congelados';
  }
  
  // Productos de limpieza y hogar adicionales
  if (nameLower.match(/\b(glade|aromatizante|varita|diablo|osirex|segueta|cuchilla|vela|formula|mecanica|probador|corriente|bolsa|ziploc|calidex)\b/)) {
    return 'Hogar';
  }
  
  // Productos de higiene personal adicionales
  if (nameLower.match(/\b(pañal|securezza|oki|colgate|plax|tinte|igora|maxton|pre-tratamiento|tratamiento|toalla|always|abunda|diva|protector|diario)\b/)) {
    return 'Higiene Personal';
  }
  
  // Productos de mascotas adicionales
  if (nameLower.match(/\b(colonia|rinti|antipulgas|espuma|bano|seco)\b/)) {
    return 'Mascotas';
  }
  
  // Productos de limpieza adicionales
  if (nameLower.match(/\b(mata|olores|valp|insect|plagatox|hormiga|zancudo|diablo|rojo|hornos)\b/)) {
    return 'Limpieza';
  }
  
  // Productos de bebestibles adicionales
  if (nameLower.match(/\b(rikomalt|aguafiel|green|spot|tequeño|fiestero)\b/)) {
    return 'Bebidas';
  }
  
  // Productos de conservas adicionales
  if (nameLower.match(/\b(frijol|arveja|maiz|cotufa|cereza|aceituna|pepinillo|alcaparra|palmito|guisante|atun|sardina|pepitona|mermelada|sweet|relish|tomate|pure|pan|arepita|dulce|melaza|uva|darna|sabroseador|ricos|verde|partida|pantera|negra|rode|sole|pelado|olive|deshuesada|deshuesadas|entera|frasco|lata|picante|mexicana|almibar|osole|ole|nerano|loreto|mary|lta|margarita)\b/)) {
    return 'Conservas';
  }
  
  // Productos de lácteos adicionales
  if (nameLower.match(/\b(rikesa|cheddar|parmesano|tocineta|margarina|nelly|mavesa|mayonesa|dona|tita|maizina|toddy)\b/)) {
    return 'Lácteos';
  }
  
  // Productos de hogar adicionales
  if (nameLower.match(/\b(vela|oracion|bipa)\b/)) {
    return 'Hogar';
  }
  
  // Si no se encontró categoría, asignar "Otros"
  return 'Otros';
}

// Función para buscar imagen
function findImage(slug, cleanedName) {
  const normalizedSlug = slug.replace(/-/g, '_');
  
  // Buscar imagen exacta
  const exact = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '');
    return imgSlug === slug || imgSlug === normalizedSlug;
  });
  if (exact) return `productos/${exact}`;
  
  // Buscar imagen que contenga el slug (normalizado)
  const contains = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '').toLowerCase().replace(/-/g, '_');
    return imgSlug.includes(normalizedSlug) || normalizedSlug.includes(imgSlug);
  });
  if (contains) return `productos/${contains}`;
  
  // Buscar imagen por nombre similar (más flexible)
  const nameWords = cleanedName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const similar = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '').toLowerCase();
    const matchCount = nameWords.filter(word => imgSlug.includes(word)).length;
    return matchCount >= Math.ceil(nameWords.length * 0.5); // 50% de coincidencia
  });
  if (similar) return `productos/${similar}`;
  
  return null;
}

// Parsear CSV
const lines = csvContent.split('\n');
const products = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Parsear línea CSV respetando comillas
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim());
  
  if (values.length < 10) continue;
  
  const [
    sku,
    category,
    name,
    presentation,
    price,
    slugUrl,
    seoDescription,
    metaDescription,
    keywords,
    imageFile,
    status,
    visibility,
    inventory
  ] = values;
  
  // Saltar si está vacío o no tiene precio
  if (!name || !price || price === '') continue;
  
  const cleanedName = cleanProductName(name);
  const priceNum = parseFloat(price);
  
  if (isNaN(priceNum)) continue;
  
  // Extraer peso del nombre o de la presentación
  const weight = extractWeightFromName(cleanedName) || (presentation ? presentation.trim() : null);
  const baseName = getBaseName(cleanedName);
  const baseSlug = generateSlug(baseName || cleanedName);
  
  products.push({
    originalName: name,
    cleanedName,
    baseName,
    category: assignCategory(cleanedName, category),
    weight,
    price: priceNum,
    slug: slugUrl || generateSlug(cleanedName),
    baseSlug,
    image: findImage(baseSlug, baseName || cleanedName),
    inventory: parseInt(inventory) || 100,
    keywords: keywords || ''
  });
}

// Agrupar productos por nombre base (consolidar variaciones)
const groupedProducts = {};

products.forEach(product => {
  // Crear clave de agrupación basada en el nombre base
  const groupKey = (product.baseName || product.cleanedName).toLowerCase();
  
  if (!groupedProducts[groupKey]) {
    groupedProducts[groupKey] = {
      name: product.baseName || product.cleanedName,
      category: product.category,
      baseSlug: product.baseSlug,
      image: product.image,
      keywords: product.keywords,
      variations: []
    };
  }
  
  // Verificar si la variación ya existe (usando peso normalizado)
  const normalizedWeight = normalizeWeight(product.weight);
  const existingVariation = groupedProducts[groupKey].variations.find(
    v => normalizeWeight(v.weight) === normalizedWeight && v.price === product.price
  );
  
  if (!existingVariation) {
    groupedProducts[groupKey].variations.push({
      weight: product.weight,
      price: product.price,
      slug: product.slug,
      inventory: product.inventory
    });
  }
});

// Convertir a array de productos finales
const finalProducts = [];
let productId = 1;

Object.values(groupedProducts).forEach(group => {
  // Si solo tiene una variación, es producto simple
  if (group.variations.length === 1) {
    const variation = group.variations[0];
    finalProducts.push({
      id: `prod_${String(productId).padStart(4, '0')}`,
      nombre: group.name,
      descripcion: `${group.name} disponible para delivery.`,
      categoria: group.category,
      precio_usd: variation.price,
      stock: variation.inventory,
      imagen_urls: group.image ? [group.image] : [],
      es_promo: false,
      es_nuevo: false,
      es_mas_vendido: false,
      activo: true,
      slug: variation.slug,
      palabras_clave: group.keywords
    });
    productId++;
  } else {
    // Tiene múltiples variaciones (mismo nombre, diferente peso)
    const mainSlug = group.baseSlug;
    
    finalProducts.push({
      id: `prod_${String(productId).padStart(4, '0')}`,
      nombre: group.name,
      descripcion: `${group.name} disponible en diferentes presentaciones.`,
      categoria: group.category,
      precio_usd: group.variations[0].price,
      stock: group.variations.reduce((sum, v) => sum + v.inventory, 0),
      imagen_urls: group.image ? [group.image] : [],
      es_promo: false,
      es_nuevo: false,
      es_mas_vendido: false,
      activo: true,
      slug: mainSlug,
      palabras_clave: group.keywords,
      sizes: group.variations.map((v, idx) => ({
        id: `size_${idx + 1}`,
        name: v.weight || 'Unitario',
        price_usd: v.price,
        description: v.weight ? `${group.name} - ${v.weight}` : group.name
      }))
    });
    productId++;
  }
});

// Guardar resultado
const outputPath = path.join(__dirname, '../src/data/products.json');
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(finalProducts, null, 2));

// Estadísticas
const withVariations = finalProducts.filter(p => p.sizes && p.sizes.length > 1);
const simple = finalProducts.filter(p => !p.sizes || p.sizes.length <= 1);

console.log('=== PROCESAMIENTO DE PRODUCTOS COMPLETADO ===');
console.log(`Total de productos: ${finalProducts.length}`);
console.log(`Productos simples: ${simple.length}`);
console.log(`Productos con variaciones: ${withVariations.length}`);
console.log(`\nArchivo generado: ${outputPath}`);

// Mostrar todos los productos con variaciones
if (withVariations.length > 0) {
  console.log('\n=== PRODUCTOS CON VARIACIONES ===');
  withVariations.forEach(p => {
    console.log(`\n${p.nombre}:`);
    p.sizes.forEach(s => {
      console.log(`  - ${s.name}: $${s.price_usd}`);
    });
  });
}
