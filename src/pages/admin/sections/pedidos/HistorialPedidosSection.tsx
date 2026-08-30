import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { Order } from '../../../../types/store';
import { Search, Download, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../../../../components/Toast';

interface HistorialPedidosSectionProps {
  scopeSedeId?: string;
}

type HistoryStatus = 'Todos' | 'Entregado' | 'Cancelado';

const STATUS_BADGE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  Entregado: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle size={10} /> },
  Cancelado: { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle size={10} /> },
};

const HistorialPedidosSection: React.FC<HistorialPedidosSectionProps> = ({ scopeSedeId }) => {
  const { config } = useApp();
  const [sedeFilter, setSedeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatus>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const lockedSede = scopeSedeId || '';
  const canFilterBySede = !lockedSede;
  const effectiveSede = lockedSede || sedeFilter || undefined;

  const { showToast } = useToast();
  const { completedOrders, cancelledOrders } = useOrders(effectiveSede);
  const themeColor = config.theme_color || '#A4D045';

  const allHistoryOrders = useMemo(() => {
    return [...completedOrders, ...cancelledOrders].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }, [completedOrders, cancelledOrders]);

  const filteredOrders = useMemo(() => {
    let result = allHistoryOrders;

    if (statusFilter !== 'Todos') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (dateFrom) {
      result = result.filter(o => o.fecha >= dateFrom);
    }
    if (dateTo) {
      const to = dateTo + 'T23:59:59';
      result = result.filter(o => o.fecha <= to);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.cliente_nombre.toLowerCase().includes(q) ||
        (o.cliente_telefono && o.cliente_telefono.includes(q))
      );
    }

    return result;
  }, [allHistoryOrders, statusFilter, dateFrom, dateTo, searchQuery]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exportCSV = useCallback(() => {
    if (filteredOrders.length === 0) {
      showToast('info', 'No hay pedidos para exportar.');
      return;
    }
    const headers = ['ID', 'Fecha', 'Cliente', 'Telefono', 'Metodo Pago', 'Total USD', 'Total Bs', 'Status', 'Direccion'];
    const rows = filteredOrders.map(o => [
      o.id,
      `"${o.fecha}"`,
      `"${o.cliente_nombre.replace(/"/g, '""')}"`,
      o.cliente_telefono,
      o.metodo_pago,
      o.total_usd.toFixed(2),
      o.total_bs.toFixed(2),
      o.status,
      `"${o.direccion_envio.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historial_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  }, [filteredOrders]);

  const totals = useMemo(() => ({
    count: filteredOrders.length,
    revenue: filteredOrders.filter(o => o.status === 'Entregado').reduce((s, o) => s + (Number(o.total_usd) || 0), 0),
  }), [filteredOrders]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h4 className="text-xs uppercase font-mono font-bold text-[#a1a1aa] tracking-wider">
            Historial de Pedidos
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {totals.count} pedidos \u00b7 ${totals.revenue.toFixed(2)} USD
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <Download size={12} /> CSV
          </button>

          {activeSedes.length > 1 && canFilterBySede && (
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="">Todas las sedes</option>
              {activeSedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Status tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {(['Todos', 'Entregado', 'Cancelado'] as HistoryStatus[]).map(status => {
            const cfg = status !== 'Todos' ? STATUS_BADGE[status] : null;
            const count = status === 'Todos'
              ? allHistoryOrders.length
              : allHistoryOrders.filter(o => o.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {cfg?.icon}
                {status}
                <span className={`text-[9px] px-1 py-0 rounded-full ${
                  statusFilter === status ? 'bg-slate-200 text-slate-700' : 'bg-slate-200/50 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer"
          placeholder="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer"
          placeholder="Hasta"
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[140px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID, cliente o tel\u00e9fono..."
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* Order list */}
      <div className="flex flex-col gap-2">
        {filteredOrders.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
            No hay pedidos en el historial con estos filtros.
          </div>
        ) : (
          filteredOrders.map(order => {
            const isExpanded = expandedIds.has(order.id);
            const badge = STATUS_BADGE[order.status] || STATUS_BADGE.Cancelado;

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Summary row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] sm:text-xs font-black text-slate-900 shrink-0">#{order.id.toUpperCase()}</span>
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.color} shrink-0`}>
                      {badge.icon}
                      {order.status}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 truncate">{order.cliente_nombre}</span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline shrink-0">{order.cliente_telefono}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {order.fecha ? new Date(order.fecha).toLocaleDateString('es-VE') : ''}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black" style={{ color: themeColor }}>
                      ${order.total_usd?.toFixed(2)}
                    </span>
                    {isExpanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-[10px]">
                      <div>
                        <span className="text-slate-400 block">Metodo de pago</span>
                        <span className="font-bold text-slate-700">{order.metodo_pago}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Direccion</span>
                        <span className="font-bold text-slate-700 truncate block">{order.direccion_envio || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Tipo entrega</span>
                        <span className="font-bold text-slate-700 capitalize">{order.tipo_entrega}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total Bs</span>
                        <span className="font-bold text-slate-700">Bs. {order.total_bs?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Items</span>
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-slate-700">
                            <span className="font-bold">{item.cantidad}x</span> {item.nombre}
                          </span>
                          <span className="font-mono text-slate-500">${(item.precio_usd * item.cantidad).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistorialPedidosSection;
