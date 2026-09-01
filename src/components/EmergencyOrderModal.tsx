import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Order } from '../types/store';
import { supabase } from '../store/supabaseClient';
import {
  CheckCircle, XCircle, Printer, Volume2, VolumeX, UtensilsCrossed,
  Truck, Store, Clock, AlertTriangle, ChefHat, Wifi, WifiOff, MapPin, ExternalLink
} from 'lucide-react';
import { printMesaTicket } from '../utils/printMesaTicket';

let audioCtx: AudioContext | null = null;
let alertOscillator: OscillatorNode | null = null;
let alertGain: GainNode | null = null;
let alertLoopTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

async function unlockAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {}
}

function startContinuousAlert(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    stopContinuousAlert();

    alertOscillator = ctx.createOscillator();
    alertGain = ctx.createGain();

    alertOscillator.type = 'sine';
    alertOscillator.frequency.setValueAtTime(880, ctx.currentTime);

    alertGain.gain.setValueAtTime(0, ctx.currentTime);
    alertGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    alertGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    alertGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.35);
    alertGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

    alertOscillator.connect(alertGain);
    alertGain.connect(ctx.destination);

    alertOscillator.start(ctx.currentTime);
    // OscillatorNode no tiene .loop — programar repetición manual
    alertLoopTimer = setTimeout(() => {
      try {
        if (alertOscillator && ctx.state === 'running') {
          alertOscillator.start(ctx.currentTime);
        }
      } catch {}
    }, 600);
  } catch {}
}

function stopContinuousAlert(): void {
  try {
    if (alertLoopTimer) {
      clearTimeout(alertLoopTimer);
      alertLoopTimer = null;
    }
    if (alertOscillator) {
      alertOscillator.stop();
      alertOscillator.disconnect();
      alertOscillator = null;
    }
    if (alertGain) {
      alertGain.disconnect();
      alertGain = null;
    }
  } catch {}
}

function playNewOrderBeep(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1200, ctx.currentTime);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.15);
      } catch {}
    }, 180);
  } catch {}
}

