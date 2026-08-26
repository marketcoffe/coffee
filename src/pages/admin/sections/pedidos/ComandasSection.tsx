import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { Order } from '../../../../types/store';
import { Download, LayoutGrid, List, XCircle, ArrowRight, Monitor, Smartphone, ChevronRight } from 'lucide-react';
import { OrderCard, sortOrdersByPriority } from '../../components/OrderCard';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { printOrderTicket } from '../../utils/printUtils';
import { Tooltip } from '../../components/Tooltip';

type TabStatus = 'Pendiente' | 'En preparacion' | 'En camino' | 'Entregado' | 'Cancelado' | 'Todos';

const TAB_CONFIG: Record<TabStatus, { label: string; color: string; bg: string; borderColor: string; countBg: string }> = {
  'Todos':          { label: 'Todos',          color: 'text-slate-700',   bg: 'bg-slate-50',   borderColor: 'border-slate-300',   countBg: 'bg-slate-500' },
  'Pendiente':      { label: 'Pendiente',      color: 'text-amber-700',  bg: 'bg-amber-50',   borderColor: 'border-amber-300',   countBg: 'bg-amber-500' },
  'En preparacion': { label: 'En Preparacion', color: 'text-violet-700', bg: 'bg-violet-50',  borderColor: 'border-violet-300',  countBg: 'bg-violet-500' },
  'En camino':      { label: 'En Camino',      color: 'text-cyan-700',   bg: 'bg-cyan-50',    borderColor: 'border-cyan-300',    countBg: 'bg-cyan-500' },
  'Entregado':      { label: 'Entregado',      color: 'text-emerald-700',bg: 'bg-emerald-50', borderColor: 'border-emerald-300', countBg: 'bg-emerald-500' },
  'Cancelado':      { label: 'Cancelado',      color: 'text-red-700',    bg: 'bg-red-50',     borderColor: 'border-red-300',     countBg: 'bg-red-500' },
};

const STATUS_ORDER: Record<string, number> = {
  'Pendiente': 0, 'Procesando': 1, 'enviado_cocina': 2,
  'En preparación': 3, 'En preparacion': 3, 'en_preparacion': 3,
  'En camino': 4, 'Entregado': 5, 'Cancelado': 6,
  'pendiente_verificacion': 0, 'pago_enviado': 0, 'pendiente_pago': 0, 'pago_en_verificacion': 0,
  'completado': 5, 'cancelado': 6, 'Listo': 4,
};

function getOrderTab(order: Order): TabStatus {
  const s = order.status;
  if (s === 'Cancelado' || s === 'cancelado') return 'Cancelado';
  if (s === 'Entregado' || s === 'completado') return 'Entregado';
  if (s === 'En camino' || s === 'Listo') return 'En camino';
  if (s === 'En preparación' || s === 'En preparacion' || s === 'en_preparacion' || s === 'enviado_cocina') return 'En preparacion';
  return 'Pendiente';
}

function getUrgencyClass(fecha: string, status: Order['status']): string {
  if (status === 'Cancelado' || status === 'cancelado' || status === 'Entregado' || status === 'completado') return '';
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (mins > 30) return 'order-urgency-high';
  if (mins > 15) return 'order-urgency-medium';
  return 'order-urgency-low';
}

interface ComandasSectionProps { scopeSedeId?: string; }

