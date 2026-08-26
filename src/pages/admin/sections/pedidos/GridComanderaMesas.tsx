import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../../../store/AppContext';
import { supabase } from '../../../../store/supabaseClient';
import { Order } from '../../../../types/store';
import {
  UtensilsCrossed, Printer, CheckCircle, Clock, CreditCard, X, Volume2, VolumeX,
  Search, Filter, AlertTriangle, Banknote, Eye, Check, Ban
} from 'lucide-react';
import { printMesaTicket } from '../../../../utils/printMesaTicket';

type MesaColumn = 'en_cocina' | 'esperando_pago' | 'pagado';

const COLUMN_CONFIG: Record<MesaColumn, { label: string; color: string; bg: string; borderColor: string; countBg: string }> = {
  'en_cocina':      { label: 'En Cocina',       color: 'text-blue-700',    bg: 'bg-blue-50',    borderColor: 'border-blue-300',    countBg: 'bg-blue-500' },
  'esperando_pago': { label: 'Esperando Pago',   color: 'text-amber-700',   bg: 'bg-amber-50',   borderColor: 'border-amber-300',   countBg: 'bg-amber-500' },
  'pagado':         { label: 'Pagado',           color: 'text-emerald-700', bg: 'bg-emerald-50', borderColor: 'border-emerald-300', countBg: 'bg-emerald-500' },
};

function getMesaColumn(order: Order): MesaColumn {
  const s = order.status;
  if (s === 'pago_enviado' || s === 'pendiente_pago') return 'esperando_pago';
  if (s === 'completado' || s === 'Entregado') return 'pagado';
  return 'en_cocina';
}

