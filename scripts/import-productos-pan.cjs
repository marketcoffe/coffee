const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'public', 'productos-pan.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const imagesDir = path.join(__dirname, '..', 'public', 'productos-pan');
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
  if (exactMatch) return `productos-pan/${exactMatch}`;
  const partialMatch = availableImages.find(img => {
    const imgSlug = img.replace('.webp', '');
    return imgSlug.includes(slug) || slug.includes(imgSlug);
  });
  if (partialMatch) return `productos-pan/${partialMatch}`;
  return null;
}

function assignSubcategoria(nombre, precio) {
  const n = nombre.toLowerCase();

  if (n.includes('torta') || n.includes('cheesecake') || n.includes('baklava') ||
      n.includes('shavier') || n.includes('galleta') || n.includes('marquesa') ||
      n.includes('trufa') || n.includes('brazo gitano') || n.includes('brownie') ||
      n.includes('donas') || n.includes('alfajor') || n.includes('reinita') ||
      n.includes('bombas') || n.includes('quesadilla') || n.includes('arequipilla') ||
      n.includes('torta de pan')) {
    return 'Pasteleria';
  }
  if (n.includes('cachito')) return 'Cachitos';
  if (n.includes('arepa rellena') || n.includes('arepas rellenas')) return 'Arepas Rellenas';
  if (n.includes('sándwich') || n.includes('sandwich')) return 'Sándwiches';
  if (n.includes('pan ') || n.includes('pan de') || n.includes('pata e gato')) return 'Panes';
  return 'Snacks';
}

