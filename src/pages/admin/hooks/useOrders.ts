import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { Order } from '../../../types/store';

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
    const statusFlow: Order['status'][] = ['Pendiente', 'Procesando', 'En preparación', 'Listo', 'En camino', 'Entregado'];
    const currentIdx = statusFlow.indexOf(order.status);
    if (currentIdx >= 0 && currentIdx < statusFlow.length - 1) {
      setAdvancingId(order.id);
      try {
        await updateOrderStatus(order.id, statusFlow[currentIdx + 1]);
      } finally {
        setAdvancingId(null);
      }
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
      const statusFlow: Order['status'][] = ['Pendiente', 'Procesando', 'En preparación', 'Listo', 'En camino', 'Entregado'];
      const currentIdx = statusFlow.indexOf(order.status);
      if (currentIdx >= 0 && currentIdx < statusFlow.length - 1) {
        await updateOrderStatus(id, statusFlow[currentIdx + 1]);
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
