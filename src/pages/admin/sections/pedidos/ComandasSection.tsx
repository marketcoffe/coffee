import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { Order } from '../../../../types/store';
import { Download, LayoutGrid, List, CheckSquare, XCircle, ArrowRight } from 'lucide-react';
import { OrderCard, sortOrdersByPriority } from '../../components/OrderCard';
import { AdminTrackingMap } from '../../components/AdminTrackingMap';
import { printOrderTicket } from '../../utils/printUtils';
import { Tooltip } from '../../components/Tooltip';

type KanbanColumn = 'Pendiente' | 'En preparacion' | 'Listo' | 'En camino' | 'Entregado' | 'Cancelado';

const KANBAN_COLUMNS: KanbanColumn[] = ['Pendiente', 'En preparacion', 'Listo', 'En camino', 'Entregado', 'Cancelado'];

const COLUMN_CONFIG: Record<KanbanColumn, { label: string; color: string; bg: string; borderColor: string; countBg: string }> = {
  'Pendiente':       { label: 'Pendiente',        color: 'text-amber-700',  bg: 'bg-amber-50',  borderColor: 'border-amber-300',  countBg: 'bg-amber-500' },
  'En preparacion':  { label: 'En Preparacion',   color: 'text-violet-700', bg: 'bg-violet-50', borderColor: 'border-violet-300', countBg: 'bg-violet-500' },
  'Listo':           { label: 'Listo',             color: 'text-blue-700',   bg: 'bg-blue-50',   borderColor: 'border-blue-300',   countBg: 'bg-blue-500' },
  'En camino':       { label: 'En Camino',         color: 'text-cyan-700',   bg: 'bg-cyan-50',   borderColor: 'border-cyan-300',   countBg: 'bg-cyan-500' },
  'Entregado':       { label: 'Entregado',         color: 'text-emerald-700',bg: 'bg-emerald-50',borderColor: 'border-emerald-300',countBg: 'bg-emerald-500' },
  'Cancelado':       { label: 'Cancelado',         color: 'text-red-700',    bg: 'bg-red-50',    borderColor: 'border-red-300',    countBg: 'bg-red-500' },
};

function getOrderColumn(order: Order): KanbanColumn {
  if (order.status === 'Cancelado') return 'Cancelado';
  if (order.status === 'Procesando') return 'Pendiente';
  if (order.status === ('En preparacion' as Order['status']) || order.status === 'En preparación') return 'En preparacion';
  return order.status as KanbanColumn;
}

function getUrgencyClass(fecha: string, status: Order['status']): string {
  if (status === 'Cancelado' || status === 'Entregado') return '';
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (mins > 30) return 'erp-urgency-high';
  if (mins > 15) return 'erp-urgency-medium';
  return 'erp-urgency-low';
}

function waLink(order: Order): string {
  const phone = order.cliente_telefono?.replace(/\D/g, '');
  if (!phone) return '';
  return `https://wa.me/58${phone}?text=Tu pedido #${order.id.slice(-4)} esta ${order.status}`;
}

interface ComandasSectionProps { scopeSedeId?: string; }