function generateDescripcion(nombre, subcategoria) {
  const n = nombre.toLowerCase();

  const descripciones = {
    'baklava': 'Deliciosa baklava, postre tradicional elaborado con capas de masa filo, nueces trituradas y bañado en jarabe de miel. Crujiente y dulce.',
    'shavier': 'Suave y esponjoso shavier, pastelito relleno de crema pastelera cubierto con azúcar flor. Una Tentacion irresistible.',
    'galleta red velvet': 'Galleta red velvet con color intenso y sabor a cacao suave, cubierta con frosting de queso crema. Textura crujiente por fuera y suave por dentro.',
    'torta choconutella': 'Exquisita torta de chocolate con relleno de Nutella y cobertura de ganache de chocolate. Para los amantes del chocolate.',
    'torta chocoarequipe': 'Torta de chocolate con generoso relleno de arequipe artesanal y cobertura de ganache. Combinacion perfecta de dulce y chocolate.',
    'torta selva negra': 'Clasica torta selva negra con capas de bizcocho de chocolate, crema chantilly, cerezas y virutas de chocolate. Postre premium.',
    'cheesecake': 'Autentico cheesecake cremoso con base de galleta Graham y cobertura de frutos rojos. Textura sedosa y sabor equilibrado.',
    'torta beso de angel': 'Torta beso de angel con capas de bizcocho suave, relleno de merengue italiano y cubierta con merengue dorado al soplete.',
    'torta tres leches arequipe': 'Torta tres leches remojada en mezcla de leche evaporada, leche condensada y crema de leche, con generoso relleno de arequipe.',
    'torta tres leches fresa': 'Torta tres leches con fresas frescas frescas naturales, remojada en tres leches y cubierta con crema batida y fresas.',
    'torta tres leches limon': 'Torta tres leches con toque refrescante de limon, remojada en mezcla de tres leches y decorada con merengue de limon.',
    'torta tres leches zanahoria': 'Torta de zanahoria casera remojada en tres leches, con canela y nueces. Esponjosa, húmeda y llena de sabor.',
    'marquesa': 'Suave marquesa de chocolate, postre tradicional sin hornear elaborado con galletas de chocolate, crema de cacao y chocolate derretido.',
    'trufa de chocolate': 'Trufa artesanal de chocolate belga con centro cremoso y recubierta de cacao en polvo. Bocado pequeno de puro placer.',
    'brazo gitano': 'Brazo gitano de bizcocho suave relleno de mermelada de guayaba y cubierto con azucar glas. Postre tipico y irresistible.',
    'brownie porcion': 'Brownie denso y chocolatoso con costra crujiente por fuera y centro húmedo. Porcion generosa para disfrutar.',
    'torta de pan': 'Torta de pan casera elaborada con pan remojado en leche, canela y especias. Postre tipico hogareño con sabor tradicional.',
    'donas': 'Donas frescas fritas, esponjosas y cubiertas con azucar. Perfectas para acompanar el cafe de la manana.',
    'bombas': 'Bombas de masa frita rellenas de crema pastelera, cubiertas con azucar flor. Grandes, esponjosas y deliciosas.',
    'mini bombas': 'Mini bombas de masa frita rellenas de crema pastelera. Porcion ideal para picar entre varios.',
    'alfajores (1 unid)': 'Alfajor artesanal de maizena relleno de arequipe y cubierto con coco rallado. Unidad individual.',
    'alfajores (pack 3x1,60$)': 'Pack de 3 alfajores artesanales de maizena rellenos de arequipe y cubiertos con coco rallado.',
    'reinitas (1 unid)': 'Reinita tipica, galleta crocante de anis con forma de flor. Sabor tradicional en unidad individual.',
    'pan de queso': 'Pan de queso fresco y esponjoso, con sabor intenso a queso criollo. Ideal para el desayuno o merienda.',
    'pan de queso, tocino y tajada': 'Pan de queso con trozos de tocineta crocante y tajada de queso derretido. Combinacion salada irresistible.',
    'mini lunch': 'Mini lunch:组合 completo de snacks incluye empanada, tequeño, pastelito y mas. Porcion perfecta para compartir.',
    'churros': 'Churros recien fritos, crocantes por fuera y suaves por dentro, espolvoreados con azucar y canela. Acompanados de salsa de chocolate.',
    'empanadas': 'Empanadas rellenas de carne mechada sazonada, fritas hasta alcanzar un dorado perfecto. Crujientes y jugosas.',
    'tequenos': 'Tequenos de queso blanco fresco envueltos en masa crujiente, fritos hasta alcanzar un dorado perfecto. Tipicos y deliciosos.',
    'pastelito': 'Pastelito relleno de carne sazonada, frito y dorado. Masa crujiente con relleno sabroso.',
    'pan frances (grande)': 'Pan frances grande, clasico pan venezolano con corteza crujiente y miga suave. Fresco del dia.',
    'pan frances (pequeno)': 'Pan frances pequeno, clasico pan venezolano con corteza crujiente y miga suave. Tamano ideal para un individual.',
    'pan canilla (grande)': 'Pan canilla grande, suave y esponjoso, ideal para preparar sandwiches o acompanar cualquier comida.',
    'pan canilla (pequeno)': 'Pan canilla pequeno, suave y esponjoso. Tamano perfecto para snacks o desayunos ligeros.',
    'pan canilla concha dura': 'Pan canilla con concha dura crocante por fuera y miga suave por dentro. Textura clasica y sabor tradicional.',
    'pan perro pequeno': 'Pan para perro caliente, suave y elástico, tamano pequeno. Ideal para preparar hot dogs caseros.',
    'pan hamburguesa': 'Pan para hamburguesa, suave y dorado con semillas de sesamo. Base perfecta para hamburguesas caseras.',
    'pan campesino': 'Pan campesino artesanal, denso y rústico con sabor intenso a trigo. Ideal para acompañar sopas y guisos.',
    'pan gallego': 'Pan gallego, pan tradicional de corteza crujiente y miga alveolada. Sabor auténtico de panaderia artesanal.',
    'pan galleguito': 'Pan galleguito, version pequeña del pan gallego. Crocante por fuera, suave por dentro. Perfecto para porciones individuales.',
    'pan siciliano': 'Pan siciliano con sabor intenso a ajo y hierbas aromáticas. Corteza crujiente y miga suave. Ideal para acompañar pastas.',
    'pan masa madre': 'Pan de masa madre fermentada naturalmente, con sabor ligeramente acido y textura alveolada. Sin aditivos artificiales.',
    'pan de guayaba': 'Pan dulce de guayaba, suave y aromático con relleno de pasta de guayaba. Perfecto para el desayuno o merienda.',
    'pan chino': 'Pan chino, pan dulce venezolano suave y esponjoso con sabor ligeramente dulce. Clasico de la panaderia.',
    'pan de arequipe': 'Pan dulce relleno de arequipe artesanal, suave y esponjoso. Combina la dulzura del pan con el sabor del caramelo.',
    'pan andino': 'Pan andino artesanal, denso y rústico elaborado con harina de trigo integral. Sabor intenso y textura firme.',
    'pan trenza': 'Pan trenza trenzado artesanalmente, suave y esponjoso con corteza dorada. Perfecto para desayunos y meriendas.',
    'quesadilla / arequipilla': 'Quesadilla o arequipilla, pan dulce tradicional con queso crema y sabor ligeramente dulce. Suave y esponjoso.',
    'pan de coco': 'Pan de coco aromático con trozos de coco rallado, suave y esponjoso. Sabor tropical irresistible.',
    'pan de coco con leche condensada': 'Pan de coco con generoso baño de leche condensada, dulce y cremoso. Una delicia tropical.',
    'pata e gato': 'Pan pata de gato, pan dulce crujiente con forma característica, sabor ligeramente dulce y textura crocante.',
    'pan uva': 'Pan de uva dulce con pasas jugosas distribuidas en la masa suave. Ideal para desayunos y meriendas.',
    'pan chino grande': 'Pan chino grande, pan dulce venezolano suave y esponjoso en tamano generoso. Perfecto para compartir.',
    'pizza individual': 'Pizza individual con masa crujiente, salsa de tomate casera, queso mozzarella derretido y topping a elegir.',
    'sandwich pequeno': 'Sandwich preparado en pan fresco con ingredientes selectos. Tamano ideal para un snack ligero.',
    'sandwich mediano': 'Sandwich preparado en pan fresco con generosa porcion de ingredientes. Tamano perfecto para el almuerzo.',
    'sandwich grande': 'Sandwich grande preparado en pan fresco con doble porcion de ingredientes. Para los que tienen mucho apetito.',
    'sandwich granjero': 'Sandwich granjero con jamón, queso, lechuga, tomate y mayonesa en pan tostado. Clasico y sustancioso.',
    'sandwich granjerito': 'Sandwich granjerito, version compacta del sandwich granjero. Jamón, queso y vegetales frescos en pan suave.',
  };

  const key = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()]/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
  for (const [k, v] of Object.entries(descripciones)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  if (subcategoria === 'Panes') return `${nombre} fresco de panaderia, elaborado con ingredientes de calidad. Ideal para acompanar cualquier comida.`;
  if (subcategoria === 'Pasteleria') return `${nombre}, postre artesanal preparado con ingredientes frescos y de primera calidad.`;
  if (subcategoria === 'Cachitos') return `${nombre}, cachito fresco y crocante relleno con ingredientes selectos. Perfecto para el desayuno.`;
  if (subcategoria === 'Arepas Rellenas') return `${nombre}, arepa rellena con ingredientes frescos y contornos selectos. Tipica y deliciosa.`;
  if (subcategoria === 'Sándwiches') return `${nombre}, sandwich preparado en pan fresco con ingredientes de calidad.`;
  return `${nombre}, snack fresco de panaderia, preparado con ingredientes selectos.`;
}

