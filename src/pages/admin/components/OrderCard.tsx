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
  themeColor: string;
}

const STATUS_CONFIG: Record<Order['status'], { color: string; bg: string; border: string; label: string }> = {
  'Pendiente':      { color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-l-amber-400',  label: 'Pendiente' },
  'Procesando':     { color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-l-blue-400',   label: 'Procesando' },
  'En preparación': { color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-l-violet-400', label: 'En Preparación' },
  'Listo':          { color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-l-green-400',  label: 'Listo' },
  'En camino':      { color: 'text-cyan-700',   bg: 'bg-cyan-100',   border: 'border-l-cyan-400',   label: 'En Camino' },
  'Entregado':      { color: 'text-emerald-700',bg: 'bg-emerald-100',border: 'border-l-emerald-400',label: 'Entregado' },
  'Cancelado':      { color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-l-red-400',    label: 'Cancelado' },
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
    'Pendiente': 0, 'Procesando': 1, 'En preparación': 2,
    'Listo': 3, 'En camino': 4, 'Entregado': 5, 'Cancelado': 6,
  };
  return [...orders].sort((a, b) => {
    const pa = priority[a.status] ?? 0;
    const pb = priority[b.status] ?? 0;
    if (pa !== pb) return pa - pb;
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  });
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onAdvanceStatus, onCancel, onPrint, onWhatsApp, themeColor }) => {
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pendiente'];
  const isFinal = order.status === 'Entregado' || order.status === 'Cancelado';
  const elapsed = getElapsed(order.fecha);

  const flow: Order['status'][] = ['Pendiente', 'Procesando', 'En preparación', 'Listo', 'En camino', 'Entregado'];
  const currentIdx = flow.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < flow.length - 1 ? flow[currentIdx + 1] : null;

  const nextLabel: Record<string, string> = {
    'Pendiente': 'Preparar',
    'Procesando': 'En Preparación',
    'En preparación': 'Marcar Listo',
    'Listo': 'Enviar',
    'En camino': 'Marcar Entregado',
  };

  const subtotal = order.subtotal_usd || order.total_usd;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;
  const iva = subtotal * 0.16;

  return (
    <div className={`bg-white rounded-xl border-l-4 ${statusCfg.border} border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 shrink-0">#{order.id.slice(-4).toUpperCase()}</span>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {getDeliveryIcon(order.tipo_entrega)}
            <span className="text-[9px] font-semibold text-slate-500">{getDeliveryLabel(order.tipo_entrega, order.numero_mesa)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={10} className={elapsed.colorClass} />
            <span className={`text-[10px] font-mono font-bold ${elapsed.colorClass}`}>{elapsed.text}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-bold text-slate-800 truncate">{order.cliente_nombre}</span>
          {order.cliente_telefono && (
            <a href={`tel:${order.cliente_telefono}`} className="text-[10px] text-blue-500 hover:underline shrink-0 hidden sm:inline" onClick={e => e.stopPropagation()}>
              {order.cliente_telefono}
            </a>
          )}
        </div>

        <div className="mt-2 space-y-0.5">
          {order.items?.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-700">
                  <span className="font-bold text-slate-900">{item.cantidad}x</span> {item.nombre}
                </span>
                {item.selected_options && item.selected_options.length > 0 && (
                  <span className="text-[9px] text-slate-400 ml-1 hidden sm:inline">
                    ({item.selected_options.map(o => o.option_name).join(', ')})
                  </span>
                )}
                {item.ingredientes_removidos && item.ingredientes_removidos.length > 0 && (
                  <div className="text-[9px] text-red-400 hidden sm:block">
                    Sin: {item.ingredientes_removidos.join(', ')}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                ${(item.precio_usd * item.cantidad).toFixed(2)}
              </span>
            </div>
          ))}
          {!isFinal && (order.items?.length || 0) > 4 && (
            <p className="text-[9px] text-slate-400 italic">+{(order.items?.length || 0) - 4} mas...</p>
          )}
        </div>

        {order.notas_admin && (
          <div className="mt-2 p-1.5 bg-amber-50 rounded text-[9px] text-amber-700 border border-amber-200">
            {order.notas_admin}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[10px]">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono">${subtotal.toFixed(2)}</span>
          </div>
          {shipping > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Envio</span>
              <span className="font-mono">${shipping.toFixed(2)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span className="truncate">Descuento{order.cupon_codigo ? ` (${order.cupon_codigo})` : ''}</span>
              <span className="font-mono shrink-0">-${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm pt-1" style={{ color: themeColor }}>
            <span>TOTAL</span>
            <span>${order.total_usd?.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2 flex-wrap">
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

        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 order-card-actions">
          {!isFinal && nextStatus && (
            <Tooltip content={`Avanzar a: ${nextStatus}`} position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onAdvanceStatus(order); }}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-white rounded-lg cursor-pointer transition-all active:scale-95"
                style={{ backgroundColor: themeColor }}
              >
                <ArrowRight size={11} /> <span className="hidden sm:inline">{nextLabel[order.status] || 'Avanzar'}</span><span className="sm:hidden">Avanzar</span>
              </button>
            </Tooltip>
          )}
          <Tooltip content="Imprimir comanda para cocina" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(order); }}
              className="p-1.5 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-all active:scale-95"
            >
              <Printer size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Enviar estado por WhatsApp" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onWhatsApp(order); }}
              className="p-1.5 text-green-600 bg-white border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer transition-all active:scale-95"
            >
              <MessageSquare size={12} />
            </button>
          </Tooltip>
          {!isFinal && onCancel && (
            <Tooltip content="Cancelar este pedido" position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(order); }}
                className="p-1.5 text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer transition-all active:scale-95"
              >
                <XCircle size={13} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};
