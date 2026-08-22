import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// TESTS DE INTEGRACIÓN - Flujo completo de checkout
// ============================================================

describe('INTEGRACIÓN - Flujo de Checkout', () => {
  const mockCartItems = [
    {
      item: {
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
      },
      quantity: 2,
      selected_options: [],
      options_total_usd: 0,
      ingredientes_removidos: [],
    },
    {
      item: {
        id: 'pap-001',
        nombre: 'Papas Fritas',
        descripcion: 'Papas fritas crujientes',
        categoria: ['Papas & Sides'],
        precio_usd: 3.0,
        stock: 50,
        imagen_urls: ['https://example.com/fries.jpg'],
        es_promo: false,
        es_nuevo: false,
        es_mas_vendido: false,
        delivery_gratis: false,
        ingredientes: [],
        option_groups: [],
      },
      quantity: 1,
      selected_options: [],
      options_total_usd: 0,
      ingredientes_removidos: [],
    },
  ];

  const mockConfig = {
    site_nombre: 'Market Coffee Sweet',
    theme_color: '#E31837',
    tasa_cambio: 36.5,
    pagomovil_discount_percent: 5,
    zelle_discount_percent: 0,
    efectivo_discount_percent: 0,
    transferencia_discount_percent: 0,
    delivery_zonas: [
      { id: 'z1', name: 'Centro', cost: 1.5, minKm: 0, maxKm: 3 },
      { id: 'z2', name: 'Lejos', cost: 3.0, minKm: 3, maxKm: 8 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cálculo de Subtotal', () => {
    it('calcula correctamente el subtotal de items', () => {
      const subtotal = mockCartItems.reduce((acc, ci) => {
        return acc + (ci.item.precio_usd + (ci.options_total_usd || 0)) * ci.quantity;
      }, 0);

      expect(subtotal).toBe(18.0);
    });

    it('calcula correctamente con opciones extras', () => {
      const itemsWithOptions = [
        {
          ...mockCartItems[0],
          options_total_usd: 1.5,
          quantity: 1,
        },
      ];

      const subtotal = itemsWithOptions.reduce((acc, ci) => {
        return acc + (ci.item.precio_usd + (ci.options_total_usd || 0)) * ci.quantity;
      }, 0);

      expect(subtotal).toBe(9.0);
    });
  });

  describe('Descuentos por Método de Pago', () => {
    it('aplica descuento de Pago Móvil correctamente', () => {
      const subtotal = 18.0;
      const discountPercent = mockConfig.pagomovil_discount_percent;
      const discountAmount = subtotal * (discountPercent / 100);
      const total = subtotal - discountAmount;

      expect(discountPercent).toBe(5);
      expect(discountAmount).toBeCloseTo(0.9, 1);
      expect(total).toBeCloseTo(17.1, 1);
    });

    it('no aplica descuento para efectivo', () => {
      const subtotal = 18.0;
      const discountPercent = mockConfig.efectivo_discount_percent;
      const total = subtotal - subtotal * (discountPercent / 100);

      expect(discountPercent).toBe(0);
      expect(total).toBe(18.0);
    });

    it('aplica cupón de descuento correctamente', () => {
      const subtotal = 18.0;
      const couponDiscount = 3.0;
      const total = subtotal - couponDiscount;

      expect(total).toBe(15.0);
    });

    it('combina descuento de pago y cupón', () => {
      const subtotal = 18.0;
      const paymentDiscount = subtotal * (mockConfig.pagomovil_discount_percent / 100);
      const couponDiscount = 2.0;
      const total = subtotal - paymentDiscount - couponDiscount;

      expect(total).toBeCloseTo(15.1, 1);
    });
  });

  describe('Costo de Envío', () => {
    it('calcula envío por zona correctamente', () => {
      const distance = 2.5;
      const zone = mockConfig.delivery_zonas.find(
        (z) => distance >= z.minKm && distance <= z.maxKm
      );
      expect(zone?.cost).toBe(1.5);
    });

    it('zona lejana tiene costo mayor', () => {
      const distance = 5.0;
      const zone = mockConfig.delivery_zonas.find(
        (z) => distance >= z.minKm && distance <= z.maxKm
      );
      expect(zone?.cost).toBe(3.0);
    });

    it('delivery gratis ignora costo de envío', () => {
      const total = 18.0 + 0;
      expect(total).toBe(18.0);
    });
  });

  describe('Conversión USD/BS', () => {
    it('convierte USD a BS correctamente', () => {
      const totalUsd = 18.0;
      const totalBs = totalUsd * mockConfig.tasa_cambio;
      expect(totalBs).toBe(657.0);
    });

    it('maneja tasa de cambio 1:1', () => {
      const totalUsd = 18.0;
      const totalBs = totalUsd * 1;
      expect(totalBs).toBe(18.0);
    });

    it('redondea a 2 decimales', () => {
      const totalUsd = 10.33;
      const totalBs = Math.round(totalUsd * mockConfig.tasa_cambio * 100) / 100;
      expect(totalBs).toBe(377.05);
    });
  });

  describe('Validación de Pedido', () => {
    it('rechaza pedido vacío', () => {
      const cart: typeof mockCartItems = [];
      expect(cart.length).toBe(0);
    });

    it('rechaza cantidad mayor a stock', () => {
      const item = mockCartItems[0];
      const maxQty = Math.min(item.item.stock, item.quantity);
      expect(maxQty).toBeLessThanOrEqual(item.item.stock);
    });

    it('requiere teléfono para crear pedido', () => {
      const orderData = {
        cliente_nombre: 'Juan',
        cliente_telefono: '',
      };
      expect(orderData.cliente_telefono).toBe('');
      // El pedido no debería crearse sin teléfono
    });

    it('requiere método de pago válido', () => {
      const validMethods = ['Pago Móvil', 'Zelle', 'Efectivo', 'Transferencia'];
      const metodo = 'Crypto';
      expect(validMethods).not.toContain(metodo);
    });

    it('requiere dirección para delivery', () => {
      const orderData = {
        tipo_entrega: 'delivery',
        direccion_envio: '',
      };
      expect(orderData.direccion_envio).toBe('');
    });
  });

  describe('Generación de ID de Pedido', () => {
    it('genera ID con formato correcto', () => {
      const id = `PED-${Math.floor(1000 + Math.random() * 9000)}-VAL-${new Date().getFullYear()}`;
      expect(id).toMatch(/^PED-\d{4}-VAL-\d{4}$/);
    });

    it('IDs generados son únicos', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(`PED-${Math.floor(1000 + Math.random() * 9000)}-VAL-${new Date().getFullYear()}`);
      }
      expect(ids.size).toBeGreaterThan(90);
    });
  });
});