function getStatusBadge(status: Order['status']): { label: string; className: string } {
  switch (status) {
    case 'enviado_cocina': return { label: 'En Cocina', className: 'bg-blue-100 text-blue-700 border-blue-300' };
    case 'En preparacion': case 'En preparación': case 'en_preparacion':
      return { label: 'En Preparación', className: 'bg-violet-100 text-violet-700 border-violet-300' };
    case 'pago_enviado': return { label: 'Pago Enviado', className: 'bg-amber-100 text-amber-700 border-amber-300' };
    case 'pendiente_pago': return { label: 'Pendiente Pago', className: 'bg-orange-100 text-orange-700 border-orange-300' };
    case 'pago_en_verificacion': return { label: 'Verificando Pago', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    case 'completado': case 'Entregado': return { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
    case 'Cancelado': case 'cancelado': return { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-300' };
    default: return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-300' };
  }
}

function getElapsedTime(fecha: string): { text: string; color: string; urgent: boolean } {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return { text: `${mins}m`, color: 'text-emerald-600', urgent: false };
  if (mins < 15) return { text: `${mins}m`, color: 'text-amber-600', urgent: false };
  return { text: `${mins}m`, color: 'text-red-600', urgent: true };
}

interface GridComanderaMesasProps {
  scopeSedeId?: string;
}

const GridComanderaMesas: React.FC<GridComanderaMesasProps> = ({ scopeSedeId }) => {
  const { orders, config, confirmMesaPayment, updateOrderStatus, refreshOrders } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterMesa, setFilterMesa] = useState<string>('');
  const [searchTicket, setSearchTicket] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrderCountRef = useRef(0);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  // Sound alert for new orders
  useEffect(() => {
    const mesaOrders = orders.filter(o =>
      (o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa') &&
      o.status === 'enviado_cocina' &&
      !['Cancelado', 'cancelado', 'completado', 'Entregado'].includes(o.status)
    );
    if (mesaOrders.length > prevOrderCountRef.current && soundEnabled) {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } catch {}
    }
    // Mark new orders for flash animation
    if (mesaOrders.length > prevOrderCountRef.current) {
      const newIds = mesaOrders.filter(o => !prevOrderCountRef.current || true).slice(0, 3).map(o => o.id);
      setNewOrderIds(prev => new Set([...prev, ...newIds]));
      setTimeout(() => setNewOrderIds(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.delete(id));
        return next;
      }), 3000);
    }
    prevOrderCountRef.current = mesaOrders.length;
  }, [orders, soundEnabled]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel('grid_comandera_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: 'tipo_pedido=eq.mesa' }, () => refreshOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'tipo_pedido=eq.mesa' }, () => refreshOrders())
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const o = payload.payload;
        if (o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa') {
          refreshOrders();
          // Flash animation for new order
          setNewOrderIds(prev => new Set([...prev, o.id]));
          setTimeout(() => setNewOrderIds(prev => {
            const next = new Set(prev);
            next.delete(o.id);
            return next;
          }), 3000);
        }
      })
      .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
        const o = payload.payload;
        if (o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa') refreshOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refreshOrders]);

  const mesaOrders = useMemo(() => {
    let result = orders.filter(o => o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa');
    if (scopeSedeId) result = result.filter(o => !o.sede_id || o.sede_id === scopeSedeId);
    return result.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [orders, scopeSedeId]);

  const activeMesaOrders = useMemo(() =>
    mesaOrders.filter(o => !['Cancelado', 'cancelado', 'completado', 'Entregado'].includes(o.status)),
    [mesaOrders]
  );

  const filteredOrders = useMemo(() => {
    let result = activeMesaOrders;
    if (filterMesa) result = result.filter(o => String(o.numero_mesa) === filterMesa);
    if (searchTicket) {
      const q = searchTicket.toLowerCase();
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.ticket_code && o.ticket_code.toLowerCase().includes(q)) ||
        (o.nombre_cliente && o.nombre_cliente.toLowerCase().includes(q)) ||
        (o.cliente_nombre && o.cliente_nombre.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeMesaOrders, filterMesa, searchTicket]);

  const ordersByColumn = useMemo(() => {
    const groups: Record<MesaColumn, Order[]> = { 'en_cocina': [], 'esperando_pago': [], 'pagado': [] };
    filteredOrders.forEach(order => { groups[getMesaColumn(order)].push(order); });
    return groups;
  }, [filteredOrders]);

  const uniqueMesas = useMemo(() => {
    const nums = new Set(mesaOrders.map(o => o.numero_mesa).filter(Boolean));
    return Array.from(nums).sort((a, b) => a! - b!);
  }, [mesaOrders]);

  const handleAccept = async (orderId: string) => {
    await supabase.rpc('aceptar_pedido_mesa', { p_order_id: orderId, p_tiempo_estimado: '15 min' });
    refreshOrders();
  };

  const handleApprovePayment = async (orderId: string) => {
    await supabase.rpc('aprobar_pago_mesa', { p_order_id: orderId, p_aprobar: true });
    setShowPaymentModal(null);
    refreshOrders();
  };

  const handleRejectPayment = async (orderId: string) => {
    await supabase.rpc('aprobar_pago_mesa', { p_order_id: orderId, p_aprobar: false });
    setShowPaymentModal(null);
    refreshOrders();
  };

  const handleReject = async (orderId: string) => {
    const motivo = rejectReason || 'Pedido rechazado por el personal';
    await supabase.rpc('rechazar_pedido_mesa', { p_order_id: orderId, p_motivo: motivo });
    setRejectModal(null);
    setRejectReason('');
    refreshOrders();
  };

  const handlePrint = (order: Order) => {
    printMesaTicket(order, config);
  };

  const renderOrderCard = (order: Order) => {
    const isSelected = selectedOrder === order.id;
    const statusBadge = getStatusBadge(order.status);
    const elapsed = getElapsedTime(order.fecha);
    const isPendingKitchen = order.status === 'enviado_cocina';
    const isPendingPayment = order.status === 'pago_enviado' || order.status === 'pendiente_pago';
    const isNew = newOrderIds.has(order.id);

    return (
      <div
        key={order.id}
        onClick={() => setSelectedOrder(isSelected ? null : order.id)}
        className={`bg-white rounded-2xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
          isSelected ? 'ring-2 ring-offset-2' : ''
        } ${isNew ? 'animate-pulse border-amber-400 shadow-lg shadow-amber-100' : ''} ${
          isPendingKitchen && !isNew ? 'border-blue-300' : isPendingPayment ? 'border-amber-300' : 'border-[#e4beb1]/20'
        }`}
        style={isSelected ? { outlineColor: themeColor } : {}}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#e67e22' }}>
              #{order.numero_mesa}
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1c1d]">Mesa {order.numero_mesa}</p>
              <p className="text-[10px] text-[#8f7065]">{order.nombre_cliente || order.cliente_nombre}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            <span className={`text-[9px] font-bold flex items-center gap-1 ${elapsed.color}`}>
              {elapsed.urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              {elapsed.text}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="mb-2">
          <div className="space-y-1">
            {order.items?.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px]">
                <span className="text-[#5b4137] truncate">{item.cantidad}x {item.nombre}</span>
                <span className="font-bold text-[#1a1c1d] shrink-0">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
            {(order.items?.length || 0) > 3 && (
              <p className="text-[9px] text-[#8f7065]">+{(order.items?.length || 0) - 3} items más</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {order.notas_admin && (
          <div className="mb-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-[9px] text-amber-700 font-semibold">📝 {order.notas_admin}</p>
          </div>
        )}

        {/* Payment info */}
            {order.metodo_pago && order.metodo_pago !== 'Pendiente' && order.metodo_pago !== 'Pago Móvil' && (
          <div className="mb-2 p-2 bg-[#f9f9fb] rounded-lg border border-[#e4beb1]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard size={10} className="text-[#8f7065]" />
              <span className="text-[9px] font-bold text-[#8f7065]">{order.metodo_pago}</span>
            </div>
            {order.referencia_pago && <p className="text-[9px] text-[#5b4137]">Ref: {order.referencia_pago}</p>}
            {order.banco_origen && <p className="text-[9px] text-[#5b4137]">Banco: {order.banco_origen}</p>}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center mb-2 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
          <span className="text-[10px] font-bold text-[#1a1c1d]">Total</span>
          <span className="text-sm font-black" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
        </div>

        {/* Ticket code */}
        {order.ticket_code && (
          <div className="mb-2 text-center">
            <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg bg-[#f9f9fb] border border-[#e4beb1]/10" style={{ color: '#e67e22' }}>
              {order.ticket_code}
            </span>
          </div>
        )}

        {/* Actions */}
        {isSelected && (
          <div className="space-y-2 pt-3 border-t border-[#e4beb1]/10">
            <button onClick={(e) => { e.stopPropagation(); handlePrint(order); }}
              className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer hover:opacity-80"
              style={{ borderColor: themeColor, color: themeColor }}>
              <Printer size={12} /> Imprimir Comanda
            </button>
            {isPendingKitchen && (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleAccept(order.id); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 text-white transition-all cursor-pointer hover:brightness-110 active:scale-95"
                  style={{ backgroundColor: '#10b981' }}>
                  <CheckCircle size={12} /> Aceptar
                </button>
                <button onClick={(e) => { e.stopPropagation(); setRejectModal(order.id); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 bg-red-500 text-white transition-all cursor-pointer hover:brightness-110 active:scale-95">
                  <Ban size={12} /> Rechazar
                </button>
              </div>
            )}
            {isPendingPayment && (
              <button onClick={(e) => { e.stopPropagation(); setShowPaymentModal(order.id); }}
                className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 text-white transition-all cursor-pointer hover:brightness-110 active:scale-95"
                style={{ backgroundColor: '#10b981' }}>
                <CheckCircle size={12} /> Verificar Pago
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mt-2">
          <Clock size={10} className="text-[#8f7065]" />
          <span className="text-[9px] text-[#8f7065]">{new Date(order.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">Comandera de Mesas</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{activeMesaOrders.length} pedidos activos</p>
        </div>
        <div className="flex items-center gap-2">
          {newOrderIds.size > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Nuevo
            </span>
          )}
          <button onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white border border-[#e4beb1]/10 cursor-pointer hover:bg-[#f9f9fb] transition-colors">
            {soundEnabled ? <Volume2 size={14} className="text-[#1a1c1d]" /> : <VolumeX size={14} className="text-[#8f7065]" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f7065]" />
          <input type="text" value={searchTicket} onChange={(e) => setSearchTicket(e.target.value)}
            placeholder="Buscar por código, nombre..."
            className="w-full bg-white border border-[#e4beb1]/10 rounded-xl pl-9 pr-3 py-2 text-xs outline-none" />
        </div>
        <select value={filterMesa} onChange={(e) => setFilterMesa(e.target.value)}
          className="bg-white border border-[#e4beb1]/10 rounded-xl px-3 py-2 text-xs outline-none appearance-none cursor-pointer">
          <option value="">Todas las mesas</option>
          {uniqueMesas.map(n => <option key={n} value={n}>Mesa {n}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En Cocina', value: ordersByColumn.en_cocina.length, color: '#3b82f6' },
          { label: 'Esperando Pago', value: ordersByColumn.esperando_pago.length, color: '#f59e0b' },
          { label: 'Pagado', value: ordersByColumn.pagado.length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#e4beb1]/10 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f7065]">{s.label}</p>
            <p className="text-xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(COLUMN_CONFIG) as MesaColumn[]).map(col => {
          const cfg = COLUMN_CONFIG[col];
          const columnOrders = ordersByColumn[col];
          return (
            <div key={col} className="flex flex-col">
              <div className={`flex items-center justify-between p-3 rounded-t-xl border-2 border-b-0 ${cfg.borderColor} ${cfg.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded-full ${cfg.countBg}`}>{columnOrders.length}</span>
                </div>
              </div>
              <div className={`flex-1 p-3 rounded-b-xl border-2 border-t-0 ${cfg.borderColor} ${cfg.bg} min-h-[200px] space-y-3`}>
                {columnOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-[10px] text-slate-400 italic">Sin pedidos</div>
                ) : columnOrders.map(order => renderOrderCard(order))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment verification modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1a1c1d]">Verificar Pago</h3>
              <button onClick={() => setShowPaymentModal(null)} className="p-1 rounded-lg hover:bg-[#eeeef0] cursor-pointer"><X size={16} /></button>
            </div>
            {(() => {
              const order = orders.find(o => o.id === showPaymentModal);
              if (!order) return null;
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-[#f9f9fb] rounded-xl border border-[#e4beb1]/10">
                    <p className="text-xs font-bold text-[#1a1c1d]">Mesa #{order.numero_mesa} — {order.nombre_cliente || order.cliente_nombre}</p>
                    <p className="text-xs text-[#8f7065] mt-1">Método: {order.metodo_pago}</p>
                    {order.referencia_pago && <p className="text-xs text-[#8f7065]">Ref: {order.referencia_pago}</p>}
                    {order.banco_origen && <p className="text-xs text-[#8f7065]">Banco: {order.banco_origen}</p>}
                    <p className="text-sm font-black mt-2" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprovePayment(order.id)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1 cursor-pointer"
                      style={{ backgroundColor: '#10b981' }}>
                      <Check size={14} /> Aprobar Pago
                    </button>
                    <button onClick={() => handleRejectPayment(order.id)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-red-500 text-white flex items-center justify-center gap-1 cursor-pointer">
                      <X size={14} /> Rechazar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1c1d] mb-3">Rechazar Pedido</h3>
            <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2 text-xs outline-none mb-3">
              <option value="">Seleccionar motivo...</option>
              <option value="Producto no disponible">Producto no disponible</option>
              <option value="Fuera de horario">Fuera de horario</option>
              <option value="Mesa cerrada">Mesa cerrada</option>
              <option value="Pedido duplicado">Pedido duplicado</option>
              <option value="Otro">Otro</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#eeeef0] text-[#5b4137] cursor-pointer">Cancelar</button>
              <button onClick={() => handleReject(rejectModal)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-red-500 text-white cursor-pointer">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridComanderaMesas;
