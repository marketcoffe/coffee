import React, { useMemo, useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { Download, Printer } from 'lucide-react';
import { printReporte, ReporteData } from '../../utils/printReporte';

type DateRange = 'today' | '7days' | '30days' | 'custom';
type OrderType = 'all' | 'delivery' | 'pickup' | 'mesa';

const VentasReportSection: React.FC = () => {
  const { orders, config } = useApp();
  const [sedeFilter, setSedeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType>('all');
  const [mesaFilter, setMesaFilter] = useState<string>('');

  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const principalSedeId = activeSedes.find(s => s.es_principal)?.id || activeSedes[0]?.id || '';

  const filteredOrders = useMemo(() => {
    let result = sedeFilter
      ? orders.filter(o => (o.sede_id || principalSedeId) === sedeFilter)
      : [...orders];

    // Filter by order type
    if (orderTypeFilter !== 'all') {
      result = result.filter(o => o.tipo_entrega === orderTypeFilter || o.tipo_pedido === orderTypeFilter);
    }

    // Filter by mesa number
    if (mesaFilter) {
      result = result.filter(o => String(o.numero_mesa) === mesaFilter);
    }

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (dateRange === 'today') {
      result = result.filter(o => new Date(o.fecha).getTime() >= cutoff);
    } else if (dateRange === '7days') {
      const start = cutoff - 7 * 24 * 60 * 60 * 1000;
      result = result.filter(o => new Date(o.fecha).getTime() >= start);
    } else if (dateRange === '30days') {
      const start = cutoff - 30 * 24 * 60 * 60 * 1000;
      result = result.filter(o => new Date(o.fecha).getTime() >= start);
    } else if (dateRange === 'custom' && customStart && customEnd) {
      const s = new Date(customStart).getTime();
      const e = new Date(customEnd).getTime() + 86400000;
      result = result.filter(o => { const t = new Date(o.fecha).getTime(); return t >= s && t <= e; });
    }

    return result;
  }, [orders, sedeFilter, principalSedeId, dateRange, customStart, customEnd, orderTypeFilter, mesaFilter]);

  const dailySalesData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredOrders.forEach(o => {
      try {
        const key = new Date(o.fecha).toLocaleDateString([], { month: 'short', day: 'numeric' });
        map[key] = (map[key] || 0) + (Number(o.total_usd) || 0);
      } catch { /* skip */ }
    });
    return Object.entries(map).map(([fecha, total]) => ({ fecha, Ventas: parseFloat(total.toFixed(2)) }));
  }, [filteredOrders]);

  const weeklySalesData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredOrders.forEach(o => {
      try {
        const d = new Date(o.fecha);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
        map[key] = (map[key] || 0) + (Number(o.total_usd) || 0);
      } catch { /* skip */ }
    });
    return Object.entries(map).map(([semana, total]) => ({ semana, Ventas: parseFloat(total.toFixed(2)) }));
  }, [filteredOrders]);

  const monthlySalesData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredOrders.forEach(o => {
      try {
        const key = new Date(o.fecha).toLocaleDateString([], { month: 'short', year: 'numeric' });
        map[key] = (map[key] || 0) + (Number(o.total_usd) || 0);
      } catch { /* skip */ }
    });
    return Object.entries(map).map(([mes, total]) => ({ mes, Ventas: parseFloat(total.toFixed(2)) }));
  }, [filteredOrders]);

  const ordersByDay = useMemo(() => {
    const map: { [key: string]: { count: number; total: number } } = {};
    filteredOrders.forEach(o => {
      try {
        const key = new Date(o.fecha).toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count += 1;
        map[key].total += Number(o.total_usd) || 0;
      } catch { /* skip */ }
    });
    return Object.entries(map)
      .map(([dia, data]) => ({ dia, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filteredOrders]);

  const totalRevenue = useMemo(() => filteredOrders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0), [filteredOrders]);

  // Sales breakdown by order type
  const salesByType = useMemo(() => {
    const map: { [key: string]: { count: number; total: number } } = { delivery: { count: 0, total: 0 }, pickup: { count: 0, total: 0 }, mesa: { count: 0, total: 0 }, other: { count: 0, total: 0 } };
    filteredOrders.forEach(o => {
      const type = o.tipo_entrega || o.tipo_pedido || 'other';
      const key = type === 'mesa' ? 'mesa' : type === 'pickup' ? 'pickup' : type === 'delivery' ? 'delivery' : 'other';
      map[key].count += 1;
      map[key].total += Number(o.total_usd) || 0;
    });
    return map;
  }, [filteredOrders]);

  // Top mesas
  const topMesas = useMemo(() => {
    const map: { [key: number]: { count: number; total: number } } = {};
    filteredOrders.forEach(o => {
      if (o.numero_mesa) {
        if (!map[o.numero_mesa]) map[o.numero_mesa] = { count: 0, total: 0 };
        map[o.numero_mesa].count += 1;
        map[o.numero_mesa].total += Number(o.total_usd) || 0;
      }
    });
    return Object.entries(map)
      .map(([num, data]) => ({ mesa: `Mesa ${num}`, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredOrders]);

  // Unique mesa numbers for filter
  const availableMesas = useMemo(() => {
    const nums = new Set<number>();
    orders.forEach(o => { if (o.numero_mesa) nums.add(o.numero_mesa); });
    return Array.from(nums).sort((a, b) => a - b);
  }, [orders]);

  const exportCSV = () => {
    const header = 'Día,Pedidos,Total USD\n';
    const rows = ordersByDay.map(r => `${r.dia},${r.count},${r.total.toFixed(2)}`).join('\n');
    const typeSummary = `\n\nResumen por Tipo:\nTipo,Pedidos,Total USD\nDelivery,${salesByType.delivery.count},${salesByType.delivery.total.toFixed(2)}\nPickup,${salesByType.pickup.count},${salesByType.pickup.total.toFixed(2)}\nMesa,${salesByType.mesa.count},${salesByType.mesa.total.toFixed(2)}`;
    const mesaSummary = topMesas.length > 0 ? `\n\nTop Mesas:\nMesa,Pedidos,Total USD\n${topMesas.map(m => `${m.mesa},${m.count},${m.total.toFixed(2)}`).join('\n')}` : '';
    const blob = new Blob([header + rows + typeSummary + mesaSummary], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReporte = () => {
    const now = new Date();
    const rangeLabel = dateRange === 'today' ? 'Hoy' : dateRange === '7days' ? 'Ultimos 7 dias' : dateRange === '30days' ? 'Ultimos 30 dias' : 'Periodo personalizado';
    const reportData: ReporteData = {
      titulo: `REPORTE DE VENTAS - ${rangeLabel}`,
      totalPedidos: filteredOrders.length,
      totalIngresos: totalRevenue,
      totalEnvios: filteredOrders.reduce((acc, o) => acc + (Number(o.costo_envio_usd) || 0), 0),
      totalDescuentos: filteredOrders.reduce((acc, o) => acc + (Number(o.descuento_cupon_usd) || 0), 0),
      totalIVA: totalRevenue * 0.16,
      porDelivery: salesByType.delivery.count,
      porPickup: salesByType.pickup.count,
      porMesa: salesByType.mesa.count,
      efectivo: filteredOrders.filter(o => o.metodo_pago?.toLowerCase().includes('efectivo')).reduce((a, o) => a + (Number(o.total_usd) || 0), 0),
      tdc: filteredOrders.filter(o => o.metodo_pago?.toLowerCase().includes('tarjeta') || o.metodo_pago?.toLowerCase().includes('tdc')).reduce((a, o) => a + (Number(o.total_usd) || 0), 0),
      pagoMovil: filteredOrders.filter(o => o.metodo_pago?.toLowerCase().includes('pago movil')).reduce((a, o) => a + (Number(o.total_usd) || 0), 0),
      otroPago: filteredOrders.filter(o => !o.metodo_pago?.toLowerCase().includes('efectivo') && !o.metodo_pago?.toLowerCase().includes('tarjeta') && !o.metodo_pago?.toLowerCase().includes('tdc') && !o.metodo_pago?.toLowerCase().includes('pago movil')).reduce((a, o) => a + (Number(o.total_usd) || 0), 0),
      pedidos: ordersByDay.slice(0, 20).map(r => ({
        id: r.dia,
        fecha: r.dia,
        cliente: `${r.count} pedidos`,
        tipo: '',
        items: 0,
        total: r.total,
        metodoPago: '',
      })),
    };
    printReporte(reportData, config);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {activeSedes.length > 1 && (
          <select
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700"
          >
            <option value="">Todas las sedes</option>
            {activeSedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
        {(['today', '7days', '30days', 'custom'] as DateRange[]).map(r => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              dateRange === r ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {r === 'today' ? 'Hoy' : r === '7days' ? '7 Días' : r === '30days' ? '30 Días' : 'Personalizado'}
          </button>
        ))}
        {dateRange === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]" />
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]" />
          </>
        )}
        <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          <Download size={13} /> Exportar CSV
        </button>
        <button onClick={handlePrintReporte} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-600 text-white hover:bg-slate-700 transition-colors">
          <Printer size={13} /> Imprimir
        </button>
      </div>

      {/* Order type & mesa filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['all', 'delivery', 'pickup', 'mesa'] as OrderType[]).map(t => (
            <button
              key={t}
              onClick={() => setOrderTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                orderTypeFilter === t ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'delivery' ? 'Delivery' : t === 'pickup' ? 'Pickup' : 'Mesa'}
            </button>
          ))}
        </div>
        {availableMesas.length > 0 && (
          <select
            value={mesaFilter}
            onChange={(e) => setMesaFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700"
          >
            <option value="">Todas las mesas</option>
            {availableMesas.map(n => <option key={n} value={n}>Mesa {n}</option>)}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Total Período</p>
          <p className="text-2xl font-black font-mono text-slate-900">${totalRevenue.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{filteredOrders.length} pedidos</p>
        </div>
        <div className="p-4 border border-blue-200 rounded-xl bg-blue-50 shadow-sm">
          <p className="text-[10px] text-blue-600 uppercase tracking-wide font-medium">Delivery</p>
          <p className="text-xl font-black font-mono text-blue-900">${salesByType.delivery.total.toFixed(2)}</p>
          <p className="text-[10px] text-blue-500 mt-1">{salesByType.delivery.count} pedidos</p>
        </div>
        <div className="p-4 border border-purple-200 rounded-xl bg-purple-50 shadow-sm">
          <p className="text-[10px] text-purple-600 uppercase tracking-wide font-medium">Pickup</p>
          <p className="text-xl font-black font-mono text-purple-900">${salesByType.pickup.total.toFixed(2)}</p>
          <p className="text-[10px] text-purple-500 mt-1">{salesByType.pickup.count} pedidos</p>
        </div>
        <div className="p-4 border border-orange-200 rounded-xl bg-orange-50 shadow-sm">
          <p className="text-[10px] text-orange-600 uppercase tracking-wide font-medium">Mesa</p>
          <p className="text-xl font-black font-mono text-orange-900">${salesByType.mesa.total.toFixed(2)}</p>
          <p className="text-[10px] text-orange-500 mt-1">{salesByType.mesa.count} pedidos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Ventas Diarias</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailySalesData}>
                <XAxis dataKey="fecha" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="Ventas" stroke="#7c3aed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Ventas Semanales</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklySalesData}>
                <XAxis dataKey="semana" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Ventas']} />
                <Bar dataKey="Ventas" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm md:col-span-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Ventas Mensuales</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlySalesData}>
                <XAxis dataKey="mes" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Ventas']} />
                <Bar dataKey="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Mesas */}
      {topMesas.length > 0 && (
        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Top Mesas (por ventas)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-bold text-slate-600">#</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-600">Mesa</th>
                  <th className="px-4 py-2 text-right font-bold text-slate-600">Pedidos</th>
                  <th className="px-4 py-2 text-right font-bold text-slate-600">Total (USD)</th>
                </tr>
              </thead>
              <tbody>
                {topMesas.map((m, i) => (
                  <tr key={m.mesa} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400 font-bold">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-orange-600">{m.mesa}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{m.count}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">${m.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Detalle por Día</h4>
        </div>
        <div className="overflow-x-auto max-h-[300px]">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-bold text-slate-600">Día</th>
                <th className="px-4 py-2 text-right font-bold text-slate-600">Pedidos</th>
                <th className="px-4 py-2 text-right font-bold text-slate-600">Total (USD)</th>
              </tr>
            </thead>
            <tbody>
              {ordersByDay.map(r => (
                <tr key={r.dia} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{r.dia}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{r.count}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">${r.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VentasReportSection;
