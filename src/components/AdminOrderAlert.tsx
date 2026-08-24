import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Order } from '../types/store';
import { supabase } from '../store/supabaseClient';
import { X, CheckCircle, XCircle, Printer, Volume2, VolumeX, UtensilsCrossed, Truck, Store, Clock } from 'lucide-react';
import { printMesaTicket } from '../utils/printMesaTicket';

export default function AdminOrderAlert() {
  const { config, updateOrderStatus, confirmMesaPayment, mesas } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPHeTnJVqO0Bvkp2XbEVCdZCdlWlEQ3aPnJZpQ0N2j5yVaENDdo+clWlDQ3aPnJVpQ0N2j5uUaURDdo+clGlEQ3aPm5NpREN2j5uTaURDdo+bk2lEQ3aPm5NpREN2j5uTaURDdY6ak2lEQ3aPm5NpREN2j5uTaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3aPm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURD');
        audioRef.current.volume = 0.5;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    const channel = supabase.channel('marketo_realtime_system');

    channel
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const order = payload.payload;
        if (order && !dismissedIds.has(order.id)) {
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playAlertSound();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
        const order = payload.new as Order;
        if (order && !dismissedIds.has(order.id)) {
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playAlertSound();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dismissedIds, playAlertSound]);

  const handleApprove = async (orderId: string) => {
    const result = await updateOrderStatus(orderId, 'En preparación' as Order['status']);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleReject = async (orderId: string) => {
    const result = await updateOrderStatus(orderId, 'Cancelado');
    if (result === false) {
      setPendingOrders(prev => [...prev]);
      return;
    }
    setPendingOrders(prev => prev.filter(o => o.id === orderId ? { ...o, status: 'Cancelado' } : o));
    setTimeout(() => {
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      setDismissedIds(prev => new Set([...prev, orderId]));
    }, 2000);
  };

  const handlePrint = (order: Order) => {
    printMesaTicket(order, config);
  };

  const handleConfirmPayment = async (orderId: string) => {
    const result = await confirmMesaPayment(orderId);
    if (result === false) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleDismiss = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-in">
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${typeConfig.color}, ${typeConfig.color}dd)` }}>
          <div className="flex items-center gap-2">
            <TypeIcon size={20} className="text-white" />
            <div>
              <h2 className="text-white font-bold text-sm">Nuevo Pedido</h2>
              <p className="text-white/80 text-[11px]">{pendingOrders.length} pendiente{pendingOrders.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer" title={soundEnabled ? 'Silenciar' : 'Activar sonido'}>
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={() => handleDismiss(currentOrder.id)} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Type & Client */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ backgroundColor: `${typeConfig.color}10` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white" style={{ backgroundColor: typeConfig.color }}>
              {currentOrder.numero_mesa || <TypeIcon size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1c1d]">{currentOrder.nombre_cliente || currentOrder.cliente_nombre}</p>
              <p className="text-[11px] text-[#8f7065]">
                {typeConfig.label}
                {currentOrder.tipo_pedido === 'mesa' && mesa ? ` — ${mesa.nombre_personalizado || `Mesa ${currentOrder.numero_mesa}`}` : ''}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-2">Detalle del Pedido</h3>
            <div className="space-y-1.5">
              {currentOrder.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-[#e4beb1]/10 last:border-0">
                  <span className="text-[#5b4137]">
                    <span className="font-bold">{item.cantidad}x</span> {item.nombre}
                    {item.selected_options && item.selected_options.length > 0 && (
                      <span className="text-[#8f7065] ml-1">
                        ({item.selected_options.map(o => o.option_name).join(', ')})
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-[#1a1c1d]">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-3 rounded-xl mb-4" style={{ backgroundColor: `${typeConfig.color}10` }}>
            <span className="text-sm font-bold text-[#1a1c1d]">Total a Pagar</span>
            <div className="text-right">
              <span className="text-lg font-black" style={{ color: typeConfig.color }}>${currentOrder.total_usd?.toFixed(2)}</span>
              <span className="text-[10px] text-[#8f7065] ml-1">{currentOrder.total_bs?.toFixed(2)} Bs.</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-4 p-3 bg-[#f9f9fb] rounded-xl border border-[#e4beb1]/10">
            <p className="text-[10px] font-bold uppercase text-[#8f7065] mb-1">Método de Pago</p>
            <p className="text-sm font-bold text-[#1a1c1d]">{currentOrder.metodo_pago}</p>
            {currentOrder.referencia_pago && (
              <div className="mt-1.5">
                <p className="text-[10px] font-bold uppercase text-[#8f7065]">Referencia</p>
                <p className="text-xs font-bold text-[#1a1c1d]">{currentOrder.referencia_pago}</p>
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
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#10b981' }}
            >
              <CheckCircle size={16} />
              Verificar Pago
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(currentOrder.id)}
                className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: '#10b981' }}
              >
                <CheckCircle size={16} />
                Aceptar Pedido
              </button>
              <button
                onClick={() => handleReject(currentOrder.id)}
                className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-red-500 text-white transition-all active:scale-[0.98] cursor-pointer"
              >
                <XCircle size={16} />
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
            <p className="text-center text-[10px] text-[#8f7065]">
              Quedan {pendingOrders.length - 1} pedido{pendingOrders.length - 1 > 1 ? 's' : ''} por procesar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
