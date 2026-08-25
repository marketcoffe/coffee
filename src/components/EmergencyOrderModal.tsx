import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Order } from '../types/store';
import { supabase } from '../store/supabaseClient';
import { CheckCircle, XCircle, Printer, Volume2, VolumeX, UtensilsCrossed, Truck, Store, Clock, AlertTriangle, ChefHat } from 'lucide-react';
import { printMesaTicket } from '../utils/printMesaTicket';

let audioCtx: AudioContext | null = null;
let alertOscillator: OscillatorNode | null = null;
let alertGain: GainNode | null = null;

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
    alertOscillator.loop = true;
  } catch {}
}

function stopContinuousAlert(): void {
  try {
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

function playSingleBeep(): void {
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

export default function EmergencyOrderModal() {
  const { config, updateOrderStatus, confirmMesaPayment, mesas } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unlockAndPlay = useCallback(async () => {
    if (!audioUnlocked) {
      await unlockAudio();
      setAudioUnlocked(true);
    }
    if (soundEnabled) {
      startContinuousAlert();
    }
  }, [audioUnlocked, soundEnabled]);

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
    if (pendingOrders.length > 0) {
      setElapsedSeconds(0);
      elapsedRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setElapsedSeconds(0);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [pendingOrders.length]);

  useEffect(() => {
    const channel = supabase.channel('marketo_emergency_orders');

    channel
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (order && !dismissedIds.has(order.id)) {
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playSingleBeep();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
        const order = payload.new as Order;
        if (order && !dismissedIds.has(order.id)) {
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playSingleBeep();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dismissedIds]);

  const handleApprove = async (orderId: string) => {
    playSingleBeep();
    const result = await updateOrderStatus(orderId, 'En preparación' as Order['status']);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleReject = async (orderId: string) => {
    stopContinuousAlert();
    const result = await updateOrderStatus(orderId, 'Cancelado');
    if (result === false) {
      setPendingOrders(prev => [...prev]);
      return;
    }
    setPendingOrders(prev => prev.filter(o => o.id === orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handlePrint = (order: Order) => {
    printMesaTicket(order, config);
  };

  const handleConfirmPayment = async (orderId: string) => {
    playSingleBeep();
    const result = await confirmMesaPayment(orderId);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleDismiss = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
    if (pendingOrders.length <= 1) stopContinuousAlert();
  };

  if (pendingOrders.length === 0) return null;

  const currentOrder = pendingOrders[0];
  const mesa = currentOrder.numero_mesa ? mesas.find(m => m.numero_mesa === currentOrder.numero_mesa) : null;

  const getTypeConfig = (order: Order) => {
    const tipo = order.tipo_pedido || order.tipo_entrega;
    if (tipo === 'mesa') return { label: `Mesa #${order.numero_mesa || '?'}`, icon: UtensilsCrossed, color: '#e67e22' };
    if (tipo === 'pickup') return { label: 'Pickup', icon: Store, color: '#8b5cf6' };
    return { label: 'Delivery', icon: Truck, color: '#3b82f6' };
  };

  const typeConfig = getTypeConfig(currentOrder);
  const TypeIcon = typeConfig.icon;

  const formatElapsed = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={unlockAndPlay}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[95vh] overflow-hidden relative">
        {/* Pulsing red border */}
        <div className="absolute inset-0 rounded-3xl border-4 border-red-500 animate-pulse pointer-events-none" />

        {/* Header */}
        <div className="p-5 flex items-center justify-between relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${typeConfig.color}, ${typeConfig.color}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-white font-black text-base uppercase tracking-wide">Nuevo Pedido</h2>
              <p className="text-white/80 text-[11px] font-bold">{pendingOrders.length} pendiente{pendingOrders.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Timer */}
            <div className="bg-white/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock size={14} className="text-white" />
              <span className="text-white font-mono font-black text-sm">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer" title={soundEnabled ? 'Silenciar' : 'Activar sonido'}>
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={() => handleDismiss(currentOrder.id)} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer">
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(95vh-220px)]">
          {/* Type & Client */}
          <div className="flex items-center gap-3 mb-4 p-4 rounded-xl" style={{ backgroundColor: `${typeConfig.color}10` }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl text-white" style={{ backgroundColor: typeConfig.color }}>
              {currentOrder.numero_mesa || <TypeIcon size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1a1c1d] truncate">{currentOrder.nombre_cliente || currentOrder.cliente_nombre}</p>
              <p className="text-[11px] text-[#8f7065]">
                {typeConfig.label}
                {currentOrder.tipo_pedido === 'mesa' && mesa ? ` — ${mesa.nombre_personalizado || `Mesa ${currentOrder.numero_mesa}`}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black" style={{ color: typeConfig.color }}>${currentOrder.total_usd?.toFixed(2)}</p>
              <p className="text-[10px] text-[#8f7065]">{currentOrder.total_bs?.toFixed(2)} Bs.</p>
            </div>
          </div>

          {/* Items */}
          <div className="mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-2 flex items-center gap-1.5">
              <ChefHat size={12} /> Detalle del Pedido
            </h3>
            <div className="space-y-1.5">
              {currentOrder.items?.map((item, idx) => (
                <div key={idx} className="py-2 border-b border-[#e4beb1]/10 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#1a1c1d]">
                      {item.cantidad}x {item.nombre}
                    </span>
                    <span className="text-xs font-bold text-[#1a1c1d]">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
                  </div>
                  {item.selected_options && item.selected_options.length > 0 && (
                    <p className="text-[10px] text-[#8f7065] mt-0.5">
                      + {item.selected_options.map(o => o.option_name).join(', ')}
                    </p>
                  )}
                  {item.ingredientes_removidos && item.ingredientes_removidos.length > 0 && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      Sin: {item.ingredientes_removidos.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-4 p-3 bg-[#f9f9fb] rounded-xl border border-[#e4beb1]/10">
            <p className="text-[10px] font-bold uppercase text-[#8f7065] mb-1">Metodo de Pago</p>
            <p className="text-sm font-bold text-[#1a1c1d]">{currentOrder.metodo_pago}</p>
            {currentOrder.referencia_pago && (
              <div className="mt-1.5">
                <p className="text-[10px] font-bold uppercase text-[#8f7065]">Referencia</p>
                <p className="text-xs font-bold text-[#1a1c1d] font-mono">{currentOrder.referencia_pago}</p>
              </div>
            )}
            {currentOrder.banco_origen && (
              <div className="mt-1.5">
                <p className="text-[10px] font-bold uppercase text-[#8f7065]">Banco Emisor</p>
                <p className="text-xs font-bold text-[#1a1c1d]">{currentOrder.banco_origen}</p>
              </div>
            )}
          </div>

          {currentOrder.notas_admin && (
            <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-[10px] font-bold uppercase text-amber-700 mb-1">Notas</p>
              <p className="text-xs text-amber-800">{currentOrder.notas_admin}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#e4beb1]/10 space-y-2">
          {currentOrder.status === 'pago_enviado' ? (
            <button
              onClick={() => handleConfirmPayment(currentOrder.id)}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#10b981' }}
            >
              <CheckCircle size={18} />
              Verificar Pago
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(currentOrder.id)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: '#10b981' }}
              >
                <CheckCircle size={18} />
                Aceptar Pedido
              </button>
              <button
                onClick={() => handleReject(currentOrder.id)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-red-500 text-white transition-all active:scale-[0.98] cursor-pointer"
              >
                <XCircle size={18} />
                Rechazar
              </button>
            </div>
          )}
          <button
            onClick={() => handlePrint(currentOrder)}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.98] cursor-pointer"
            style={{ borderColor: typeConfig.color, color: typeConfig.color }}
          >
            <Printer size={16} />
            Imprimir Comanda
          </button>
          {pendingOrders.length > 1 && (
            <p className="text-center text-[10px] text-[#8f7065] font-bold">
              Quedan {pendingOrders.length - 1} pedido{pendingOrders.length - 1 > 1 ? 's' : ''} por procesar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
