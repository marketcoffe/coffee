import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { useToast } from '../../../components/Toast';
import { Order } from '../../../types/store';

function getNextStatus(status: Order['status'], tipoEntrega?: string): Order['status'] | null {
  if (status === 'Entregado' || status === 'Cancelado' || status === 'completado' || status === 'cancelado' || status === 'Listo') return null;

  if (status === 'En camino') return 'Entregado';

  if (status === 'En preparación' || status === 'En preparacion' || status === 'en_preparacion') {
    return tipoEntrega === 'delivery' ? 'En camino' : 'Entregado';
  }

  if (
    status === 'Pendiente' ||
    status === 'Procesando' ||
    status === 'enviado_cocina' ||
    status === 'pendiente_verificacion' ||
    status === 'pago_enviado' ||
    status === 'pendiente_pago' ||
    status === 'pago_en_verificacion'
  ) {
    return 'En preparación';
  }

  return null;
}

export function useOrders(sedeId?: string) {
  const { orders, config, updateOrderStatus } = useApp();
  const { showToast } = useToast();
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
      const result = await updateOrderStatus(order.id, nextStatus);
      if (result === false) {
        showToast('error', 'Error al actualizar el estado. Verifica tus permisos.');
      }
    } finally {
      setAdvancingId(null);
    }
  }, [updateOrderStatus, showToast]);

  const cancelOrder = useCallback(async (order: Order, reason?: string) => {
    setAdvancingId(order.id);
    try {
      const result = await updateOrderStatus(order.id, 'Cancelado', undefined, reason || 'Cancelado por administrador');
      if (result === false) {
        showToast('error', 'Error al cancelar el pedido. Verifica tus permisos.');
      }
    } finally {
      setAdvancingId(null);
    }
  }, [updateOrderStatus, showToast]);

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
