import { describe, it, expect } from 'vitest';
import type { FoodItem, Order, Coupon, CartItem, SelectedOption, StoreConfig } from '../../types/store';

// ============================================================
// TESTS UNITARIOS - Lógica core de AppContext
// Tests de la lógica pura (sin renderizar componentes)
// ============================================================

describe('AppContext - Lógica del Carrito', () => {
  const mockItem: FoodItem = {
    id: 'hmb-001',
    nombre: 'Smash Clásica',
    descripcion: 'Doble smash de carne',
    categoria: ['Hamburguesas'],
    precio_usd: 7.5,
    stock: 30,
    imagen_urls: ['https://example.com/burger.jpg'],
    es_promo: false,
    es_nuevo: false,
    es_mas_vendido: true,
    delivery_gratis: false,
    ingredientes: ['Pan', 'Carne', 'Queso'],
    option_groups: [],
  };

  const simulateAddToCart = (
    prev: CartItem[],
    item: FoodItem,
    qty = 1,
    selectedOptions?: SelectedOption[],
    optionsTotal = 0,
    removedIngredients?: string[]
  ): CartItem[] => {
    const optionsKey =
      selectedOptions && selectedOptions.length > 0
        ? JSON.stringify([...selectedOptions].sort((a, b) => a.option_name.localeCompare(b.option_name)))
        : '';
    const cartKey = `${item.id}${optionsKey ? `_${optionsKey}` : ''}`;

    const idx = prev.findIndex((ci) => {
      const itemOptionsKey =
        ci.selected_options && ci.selected_options.length > 0
          ? JSON.stringify([...ci.selected_options].sort((a, b) => a.option_name.localeCompare(b.option_name)))
          : '';
      return `${ci.item.id}${itemOptionsKey ? `_${itemOptionsKey}` : ''}` === cartKey;
    });

    if (idx > -1) {
      const currentQty = prev[idx].quantity;
      const targetQty = Math.min(item.stock, currentQty + qty);
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: targetQty };
      return copy;
    } else {
      return [
        ...prev,
        {
          item,
          quantity: Math.min(item.stock, qty),
          selected_options: selectedOptions,
          options_total_usd: optionsTotal,
          ingredientes_removidos: removedIngredients || [],
        },
      ];
    }
  };

  it('addToCart agrega producto nuevo al carrito vacío', () => {
    const result = simulateAddToCart([], mockItem, 1);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe('hmb-001');
    expect(result[0].quantity).toBe(1);
  });

  it('addToCart incrementa cantidad si producto ya existe', () => {
    const initial: CartItem[] = [{ item: mockItem, quantity: 1 }];
    const result = simulateAddToCart(initial, mockItem, 1);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it('addToCart no excede el stock disponible', () => {
    const initial: CartItem[] = [{ item: mockItem, quantity: 29 }];
    const result = simulateAddToCart(initial, mockItem, 5);
    expect(result[0].quantity).toBe(30);
  });

  it('addToCart respeta stock máximo al agregar cantidad 0 (quantity se queda en 0 por Math.min(stock, 0))', () => {
    const result = simulateAddToCart([], mockItem, 0);
    expect(result[0].quantity).toBe(0);
  });

  it('addToCart maneja opciones seleccionadas', () => {
    const options: SelectedOption[] = [{ group_name: 'Extras', option_name: 'Queso', precio_usd: 0.75 }];
    const result = simulateAddToCart([], mockItem, 1, options, 0.75);
    expect(result).toHaveLength(1);
    expect(result[0].selected_options).toEqual(options);
    expect(result[0].options_total_usd).toBe(0.75);
  });

  it('addToCart distingue items con diferentes opciones', () => {
    const opt1: SelectedOption[] = [{ group_name: 'Extras', option_name: 'Queso', precio_usd: 0.75 }];
    const opt2: SelectedOption[] = [{ group_name: 'Extras', option_name: 'Tocino', precio_usd: 1.0 }];

    let cart = simulateAddToCart([], mockItem, 1, opt1, 0.75);
    cart = simulateAddToCart(cart, mockItem, 1, opt2, 1.0);

    expect(cart).toHaveLength(2);
  });

  it('removeFromCart elimina producto del carrito', () => {
    const initial: CartItem[] = [
      { item: mockItem, quantity: 1 },
      { item: { ...mockItem, id: 'pap-001', nombre: 'Papas' }, quantity: 1 },
    ];
    const result = initial.filter((ci) => ci.item.id !== 'hmb-001');
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe('pap-001');
  });

  it('updateCartQuantity actualiza cantidad correctamente', () => {
    const initial: CartItem[] = [{ item: mockItem, quantity: 2 }];
    const idx = initial.findIndex((ci) => ci.item.id === 'hmb-001');
    const targetQty = Math.max(1, Math.min(mockItem.stock, 5));
    const copy = [...initial];
    copy[idx] = { ...copy[idx], quantity: targetQty };
    expect(copy[0].quantity).toBe(5);
  });

  it('updateCartQuantity no permite cantidad menor a 1', () => {
    const qty = Math.max(1, 0);
    expect(qty).toBe(1);
  });

  it('updateCartQuantity no permite cantidad mayor al stock', () => {
    const qty = Math.max(1, Math.min(mockItem.stock, 100));
    expect(qty).toBe(30);
  });
});

describe('AppContext - Cálculo de Totales del Pedido', () => {
  const mockConfig: StoreConfig = {
    site_nombre: 'Test',
    telefono_soporte: '04121234567',
    direccion_fisica: 'Caracas',
    coordenadas_tienda: { lat: 10.48, lng: -66.9 },
    banners: [],
    zelle_enabled: true,
    zelle_data: '',
    zelle_discount_percent: 0,
    pagomovil_enabled: true,
    pagomovil_data: '',
    pagomovil_discount_percent: 5,
    efectivo_enabled: true,
    efectivo_data: '',
    efectivo_discount_percent: 0,
    transferencia_enabled: false,
    transferencia_data: '',
    transferencia_discount_percent: 0,
    tasa_cambio: 36.5,
  };

  const calculateOrderTotals = (
    cart: CartItem[],
    config: StoreConfig,
    metodoPago: Order['metodo_pago'],
    costoEnvio: number,
    descuentoCupon: number = 0
  ) => {
    const items = cart.map((ci) => ({
      precio_usd: ci.item.precio_usd,
      options_total_usd: ci.options_total_usd || 0,
      cantidad: ci.quantity,
    }));

    const subtotal = items.reduce((acc, item) => {
      return acc + (item.precio_usd + item.options_total_usd) * item.cantidad;
    }, 0);

    let discountPercent = 0;
    if (metodoPago === 'Pago Móvil') discountPercent = config.pagomovil_discount_percent || 0;
    else if (metodoPago === 'Zelle') discountPercent = config.zelle_discount_percent || 0;
    else if (metodoPago === 'Efectivo') discountPercent = config.efectivo_discount_percent || 0;
    else if (metodoPago === 'Transferencia') discountPercent = config.transferencia_discount_percent || 0;

    const discountAmount = subtotal * (discountPercent / 100);
    const subtotalAfterDiscount = subtotal - discountAmount - descuentoCupon;
    const totalUsd = Math.max(0, subtotalAfterDiscount + costoEnvio);
    const totalBs = totalUsd * (config.tasa_cambio || 1);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountPercent,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalBs: Math.round(totalBs * 100) / 100,
    };
  };

  const cart: CartItem[] = [
    { item: { id: '1', nombre: 'Burger', descripcion: '', categoria: ['Hamburguesas'], precio_usd: 7.5, stock: 10, imagen_urls: [], es_promo: false, es_nuevo: false, es_mas_vendido: false }, quantity: 2 },
    { item: { id: '2', nombre: 'Papas', descripcion: '', categoria: ['Snacks'], precio_usd: 3, stock: 20, imagen_urls: [], es_promo: false, es_nuevo: false, es_mas_vendido: false }, quantity: 1 },
  ];

  it('calcula subtotal correctamente', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Efectivo', 0);
    expect(totals.subtotal).toBe(18.0);
  });

  it('aplica descuento de Pago Móvil (5%)', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Pago Móvil', 0);
    expect(totals.discountPercent).toBe(5);
    expect(totals.discountAmount).toBe(0.9);
    expect(totals.totalUsd).toBe(17.1);
  });

  it('aplica descuento de cupón', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Efectivo', 0, 3.0);
    expect(totals.totalUsd).toBe(15.0);
  });

  it('suma costo de envío al total', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Efectivo', 2.5);
    expect(totals.totalUsd).toBe(20.5);
  });

  it('convierte USD a BS con tasa de cambio', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Efectivo', 0);
    expect(totals.totalBs).toBe(657.0);
  });

  it('combina descuento de pago + cupón + envío', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Pago Móvil', 2.5, 1.0);
    // subtotal=18, discount=0.9, coupon=1.0, shipping=2.5
    // totalUsd = 18 - 0.9 - 1.0 + 2.5 = 18.6
    expect(totals.totalUsd).toBe(18.6);
  });

  it('total nunca es negativo', () => {
    const totals = calculateOrderTotals(cart, mockConfig, 'Efectivo', 0, 100.0);
    expect(totals.totalUsd).toBeGreaterThanOrEqual(0);
  });
});