const ComandasSection: React.FC<ComandasSectionProps> = ({ scopeSedeId }) => {
  const { orders, config } = useApp();
  const { advanceStatus, cancelOrder, bulkAdvance } = useOrders();
  const themeColor = config.theme_color || '#A4D045';

  const [activeTab, setActiveTab] = useState<TabStatus>('Pendiente');
  const [kitchenMode, setKitchenMode] = useState(false);
  const [sedeFilter, setSedeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const lockedSede = scopeSedeId || '';
  const effectiveSedeFilter = lockedSede || sedeFilter;

  const deliveryPickupOrders = useMemo(() => {
    let result = [...(orders || [])];
    result = result.filter(o => o.tipo_pedido !== 'mesa' && o.tipo_entrega !== 'mesa');
    if (effectiveSedeFilter) result = result.filter(o => o.sede_id === effectiveSedeFilter);
    return result;
  }, [orders, effectiveSedeFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabStatus, number> = {
      'Todos': 0, 'Pendiente': 0, 'En preparacion': 0,
      'En camino': 0, 'Entregado': 0, 'Cancelado': 0,
    };
    deliveryPickupOrders.forEach(order => {
      const tab = getOrderTab(order);
      counts[tab]++;
      counts['Todos']++;
    });
    return counts;
  }, [deliveryPickupOrders]);

  const filteredOrders = useMemo(() => {
    let result = deliveryPickupOrders;
    if (activeTab !== 'Todos') {
      result = result.filter(o => getOrderTab(o) === activeTab);
    }
    return result.sort((a, b) => {
      const pa = STATUS_ORDER[a.status] ?? 0;
      const pb = STATUS_ORDER[b.status] ?? 0;
      if (pa !== pb) return pa - pb;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [deliveryPickupOrders, activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAdvance = async () => {
    const advanceable = selectedIds.filter(id => {
      const order = deliveryPickupOrders.find(o => o.id === id);
      return order && order.status !== 'Entregado' && order.status !== 'Cancelado';
    });
    await bulkAdvance(advanceable);
    setSelectedIds([]);
  };

  const handleBulkCancel = async () => {
    const cancellable = selectedIds.filter(id => {
      const order = deliveryPickupOrders.find(o => o.id === id);
      return order && order.status !== 'Entregado' && order.status !== 'Cancelado';
    });
    for (const id of cancellable) {
      const order = deliveryPickupOrders.find(o => o.id === id);
      if (order) await cancelOrder(order);
    }
    setSelectedIds([]);
  };

  const handleAdvance = useCallback((order: Order) => { advanceStatus(order); }, [advanceStatus]);
  const handleCancel = useCallback((order: Order) => { cancelOrder(order); }, [cancelOrder]);

  const handleWhatsApp = useCallback((order: Order) => {
    const phone = order.cliente_telefono?.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/58${phone}?text=Tu pedido #${order.id.slice(-4)} esta ${order.status}`, '_blank');
  }, []);

  const exportCSV = () => {
    const headers = ["#", "ID", "Fecha", "Cliente", "Telefono", "Tipo", "Metodo Pago", "Total USD", "Status"];
    const rows = filteredOrders.map((o, i) => [
      String(i + 1), o.id, o.fecha, o.cliente_nombre, o.cliente_telefono,
      o.tipo_entrega, o.metodo_pago, (o.total_usd ?? 0).toFixed(2), o.status
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printOrder = (order: Order) => printOrderTicket(order, config);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">Cola de Pedidos</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{tabCounts.Todos} pedidos activos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Exportar pedidos a archivo CSV">
            <button onClick={exportCSV} className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer">
              <Download size={12} /> CSV
            </button>
          </Tooltip>
          <Tooltip content={kitchenMode ? 'Vista normal' : 'Modo Cocina: tarjetas grandes para pantalla de cocina'}>
            <button onClick={() => setKitchenMode(!kitchenMode)} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer ${kitchenMode ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {kitchenMode ? <Smartphone size={12} /> : <Monitor size={12} />}
              {kitchenMode ? 'Normal' : 'Cocina'}
            </button>
          </Tooltip>
          {activeSedes.length > 1 && !lockedSede && (
            <Tooltip content="Filtrar pedidos por sucursal">
              <select value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 cursor-pointer">
                <option value="">Todas</option>
                {activeSedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <span className="text-xs font-bold text-blue-700">{selectedIds.length} seleccionados</span>
          <Tooltip content="Avanzar todos los seleccionados al siguiente estado">
            <button onClick={handleBulkAdvance} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white rounded-lg cursor-pointer transition-all active:scale-95" style={{ background: themeColor }}>
              <ArrowRight size={12} /> Avanzar todos
            </button>
          </Tooltip>
          <Tooltip content="Cancelar todos los seleccionados">
            <button onClick={handleBulkCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer transition-all active:scale-95">
              <XCircle size={12} /> Cancelar todos
            </button>
          </Tooltip>
          <button onClick={() => setSelectedIds([])} className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Deseleccionar</button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
        {(['Pendiente', 'En preparacion', 'En camino', 'Entregado', 'Cancelado'] as TabStatus[]).map(status => {
          const cfg = TAB_CONFIG[status];
          const count = tabCounts[status];
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                isActive
                  ? `${cfg.bg} ${cfg.borderColor} ${cfg.color} shadow-sm`
                  : 'bg-white/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'
              }`}
            >
              {cfg.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? `${cfg.countBg} text-white` : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      <div className="flex flex-col gap-2">
        {filteredOrders.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-300 rounded-xl text-center">
            <p className="text-sm font-bold text-slate-400">Sin pedidos</p>
            <p className="text-[10px] text-slate-400 mt-1">
              No hay pedidos {activeTab !== 'Todos' ? `con estado: ${TAB_CONFIG[activeTab].label}` : 'en esta seccion'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <div key={order.id} className={`relative ${getUrgencyClass(order.fecha, order.status)}`}>
              <div className="absolute top-3 left-0 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(order.id)}
                  onChange={() => toggleSelect(order.id)}
                  className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-blue-600"
                />
              </div>
              <div className="pl-5">
                <OrderCard
                  order={order}
                  onAdvanceStatus={handleAdvance}
                  onCancel={handleCancel}
                  onPrint={printOrder}
                  onWhatsApp={handleWhatsApp}
                  onOpenDetail={setDetailOrder}
                  themeColor={themeColor}
                  kitchenMode={kitchenMode}
                  sequenceNumber={index + 1}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail modal */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onAdvance={handleAdvance}
          onCancel={handleCancel}
          onPrint={printOrder}
          sequenceNumber={filteredOrders.indexOf(detailOrder) + 1}
        />
      )}
    </div>
  );
};

export default ComandasSection;