function playActionBeep(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 2000;

function getTypeConfig(order: Order) {
  const tipo = order.tipo_pedido || order.tipo_entrega;
  if (tipo === 'mesa') return { label: `Mesa #${order.numero_mesa || '?'}`, icon: UtensilsCrossed, color: '#e67e22' };
  if (tipo === 'pickup') return { label: 'Pickup', icon: Store, color: '#8b5cf6' };
  return { label: 'Delivery', icon: Truck, color: '#3b82f6' };
}

function getElapsedText(fecha: string): string {
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (mins < 1) return '<1m';
  return `${mins}m`;
}

export default function EmergencyOrderModal() {
  const { config, updateOrderStatus, confirmMesaPayment, mesas } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastCleanupRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const [elapsedTick, setElapsedTick] = useState(0);

  const unlockAndPlay = useCallback(async () => {
    if (!audioUnlocked) {
      await unlockAudio();
      setAudioUnlocked(true);
    }
  }, [audioUnlocked]);

  useEffect(() => {
    const handleClick = () => { unlockAndPlay(); };
    document.addEventListener('click', handleClick, { once: true });
    document.addEventListener('touchstart', handleClick, { once: true });
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [unlockAndPlay]);

  useEffect(() => {
    if (pendingOrders.length > 0 && soundEnabled) {
      startContinuousAlert();
    } else {
      stopContinuousAlert();
    }
    return () => { stopContinuousAlert(); };
  }, [pendingOrders.length, soundEnabled]);

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  useEffect(() => {
    if (pendingOrders.length === 0) return;
    const id = setInterval(() => setElapsedTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [pendingOrders.length]);

  const addOrdersBatch = useCallback((newOrders: Order[]) => {
    setPendingOrders(prev => {
      const existingIds = new Set(prev.map(o => o.id));
      const toAdd = newOrders.filter(o =>
        o?.id && !existingIds.has(o.id) && !dismissedIdsRef.current.has(o.id)
      );
      if (toAdd.length === 0) return prev;
      return [...toAdd, ...prev];
    });
  }, []);

  const connectChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (broadcastCleanupRef.current) {
      broadcastCleanupRef.current();
      broadcastCleanupRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // CDC listener en canal persistente
    const channel = supabase.channel('marketo_emergency_orders');
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
        const order = payload.new as Order;
        if (order && !dismissedIdsRef.current.has(order.id)) {
          addOrdersBatch([order]);
          playNewOrderBeep();
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          retriesRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, retriesRef.current), MAX_RECONNECT_DELAY);
          retriesRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => connectChannel(), delay);
        }
      });

    channelRef.current = channel;

    // Escuchar broadcasts via CustomEvent global (AppContext broadcastChan)
    const handleNewOrder = (e: Event) => {
      const order = (e as CustomEvent).detail as Order;
      if (order && !dismissedIdsRef.current.has(order.id)) {
        addOrdersBatch([order]);
        playNewOrderBeep();
      }
    };
    window.addEventListener('new_order_received', handleNewOrder);
    broadcastCleanupRef.current = () => window.removeEventListener('new_order_received', handleNewOrder);
  }, [addOrdersBatch]);

  useEffect(() => {
    connectChannel();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (broadcastCleanupRef.current) {
        broadcastCleanupRef.current();
        broadcastCleanupRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectChannel]);

  const handleApprove = async (orderId: string) => {
    playActionBeep();
    const result = await updateOrderStatus(orderId, 'En preparación' as Order['status']);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleReject = async (orderId: string) => {
    const result = await updateOrderStatus(orderId, 'Cancelado');
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handlePrint = (order: Order) => {
    printMesaTicket(order, config);
  };

  const handleConfirmPayment = async (orderId: string) => {
    playActionBeep();
    const result = await confirmMesaPayment(orderId);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleDismiss = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleAcceptAll = async () => {
    const toProcess = [...pendingOrders];
    for (const order of toProcess) {
      if (order.status === 'pago_enviado') {
        await confirmMesaPayment(order.id);
      } else {
        await updateOrderStatus(order.id, 'En preparación' as Order['status']);
      }
      playActionBeep();
    }
    const ids = toProcess.map(o => o.id);
    setDismissedIds(prev => new Set([...prev, ...ids]));
    setPendingOrders([]);
  };

  if (pendingOrders.length === 0) return null;

  const mesaCount = pendingOrders.filter(o => (o.tipo_pedido || o.tipo_entrega) === 'mesa').length;
  const deliveryCount = pendingOrders.filter(o => (o.tipo_pedido || o.tipo_entrega) === 'delivery').length;
  const pickupCount = pendingOrders.filter(o => (o.tipo_pedido || o.tipo_entrega) === 'pickup').length;

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={unlockAndPlay}
    >
      {/* Header */}
      <div className="shrink-0 p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
            <AlertTriangle size={22} className="text-white animate-bounce" />
          </div>
          <div>
            <h2 className="text-white font-black text-base uppercase tracking-wide">
              Pedidos Entrantes
            </h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-white/90 text-[11px] font-bold">
                {pendingOrders.length} pendiente{pendingOrders.length > 1 ? 's' : ''}
              </span>
              {mesaCount > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/30 text-orange-200">
                  {mesaCount} mesa{mesaCount > 1 ? 's' : ''}
                </span>
              )}
              {deliveryCount > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200">
                  {deliveryCount} delivery
                </span>
              )}
              {pickupCount > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200">
                  {pickupCount} pickup
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isConnected ? <Wifi size={12} className="text-green-300" /> : <WifiOff size={12} className="text-red-300" />}
            <span className="text-[9px] font-bold text-white/70">
              {isConnected ? 'En linea' : 'Reconectando...'}
            </span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer"
            title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {/* Accept All */}
      {pendingOrders.length > 1 && (
        <div className="shrink-0 p-3 border-b border-white/10">
          <button
            onClick={handleAcceptAll}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: '#10b981' }}
          >
            <CheckCircle size={18} />
            Aceptar Todos ({pendingOrders.length})
          </button>
        </div>
      )}

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" key={elapsedTick}>
        {pendingOrders.map((order, index) => {
          const typeConfig = getTypeConfig(order);
          const TypeIcon = typeConfig.icon;
          const elapsedMin = Math.floor((Date.now() - new Date(order.fecha).getTime()) / 60000);
          const isUrgent = elapsedMin > 15;

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl overflow-hidden shadow-lg"
              style={{ borderLeft: `4px solid ${typeConfig.color}` }}
            >
              {/* Order header */}
              <div className="p-3 flex items-center justify-between" style={{ backgroundColor: `${typeConfig.color}08` }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: typeConfig.color }}>
                    #{index + 1}
                  </span>
                  <TypeIcon size={14} style={{ color: typeConfig.color }} />
                  <span className="text-[11px] font-bold" style={{ color: typeConfig.color }}>
                    {typeConfig.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{order.id.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-100' : 'bg-slate-100'}`}>
                    <Clock size={10} className={isUrgent ? 'text-red-500' : 'text-slate-400'} />
                    <span className={`text-[10px] font-bold ${isUrgent ? 'text-red-500' : 'text-slate-500'}`}>
                      {getElapsedText(order.fecha)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDismiss(order.id)}
                    className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <XCircle size={14} className="text-slate-300 hover:text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Client & items */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-[#1a1c1d]">
                      {order.nombre_cliente || order.cliente_nombre}
                    </p>
                    {order.cliente_telefono && (
                      <p className="text-[10px] text-slate-400">{order.cliente_telefono}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black" style={{ color: typeConfig.color }}>
                      ${order.total_usd?.toFixed(2)}
                    </p>
                    {order.total_bs && (
                      <p className="text-[9px] text-slate-400">{order.total_bs?.toFixed(2)} Bs.</p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1 mb-2">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-600 truncate">
                        {item.cantidad}x {item.nombre}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 ml-2 shrink-0">
                        ${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Delivery address & location */}
                {order.direccion_envio && (
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 mb-2">
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-blue-700 font-semibold">Direccion de entrega</p>
                        <p className="text-[11px] text-blue-900 truncate">{order.direccion_envio}</p>
                        {order.distancia_km && (
                          <p className="text-[9px] text-blue-500 mt-0.5">{order.distancia_km.toFixed(1)} km de distancia</p>
                        )}
                      </div>
                      {order.lat && order.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors shrink-0"
                          title="Ver en Google Maps"
                        >
                          <ExternalLink size={12} className="text-blue-600" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment info */}
                <div className="flex items-center gap-2 text-[9px] text-slate-400 mb-2">
                  <span className="font-semibold">{order.metodo_pago}</span>
                  {order.referencia_pago && (
                    <span className="font-mono">Ref: {order.referencia_pago}</span>
                  )}
                </div>

                {order.notas_admin && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 mb-2">
                    <p className="text-[9px] text-amber-700 font-semibold">{order.notas_admin}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {order.status === 'pago_enviado' ? (
                    <button
                      onClick={() => handleConfirmPayment(order.id)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-white transition-all active:scale-[0.98] cursor-pointer"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      <CheckCircle size={14} />
                      Verificar Pago
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-white transition-all active:scale-[0.98] cursor-pointer"
                        style={{ backgroundColor: '#10b981' }}
                      >
                        <CheckCircle size={14} />
                        Aceptar
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center bg-red-500 text-white transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePrint(order)}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center border-2 transition-all active:scale-[0.98] cursor-pointer"
                    style={{ borderColor: typeConfig.color, color: typeConfig.color }}
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