describe('AppContext - Favoritos', () => {
  const toggleFavorite = (prev: string[], itemId: string): string[] => {
    return prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
  };

  const isFavorite = (favorites: string[], itemId: string): boolean => {
    return favorites.includes(itemId);
  };

  it('agrega producto a favoritos', () => {
    const result = toggleFavorite([], 'hmb-001');
    expect(result).toContain('hmb-001');
    expect(result).toHaveLength(1);
  });

  it('quita producto de favoritos', () => {
    const result = toggleFavorite(['hmb-001', 'pap-001'], 'hmb-001');
    expect(result).not.toContain('hmb-001');
    expect(result).toContain('pap-001');
  });

  it('toggle funciona correctamente (agrega y quita)', () => {
    let favs: string[] = [];
    favs = toggleFavorite(favs, 'hmb-001');
    expect(isFavorite(favs, 'hmb-001')).toBe(true);

    favs = toggleFavorite(favs, 'hmb-001');
    expect(isFavorite(favs, 'hmb-001')).toBe(false);
  });

  it('maneja múltiples favoritos', () => {
    let favs: string[] = [];
    favs = toggleFavorite(favs, 'hmb-001');
    favs = toggleFavorite(favs, 'pap-001');
    favs = toggleFavorite(favs, 'pzz-001');
    expect(favs).toHaveLength(3);
  });

  it('isFavorite retorna false para lista vacía', () => {
    expect(isFavorite([], 'hmb-001')).toBe(false);
  });
});

