import { useCallback, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { useToast } from '../../../components/Toast';
import { Order } from '../../../types/store';

function getNextStatus(status: Order['status'], tipoEntrega?: string): Order['status'] | null {
  if (status === 'Entregado' || status === 'Cancelado' || status === 'completado' || status === 'cancelado') return null;

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
    status === 'pago_en_verificacion' ||
    status === 'Listo'
  ) {
    return 'En preparación';
  }

  return null;
}

export function useOrders(sedeId?: string) {
  const { orders, config, updateOrderStatus } = useApp();
  const { showToast } = useToast();
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const advancingRef = useRef<Set<string>>(new Set());
  const principalSedeId = (config.sedes || []).find(s => s.es_principal)?.id || (config.sedes || [])[0]?.id || '';

  const filteredBySede = useMemo(() => {
    if (!sedeId) return orders;
    return orders.filter(o => (o.sede_id || principalSedeId) === sedeId);
  }, [orders, sedeId, principalSedeId]);

  const activeOrders = useMemo(() => filteredBySede.filter(o => !['Entregado', 'Cancelado', 'completado', 'cancelado'].includes(o.status)), [filteredBySede]);
  const completedOrders = useMemo(() => filteredBySede.filter(o => o.status === 'Entregado' || o.status === 'completado'), [filteredBySede]);
  const cancelledOrders = useMemo(() => filteredBySede.filter(o => o.status === 'Cancelado' || o.status === 'cancelado'), [filteredBySede]);

  const advanceStatus = useCallback(async (order: Order) => {
    if (advancingRef.current.has(order.id)) return;
    const tipoEntrega = order.tipo_entrega || order.tipo_pedido || 'delivery';
    const nextStatus = getNextStatus(order.status, tipoEntrega);
    if (!nextStatus) return;
    advancingRef.current.add(order.id);
    setAdvancingId(order.id);
    try {
      const result = await updateOrderStatus(order.id, nextStatus);
      if (result === false) {
        showToast('error', 'Error al actualizar el estado. Verifica tus permisos.');
      } else if (nextStatus === 'Entregado') {
        showToast('success', `Pedido #${order.id?.slice(0, 8)} entregado. Puntos acreditados al cliente.`);
      }
    } finally {
      advancingRef.current.delete(order.id);
      setAdvancingId(null);
    }
  }, [updateOrderStatus, showToast]);

  const cancelOrder = useCallback(async (order: Order, reason?: string) => {
    if (advancingRef.current.has(order.id)) return;
    advancingRef.current.add(order.id);
    setAdvancingId(order.id);
    try {
      const result = await updateOrderStatus(order.id, 'Cancelado', undefined, reason || 'Cancelado por administrador');
      if (result === false) {
        showToast('error', 'Error al cancelar el pedido. Verifica tus permisos.');
      }
    } finally {
      advancingRef.current.delete(order.id);
      setAdvancingId(null);
    }
  }, [updateOrderStatus, showToast]);

  const bulkAdvance = useCallback(async (orderIds: string[]) => {
    for (const id of orderIds) {
      const order = filteredBySede.find(o => o.id === id);
      if (!order) continue;
      const tipoEntrega = order.tipo_entrega || order.tipo_pedido || 'delivery';
      const nextStatus = getNextStatus(order.status, tipoEntrega);
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
