import React, { useEffect, useRef } from 'react';
import { useApp } from '../../../store/AppContext';
import { Order } from '../../../types/store';
import { X, MapPin, Clock, Truck, Store, CreditCard, Phone, MessageSquare, Printer, ArrowRight, Navigation, FileText } from 'lucide-react';
import { printFactura } from '../../../utils/printFactura';

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onAdvance?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onPrint?: (order: Order) => void;
  sequenceNumber?: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'Pendiente':              { color: '#f59e0b', bg: '#fef3c7', label: 'Pendiente' },
  'Procesando':             { color: '#3b82f6', bg: '#dbeafe', label: 'Procesando' },
  'En preparación':         { color: '#8b5cf6', bg: '#ede9fe', label: 'En Preparación' },
  'En preparacion':         { color: '#8b5cf6', bg: '#ede9fe', label: 'En Preparación' },
  'en_preparacion':         { color: '#8b5cf6', bg: '#ede9fe', label: 'En Preparación' },
  'enviado_cocina':         { color: '#3b82f6', bg: '#dbeafe', label: 'En Cocina' },
  'Listo':                  { color: '#22c55e', bg: '#dcfce7', label: 'Listo' },
  'En camino':              { color: '#06b6d4', bg: '#cffafe', label: 'En Camino' },
  'Entregado':              { color: '#10b981', bg: '#d1fae5', label: 'Entregado' },
  'Cancelado':              { color: '#ef4444', bg: '#fee2e2', label: 'Cancelado' },
  'cancelado':              { color: '#ef4444', bg: '#fee2e2', label: 'Cancelado' },
  'completado':             { color: '#10b981', bg: '#d1fae5', label: 'Completado' },
  'pago_enviado':           { color: '#f59e0b', bg: '#fef3c7', label: 'Pago Enviado' },
  'pendiente_pago':         { color: '#f97316', bg: '#ffedd5', label: 'Pendiente Pago' },
  'pendiente_verificacion': { color: '#f59e0b', bg: '#fef3c7', label: 'Verificando' },
  'pago_en_verificacion':   { color: '#eab308', bg: '#fef9c3', label: 'Verificando Pago' },
};

function getDeliveryConfig(tipo: string, numeroMesa?: number) {
  if (tipo === 'delivery') return { label: 'Delivery', icon: Truck, color: '#3b82f6' };
  if (tipo === 'pickup') return { label: 'Pickup', icon: Store, color: '#8b5cf6' };
  return { label: `Mesa #${numeroMesa || ''}`, icon: Store, color: '#f97316' };
}