function generateIngredientes(nombre, subcategoria) {
  const n = nombre.toLowerCase();
  const ingredientes = [];

  if (n.includes('torta') || n.includes('cheesecake') || n.includes('marquesa') || n.includes('brownie')) {
    ingredientes.push('Harina de trigo', 'Huevos', 'Azucar', 'Mantequilla');
    if (n.includes('chocolate') || n.includes('choco') || n.includes('brownie')) ingredientes.push('Chocolate');
    if (n.includes('tres leches')) ingredientes.push('Leche evaporada', 'Leche condensada', 'Crema de leche');
    if (n.includes('arequipe')) ingredientes.push('Arequipe');
    if (n.includes('fresa')) ingredientes.push('Fresas frescas');
    if (n.includes('limon')) ingredientes.push('Jugo de limon', 'Ralladura de limon');
    if (n.includes('zanahoria')) ingredientes.push('Zanahoria rallada', 'Nueces', 'Canela');
    if (n.includes('selva negra')) ingredientes.push('Cerezas', 'Crema chantilly');
    if (n.includes('nutella')) ingredientes.push('Nutella');
    if (n.includes('beso de angel')) ingredientes.push('Merengue italiano');
  } else if (subcategoria === 'Panes') {
    ingredientes.push('Harina de trigo', 'Levadura', 'Sal', 'Agua');
    if (n.includes('queso')) ingredientes.push('Queso criollo');
    if (n.includes('tocino')) ingredientes.push('Tocineta');
    if (n.includes('coco')) ingredientes.push('Coco rallado');
    if (n.includes('guayaba')) ingredientes.push('Pasta de guayaba');
    if (n.includes('arequipe')) ingredientes.push('Arequipe');
    if (n.includes('uva') || n.includes('pasas')) ingredientes.push('Pasas');
    if (n.includes('sesamo')) ingredientes.push('Semillas de sesamo');
    if (n.includes('masa madre')) ingredientes.push('Masa madre natural');
    if (n.includes('ajo') || n.includes('siciliano')) ingredientes.push('Ajo', 'Hierbas aromaticas');
    if (n.includes('integral') || n.includes('andino')) ingredientes.push('Harina integral');
  } else if (subcategoria === 'Cachitos') {
    ingredientes.push('Masa de pan', 'Mantequilla');
    if (n.includes('jamón') && n.includes('queso')) { ingredientes.push('Jamón', 'Queso'); }
    else if (n.includes('jamón')) { ingredientes.push('Jamón'); }
    else if (n.includes('mortadela')) { ingredientes.push('Mortadela', 'Queso'); }
  } else if (subcategoria === 'Arepas Rellenas') {
    ingredientes.push('Maiz pelao', 'Sal');
    if (n.includes('contornos')) ingredientes.push('Contornos a elegir');
  } else if (subcategoria === 'Sándwiches') {
    ingredientes.push('Pan fresco', 'Proteina a elegir', 'Vegetales frescos', 'Salsas');
  } else if (subcategoria === 'Snacks') {
    ingredientes.push('Masa fresca');
    if (n.includes('empanada')) ingredientes.push('Carne mechada', 'Cebolla', 'Pimiento');
    if (n.includes('tequeño')) ingredientes.push('Queso blanco');
    if (n.includes('churro')) ingredientes.push('Azucar', 'Canela');
    if (n.includes('pastelito')) ingredientes.push('Carne sazonada');
    if (n.includes('pizza')) ingredientes.push('Salsa de tomate', 'Queso mozzarella');
  }

  if (ingredientes.length === 0) ingredientes.push('Ingredientes frescos de calidad');
  return ingredientes;
}

