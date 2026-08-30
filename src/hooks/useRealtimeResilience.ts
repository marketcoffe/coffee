import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../store/supabaseClient';

interface UseRealtimeResilienceOptions {
  channelName: string;
  enabled?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onReconnect?: () => void;
  onStatusChange?: (status: string) => void;
  events?: Array<{
    type: 'postgres_changes' | 'broadcast' | 'presence';
    event?: string;
    schema?: string;
    table?: string;
    filter?: string;
    eventName?: string;
    callback: (payload: unknown) => void;
  }>;
}

interface UseRealtimeResilienceReturn {
  isConnected: boolean;
  connectionStatus: string;
  retries: number;
  reconnect: () => void;
  forceReconnect: () => void;
}

/**
 * Hook de reconexión resiliente para Supabase Realtime.
 *
 * Características:
 * - Exponential backoff con jitter para reconexiones
 * - Limpieza completa de canales y timers al desmontar
 * - Prevención de duplicación de listeners
 * - Callbacks estabilizados vía ref (sin re-suscripciones innecesarias)
 * - Soporte para múltiples tipos de eventos (postgres_changes, broadcast, presence)
 */
export function useRealtimeResilience(
  options: UseRealtimeResilienceOptions
): UseRealtimeResilienceReturn {
  const {
    channelName,
    enabled = true,
    maxRetries = 10,
    initialDelayMs = 2000,
    maxDelayMs = 60000,
    onReconnect,
    onStatusChange,
    events = [],
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [retries, setRetries] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Estabilizar callbacks sin causar re-suscripciones
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    if (!mountedRef.current) return;

    cleanup();
    retriesRef.current += 1;
    setRetries(retriesRef.current);

    const channel = supabase.channel(channelName);

    // Registrar todos los eventos configurados
    for (const evt of eventsRef.current) {
      if (evt.type === 'postgres_changes') {
        (channel as any).on(
          'postgres_changes',
          {
            event: (evt.event as '*' | 'INSERT' | 'UPDATE' | 'DELETE') || '*',
            schema: evt.schema || 'public',
            table: evt.table || '*',
            filter: evt.filter,
          },
          evt.callback as (payload: Record<string, unknown>) => void
        );
      } else if (evt.type === 'broadcast' && evt.eventName) {
        channel.on('broadcast', { event: evt.eventName }, evt.callback as (payload: { payload: unknown }) => void);
      } else if (evt.type === 'presence' && evt.eventName) {
        (channel as any).on('presence', { event: evt.eventName }, evt.callback as (payload: Record<string, unknown>) => void);
      }
    }

    channel.on('system', { event: 'reconnect' }, () => {
      console.log(`[RealtimeResilience] System reconnect for "${channelName}"`);
      onReconnectRef.current?.();
    });

    channel.subscribe((status) => {
      if (!mountedRef.current) return;

      setConnectionStatus(status);
      onStatusChangeRef.current?.(status);

      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        retriesRef.current = 0;
        setRetries(0);
        console.log(`[RealtimeResilience] "${channelName}" connected`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
        console.warn(`[RealtimeResilience] "${channelName}" failed: ${status}`);

        if (retriesRef.current < maxRetries) {
          // Exponential backoff con jitter: delay * 2^(attempt-1) + random jitter
          const exponentialDelay = initialDelayMs * Math.pow(2, retriesRef.current - 1);
          const jitter = Math.random() * 1000;
          const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

          console.log(`[RealtimeResilience] Reconnecting "${channelName}" in ${Math.round(delay)}ms (attempt ${retriesRef.current}/${maxRetries})`);

          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              subscribe();
            }
          }, delay);
        } else {
          console.error(`[RealtimeResilience] Max retries (${maxRetries}) reached for "${channelName}"`);
          setConnectionStatus('FAILED');
        }
      } else if (status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;
  }, [channelName, maxRetries, initialDelayMs, maxDelayMs, cleanup]);

  const forceReconnect = useCallback(() => {
    retriesRef.current = 0;
    setRetries(0);
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      subscribe();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, subscribe, cleanup]);

  return {
    isConnected,
    connectionStatus,
    retries,
    reconnect: subscribe,
    forceReconnect,
  };
}
