import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { Order } from '../../../types/store';

function getNextStatus(status: Order['status'], tipoEntrega?: string): Order['status'] | null {
  const flow: Record<string, Order['status']> = {
    'enviado_cocina': 'En preparación',
    'pendiente_verificacion': 'Pendiente',
    'pago_enviado': 'En preparación',
    'pendiente_pago': 'En preparación',
    'pago_en_verificacion': 'En preparación',
    'Pendiente': 'Procesando',
    'Procesando': 'En preparación',
    'En preparación': 'Listo',
    'En preparacion': 'Listo',
    'en_preparacion': 'Listo',
  };
  // After "Listo": delivery goes to "En camino", mesa/pickup go to "Entregado"
  if (status === 'Listo') return tipoEntrega === 'delivery' ? 'En camino' : 'Entregado';
  if (status === 'En camino') return 'Entregado';
  return flow[status] ?? null;
}

export function useOrders(sedeId?: string) {
  const { orders, config, updateOrderStatus } = useApp();
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const principalSedeId = (config.sedes || []).find(s => s.es_principal)?.id || (config.sedes || [])[0]?.id || '';

  const filteredBySede = useMemo(() => {
    if (!sedeId) return orders;
    return orders.filter(o => (o.sede_id || principalSedeId) === sedeId);
  }, [orders, sedeId, principalSedeId]);

  const activeOrders = useMemo(() => filteredBySede.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado'), [filteredBySede]);
  const completedOrders = useMemo(() => filteredBySede.filter(o => o.status === 'Entregado'), [filteredBySede]);
  const cancelledOrders = useMemo(() => filteredBySede.filter(o => o.status === 'Cancelado'), [filteredBySede]);

  const advanceStatus = useCallback(async (order: Order) => {
    const nextStatus = getNextStatus(order.status, order.tipo_entrega);
    if (!nextStatus) return;
    setAdvancingId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
    } finally {
      setAdvancingId(null);
    }
  }, [updateOrderStatus]);

  const cancelOrder = useCallback(async (order: Order, reason?: string) => {
    setAdvancingId(order.id);
    try {
      await updateOrderStatus(order.id, 'Cancelado', undefined, reason || 'Cancelado por administrador');
    } finally {
      setAdvancingId(null);
    }
  }, [updateOrderStatus]);

  const bulkAdvance = useCallback(async (orderIds: string[]) => {
    for (const id of orderIds) {
      const order = filteredBySede.find(o => o.id === id);
      if (!order) continue;
      const nextStatus = getNextStatus(order.status, order.tipo_entrega);
      if (nextStatus) {
        await updateOrderStatus(id, nextStatus);
      }
    }
  }, [filteredBySede, updateOrderStatus]);

  const getOrdersByStatus = useCallback((status: Order['status'] | 'Todos') => {
    if (status === 'Todos') return filteredBySede;
    return filteredBySede.filter(o => o.status === status);
  }, [filteredBySede]);

  const getTotalRevenue = useCallback(() => {
    return filteredBySede
      .filter(o => o.status === 'Entregado')
      .reduce((sum, o) => sum + (Number(o.total_usd) || 0), 0);
  }, [filteredBySede]);

  const getTodayOrders = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredBySede.filter(o => o.fecha?.startsWith(today));
  }, [filteredBySede]);

  return {
    orders: filteredBySede,
    activeOrders,
    completedOrders,
    cancelledOrders,
    advanceStatus,
    cancelOrder,
    bulkAdvance,
    advancingId,
    getOrdersByStatus,
    getTotalRevenue,
    getTodayOrders,
  };
}
