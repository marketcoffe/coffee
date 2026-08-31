import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, Clock, CheckCircle, Star, Tag, Copy, ChevronDown, ChevronRight,
  RotateCcw, Truck, UtensilsCrossed, CreditCard, AlertCircle, Gift, X
} from 'lucide-react';
import { supabase } from '../store/supabaseClient';
import { useApp } from '../store/AppContext';
import type { Order } from '../types/store';

const FINISHED_STATUSES = new Set(['completado', 'Entregado', 'Cancelado', 'cancelado']);

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'Pendiente': 'Aceptado',
    'Procesando': 'En Preparación',
    'enviado_cocina': 'En Cocina',
    'En preparación': 'En Preparación',
    'En preparacion': 'En Preparación',
    'en_preparacion': 'En Preparación',
    'Listo': 'Listo',
    'En camino': 'En Camino',
    'Entregado': 'Entregado',
    'Cancelado': 'Cancelado',
    'completado': 'Completado',
    'cancelado': 'Cancelado',
    'pago_enviado': 'Pago Enviado',
    'pendiente_pago': 'Pendiente Pago',
    'pendiente_verificacion': 'Verificando',
    'pago_en_verificacion': 'Verificando Pago',
  };
  return labels[status] || status;
}

function getMesaSteps() {
  return [
    { key: 'Pendiente', label: 'Recibido', emoji: '\u{1F4CB}' },
    { key: 'En preparación', label: 'En Preparación', emoji: '\u{1F468}\u{200D}\u{1F373}' },
    { key: 'pendiente_pago', label: 'Esperando Pago', emoji: '\u{1F4B3}' },
    { key: 'completado', label: 'Pagado', emoji: '\u2705' },
  ];
}

function getDeliverySteps() {
  return [
    { key: 'Pendiente', label: 'Recibido', emoji: '\u{1F4CB}' },
    { key: 'En preparación', label: 'En Preparación', emoji: '\u{1F373}' },
    { key: 'En camino', label: 'En Camino', emoji: '\u{1F6F5}' },
    { key: 'Entregado', label: 'Entregado', emoji: '\u2705' },
  ];
}

function getStepIndex(status: string, steps: ReturnType<typeof getMesaSteps>): number {
  const map: Record<string, number> = {
    'Pendiente': 0,
    'Procesando': 1,
    'enviado_cocina': 1,
    'En preparación': 1,
    'En preparacion': 1,
    'en_preparacion': 1,
    'Listo': 1,
    'pendiente_pago': 2,
    'pago_enviado': 2,
    'pago_en_verificacion': 2,
    'completado': 3,
    'En camino': 2,
    'Entregado': 3,
    'Cancelado': -1,
    'cancelado': -1,
  };
  return map[status] ?? 0;
}