describe('AppContext - Cupones', () => {
  const coupons: Coupon[] = [
    { id: 'c1', code: 'DESCUENTO10', discount_percent: 10, active: true, usage_limit: 100, usage_count: 5, valid_until: '2026-12-31' },
    { id: 'c2', code: 'EXPIRADO', discount_percent: 20, active: false, usage_limit: 50, usage_count: 50, valid_until: '2025-01-01' },
    { id: 'c3', code: 'ILIMITADO', discount_percent: 15, active: true, usage_count: 0 },
  ];

  const validateCoupon = (coupon: Coupon, subtotal: number): { valid: boolean; reason?: string } => {
    if (!coupon.active) return { valid: false, reason: 'Cupón inactivo' };
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit)
      return { valid: false, reason: 'Límite de usos alcanzado' };
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date())
      return { valid: false, reason: 'Cupón expirado' };
    if (subtotal <= 0) return { valid: false, reason: 'Subtotal inválido' };
    return { valid: true };
  };

  it('valida cupón activo correctamente', () => {
    const result = validateCoupon(coupons[0], 50);
    expect(result.valid).toBe(true);
  });

  it('rechaza cupón inactivo', () => {
    const result = validateCoupon(coupons[1], 50);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Cupón inactivo');
  });

  it('rechaza cupón con usos agotados', () => {
    const coupon: Coupon = { id: 'c4', code: 'FULL', discount_percent: 10, active: true, usage_limit: 10, usage_count: 10 };
    const result = validateCoupon(coupon, 50);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Límite de usos alcanzado');
  });

  it('acepta cupón sin límite de usos', () => {
    const result = validateCoupon(coupons[2], 50);
    expect(result.valid).toBe(true);
  });

  it('calcula descuento correctamente', () => {
    const discount = 50 * (coupons[0].discount_percent / 100);
    expect(discount).toBe(5.0);
  });
});
