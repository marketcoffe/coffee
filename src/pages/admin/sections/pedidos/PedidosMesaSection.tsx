import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Order } from '../../../../types/store';
import { UtensilsCrossed, Printer, CheckCircle, Clock, CreditCard, Banknote } from 'lucide-react';
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
    case 'En preparacion':
    case 'En preparación':
    case 'en_preparacion':
      return { label: 'En Cocina', className: 'bg-blue-100 text-blue-700 border-blue-300' };
    case 'pago_enviado':
      return { label: 'Pago Enviado', className: 'bg-amber-100 text-amber-700 border-amber-300' };
    case 'pendiente_pago':
      return { label: 'Pendiente Pago', className: 'bg-orange-100 text-orange-700 border-orange-300' };
    case 'completado':
    case 'Entregado':
      return { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
    case 'Cancelado':
    case 'cancelado':
      return { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-300' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-300' };
  }
}

interface PedidosMesaSectionProps {
  scopeSedeId?: string;
}

const PedidosMesaSection: React.FC<PedidosMesaSectionProps> = ({ scopeSedeId }) => {
  const { orders, config, confirmMesaPayment, updateOrderStatus, refreshOrders } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Realtime: escuchar custom events del AppContext + refresh al volver a la pestaña
  useEffect(() => {
    const handleNewOrder = (e: Event) => {
      const order = (e as CustomEvent).detail as Order;
      if (order && (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa')) {
        refreshOrders();
      }
    };
    const handleOrderUpdate = (e: Event) => {
      const order = (e as CustomEvent).detail as Order;
      if (order && (order.tipo_pedido === 'mesa' || order.tipo_entrega === 'mesa')) {
        refreshOrders();
      }
    };
    const onFocus = () => refreshOrders();
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshOrders(); };

    window.addEventListener('new_order_received', handleNewOrder);
    window.addEventListener('order_status_changed', handleOrderUpdate);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('new_order_received', handleNewOrder);
      window.removeEventListener('order_status_changed', handleOrderUpdate);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshOrders]);

  const mesaOrders = useMemo(() => {
    let result = orders.filter(o => o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa');
    if (scopeSedeId) result = result.filter(o => !o.sede_id || o.sede_id === scopeSedeId);
    return result.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [orders, scopeSedeId]);

  const activeMesaOrders = useMemo(() =>
    mesaOrders.filter(o => o.status !== 'Cancelado' && o.status !== 'cancelado' && o.status !== 'completado' && o.status !== 'Entregado'),
    [mesaOrders]
  );

  const ordersByColumn = useMemo(() => {
    const groups: Record<MesaColumn, Order[]> = { 'en_cocina': [], 'esperando_pago': [], 'pagado': [] };
    mesaOrders.forEach(order => { groups[getMesaColumn(order)].push(order); });
    return groups;
  }, [mesaOrders]);

  const handleConfirmPayment = async (orderId: string) => {
    await confirmMesaPayment(orderId);
  };

  const handlePrint = (order: Order) => {
    printMesaTicket(order, config);
  };

  const handleCancel = async (orderId: string) => {
    await updateOrderStatus(orderId, 'Cancelado');
  };

  const renderOrderCard = (order: Order) => {
    const isSelected = selectedOrder === order.id;
    const statusBadge = getStatusBadge(order.status);

    return (
      <div
        key={order.id}
        onClick={() => setSelectedOrder(isSelected ? null : order.id)}
        className={`bg-white rounded-2xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
          isSelected ? 'ring-2 ring-offset-2' : ''
        } ${order.status === 'pago_enviado' ? 'border-amber-300' : 'border-[#e4beb1]/20'}`}
        style={isSelected ? { outlineColor: themeColor } : {}}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: '#e67e22' }}>
              <UtensilsCrossed size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1c1d]">Mesa #{order.numero_mesa}</p>
              <p className="text-[10px] text-[#8f7065]">{order.nombre_cliente || order.cliente_nombre}</p>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Items preview */}
        <div className="mb-3">
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

        {/* Total */}
        <div className="flex justify-between items-center mb-3 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
          <span className="text-[10px] font-bold text-[#1a1c1d]">Total</span>
          <span className="text-sm font-black" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
        </div>

        {/* Payment info */}
        {order.metodo_pago && (
          <div className="mb-3 p-2 bg-[#f9f9fb] rounded-lg border border-[#e4beb1]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard size={10} className="text-[#8f7065]" />
              <span className="text-[9px] font-bold text-[#8f7065]">{order.metodo_pago}</span>
            </div>
            {order.referencia_pago && (
              <p className="text-[9px] text-[#5b4137]">Ref: {order.referencia_pago}</p>
            )}
            {order.banco_origen && (
              <p className="text-[9px] text-[#5b4137]">Banco: {order.banco_origen}</p>
            )}
          </div>
        )}

        {/* Actions */}
        {isSelected && (
          <div className="space-y-2 pt-2 border-t border-[#e4beb1]/10">
            <button
              onClick={(e) => { e.stopPropagation(); handlePrint(order); }}
              className="w-full py-2 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer"
              style={{ borderColor: themeColor, color: themeColor }}
            >
              <Printer size={12} />
              Imprimir Comanda
            </button>
            {(order.status === 'pago_enviado' || order.status === 'pendiente_pago') && (
              <button
                onClick={(e) => { e.stopPropagation(); handleConfirmPayment(order.id); }}
                className="w-full py-2 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 text-white transition-all cursor-pointer"
                style={{ backgroundColor: '#10b981' }}
              >
                <CheckCircle size={12} />
                Verificar Pago
              </button>
            )}
            {(order.status === 'En preparacion' || order.status === 'En preparación' || order.status === 'en_preparacion') && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                className="w-full py-2 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 bg-red-500 text-white transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        )}

        {/* Time */}
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
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">Pedidos de Mesa</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{activeMesaOrders.length} pedidos activos</p>
        </div>
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
    </div>
  );
};

export default PedidosMesaSection;
