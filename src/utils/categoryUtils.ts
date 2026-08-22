// categoryUtils.ts — Utilidades para manejo de categorías múltiples
import { FoodItem } from '../types/store';

/**
 * Obtiene las categorías de un producto como array.
 * Soporta tanto string (legacy) como string[] (nuevo formato).
 */
export function getCategories(item: FoodItem): string[] {
  if (Array.isArray(item.categoria)) return item.categoria;
  if (typeof item.categoria === 'string' && item.categoria) return [item.categoria];
  return [];
}

/**
 * Verifica si un producto pertenece a una categoría específica.
 */
export function hasCategory(item: FoodItem, category: string): boolean {
  return getCategories(item).some(c => c.toLowerCase() === category.toLowerCase());
}

/**
 * Verifica si un producto pertenece a alguna de las categorías dadas.
 */
export function hasAnyCategory(item: FoodItem, categories: string[]): boolean {
  return getCategories(item).some(pc =>
    categories.some(c => c.toLowerCase() === pc.toLowerCase())
  );
}

/**
 * Busca en categorías usando includes (para búsquedas parciales).
 */
export function categoryIncludes(item: FoodItem, search: string): boolean {
  const q = search.toLowerCase();
  return getCategories(item).some(c => c.toLowerCase().includes(q));
}

/**
 * Retorna la primera categoría del producto (para mostrar en UI donde solo cabe una).
 */
export function getPrimaryCategory(item: FoodItem): string {
  const cats = getCategories(item);
  return cats[0] || '';
}

/**
 * Retorna todas las categorías como string separado por " · " (para display).
 */
export function formatCategories(item: FoodItem): string {
  return getCategories(item).join(' · ');
}

/**
 * Convierte un string legacy a array (para migración gradual).
 */
export function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
}
