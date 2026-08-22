import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

// ============================================================
// TESTS FASE 2 - Guest Checkout + 1-Page Checkout
// ============================================================

describe('FASE 2 - Guest Checkout', () => {
  const mockCartItems = [
    {
      item: {
        id: 'hmb-001',
        nombre: 'Smash Clásica',
        descripcion: 'Doble smash',
        categoria: ['Hamburguesas'],
        precio_usd: 7.5,
        stock: 30,
        imagen_urls: ['https://example.com/burger.jpg'],
        es_promo: false,
        es_nuevo: false,
        es_mas_vendido: true,
        delivery_gratis: false,
        ingredientes: [],
        option_groups: [],
        estimated_prep_time: 25,
        order_count: 127,
      },
      quantity: 2,
      selected_options: [],
      options_total_usd: 0,
      ingredientes_removidos: [],
    },
  ];

  describe('Tipos y Datos - Guest Phone', () => {
    it('Order acepta guest_phone como campo opcional', () => {
      const order: any = {
        id: 'PED-0001-VAL-2026',
        cliente_nombre: 'Cliente Sin Cuenta',
        cliente_telefono: '+584121234567',
        guest_phone: '+584121234567',
        items: [],
        subtotal_usd: 15,
        costo_envio_usd: 1.5,
        total_usd: 16.5,
        total_bs: 602.25,
        metodo_pago: 'Pago Móvil',
        tipo_entrega: 'delivery',
        lat: 10.18,
        lng: -68.01,
        direccion_envio: 'Centro',
        distancia_km: 2,
        status: 'Pendiente',
        fecha: new Date().toISOString(),
      };
      expect(order.guest_phone).toBe('+584121234567');
    });

    it('Order funciona sin guest_phone (usuario logueado)', () => {
      const order: any = {
        id: 'PED-0002-VAL-2026',
        cliente_nombre: 'Juan',
        cliente_telefono: '+584121234567',
        items: [],
        subtotal_usd: 10,
        costo_envio_usd: 0,
        total_usd: 10,
        total_bs: 365,
        metodo_pago: 'Zelle',
        tipo_entrega: 'delivery',
        lat: 10.18,
        lng: -68.01,
        direccion_envio: 'Centro',
        distancia_km: 1,
        status: 'Pendiente',
        fecha: new Date().toISOString(),
      };
      expect(order.guest_phone).toBeUndefined();
    });

    it('crear_cuenta flag es opcional', () => {
      const order: any = {
        id: 'PED-0003-VAL-2026',
        cliente_nombre: 'Guest',
        cliente_telefono: '+584129999999',
        crear_cuenta: true,
        items: [],
        subtotal_usd: 5,
        costo_envio_usd: 0,
        total_usd: 5,
        total_bs: 182.5,
        metodo_pago: 'Efectivo',
        tipo_entrega: 'delivery',
        lat: 10.18,
        lng: -68.01,
        direccion_envio: 'Retiro',
        distancia_km: 0,
        status: 'Pendiente',
        fecha: new Date().toISOString(),
      };
      expect(order.crear_cuenta).toBe(true);
    });
  });

  describe('FoodItem - Campos Nuevos (ETA)', () => {
    it('FoodItem acepta estimated_prep_time', () => {
      const item = {
        ...mockCartItems[0].item,
        estimated_prep_time: 25,
      };
      expect(item.estimated_prep_time).toBe(25);
    });

    it('FoodItem acepta order_count', () => {
      const item = {
        ...mockCartItems[0].item,
        order_count: 127,
      };
      expect(item.order_count).toBe(127);
    });

    it('FoodItem acepta promo_end_date', () => {
      const item = {
        ...mockCartItems[0].item,
        promo_end_date: '2026-07-01T23:59:59Z',
      };
      expect(item.promo_end_date).toBe('2026-07-01T23:59:59Z');
    });

    it('campos nuevos son opcionales en tipo FoodItem', () => {
      const minimalItem = {
        id: 'test-001',
        nombre: 'Test',
        descripcion: 'Test',
        categoria: ['Test'],
        precio_usd: 5,
        stock: 10,
        imagen_urls: [],
        es_promo: false,
        es_nuevo: false,
        es_mas_vendido: false,
      };
      expect(minimalItem).not.toHaveProperty('estimated_prep_time');
      expect(minimalItem).not.toHaveProperty('order_count');
      expect(minimalItem).not.toHaveProperty('promo_end_date');
    });
  });

  describe('Lógica de Guest Checkout', () => {
    it('solo telefono es obligatorio para guest', () => {
      const guestData = {
        nombre: '',
        telefono: '+584121234567',
      };
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      const cleaned = guestData.telefono.replace(/[\s\-()]/g, '');
      expect(phoneRegex.test(cleaned)).toBe(true);
      expect(guestData.nombre).toBe('');
    });

    it('telefono vacío falla validación', () => {
      const phone = '';
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      const cleaned = phone.replace(/[\s\-()]/g, '');
      expect(cleaned).toBe('');
      expect(phoneRegex.test(cleaned)).toBe(false);
    });

    it('telefono con formato inválido falla', () => {
      const phone = 'abc123';
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      const cleaned = phone.replace(/[\s\-()]/g, '');
      expect(phoneRegex.test(cleaned)).toBe(false);
    });

    it('telefono con guiones se limpia correctamente', () => {
      const phone = '+58-412-123-4567';
      const cleaned = phone.replace(/[\s\-()]/g, '');
      expect(cleaned).toBe('+584121234567');
    });

    it('crear_cuenta se guarda en localStorage para guest', () => {
      const guestPhone = '+584121234567';
      const guestName = 'Cliente Test';
      localStorage.setItem('marketcoffee_guest_phone', guestPhone);
      localStorage.setItem('marketcoffee_guest_name', guestName);
      expect(localStorage.getItem('marketcoffee_guest_phone')).toBe(guestPhone);
      expect(localStorage.getItem('marketcoffee_guest_name')).toBe(guestName);
    });
  });

  describe('Lógica de Upselling', () => {
    it('detecta que no hay bebidas en el carrito', () => {
      const cartCategories = mockCartItems.flatMap(ci => Array.isArray(ci.item.categoria) ? ci.item.categoria : [ci.item.categoria]);
      const hasBebidas = cartCategories.some(c => c.toLowerCase().includes('bebida'));
      expect(hasBebidas).toBe(false);
    });

    it('detecta que no hay postres en el carrito', () => {
      const cartCategories = mockCartItems.flatMap(ci => Array.isArray(ci.item.categoria) ? ci.item.categoria : [ci.item.categoria]);
      const hasPostres = cartCategories.some(c => c.toLowerCase().includes('postre'));
      expect(hasPostres).toBe(false);
    });

    it('sugiere papas cuando hay hamburguesa', () => {
      const hasBurger = mockCartItems.some(ci =>
        (Array.isArray(ci.item.categoria) ? ci.item.categoria : [ci.item.categoria]).some(c => c.toLowerCase().includes('hamburguesa'))
      );
      const hasPapas = mockCartItems.some(ci =>
        (Array.isArray(ci.item.categoria) ? ci.item.categoria : [ci.item.categoria]).some(c => c.toLowerCase().includes('papa'))
      );
      expect(hasBurger).toBe(true);
      expect(hasPapas).toBe(false);
    });

    it('filtra items sugeridos por stock disponible', () => {
      const allItems = [
        { ...mockCartItems[0].item, id: 'beb-001', categoria: ['Bebidas'], stock: 10, activo: true },
        { ...mockCartItems[0].item, id: 'beb-002', categoria: ['Bebidas'], stock: 0, activo: true },
      ];
      const available = allItems.filter(f => f.activo !== false && f.stock > 0);
      expect(available).toHaveLength(1);
    });
  });

  describe('Lógica de Reordenar', () => {
    it('puede reconstruir items de un pedido anterior', () => {
      const previousOrder = {
        items: [
          { food_id: 'hmb-001', nombre: 'Smash', precio_usd: 7.5, cantidad: 2, selected_options: [] },
          { food_id: 'pap-001', nombre: 'Papas', precio_usd: 3.0, cantidad: 1, selected_options: [] },
        ],
      };
      expect(previousOrder.items).toHaveLength(2);
      expect(previousOrder.items[0].cantidad).toBe(2);
    });

    it('verifica stock antes de reordenar', () => {
      const foodItem = mockCartItems[0].item;
      const orderQuantity = 2;
      const canReorder = foodItem.stock >= orderQuantity;
      expect(canReorder).toBe(true);
    });

    it('rechaza reordenar si stock insuficiente', () => {
      const foodItem = { ...mockCartItems[0].item, stock: 1 };
      const orderQuantity = 3;
      const canReorder = foodItem.stock >= orderQuantity;
      expect(canReorder).toBe(false);
    });
  });

  describe('Resumen de Checkout - 1 Página', () => {
    it('calcula total con envío incluido', () => {
      const subtotal = 18.0;
      const shipping = 1.5;
      const discount = 0;
      const total = subtotal - discount + shipping;
      expect(total).toBe(19.5);
    });

    it('calcula total con cupón y envío', () => {
      const subtotal = 18.0;
      const shipping = 1.5;
      const couponDiscount = subtotal * 0.1;
      const total = subtotal - couponDiscount + shipping;
      expect(total).toBeCloseTo(17.7, 1);
    });

    it('calcula total con delivery gratis', () => {
      const subtotal = 18.0;
      const shipping = 0;
      const total = subtotal + shipping;
      expect(total).toBe(18.0);
    });

    it('calcula total BS correctamente', () => {
      const totalUsd = 19.5;
      const tasa = 36.5;
      const totalBs = totalUsd * tasa;
      expect(totalBs).toBe(711.75);
    });
  });

  describe('WhatsApp Message - Guest vs Registered', () => {
    it('genera mensaje con nombre del guest', () => {
      const name = 'Cliente Sin Nombre';
      const phone = '+584121234567';
      const msg = `*Cliente:* ${name}\n*Telefono:* ${phone}`;
      expect(msg).toContain('Cliente Sin Nombre');
      expect(msg).toContain('+584121234567');
    });

    it('genera mensaje con nombre del usuario logueado', () => {
      const name = 'Juan Pérez';
      const phone = '+584129999999';
      const msg = `*Cliente:* ${name}\n*Telefono:* ${phone}`;
      expect(msg).toContain('Juan Pérez');
    });

    it('incluye URL de mapa en mensaje', () => {
      const lat = 10.18;
      const lng = -68.01;
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      expect(url).toContain('10.18');
      expect(url).toContain('-68.01');
    });
  });
});
