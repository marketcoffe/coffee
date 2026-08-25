import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../store/supabaseClient';

interface UseRealtimeReconnectOptions {
  channelName: string;
  enabled?: boolean;
  onReconnect?: () => void;
  maxRetries?: number;
  retryDelayMs?: number;
}

export function useRealtimeReconnect({
  channelName,
  enabled = true,
  onReconnect,
  maxRetries = 10,
  retryDelayMs = 5000,
}: UseRealtimeReconnectOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    retriesRef.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    if (retriesRef.current >= maxRetries) {
      console.warn(`[RealtimeReconnect] Max retries (${maxRetries}) reached for channel: ${channelName}`);
      return;
    }

    cleanup();

    retriesRef.current += 1;
    const delay = retryDelayMs * Math.min(retriesRef.current, 5);
    console.log(`[RealtimeReconnect] Reconnecting to "${channelName}" in ${delay}ms (attempt ${retriesRef.current}/${maxRetries})`);

    reconnectTimerRef.current = setTimeout(() => {
      const channel = supabase.channel(channelName);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RealtimeReconnect] Channel "${channelName}" reconnected`);
          retriesRef.current = 0;
          onReconnect?.();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[RealtimeReconnect] Channel "${channelName}" failed: ${status}`);
          reconnect();
        }
      });

      channelRef.current = channel;
    }, delay);
  }, [channelName, maxRetries, retryDelayMs, onReconnect, cleanup]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(channelName);

    channel.on('system', { event: 'reconnect' }, () => {
      console.log(`[RealtimeReconnect] System reconnect event for "${channelName}"`);
      onReconnect?.();
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        retriesRef.current = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reconnect();
      }
    });

    channelRef.current = channel;

    return cleanup;
  }, [channelName, enabled, reconnect, onReconnect, cleanup]);

  return { reconnect, cleanup };
}
