import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { Order } from '../../../../types/store';
import { MapPin, ArrowRight, Clock, Package, CheckCircle, Truck } from 'lucide-react';
import { AdminTrackingMap } from '../../components/AdminTrackingMap';

interface MapaDeliverySectionProps {
  scopeSedeId?: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; nextLabel: string; icon: React.ReactNode }> = {
  Pendiente:     { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  nextLabel: 'Procesar',    icon: <Package size={12} /> },
  Procesando:    { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   nextLabel: 'Preparar',    icon: <Clock size={12} /> },
  'En preparación': { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', nextLabel: 'Marcar Listo', icon: <Package size={12} /> },
  Listo:         { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  nextLabel: 'Despachar',   icon: <CheckCircle size={12} /> },
  'En camino':   { color: 'text-cyan-700',   bg: 'bg-cyan-50',   border: 'border-cyan-200',   nextLabel: 'Entregar',    icon: <Truck size={12} /> },
};

const MapaDeliverySection: React.FC<MapaDeliverySectionProps> = ({ scopeSedeId }) => {
  const { config } = useApp();
  const [sedeFilter, setSedeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'Todos'>('Todos');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const lockedSede = scopeSedeId || '';
  const canFilterBySede = !lockedSede;
  const effectiveSede = lockedSede || sedeFilter || undefined;

  const { activeOrders, advanceStatus, advancingId } = useOrders(effectiveSede);
  const themeColor = config.theme_color || '#A4D045';

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'Todos') return activeOrders;
    return activeOrders.filter(o => o.status === statusFilter);
  }, [activeOrders, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: activeOrders.length };
    activeOrders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [activeOrders]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return filteredOrders.find(o => o.id === selectedOrderId) || null;
  }, [filteredOrders, selectedOrderId]);

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderId(prev => prev === orderId ? null : orderId);
  }, []);

  const handleAdvance = useCallback(async (order: Order) => {
    await advanceStatus(order);
  }, [advanceStatus]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)]">
      {/* Filters bar */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar shrink-0">
        {activeSedes.length > 1 && canFilterBySede && (
          <select
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer"
          >
            <option value="">Todas las sedes</option>
            {activeSedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
        {(['Todos', 'En camino', 'Listo', 'Procesando', 'En preparación', 'Pendiente'] as const).map(status => {
          const cfg = status !== 'Todos' ? STATUS_CONFIG[status] : null;
          const count = statusCounts[status] || 0;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                isActive
                  ? 'bg-white border-slate-300 shadow-sm text-slate-900'
                  : 'bg-white/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'
              }`}
            >
              {cfg?.icon}
              {status === 'Todos' ? 'Todos' : status}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main: Map + Panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Map (60% on desktop) */}
        <div className="w-full lg:w-[60%] h-[40vh] lg:h-full shrink-0">
          <AdminTrackingMap
            orders={filteredOrders}
            shopCoords={config.coordenadas_tienda}
            selectedOrderId={selectedOrderId}
            onSelectOrder={handleSelectOrder}
            themeColor={themeColor}
          />
        </div>

        {/* Order panel (40% on desktop) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-bold text-slate-900">
              Pedidos
              <span className="text-xs font-normal text-slate-500 ml-2">({filteredOrders.length})</span>
            </h3>
            {selectedOrderId && (
              <button
                onClick={() => setSelectedOrderId(null)}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Limpiar selecci\u00f3n
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <MapPin size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-400">Sin pedidos</p>
                <p className="text-[11px] text-slate-400 mt-1">No hay pedidos con estado: {statusFilter}</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status];
                const isSelected = order.id === selectedOrderId;

                return (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`bg-white rounded-xl border overflow-hidden transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-400 shadow-md ring-2 ring-slate-200'
                        : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">#{order.id.slice(-4).toUpperCase()}</span>
                          {cfg && (
                            <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                              {cfg.icon}
                              {order.status}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-black" style={{ color: themeColor }}>
                          ${order.total_usd?.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-slate-600">
                            {order.cliente_nombre?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{order.cliente_nombre}</p>
                          <p className="text-[9px] text-slate-500 truncate">{order.direccion_envio || 'Sin direcci\u00f3n'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          <Clock size={9} />
                          {order.fecha ? new Date(order.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}
                          {' \u00b7 '}{order.items?.length || 0} items
                        </span>
                        {order.distancia_km && (
                          <span className="text-[9px] text-slate-400">
                            {order.distancia_km.toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Advance button when selected */}
                    {isSelected && cfg && (
                      <div className="border-t border-slate-100 p-2 bg-slate-50">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAdvance(order); }}
                          disabled={advancingId === order.id}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold text-white rounded-lg cursor-pointer active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: themeColor }}
                        >
                          {advancingId === order.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              {cfg.icon}
                              {cfg.nextLabel}
                              <ArrowRight size={12} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaDeliverySection;
