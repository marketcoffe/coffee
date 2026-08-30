import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../store/supabaseClient';
import { Order } from '../types/store';

interface UseOrdersRealtimeOptions {
  enabled?: boolean;
  onNewOrder?: (order: Order) => void;
  onStatusChange?: (order: Order) => void;
  soundEnabled?: boolean;
}

interface UseOrdersRealtimeReturn {
  isConnected: boolean;
  connectionStatus: string;
  lastEvent: string | null;
  reconnect: () => void;
}

const NOTIFICATION_SOUND_URL = '/sounds/notification.wav';

/**
 * Hook responsivo para la Comandera Admin que escucha pedidos
 * de Mesa y Delivery en tiempo real via Supabase Realtime.
 *
 * Escucha dual:
 *   - CDC (postgres_changes) INSERT + UPDATE en tabla orders
 *   - BROADCAST new_order_broadcast + order_status_broadcast
 *
 * Actualiza la UI al instante y dispara alerta sonora.
 */
export function useOrdersRealtime(options: UseOrdersRealtimeOptions = {}): UseOrdersRealtimeReturn {
  const { enabled = true, onNewOrder, onStatusChange, soundEnabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onNewOrder, onStatusChange });
  callbacksRef.current = { onNewOrder, onStatusChange };

  const playSoundRef = useRef(() => {});
  playSoundRef.current = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {
      /* silent — audio not available */
    }
  };

  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel('admin_orders_realtime');

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload: Record<string, unknown>) => {
          const order = payload.new as Order;
          if (!order?.id) return;
          setLastEvent(`INSERT:${order.id}`);
          callbacksRef.current.onNewOrder?.(order);
          playSoundRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: Record<string, unknown>) => {
          const order = payload.new as Order;
          if (!order?.id) return;
          setLastEvent(`UPDATE:${order.id}:${order.status}`);
          callbacksRef.current.onStatusChange?.(order);
        }
      )
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (!order?.id) return;
        setLastEvent(`BROADCAST_NEW:${order.id}`);
        callbacksRef.current.onNewOrder?.(order);
        playSoundRef.current();
      })
      .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (!order?.id) return;
        setLastEvent(`BROADCAST_STATUS:${order.id}:${order.status}`);
        callbacksRef.current.onStatusChange?.(order);
      })
      .subscribe((status: string) => {
        setIsConnected(status === 'SUBSCRIBED');
        setConnectionStatus(status);
        if (status === 'SUBSCRIBED') {
          mountedRef.current && console.warn('[useOrdersRealtime] Conectado a canal admin_orders_realtime');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          mountedRef.current && console.warn(`[useOrdersRealtime] Estado: ${status} — reintentando en 5s`);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current && channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }, 5000);
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return { isConnected, connectionStatus, lastEvent, reconnect };
}
