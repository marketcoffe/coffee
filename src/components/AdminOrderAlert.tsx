import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Order } from '../types/store';
import { supabase } from '../store/supabaseClient';
import { X, CheckCircle, XCircle, Volume2, VolumeX, UtensilsCrossed, Truck, Store, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { OrderDetailModal } from '../pages/admin/components/OrderDetailModal';
import { printOrderTicket } from '../pages/admin/utils/printUtils';

export default function AdminOrderAlert() {
  const { config, updateOrderStatus, mesas } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPHeTnJVqO0Bvkp2XbEVCdZCdlWlEQ3aPnJZpQ0N2j5yVaUNDdo+clWlDQ3aPnJVpQ0N2j5uUaURDdo+clGlEQ3aPm5NpREN2j5uTaURDdo+bk2lEQ3aPm5NpREN2j5uTaURDdY6ak2lEQ3aPm5NpREN2j5uTaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3aPm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3aPm5JpREN2j5uSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURDdY6ak2lEQ3WOm5JpREN1jpuSaURD');
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
          if (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa') return;
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playAlertSound();
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 2000);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
        const order = payload.new as Order;
        if (order && !dismissedIds.has(order.id)) {
          if (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa') return;
          setPendingOrders(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          playAlertSound();
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 2000);
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
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleDismiss = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setDismissedIds(prev => new Set([...prev, orderId]));
  };

  const handleAcceptAll = async () => {
    for (const order of pendingOrders) {
      await updateOrderStatus(order.id, 'En preparación' as Order['status']);
    }
    const ids = pendingOrders.map(o => o.id);
    setDismissedIds(prev => new Set([...prev, ...ids]));
    setPendingOrders([]);
  };

  const handlePrint = (order: Order) => {
    printOrderTicket(order, config);
  };

  const getTypeConfig = (order: Order) => {
    const tipo = order.tipo_pedido || order.tipo_entrega;
    if (tipo === 'mesa') return { label: `Mesa #${order.numero_mesa || '?'}`, icon: UtensilsCrossed, color: '#e67e22' };
    if (tipo === 'pickup') return { label: 'Pickup', icon: Store, color: '#8b5cf6' };
    return { label: 'Delivery', icon: Truck, color: '#3b82f6' };
  };

  // Expose newOrderFlash to parent for tab flash
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('newOrderAlert', { detail: { hasNew: pendingOrders.length > 0, flash: newOrderFlash } }));
  }, [pendingOrders.length, newOrderFlash]);

  if (pendingOrders.length === 0) return null;

  return (
    <>
      {/* Floating panel */}
      <div className={`fixed right-0 top-0 bottom-0 z-[9997] flex flex-col transition-all duration-300 ${panelOpen ? 'w-[360px]' : 'w-12'}`}
        style={{ background: 'var(--erp-sidebar-bg, #fff)', borderLeft: '1px solid var(--erp-card-border, #e2e8f0)', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>

        {/* Toggle button */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
          style={{ background: themeColor }}
        >
          {panelOpen ? <ChevronRight size={14} className="text-white" /> : <ChevronLeft size={14} className="text-white" />}
        </button>

        {panelOpen && (
          <>
            {/* Header */}
            <div className="shrink-0 p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--erp-card-border, #e2e8f0)' }}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full bg-amber-500 ${newOrderFlash ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-bold" style={{ color: 'var(--ios-text, #1a1c1d)' }}>
                  Pedidos Nuevos ({pendingOrders.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" title={soundEnabled ? 'Silenciar' : 'Activar sonido'}>
                  {soundEnabled ? <Volume2 size={14} className="text-slate-500" /> : <VolumeX size={14} className="text-slate-400" />}
                </button>
                <button onClick={() => setPendingOrders([])} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" title="Limpiar todos">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Accept all button */}
            {pendingOrders.length > 1 && (
              <div className="shrink-0 p-2 border-b" style={{ borderColor: 'var(--erp-card-border, #e2e8f0)' }}>
                <button
                  onClick={handleAcceptAll}
                  className="w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-white cursor-pointer transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#10b981' }}
                >
                  <CheckCircle size={14} />
                  Aceptar Todos ({pendingOrders.length})
                </button>
              </div>
            )}

            {/* Orders list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {pendingOrders.map((order, index) => {
                const typeConfig = getTypeConfig(order);
                const TypeIcon = typeConfig.icon;
                const elapsed = Math.floor((Date.now() - new Date(order.fecha).getTime()) / 60000);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border p-3 transition-all hover:shadow-md cursor-pointer"
                    style={{ borderColor: `${typeConfig.color}30` }}
                    onClick={() => setDetailOrder(order)}
                  >
                    {/* Order header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${typeConfig.color}15`, color: typeConfig.color }}>
                          #{index + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-900">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TypeIcon size={11} style={{ color: typeConfig.color }} />
                        <span className="text-[9px] font-bold" style={{ color: typeConfig.color }}>{typeConfig.label}</span>
                      </div>
                    </div>

                    {/* Client */}
                    <p className="text-xs font-bold text-slate-800 truncate">{order.cliente_nombre}</p>
                    {order.cliente_telefono && (
                      <p className="text-[10px] text-slate-500 truncate">{order.cliente_telefono}</p>
                    )}

                    {/* Items preview */}
                    <div className="mt-2 space-y-0.5">
                      {order.items?.slice(0, 3).map((item, idx) => (
                        <p key={idx} className="text-[10px] text-slate-600 truncate">
                          {item.cantidad}x {item.nombre}
                        </p>
                      ))}
                      {(order.items?.length || 0) > 3 && (
                        <p className="text-[9px] text-slate-400">+{(order.items?.length || 0) - 3} mas</p>
                      )}
                    </div>

                    {/* Total & time */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Clock size={10} className={elapsed > 15 ? 'text-red-500' : 'text-slate-400'} />
                        <span className={`text-[10px] font-bold ${elapsed > 15 ? 'text-red-500' : 'text-slate-500'}`}>{elapsed}min</span>
                      </div>
                      <span className="text-sm font-black" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="flex-1 py-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 text-white cursor-pointer transition-all active:scale-95"
                        style={{ backgroundColor: '#10b981' }}
                      >
                        <CheckCircle size={11} /> Aceptar
                      </button>
                      <button
                        onClick={() => handlePrint(order)}
                        className="py-2 px-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center border cursor-pointer transition-all active:scale-95"
                        style={{ borderColor: typeConfig.color, color: typeConfig.color }}
                      >
                        🖨
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        className="py-2 px-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center bg-red-500 text-white cursor-pointer transition-all active:scale-95"
                      >
                        <XCircle size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onAdvance={(o) => { handleApprove(o.id); setDetailOrder(null); }}
          onCancel={(o) => { handleReject(o.id); setDetailOrder(null); }}
          onPrint={handlePrint}
          sequenceNumber={pendingOrders.indexOf(detailOrder) + 1}
        />
      )}

      {/* CSS for panel animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
