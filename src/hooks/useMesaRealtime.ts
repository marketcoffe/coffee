import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../store/supabaseClient';
import { Order } from '../types/store';

interface UseMesaRealtimeOptions {
  orderIds?: string[];
  onStatusChange?: (order: Order) => void;
  onPaymentConfirmed?: (order: Order) => void;
  onOrderRejected?: (order: Order) => void;
  onNewOrder?: (order: Order) => void;
  enabled?: boolean;
}

interface UseMesaRealtimeReturn {
  isConnected: boolean;
  lastEvent: string | null;
  reconnect: () => void;
}

export function useMesaRealtime(options: UseMesaRealtimeOptions = {}): UseMesaRealtimeReturn {
  const {
    orderIds = [],
    onStatusChange,
    onPaymentConfirmed,
    onOrderRejected,
    onNewOrder,
    enabled = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onStatusChange, onPaymentConfirmed, onOrderRejected, onNewOrder });

  callbacksRef.current = { onStatusChange, onPaymentConfirmed, onOrderRejected, onNewOrder };

  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(`mesa_realtime_${Date.now()}`);

    // Listen to broadcast for instant order updates
    channel
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa') {
          setLastEvent('new_order');
          callbacksRef.current.onNewOrder?.(order);
        }
      })
      .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa') {
          setLastEvent(`status_${order.status}`);

          if (order.status === 'completado') {
            callbacksRef.current.onPaymentConfirmed?.(order);
          } else if (order.status === 'Cancelado' || order.status === 'cancelado') {
            callbacksRef.current.onOrderRejected?.(order);
          } else {
            callbacksRef.current.onStatusChange?.(order);
          }
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Also listen to CDC for specific orders
    if (orderIds.length > 0) {
      const filters = orderIds.map(id => `id=eq.${id}`).join(',');
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: filters
      }, (payload) => {
        const order = payload.new as Order;
        setLastEvent(`cdc_${order.status}`);

        if (order.status === 'completado') {
          callbacksRef.current.onPaymentConfirmed?.(order);
        } else if (order.status === 'Cancelado' || order.status === 'cancelado') {
          callbacksRef.current.onOrderRejected?.(order);
        } else {
          callbacksRef.current.onStatusChange?.(order);
        }
      });
    }

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, orderIds.join(',')]);

  return { isConnected, lastEvent, reconnect };
}
