const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'public', 'productos1.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const imagesDir = path.join(__dirname, '..', 'public', 'productos1');
const availableImages = fs.readdirSync(imagesDir).filter(f => f.endsWith('.webp'));

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function nameToSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '_')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function findImage(nombre) {
  const slug = nameToSlug(nombre);
  const exactMatch = availableImages.find(img => img === `${slug}.webp`);
  if (exactMatch) return `productos1/${exactMatch}`;
  
  // Try with underscore before 's' (e.g., gordons -> gordon_s)
  const withUnderscoreS = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '');
    return imgSlug === slug.replace(/(\w)s_/g, '$1_s_') || slug === imgSlug.replace(/_s_/g, 's_');
  });
  if (withUnderscoreS) return `productos1/${withUnderscoreS}`;
  
  const partialMatch = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '');
    return imgSlug.includes(slug) || slug.includes(imgSlug);
  });
  if (partialMatch) return `productos1/${partialMatch}`;
  return null;
}

const PLACEHOLDER_IMAGES = {
  'Bebidas': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500',
  'Menú': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500',
  'Pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=500',
  'Arepas': 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500',
  'Empanadas': 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b7?auto=format&fit=crop&q=80&w=500',
  'Combos Familiares': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=500',
  'Perro Caliente': 'https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=500',
  'Pepitos': 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500',
  'Hamburguesas': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500',
  'Shawarma': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=500',
  'Charcutería': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&q=80&w=500',
  'Licores': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=500',
};

const lines = csvContent.split('\n').filter(line => line.trim());
const products = [];
let productId = 1;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('ID') || trimmed.startsWith('"ID"') || trimmed.startsWith('" #"') || trimmed.startsWith('ID,')) continue;

  const fields = parseCSVLine(trimmed);
  if (fields.length < 5) continue;

  const [id, nombre, precio, descripcion, categoria, subcategoria] = fields;
  if (!nombre || !categoria) continue;

  let precioUsd = 0;
  if (precio && precio !== '-') {
    const priceStr = precio.replace('$', '').replace(',', '.').trim();
    precioUsd = parseFloat(priceStr) || 0;
  }

  const imageFile = findImage(nombre);
  const imagenUrls = imageFile
    ? [imageFile]
    : [PLACEHOLDER_IMAGES[categoria] || PLACEHOLDER_IMAGES['Menú']];

  products.push({
    id: `p1_${String(productId).padStart(3, '0')}`,
    nombre: nombre.trim(),
    descripcion: descripcion ? descripcion.trim() : '',
    categoria: categoria.trim(),
    subcategoria: subcategoria ? subcategoria.trim() : '',
    precio_usd: precioUsd,
    stock: 100,
    imagen_urls: imagenUrls,
    es_promo: false,
    es_nuevo: true,
    es_mas_vendido: false,
    activo: true,
    slug: nameToSlug(nombre),
  });
  productId++;
}

console.log(JSON.stringify(products, null, 2));

const outputPath = path.join(__dirname, '..', 'src', 'data', 'productos1-imported.json');
fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
console.error(`Generated ${products.length} products -> ${outputPath}`);

const cats = [...new Set(products.map(p => p.categoria))];
console.error(`Categories: ${cats.join(', ')}`);

const placeholders = products.filter(p => p.imagen_urls[0].includes('unsplash'));
console.error(`Products with placeholder: ${placeholders.length}`);
placeholders.forEach(p => console.error(`  - ${p.nombre} (${p.categoria})`));