const ComandasSection: React.FC<ComandasSectionProps> = ({ scopeSedeId }) => {
  const { orders, config } = useApp();
  const { advanceStatus, cancelOrder, bulkAdvance } = useOrders();
  const themeColor = config.theme_color || '#A4D045';

  const [viewMode, setViewMode] = useState<'kanban' | 'lista' | 'mapa'>('kanban');
  const [sedeFilter, setSedeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const lockedSede = scopeSedeId || '';
  const effectiveSedeFilter = lockedSede || sedeFilter;

  const allDisplayOrders = useMemo(() => {
    let result = [...orders];
    if (effectiveSedeFilter) result = result.filter(o => o.sede_id === effectiveSedeFilter);
    return result;
  }, [orders, effectiveSedeFilter]);

  const activeOrders = useMemo(() =>
    allDisplayOrders.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado'),
    [allDisplayOrders]
  );

  const ordersByColumn = useMemo(() => {
    const groups: Record<KanbanColumn, Order[]> = {
      'Pendiente': [], 'En preparacion': [], 'Listo': [],
      'En camino': [], 'Entregado': [], 'Cancelado': [],
    };
    allDisplayOrders.forEach(order => { groups[getOrderColumn(order)].push(order); });
    return groups;
  }, [allDisplayOrders]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAllInColumn = (columnOrders: Order[]) => {
    const ids = columnOrders.map(o => o.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...ids])]);
  };

  const handleBulkAdvance = async () => {
    const advanceable = selectedIds.filter(id => {
      const order = allDisplayOrders.find(o => o.id === id);
      return order && order.status !== 'Entregado' && order.status !== 'Cancelado';
    });
    await bulkAdvance(advanceable);
    setSelectedIds([]);
  };

  const handleBulkCancel = async () => {
    const cancellable = selectedIds.filter(id => {
      const order = allDisplayOrders.find(o => o.id === id);
      return order && order.status !== 'Entregado' && order.status !== 'Cancelado';
    });
    for (const id of cancellable) {
      const order = allDisplayOrders.find(o => o.id === id);
      if (order) await cancelOrder(order);
    }
    setSelectedIds([]);
  };

  const handleAdvance = useCallback((order: Order) => { advanceStatus(order); }, [advanceStatus]);
  const handleCancel = useCallback((order: Order) => { cancelOrder(order); }, [cancelOrder]);

  const handleWhatsApp = useCallback((order: Order) => {
    const url = waLink(order);
    if (url) window.open(url, '_blank');
  }, []);

  const exportCSV = () => {
    const headers = ["ID", "Fecha", "Cliente", "Telefono", "Metodo Pago", "Total USD", "Status"];
    const rows = allDisplayOrders.map(o => [o.id, o.fecha, o.cliente_nombre, o.cliente_telefono, o.metodo_pago, o.total_usd.toFixed(2), o.status]);
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">Cola de Pedidos</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{activeOrders.length} pedidos activos</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <Tooltip content="Vista Kanban: columnas por estado del pedido">
              <button onClick={() => setViewMode('kanban')} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                <LayoutGrid size={12} />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </Tooltip>
            <Tooltip content="Vista Lista: pedidos en fila vertical">
              <button onClick={() => setViewMode('lista')} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${viewMode === 'lista' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                <List size={12} />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </Tooltip>
            <Tooltip content="Vista Mapa: ubicacion de clientes en tiempo real">
              <button onClick={() => setViewMode('mapa')} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${viewMode === 'mapa' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                <LayoutGrid size={12} />
                <span className="hidden sm:inline">Mapa</span>
              </button>
            </Tooltip>
          </div>
          <Tooltip content="Exportar pedidos a archivo CSV">
            <button onClick={exportCSV} className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer">
              <Download size={12} /> <span className="hidden sm:inline">CSV</span>
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

      {selectedIds.length > 0 && (
        <div className="erp-bulk-bar flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: themeColor }}>{selectedIds.length} seleccionados</span>
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

      {viewMode === 'kanban' && (
        <div className="erp-kanban-grid">
          {KANBAN_COLUMNS.map(col => {
            const cfg = COLUMN_CONFIG[col];
            const columnOrders = ordersByColumn[col];
            return (
              <div key={col} className="erp-kanban-col">
                <div className={`erp-kanban-header ${cfg.borderColor} ${cfg.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded-full ${cfg.countBg}`}>{columnOrders.length}</span>
                  </div>
                  {columnOrders.length > 0 && (
                    <button onClick={() => selectAllInColumn(columnOrders)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Seleccionar</button>
                  )}
                </div>
                <div className={`erp-kanban-body ${cfg.bg}`}>
                  {columnOrders.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[10px] text-slate-400 italic">Sin pedidos</div>
                  ) : columnOrders.map(order => (
                    <div key={order.id} className={`relative ${getUrgencyClass(order.fecha, order.status)}`}>
                      <div className="absolute top-2 left-0 z-10">
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
                          themeColor={themeColor}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'lista' && (
        <div className="flex flex-col gap-2">
          {activeOrders.length === 0 ? (
            <div className="p-10 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">No hay pedidos activos.</div>
          ) : activeOrders.map(order => (
            <div key={order.id} className={`relative ${getUrgencyClass(order.fecha, order.status)}`}>
              <div className="absolute top-2 left-2 z-10">
                <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelect(order.id)} className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-blue-600" />
              </div>
              <div className="pl-7">
                <OrderCard order={order} onAdvanceStatus={handleAdvance} onCancel={handleCancel} onPrint={printOrder} onWhatsApp={handleWhatsApp} themeColor={themeColor} />
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'mapa' && (
        <div className="h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden border border-slate-200">
          <AdminTrackingMap orders={allDisplayOrders} shopCoords={config.coordenadas_tienda} selectedOrderId={null} onSelectOrder={() => {}} themeColor={themeColor} />
        </div>
      )}
    </div>
  );
};

export default ComandasSection;
