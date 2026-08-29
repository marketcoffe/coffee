/**
 * Genera un slug URL-friendly a partir de un texto.
 * "Hamburguesa Doble con Queso" → "hamburguesa-doble-con-queso"
 */
export function slugify(text: string): string {
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
 * Genera un slug único para un producto basado en su nombre.
 * Si hay duplicados, agrega un sufijo numérico.
 */
export function generateProductSlug(nombre: string, existingSlugs: string[]): string {
  const base = slugify(nombre);
  if (!existingSlugs.includes(base)) return base;
  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

/**
 * Genera el slug de una categoría.
 */
export function generateCategorySlug(category: string): string {
  return slugify(category);
}
