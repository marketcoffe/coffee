import {
  UtensilsCrossed, Pizza, Sandwich, Coffee, IceCream, Beef,
  Salad, Beer, Cake,
} from 'lucide-react';
import type React from 'react';

export const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  'mercado': Salad,
  'panaderia': Cake,
  'comida rapida': Sandwich,
  'combos': UtensilsCrossed,
  'hamburguesas': Sandwich,
  'pizzas': Pizza,
  'pollo': Beef,
  'bebidas': Coffee,
  'postres': Cake,
  'papas & sides': Salad,
  'entradas': Salad,
  'cervezas': Beer,
  'helados': IceCream,
};

export const DEFAULT_CATEGORY_ICON = UtensilsCrossed;