function getElapsed(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  if (diffMs < 0) return '';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}min`;
}

function getStatusBadgeColor(status: string, themeColor: string) {
  switch (status) {
    case 'completado':
    case 'Entregado':
      return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
    case 'Cancelado':
    case 'cancelado':
      return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
    case 'En camino':
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' };
    case 'En preparación':
    case 'En preparacion':
    case 'en_preparacion':
    case 'Procesando':
    case 'enviado_cocina':
      return { bg: `${themeColor}18`, text: themeColor, border: `${themeColor}40` };
    default:
      return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
  }
}

interface ClientePanelPedidosProps {}

export default function ClientePanelPedidos(_props: ClientePanelPedidosProps) {
  const {
    orders, currentUser, coupons, config, addToCart, foodItems,
    getUserLoyaltyPoints, getUserLoyaltyTier,
  } = useApp();
  const themeColor = config.theme_color || '#6E472A';

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'activos' | 'historial'>('activos');
  const [showPuntos, setShowPuntos] = useState(false);
  const [showCupones, setShowCupones] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const userPhone = currentUser?.telefono || '';
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRetriesRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  const userPhoneRef = useRef(userPhone);

  // Actualizar refs sin causar re-render del effect
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { userPhoneRef.current = userPhone; }, [userPhone]);

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const activeOrders = useMemo(() => {
    return localOrders.filter(o => {
      if (!FINISHED_STATUSES.has(o.status)) {
        if (userPhone && o.cliente_telefono === userPhone) return true;
        if (currentUser?.id && o.usuario_id === currentUser.id) return true;
        if (currentUser?.id && o.cliente_uid === currentUser.id) return true;
      }
      return false;
    }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [localOrders, userPhone, currentUser]);

  const historicalOrders = useMemo(() => {
    return localOrders.filter(o => {
      if (FINISHED_STATUSES.has(o.status)) {
        if (userPhone && o.cliente_telefono === userPhone) return true;
        if (currentUser?.id && o.usuario_id === currentUser.id) return true;
        if (currentUser?.id && o.cliente_uid === currentUser.id) return true;
      }
      return false;
    }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [localOrders, userPhone, currentUser]);

  const userPoints = currentUser ? getUserLoyaltyPoints(currentUser.id) : 0;
  const userTier = currentUser ? getUserLoyaltyTier(currentUser.id) : null;

  // Historial de puntos
  const [pointsHistory, setPointsHistory] = useState<Array<{
    id: string; points: number; operation: string; reason: string; description: string; created_at: string;
  }>>([]);
  const [showPointsHistory, setShowPointsHistory] = useState(false);

  useEffect(() => {
    if (!currentUser?.id || !showPointsHistory) return;
    console.log('[ClientePanel] Loading points history for user:', currentUser.id);
    supabase.from('loyalty_history')
      .select('id, points, operation, reason, description, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        if (error) {
          console.error('[ClientePanel] Points history load error:', error);
          return;
        }
        console.log('[ClientePanel] Points history loaded:', data?.length || 0, 'records');
        if (data) setPointsHistory(data);
      });
  }, [currentUser?.id, showPointsHistory]);

  const activeCoupons = useMemo(() => {
    return coupons.filter(c => {
      if (!c.active) return false;
      if (c.valid_until && new Date(c.valid_until) < new Date()) return false;
      if (c.usage_limit && c.usage_count >= c.usage_limit) return false;
      return true;
    });
  }, [coupons]);

  const handleReorder = useCallback((order: Order) => {
    if (!order.items || order.items.length === 0) return;
    order.items.forEach((oi) => {
      const product = foodItems.find(fi => fi.id === oi.food_id || fi.nombre === oi.nombre);
      if (product) {
        addToCart(product, oi.cantidad, oi.selected_options, 0);
      }
    });
  }, [foodItems, addToCart]);

  const handleCopyCoupon = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const MAX_DELAY = 30000;
    const BASE_DELAY = 2000;

    const connectChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      console.log('[ClientePanel] Suscribiéndose a realtime para usuario:', currentUser.id);

      const cu = currentUserRef.current;
      const phone = userPhoneRef.current;

      const channel = supabase
        .channel(`cliente_orders_${cu?.id || 'anon'}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          (payload: Record<string, unknown>) => {
            const updated = payload.new as Order;
            if (!updated?.id) return;
            const cur = currentUserRef.current;
            const ph = userPhoneRef.current;
            const isMine =
              (ph && updated.cliente_telefono === ph) ||
              (cur?.id && updated.usuario_id === cur.id) ||
              (cur?.id && updated.cliente_uid === cur.id);
            if (isMine) {
              console.log('[ClientePanel] Pedido actualizado:', updated.id, updated.status);
              setLocalOrders(prev =>
                prev.map(o => o.id === updated.id ? { ...o, ...updated } : o)
              );
              if (updated.status === 'Entregado' && currentUserRef.current?.id) {
                supabase.from('usuarios_clientes')
                  .select('puntos_fidelidad, puntos_historicos')
                  .eq('id', currentUserRef.current.id)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data) {
                      window.dispatchEvent(new CustomEvent('loyalty_points_updated', {
                        detail: { puntos_fidelidad: data.puntos_fidelidad, puntos_historicos: data.puntos_historicos }
                      }));
                      console.log('[ClientePanel] Puntos re-leídos tras Entregado:', data);
                    }
                  });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload: Record<string, unknown>) => {
            const inserted = payload.new as Order;
            if (!inserted?.id) return;
            const cur = currentUserRef.current;
            const ph = userPhoneRef.current;
            const isMine =
              (ph && inserted.cliente_telefono === ph) ||
              (cur?.id && inserted.usuario_id === cur.id) ||
              (cur?.id && inserted.cliente_uid === cur.id);
            if (isMine) {
              console.log('[ClientePanel] Nuevo pedido:', inserted.id, inserted.status);
              setLocalOrders(prev => {
                if (prev.some(o => o.id === inserted.id)) return prev;
                return [inserted, ...prev];
              });
            }
          }
        )
        .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
          const updated = payload.payload;
          if (!updated?.id) return;
          const cur = currentUserRef.current;
          const ph = userPhoneRef.current;
          const isMine =
            (ph && updated.cliente_telefono === ph) ||
            (cur?.id && updated.usuario_id === cur.id) ||
            (cur?.id && updated.cliente_uid === cur.id);
          if (isMine) {
            console.log('[ClientePanel] Broadcast order_status:', updated.id, updated.status);
            setLocalOrders(prev =>
              prev.map(o => o.id === updated.id ? { ...o, ...updated } : o)
            );
            if (updated.status === 'Entregado' && currentUserRef.current?.id) {
              supabase.from('usuarios_clientes')
                .select('puntos_fidelidad, puntos_historicos')
                .eq('id', currentUserRef.current.id)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) {
                    window.dispatchEvent(new CustomEvent('loyalty_points_updated', {
                      detail: { puntos_fidelidad: data.puntos_fidelidad, puntos_historicos: data.puntos_historicos }
                    }));
                    console.log('[ClientePanel] Broadcast: puntos re-leídos tras Entregado:', data);
                  }
                });
            }
          }
        })
        .subscribe((status: string) => {
          console.log('[ClientePanel] Canal realtime status:', status);
          if (status === 'SUBSCRIBED') {
            reconnectRetriesRef.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[ClientePanelPedidos] Canal desconectado (${status}), reconectando...`);
            const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectRetriesRef.current), MAX_DELAY);
            reconnectRetriesRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => connectChannel(), delay);
          }
        });

      channelRef.current = channel;
    };

    connectChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [currentUser?.id, userPhone]);

  const OrderProgressBar: React.FC<{ order: Order }> = ({ order }) => {
    const orderType = order.tipo_entrega || order.tipo_pedido || 'delivery';
    const steps = orderType === 'mesa' ? getMesaSteps() : getDeliverySteps();
    const currentIdx = getStepIndex(order.status, steps);

    return (
      <div className="flex items-center gap-1 w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx || (currentIdx >= 0 && idx <= currentIdx && currentIdx === steps.length - 1);
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 border-2 shrink-0"
                  style={{
                    backgroundColor: isCompleted ? '#10B981' : isCurrent ? themeColor : '#E5E7EB',
                    borderColor: isCompleted ? '#10B981' : isCurrent ? themeColor : '#D1D5DB',
                    color: isCompleted || isCurrent ? '#fff' : '#9CA3AF',
                    boxShadow: isCurrent ? `0 0 0 3px ${themeColor}30` : 'none',
                  }}
                >
                  {isCompleted && !isCurrent ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="text-[11px]">{step.emoji}</span>
                  )}
                </div>
                <span
                  className="text-[9px] mt-1 font-semibold text-center leading-tight truncate w-full"
                  style={{ color: isCompleted || isCurrent ? '#1a1c1d' : '#9CA3AF' }}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-[2px] -mt-4 shrink-0 rounded-full">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: idx < currentIdx ? '#10B981' : idx === currentIdx ? themeColor : '#E5E7EB',
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderActiveOrder = (order: Order) => {
    const isExpanded = expandedOrder === order.id;
    const elapsed = getElapsed(order.fecha);
    const itemCount = order.items?.reduce((sum, i) => sum + (i.cantidad || 1), 0) || 0;
    const itemsSummary = order.items?.slice(0, 2).map(i => i.nombre).join(', ') || 'Pedido';
    const moreItems = (order.items?.length || 0) > 2 ? ` +${order.items!.length - 2} más` : '';

    return (
      <motion.div
        key={order.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#e4beb1]/10 overflow-hidden shadow-sm"
      >
        <button
          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
          className="w-full p-4 flex flex-col gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <Package size={14} style={{ color: themeColor }} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1a1c1d]">#{order.id.toUpperCase()}</p>
                <p className="text-[10px] text-[#8f7065]">{itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {elapsed && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#F3F4F6] text-[#5b4137] flex items-center gap-1">
                  <Clock size={10} />
                  {elapsed}
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={14} className="text-[#8f7065]" />
              </motion.div>
            </div>
          </div>

          <OrderProgressBar order={order} />

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#8f7065] truncate max-w-[60%]">
              {itemsSummary}{moreItems}
            </p>
            <p className="text-sm font-black" style={{ color: themeColor }}>
              ${order.total_usd?.toFixed(2)}
            </p>
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-[#e4beb1]/10 pt-3 flex flex-col gap-2">
                {order.ticket_code && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F9F5F2] border border-[#e4beb1]/10">
                    <div className="flex items-center gap-2">
                      <Tag size={12} style={{ color: themeColor }} />
                      <span className="text-[11px] text-[#5b4137] font-semibold">Ticket</span>
                    </div>
                    <span className="text-xs font-black font-mono tracking-wider" style={{ color: themeColor }}>
                      {order.ticket_code}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="text-[#5b4137] truncate">
                        {item.cantidad}x {item.nombre}
                      </span>
                      <span className="text-[#1a1c1d] font-semibold shrink-0 ml-2">
                        ${((item.precio_usd || 0) * (item.cantidad || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#e4beb1]/10 pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1a1c1d]">Total</span>
                  <span className="text-sm font-black" style={{ color: themeColor }}>
                    ${order.total_usd?.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    style={{
                      backgroundColor: `${themeColor}15`,
                      color: themeColor,
                    }}
                  >
                    {order.tipo_entrega === 'mesa' ? (
                      <><UtensilsCrossed size={10} /> Mesa #{order.numero_mesa || '?'}</>
                    ) : (
                      <><Truck size={10} /> Delivery</>
                    )}
                  </div>
                  <div className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#F3F4F6] text-[#5b4137] flex items-center gap-1">
                    <CreditCard size={10} />
                    {order.metodo_pago}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderHistoricalOrder = (order: Order) => {
    const itemCount = order.items?.reduce((sum, i) => sum + (i.cantidad || 1), 0) || 0;
    const badgeColors = getStatusBadgeColor(order.status, themeColor);
    const dateStr = new Date(order.fecha).toLocaleDateString('es-VE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const timeStr = new Date(order.fecha).toLocaleTimeString('es-VE', {
      hour: '2-digit', minute: '2-digit',
    });

    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex flex-col gap-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-[#1a1c1d]">#{order.id.toUpperCase()}</p>
            <span
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
              style={{
                backgroundColor: badgeColors.bg,
                color: badgeColors.text,
                borderColor: badgeColors.border,
              }}
            >
              {getStatusLabel(order.status)}
            </span>
          </div>
          <p className="text-sm font-black" style={{ color: themeColor }}>
            ${order.total_usd?.toFixed(2)}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-[#8f7065]" />
            <span className="text-[10px] text-[#8f7065]">{dateStr} &middot; {timeStr}</span>
          </div>
          <span className="text-[10px] text-[#8f7065]">
            {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>

        {order.status !== 'Cancelado' && order.status !== 'cancelado' && (
          <button
            onClick={() => handleReorder(order)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white active:scale-[0.98] transition-all"
            style={{ backgroundColor: themeColor }}
          >
            <RotateCcw size={13} />
            Re-ordenar
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center gap-2 px-1">
        <Package size={18} style={{ color: themeColor }} />
        <h2 className="text-base font-black text-[#1a1c1d]">Mis Pedidos</h2>
      </div>

      <div className="flex gap-2 bg-[#F3F4F6] rounded-xl p-1">
        <button
          onClick={() => setActiveTab('activos')}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
          style={{
            backgroundColor: activeTab === 'activos' ? '#fff' : 'transparent',
            color: activeTab === 'activos' ? themeColor : '#8f7065',
            boxShadow: activeTab === 'activos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Activos ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
          style={{
            backgroundColor: activeTab === 'historial' ? '#fff' : 'transparent',
            color: activeTab === 'historial' ? themeColor : '#8f7065',
            boxShadow: activeTab === 'historial' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Historial ({historicalOrders.length})
        </button>
      </div>

      {activeTab === 'activos' && (
        <div className="flex flex-col gap-3">
          {activeOrders.length === 0 ? (
            <div className="text-center py-10">
              <Package size={36} className="mx-auto mb-3" style={{ color: `${themeColor}30` }} />
              <p className="text-sm font-bold text-[#1a1c1d]">Sin pedidos activos</p>
              <p className="text-[11px] text-[#8f7065] mt-1">Tus pedidos en curso aparecerán aquí</p>
            </div>
          ) : (
            activeOrders.map(renderActiveOrder)
          )}
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="flex flex-col gap-3">
          {historicalOrders.length === 0 ? (
            <div className="text-center py-10">
              <Clock size={36} className="mx-auto mb-3" style={{ color: `${themeColor}30` }} />
              <p className="text-sm font-bold text-[#1a1c1d]">Sin historial</p>
              <p className="text-[11px] text-[#8f7065] mt-1">Tus pedidos anteriores aparecerán aquí</p>
            </div>
          ) : (
            historicalOrders.map(renderHistoricalOrder)
          )}
        </div>
      )}

      {currentUser && (
        <button
          onClick={() => setShowPuntos(!showPuntos)}
          className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${themeColor}15` }}
            >
              <Star size={16} style={{ color: themeColor }} fill={themeColor} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#1a1c1d]">Mis Puntos</p>
              <p className="text-[11px] text-[#8f7065]">
                {userPoints} puntos{userTier ? ` \u00B7 ${userTier.icon || ''} ${userTier.name}` : ''}
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: showPuntos ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-[#8f7065]" />
          </motion.div>
        </button>
      )}

      <AnimatePresence>
        {showPuntos && currentUser && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 shadow-sm">
              <div className="rounded-2xl p-5 text-center text-white mb-3"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}CC)` }}>
                <Star size={20} className="mx-auto mb-1 opacity-90" />
                <p className="text-4xl font-black mb-1">{userPoints}</p>
                <p className="text-[11px] opacity-80">Puntos disponibles</p>
              </div>

              {userTier && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F9F5F2] border border-[#e4beb1]/10">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: (userTier.color || '#CD7F32') + '18' }}
                  >
                    {userTier.icon || '\u{1F949}'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: userTier.color || '#CD7F32' }}>
                      {userTier.name}
                    </p>
                    <p className="text-[10px] text-[#8f7065]">
                      {userTier.multiplier > 1 ? `\u00D7${userTier.multiplier} multiplicador` : 'Nivel base'}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white"
                    style={{ backgroundColor: userTier.color || '#CD7F32' }}
                  >
                    ACTIVO
                  </span>
                </div>
              )}

              {/* Historial de puntos */}
              <button
                onClick={() => setShowPointsHistory(!showPointsHistory)}
                className="w-full mt-3 flex items-center justify-between text-[11px] font-bold text-[#8f7065] uppercase"
              >
                <span>Historial de puntos</span>
                <motion.div animate={{ rotate: showPointsHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} />
                </motion.div>
              </button>
              <AnimatePresence>
                {showPointsHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {pointsHistory.length === 0 ? (
                        <p className="text-[10px] text-[#8f7065] text-center py-2">Sin movimientos aun</p>
                      ) : pointsHistory.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#e4beb1]/10 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${tx.operation === 'suma' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                              {tx.operation === 'suma' ? '+' : '-'}
                            </span>
                            <div>
                              <p className="font-semibold text-[#1a1c1d] truncate max-w-[140px]">{tx.description || tx.reason}</p>
                              <p className="text-[9px] text-[#8f7065]">{new Date(tx.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</p>
                            </div>
                          </div>
                          <span className={`font-bold ${tx.operation === 'suma' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.operation === 'suma' ? '+' : '-'}{tx.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCoupons.length > 0 && (
        <>
          <button
            onClick={() => setShowCupones(!showCupones)}
            className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#FEF3C7' }}
              >
                <Tag size={16} className="text-[#D97706]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#1a1c1d]">Mis Cupones</p>
                <p className="text-[11px] text-[#8f7065]">
                  {activeCoupons.length} {activeCoupons.length === 1 ? 'disponible' : 'disponibles'}
                </p>
              </div>
            </div>
            <motion.div animate={{ rotate: showCupones ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#8f7065]" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showCupones && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2">
                  {activeCoupons.map((coupon) => {
                    const isCopied = copiedCoupon === coupon.code;
                    const discountText = coupon.coupon_type === 'fixed'
                      ? `$${coupon.discount_amount || coupon.discount_percent} OFF`
                      : coupon.coupon_type === 'free_shipping'
                      ? 'Envío Gratis'
                      : `${coupon.discount_percent}% OFF`;

                    return (
                      <div
                        key={coupon.id}
                        className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex flex-col gap-2.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gift size={14} className="text-[#D97706]" />
                            <span className="text-xs font-bold text-[#1a1c1d]">
                              {discountText}
                            </span>
                          </div>
                          {coupon.valid_until && (
                            <span className="text-[10px] text-[#8f7065]">
                              Expira: {new Date(coupon.valid_until).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>

                        {coupon.description && (
                          <p className="text-[11px] text-[#8f7065]">{coupon.description}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-[#D97706]/30 bg-[#FEF3C7]/50"
                          >
                            <span className="text-xs font-black font-mono tracking-widest text-[#D97706]">
                              {coupon.code}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopyCoupon(coupon.code)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                            style={{
                              backgroundColor: isCopied ? '#10B981' : themeColor,
                              color: '#fff',
                            }}
                          >
                            {isCopied ? (
                              <><CheckCircle size={12} /> Copiado</>
                            ) : (
                              <><Copy size={12} /> Copiar</>
                            )}
                          </button>
                        </div>

                        {coupon.min_purchase && coupon.min_purchase > 0 && (
                          <p className="text-[10px] text-[#8f7065] flex items-center gap-1">
                            <AlertCircle size={10} />
                            Compra mínima: ${coupon.min_purchase.toFixed(2)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
