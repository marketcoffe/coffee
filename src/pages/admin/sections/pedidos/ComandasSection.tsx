import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { Order } from '../../../../types/store';
import { Download, LayoutGrid, List } from 'lucide-react';
import {
  OrderCard,
  getComandaStatus,
  sortOrdersByPriority,
  COMANDA_STATUSES,
  ComandaStatus,
} from '../../components/OrderCard';
import { AdminTrackingMap } from '../../components/AdminTrackingMap';

const COMANDA_COLUMN_CONFIG: Record<ComandaStatus, { icon: string; color: string; bg: string; borderColor: string; countBg: string }> = {
  'Nuevo':         { icon: '🆕', color: 'text-amber-700',  bg: 'bg-amber-50',  borderColor: 'border-amber-300',  countBg: 'bg-amber-500' },
  'En Preparación':{ icon: '👨‍🍳', color: 'text-violet-700', bg: 'bg-violet-50', borderColor: 'border-violet-300', countBg: 'bg-violet-500' },
  'Enviado':       { icon: '✅',  color: 'text-emerald-700',bg: 'bg-emerald-50',borderColor: 'border-emerald-300',countBg: 'bg-emerald-500' },
};

interface ComandasSectionProps { scopeSedeId?: string; }

const ComandasSection: React.FC<ComandasSectionProps> = ({ scopeSedeId }) => {
  const { orders, config } = useApp();
  const { advanceStatus } = useOrders();
  const themeColor = config.theme_color || '#A4D045';

  const [viewMode, setViewMode] = useState<'kanban' | 'lista' | 'mapa'>('kanban');
  const [sedeFilter, setSedeFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const lockedSede = scopeSedeId || '';
  const effectiveSedeFilter = lockedSede || sedeFilter;

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado');
    if (effectiveSedeFilter) {
      result = result.filter(o => o.sede_id === effectiveSedeFilter);
    }
    return sortOrdersByPriority(result);
  }, [orders, effectiveSedeFilter]);

  const ordersByComandaStatus = useMemo(() => {
    const groups: Record<ComandaStatus, Order[]> = { 'Nuevo': [], 'En Preparación': [], 'Enviado': [] };
    filteredOrders.forEach(order => { groups[getComandaStatus(order.status)].push(order); });
    return groups;
  }, [filteredOrders]);

  const handleAdvance = useCallback((order: Order) => { advanceStatus(order); }, [advanceStatus]);

  const toggleExpand = (id: string) => setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const exportCSV = () => {
    const headers = ["ID", "Fecha", "Cliente", "Telefono", "Metodo Pago", "Total USD", "Status"];
    const rows = filteredOrders.map(o => [o.id, o.fecha, o.cliente_nombre, o.cliente_telefono, o.metodo_pago, o.total_usd.toFixed(2), o.status]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Pedido #${order.id.slice(-4)}</title><style>body{font-family:monospace;padding:20px}h2{font-size:16px}table{width:100%;border-collapse:collapse}td,th{padding:4px 8px;border-bottom:1px solid #ddd;text-align:left}.total{font-weight:bold;font-size:14px}</style></head><body>`);
    printWindow.document.write(`<h2>PEDIDO #${order.id.slice(-4)}</h2>`);
    printWindow.document.write(`<p>Cliente: ${order.cliente_nombre}</p><p>Tel: ${order.cliente_telefono}</p><p>Fecha: ${new Date(order.fecha).toLocaleString('es-VE')}</p>`);
    printWindow.document.write('<table><tr><th>Cant</th><th>Producto</th><th>Precio</th></tr>');
    order.items?.forEach(item => {
      printWindow.document.write(`<tr><td>${item.cantidad}x</td><td>${item.nombre}${item.selected_options?.length ? ' (' + item.selected_options.map(o => o.option_name).join(', ') + ')' : ''}</td><td>$${(item.precio_usd * item.cantidad).toFixed(2)}</td></tr>`);
    });
    printWindow.document.write(`</table><p class="total">TOTAL: $${order.total_usd?.toFixed(2)}</p>`);
    printWindow.document.write(`<p>Estado: ${order.status}</p></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">Cola de Pedidos</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{filteredOrders.length} pedidos activos</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['kanban', 'lista', 'mapa'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${viewMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                {mode === 'kanban' ? <LayoutGrid size={12} /> : mode === 'lista' ? <List size={12} /> : <List size={12} />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer">
            <Download size={12} /> CSV
          </button>
          {activeSedes.length > 1 && !lockedSede && (
            <select value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 cursor-pointer">
              <option value="">Todas las sedes</option>
              {activeSedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COMANDA_STATUSES.map(cs => {
            const colConfig = COMANDA_COLUMN_CONFIG[cs];
            const columnOrders = ordersByComandaStatus[cs];
            return (
              <div key={cs} className="flex flex-col">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-2 border-b-0 ${colConfig.borderColor} ${colConfig.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{colConfig.icon}</span>
                    <span className={`text-xs font-black uppercase tracking-wider ${colConfig.color}`}>{cs}</span>
                  </div>
                  <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${colConfig.countBg}`}>{columnOrders.length}</span>
                </div>
                <div className={`flex flex-col gap-2 p-2 border-2 border-t-0 ${colConfig.borderColor} ${colConfig.bg} rounded-b-xl min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto no-scrollbar`}>
                  {columnOrders.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[10px] text-slate-400 italic">Sin pedidos</div>
                  ) : columnOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isExpanded={expandedIds.includes(order.id)}
                      onToggleExpand={() => toggleExpand(order.id)}
                      onAdvanceStatus={handleAdvance}
                      onPrint={printOrder}
                      onWhatsApp={(o) => { const phone = o.cliente_telefono?.replace(/\D/g, ''); if (phone) window.open(`https://wa.me/58${phone}?text=Tu pedido #${o.id.slice(-4)} está ${o.status}`, '_blank'); }}
                      themeColor={themeColor}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista View */}
      {viewMode === 'lista' && (
        <div className="flex flex-col gap-2">
          {filteredOrders.length === 0 ? (
            <div className="p-10 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">No hay pedidos activos.</div>
          ) : filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isExpanded={expandedIds.includes(order.id)}
              onToggleExpand={() => toggleExpand(order.id)}
              onAdvanceStatus={handleAdvance}
              onPrint={printOrder}
              onWhatsApp={(o) => { const phone = o.cliente_telefono?.replace(/\D/g, ''); if (phone) window.open(`https://wa.me/58${phone}?text=Tu pedido #${o.id.slice(-4)} está ${o.status}`, '_blank'); }}
              themeColor={themeColor}
            />
          ))}
        </div>
      )}

      {/* Mapa View */}
      {viewMode === 'mapa' && (
        <div className="h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden border border-slate-200">
          <AdminTrackingMap orders={filteredOrders} shopCoords={config.coordenadas_tienda} selectedOrderId={null} onSelectOrder={() => {}} themeColor={themeColor} />
        </div>
      )}
    </div>
  );
};

export default ComandasSection;
