import React from 'react';
import { Order } from '../../../types/store';
import { Clock, Printer, MessageSquare, ArrowRight, XCircle, MapPin, CreditCard, Truck, Store, Package } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface OrderCardProps {
  order: Order;
  onAdvanceStatus: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onPrint: (order: Order) => void;
  onWhatsApp: (order: Order) => void;
  onOpenDetail?: (order: Order) => void;
  themeColor: string;
  kitchenMode?: boolean;
  sequenceNumber?: number;
}

const DEFAULT_STATUS_STYLE = { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-l-gray-400', label: 'Otro' };

const STATUS_CONFIG: Record<Order['status'], { color: string; bg: string; border: string; label: string }> = {
  'Pendiente':              { color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-l-amber-400',  label: 'Pendiente' },
  'Procesando':             { color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-l-blue-400',   label: 'Procesando' },
  'En preparación':         { color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-l-violet-400', label: 'En Preparación' },
  'En preparacion':         { color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-l-violet-400', label: 'En Preparacion' },
  'Listo':                  { color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-l-green-400',  label: 'Listo' },
  'En camino':              { color: 'text-cyan-700',   bg: 'bg-cyan-100',   border: 'border-l-cyan-400',   label: 'En Camino' },
  'Entregado':              { color: 'text-emerald-700',bg: 'bg-emerald-100',border: 'border-l-emerald-400',label: 'Entregado' },
  'Cancelado':              { color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-l-red-400',    label: 'Cancelado' },
  'pendiente_verificacion': { color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-l-amber-400',  label: 'Pendiente Verificación' },
  'en_preparacion':         { color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-l-violet-400', label: 'En Preparacion' },
  'completado':             { color: 'text-emerald-700',bg: 'bg-emerald-100',border: 'border-l-emerald-400',label: 'Completado' },
  'pago_enviado':           { color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-l-amber-400',  label: 'Pago Enviado' },
  'pendiente_pago':         { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-l-orange-400', label: 'Pendiente Pago' },
  'cancelado':              { color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-l-red-400',    label: 'Cancelado' },
  'enviado_cocina':         { color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-l-blue-400',   label: 'En Cocina' },
  'pago_en_verificacion':   { color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-l-yellow-400', label: 'Verificando Pago' },
};

function getElapsed(fecha: string): { text: string; colorClass: string } {
  if (!fecha) return { text: '', colorClass: '' };
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (mins < 1) return { text: 'Ahora', colorClass: 'text-emerald-600' };
  if (mins < 60) return { text: `${mins}min`, colorClass: mins > 30 ? 'text-red-600' : mins > 15 ? 'text-amber-600' : 'text-emerald-600' };
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  const totalMins = hrs * 60 + rem;
  return { text: `${hrs}h ${rem}m`, colorClass: totalMins > 30 ? 'text-red-600' : totalMins > 15 ? 'text-amber-600' : 'text-emerald-600' };
}

function getDeliveryIcon(tipo: string) {
  if (tipo === 'delivery') return <Truck size={12} />;
  if (tipo === 'pickup') return <Store size={12} />;
  return <Store size={12} />;
}

function getDeliveryLabel(tipo: string, mesa?: number) {
  if (tipo === 'delivery') return 'Delivery';
  if (tipo === 'pickup') return 'Pickup';
  if (tipo === 'mesa') return `Mesa #${mesa || ''}`;
  return tipo;
}

export function sortOrdersByPriority(orders: Order[]): Order[] {
  const priority: Record<string, number> = {
    'Pendiente': 0, 'Procesando': 1, 'enviado_cocina': 2,
    'En preparación': 3, 'En preparacion': 3, 'en_preparacion': 3,
    'En camino': 4, 'Entregado': 5, 'Cancelado': 6,
  };
  return [...orders].sort((a, b) => {
    const pa = priority[a.status] ?? 0;
    const pb = priority[b.status] ?? 0;
    if (pa !== pb) return pa - pb;
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  });
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onAdvanceStatus, onCancel, onPrint, onWhatsApp, onOpenDetail, themeColor, kitchenMode, sequenceNumber }) => {
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pendiente'];
  const isFinal = order.status === 'Entregado' || order.status === 'Cancelado' || order.status === 'completado' || order.status === 'cancelado';
  const elapsed = getElapsed(order.fecha);

  const nextLabel: Record<string, string> = {
    'Pendiente': 'En Preparación',
    'Procesando': 'En Preparación',
    'enviado_cocina': 'En Preparación',
    'pendiente_verificacion': 'En Preparación',
    'pago_enviado': 'En Preparación',
    'pendiente_pago': 'En Preparación',
    'pago_en_verificacion': 'En Preparación',
    'En preparación': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
    'En preparacion': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
    'en_preparacion': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
    'Listo': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
    'En camino': 'Entregado',
  };

  function getNextStatus(status: Order['status'], tipoEntrega?: string): Order['status'] | null {
    if (status === 'Entregado' || status === 'Cancelado' || status === 'completado' || status === 'cancelado') return null;
    if (status === 'En camino') return 'Entregado';
    if (status === 'En preparación' || status === 'En preparacion' || status === 'en_preparacion') {
      return tipoEntrega === 'delivery' ? 'En camino' : 'Entregado';
    }
    if (status === 'Pendiente' || status === 'Procesando' || status === 'enviado_cocina' ||
        status === 'pendiente_verificacion' || status === 'pago_enviado' || status === 'pendiente_pago' ||
        status === 'pago_en_verificacion' || status === 'Listo') {
      return 'En preparación';
    }
    return null;
  }

  const nextStatus = getNextStatus(order.status, order.tipo_entrega);

  const subtotal = order.subtotal_usd || order.total_usd;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;
  const iva = subtotal * 0.16;

  return (
    <div
      onClick={() => onOpenDetail?.(order)}
      className={`bg-white rounded-xl border-l-4 ${statusCfg.border} border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer ${kitchenMode ? 'order-card-kitchen' : ''}`}
    >
      <div className={kitchenMode ? 'p-4' : 'p-3'}>
        {/* Header: Order number + status + timer */}
        <div className="flex items-center gap-2">
          <span className={`order-number ${kitchenMode ? 'text-lg font-black' : 'text-[10px]'} text-slate-400 shrink-0`}>
            #{order.id.toUpperCase()}
          </span>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color} ${kitchenMode ? 'text-[11px] px-3 py-1' : ''}`}>
            {statusCfg.label}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {getDeliveryIcon(order.tipo_entrega)}
            <span className={`text-[9px] font-semibold text-slate-500 ${kitchenMode ? 'text-[11px]' : ''}`}>{getDeliveryLabel(order.tipo_entrega, order.numero_mesa)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={kitchenMode ? 14 : 10} className={elapsed.colorClass} />
            <span className={`order-timer font-mono font-bold ${elapsed.colorClass} ${kitchenMode ? 'text-sm' : 'text-[10px]'}`}>{elapsed.text}</span>
          </div>
        </div>

        {/* Client name */}
        <div className={`flex items-center gap-2 ${kitchenMode ? 'mt-3' : 'mt-2'}`}>
          <span className={`font-bold text-slate-800 truncate ${kitchenMode ? 'text-sm' : 'text-xs'}`}>{order.cliente_nombre}</span>
          {order.cliente_telefono && (
            <a href={`tel:${order.cliente_telefono}`} className="text-[10px] text-blue-500 hover:underline shrink-0 hidden sm:inline" onClick={e => e.stopPropagation()}>
              {order.cliente_telefono}
            </a>
          )}
        </div>

        {/* Items list */}
        <div className={`order-items space-y-0.5 ${kitchenMode ? 'mt-3' : 'mt-2'}`}>
          {order.items?.slice(0, kitchenMode ? 8 : 4).map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className={`text-slate-700 ${kitchenMode ? 'text-sm' : 'text-[11px]'}`}>
                  <span className={`font-bold text-slate-900 ${kitchenMode ? 'text-sm' : ''}`}>{item.cantidad}x</span> {item.nombre}
                </span>
                {item.selected_options && item.selected_options.length > 0 && (
                  <span className={`text-slate-400 ml-1 ${kitchenMode ? 'text-[11px]' : 'text-[9px] hidden sm:inline'}`}>
                    ({item.selected_options.map(o => o.option_name).join(', ')})
                  </span>
                )}
                {item.ingredientes_removidos && item.ingredientes_removidos.length > 0 && (
                  <div className={`text-red-400 ${kitchenMode ? 'text-[11px]' : 'text-[9px] hidden sm:block'}`}>
                    Sin: {item.ingredientes_removidos.join(', ')}
                  </div>
                )}
              </div>
              <span className={`font-mono text-slate-500 shrink-0 ${kitchenMode ? 'text-xs' : 'text-[10px]'}`}>
                ${(item.precio_usd * item.cantidad).toFixed(2)}
              </span>
            </div>
          ))}
          {!isFinal && (order.items?.length || 0) > (kitchenMode ? 8 : 4) && (
            <p className="text-[9px] text-slate-400 italic">+{(order.items?.length || 0) - (kitchenMode ? 8 : 4)} mas...</p>
          )}
        </div>

        {/* Admin notes */}
        {order.notas_admin && (
          <div className={`bg-amber-50 rounded text-amber-700 border border-amber-200 ${kitchenMode ? 'mt-3 p-2.5 text-sm' : 'mt-2 p-2 text-sm'}`}>
            {order.notas_admin}
          </div>
        )}

        {/* Price summary */}
        <div className={`pt-2 border-t border-slate-100 space-y-0.5 ${kitchenMode ? 'mt-3' : 'mt-2'}`}>
          <div className={`flex justify-between font-black pt-1 ${kitchenMode ? 'text-base' : 'text-sm'}`} style={{ color: themeColor }}>
            <span>TOTAL</span>
            <span>${order.total_usd?.toFixed(2)}</span>
          </div>
        </div>

        {/* Tags */}
        <div className={`flex items-center gap-1 flex-wrap ${kitchenMode ? 'mt-3' : 'mt-2'}`}>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {order.metodo_pago}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {getDeliveryLabel(order.tipo_entrega, order.numero_mesa)}
          </span>
          {order.tipo_entrega === 'delivery' && order.direccion_envio && (
            <span className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate max-w-[150px]">
              <MapPin size={8} /> {order.direccion_envio}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className={`flex items-center gap-1 flex-wrap order-card-actions ${kitchenMode ? 'mt-4 gap-2' : 'mt-2 pt-2 border-t border-slate-100'}`}>
          {!isFinal && nextStatus && (
            <Tooltip content={`Avanzar a: ${nextStatus}`} position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onAdvanceStatus(order); }}
                className={`order-action-btn flex items-center gap-1 font-bold text-white rounded-lg cursor-pointer transition-all active:scale-95 ${kitchenMode ? 'px-4 py-2.5 text-xs' : 'px-2 py-1.5 text-[10px]'}`}
                style={{ backgroundColor: themeColor }}
              >
                <ArrowRight size={kitchenMode ? 14 : 11} /> <span className="hidden sm:inline">{nextLabel[order.status] || 'Avanzar'}</span><span className="sm:hidden">Avanzar</span>
              </button>
            </Tooltip>
          )}
          <Tooltip content="Imprimir comanda para cocina" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(order); }}
              className={`flex items-center justify-center text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-all active:scale-95 ${kitchenMode ? 'p-2.5' : 'p-1.5'}`}
            >
              <Printer size={kitchenMode ? 16 : 12} />
            </button>
          </Tooltip>
          <Tooltip content="Enviar estado por WhatsApp" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onWhatsApp(order); }}
              className={`flex items-center justify-center text-green-600 bg-white border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer transition-all active:scale-95 ${kitchenMode ? 'p-2.5' : 'p-1.5'}`}
            >
              <MessageSquare size={kitchenMode ? 16 : 12} />
            </button>
          </Tooltip>
          {!isFinal && onCancel && (
            <Tooltip content="Cancelar este pedido" position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(order); }}
                className={`flex items-center justify-center text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer transition-all active:scale-95 ${kitchenMode ? 'p-2.5' : 'p-1.5'}`}
              >
                <XCircle size={kitchenMode ? 16 : 13} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};