const lines = csvContent.split('\n').filter(line => line.trim());
const products = [];
let productId = 1;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('producto')) continue;

  const fields = parseCSVLine(trimmed);
  if (fields.length < 2) continue;

  const nombre = fields[0].trim();
  const precio = fields[1] ? parseFloat(fields[1]) : 0;
  if (!nombre || isNaN(precio)) continue;

  const subcategoria = assignSubcategoria(nombre, precio);
  const descripcion = generateDescripcion(nombre, subcategoria);
  const ingredientes = generateIngredientes(nombre, subcategoria);
  const imageFile = findImage(nombre);
  const imagenUrls = imageFile ? [imageFile] : ['https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=500'];

  const esPromo = nombre.toLowerCase().includes('promo');
  const esMasVendido = ['torta tres leches arequipe', 'cheesecake', 'pan frances', 'cachito de jamon', 'pan de queso'].some(p => nombre.toLowerCase().includes(p));

  products.push({
    id: `pnd_${String(productId).padStart(3, '0')}`,
    nombre,
    descripcion,
    categoria: 'Panaderia',
    subcategoria,
    precio_usd: precio,
    stock: 100,
    imagen_urls: imagenUrls,
    es_promo: esPromo,
    es_nuevo: false,
    es_mas_vendido: esMasVendido,
    activo: true,
    ingredientes,
    slug: nameToSlug(nombre),
  });
  productId++;
}

const outputPath = path.join(__dirname, '..', 'src', 'data', 'productos-pan-imported.json');
fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
console.log(`Generados ${products.length} productos -> ${outputPath}`);

const cats = {};
products.forEach(p => {
  if (!cats[p.subcategoria]) cats[p.subcategoria] = 0;
  cats[p.subcategoria]++;
});
console.log('Subcategorias:');
Object.entries(cats).forEach(([k, v]) => console.log(`  ${k}: ${v} productos`));

const placeholders = products.filter(p => p.imagen_urls[0].includes('unsplash'));
console.log(`Productos con imagen placeholder: ${placeholders.length}`);
placeholders.forEach(p => console.log(`  - ${p.nombre}`));