function getElapsed(fecha: string): string {
  if (!fecha) return '';
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onAdvance,
  onCancel,
  onPrint,
  sequenceNumber,
}) => {
  const { config } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pendiente'];
  const deliveryCfg = getDeliveryConfig(order.tipo_entrega, order.numero_mesa);
  const DeliveryIcon = deliveryCfg.icon;
  const elapsed = getElapsed(order.fecha);

  const isFinal = order.status === 'Entregado' || order.status === 'Cancelado' || order.status === 'completado' || order.status === 'cancelado';

  const getNextLabel = (): string => {
    const labels: Record<string, string> = {
      'Pendiente': 'En Preparación',
      'Procesando': 'En Preparación',
      'enviado_cocina': 'En Preparación',
      'En preparación': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
      'En preparacion': order.tipo_entrega === 'delivery' ? 'En Camino' : 'Entregado',
      'En camino': 'Entregado',
    };
    return labels[order.status] || 'Avanzar';
  };

  const openWhatsApp = () => {
    const phone = order.cliente_telefono?.replace(/\D/g, '');
    if (!phone) return;
    const text = encodeURIComponent(
      `Hola ${order.cliente_nombre}, tu pedido #${order.id.toUpperCase()} esta en estado: ${statusCfg.label}. Total: $${order.total_usd?.toFixed(2)}`
    );
    window.open(`https://wa.me/58${phone}?text=${text}`, '_blank');
  };

  const openInGoogleMaps = () => {
    if (order.lat && order.lng) {
      window.open(`https://www.google.com/maps?q=${order.lat},${order.lng}`, '_blank');
    } else if (order.direccion_envio) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.direccion_envio)}`, '_blank');
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    if (!(window as unknown as { L?: unknown }).L) {
      // Leaflet not loaded, show fallback
      return;
    }

    const L = (window as unknown as { L: Record<string, unknown> }).L;
    const map = (L.map as (el: HTMLDivElement, opts?: Record<string, unknown>) => {
      remove(): void;
      setView(coords: [number, number], zoom?: number): void;
    })(mapRef.current, {
      center: [order.lat || config.coordenadas_tienda?.lat || 10.48, order.lng || config.coordenadas_tienda?.lng || -66.9],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    (L.tileLayer as (url: string, opts?: Record<string, unknown>) => { addTo(map: unknown): void })(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19 }
    ).addTo(map);

    // Shop marker
    if (config.coordenadas_tienda?.lat && config.coordenadas_tienda?.lng) {
      const shopIcon = (L.divIcon as (opts: Record<string, unknown>) => unknown)({
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${themeColor};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      (L.marker as (coords: [number, number], opts?: Record<string, unknown>) => { addTo(m: unknown): void })(
        [config.coordenadas_tienda.lat, config.coordenadas_tienda.lng],
        { icon: shopIcon }
      ).addTo(map);
    }

    // Client marker
    if (order.lat && order.lng) {
      const clientIcon = (L.divIcon as (opts: Record<string, unknown>) => unknown)({
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      (L.marker as (coords: [number, number], opts?: Record<string, unknown>) => { addTo(m: unknown): void })(
        [order.lat, order.lng],
        { icon: clientIcon }
      ).addTo(map);

      map.setView([order.lat, order.lng], 15);
    }

    mapInstanceRef.current = map;

    return () => {
      try { map.remove(); } catch {}
    };
  }, [order.lat, order.lng, config.coordenadas_tienda, themeColor, order.status]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg max-h-[95vh] sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${statusCfg.color}, ${statusCfg.color}dd)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <DeliveryIcon size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {sequenceNumber && (
                  <span className="text-[10px] font-black bg-white/30 text-white px-1.5 py-0.5 rounded-md">
                    #{sequenceNumber}
                  </span>
                )}
                <h2 className="text-white font-bold text-sm">
                  #{order.id.toUpperCase()}
                </h2>
              </div>
              <p className="text-white/80 text-[11px]">{deliveryCfg.label} — {statusCfg.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Client info */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-slate-600">{order.cliente_nombre?.charAt(0) || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{order.cliente_nombre}</p>
                {order.cliente_telefono && (
                  <a href={`tel:${order.cliente_telefono}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    <Phone size={10} /> {order.cliente_telefono}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock size={12} className={elapsed.includes('h') ? 'text-red-500' : elapsed.includes('min') && parseInt(elapsed) > 15 ? 'text-amber-500' : 'text-emerald-500'} />
                <span className="text-xs font-bold text-slate-600">{elapsed}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detalle del Pedido</h3>
            <div className="space-y-2">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800">{item.cantidad}x {item.nombre}</p>
                    {item.selected_options && item.selected_options.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.selected_options.map(o => o.option_name).join(', ')}
                      </p>
                    )}
                    {item.ingredientes_removidos && item.ingredientes_removidos.length > 0 && (
                      <p className="text-[10px] text-red-400 mt-0.5">
                        Sin: {item.ingredientes_removidos.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-slate-700 shrink-0 ml-2">
                    ${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Payment */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-600">Total</span>
              <span className="text-lg font-black" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
              <CreditCard size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">{order.metodo_pago}</p>
                {order.referencia_pago && (
                  <p className="text-[10px] text-slate-500 truncate">Ref: {order.referencia_pago}</p>
                )}
                {order.banco_origen && (
                  <p className="text-[10px] text-slate-500 truncate">Banco: {order.banco_origen}</p>
                )}
              </div>
            </div>
          </div>

          {/* Delivery address + Map */}
          {order.tipo_entrega === 'delivery' && (
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direccion de Entrega</h3>
                {order.distancia_km > 0 && (
                  <span className="text-[10px] font-bold text-slate-500">{order.distancia_km.toFixed(1)} km</span>
                )}
              </div>
              {order.direccion_envio && (
                <div className="flex items-start gap-2 mb-3 p-2.5 bg-blue-50 rounded-xl">
                  <MapPin size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">{order.direccion_envio}</p>
                </div>
              )}
              {/* Map */}
              <div className="relative h-48 rounded-xl overflow-hidden bg-slate-100 mb-2">
                <div ref={mapRef} className="w-full h-full" />
              </div>
              {(order.lat && order.lng) && (
                <button
                  onClick={openInGoogleMaps}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <Navigation size={12} />
                  Abrir en Google Maps
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notas_admin && (
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notas</h3>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-800">{order.notas_admin}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 p-4 border-t border-slate-100 space-y-2 bg-white">
          <button
            onClick={openWhatsApp}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer active:scale-[0.98]"
          >
            <MessageSquare size={16} />
            Compartir por WhatsApp
          </button>
          <div className="flex gap-2">
            {!isFinal && onAdvance && (
              <button
                onClick={() => { onAdvance(order); onClose(); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all cursor-pointer active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                <ArrowRight size={16} />
                {getNextLabel()}
              </button>
            )}
            {onPrint && (
              <>
                <button
                  onClick={() => onPrint(order)}
                  className="flex items-center justify-center py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer active:scale-[0.98]"
                  style={{ borderColor: statusCfg.color, color: statusCfg.color }}
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => printFactura(order, config)}
                  className="flex items-center justify-center py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer active:scale-[0.98]"
                  style={{ borderColor: '#059669', color: '#059669' }}
                  title="Imprimir Factura"
                >
                  <FileText size={16} />
                </button>
              </>
            )}
            {!isFinal && onCancel && (
              <button
                onClick={() => { onCancel(order); onClose(); }}
                className="flex items-center justify-center py-3 px-4 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer active:scale-[0.98]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
