import React, { useMemo, useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import {
  Calendar, BarChart3, ShoppingBag, ShoppingCart, DollarSign, Landmark, Package, Ticket
} from 'lucide-react';

const ResumenGeneralSection: React.FC = () => {
  const { orders, config, foodItems } = useApp();
  const [sedeFilter, setSedeFilter] = useState<string>('');
  const activeSedes = config.sedes?.filter(s => s.activa) || [];
  const principalSedeId = activeSedes.find(s => s.es_principal)?.id || activeSedes[0]?.id || '';

  const filteredOrders = useMemo(() => {
    if (!sedeFilter) return orders;
    return orders.filter(o => (o.sede_id || principalSedeId) === sedeFilter);
  }, [orders, sedeFilter, principalSedeId]);

  const reportTotals = useMemo(() => {
    const totalVentasUsd = filteredOrders.reduce((acc, o) => acc + (Number(o.total_usd) || 0), 0);
    const totalAhorroCuponesUsd = filteredOrders.reduce((acc, o) => acc + (Number(o.descuento_cupon_usd) || 0), 0);
    const totalPedidosCount = filteredOrders.length;
    let partsSold = 0;

    filteredOrders.forEach(o => {
      o.items.forEach(it => { partsSold += (Number(it.cantidad) || 0); });
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);
    const startOfPrevMonth = now.getTime() - (60 * 24 * 60 * 60 * 1000);

    let dayTotal = 0, weekTotal = 0, monthTotal = 0, prevMonthTotal = 0;

    filteredOrders.forEach(o => {
      const orderTime = new Date(o.fecha).getTime();
      const amount = Number(o.total_usd) || 0;
      if (orderTime >= startOfDay) dayTotal += amount;
      if (orderTime >= startOfWeek) weekTotal += amount;
      if (orderTime >= startOfMonth) monthTotal += amount;
      else if (orderTime >= startOfPrevMonth) prevMonthTotal += amount;
    });

    return {
      salesUSD: totalVentasUsd,
      couponSavingsUSD: totalAhorroCuponesUsd,
      salesBs: totalVentasUsd * (Number(config.tasa_cambio) || 1),
      ordersCount: totalPedidosCount,
      partsSoldCount: partsSold,
      dayTotal, weekTotal, monthTotal, prevMonthTotal
    };
  }, [filteredOrders, config.tasa_cambio]);

  const activeOrders = useMemo(() =>
    filteredOrders.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado').length
  , [filteredOrders]);

  const salesChartData = useMemo(() => {
    const datesMap: { [date: string]: number } = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      datesMap[d.toLocaleDateString([], { month: 'short', day: 'numeric' })] = 0;
    }
    filteredOrders.forEach(o => {
      try {
        const key = new Date(o.fecha).toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (key in datesMap) datesMap[key] += Number(o.total_usd) || 0;
      } catch {
        const key = o.fecha.split(' ')[0] || 'Hoy';
        if (key in datesMap) datesMap[key] += Number(o.total_usd) || 0;
      }
    });
    return Object.keys(datesMap).map(k => ({ fecha: k, Ventas: parseFloat(datesMap[k].toFixed(2)) }));
  }, [filteredOrders]);

  const couponUsageChartData = useMemo(() => {
    const datesMap: { [date: string]: number } = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      datesMap[d.toLocaleDateString([], { month: 'short', day: 'numeric' })] = 0;
    }
    filteredOrders.forEach(o => {
      if (o.cupon_codigo) {
        try {
          const key = new Date(o.fecha).toLocaleDateString([], { month: 'short', day: 'numeric' });
          if (key in datesMap) datesMap[key] += 1;
        } catch {
          const key = o.fecha.split(' ')[0] || 'Hoy';
          if (key in datesMap) datesMap[key] += 1;
        }
      }
    });
    return Object.keys(datesMap).map(k => ({ fecha: k, Usos: datesMap[k] }));
  }, [filteredOrders]);

  const topProductsChartData = useMemo(() => {
    const productsMap: { [name: string]: number } = {};
    foodItems.forEach(p => { productsMap[p.nombre.substring(0, 22)] = 0; });
    filteredOrders.forEach(o => {
      o.items.forEach(it => {
        const name = it.nombre.substring(0, 22);
        productsMap[name] = (productsMap[name] || 0) + (it.cantidad || 0);
      });
    });
    return Object.keys(productsMap)
      .map(k => ({ name: k, Unidades: productsMap[k] }))
      .filter(p => p.Unidades > 0)
      .sort((a, b) => b.Unidades - a.Unidades)
      .slice(0, 5);
  }, [filteredOrders, foodItems]);

  const monthlyComparisonData = useMemo(() => [
    { period: 'Anterior', total: reportTotals.prevMonthTotal },
    { period: 'Actual', total: reportTotals.monthTotal },
  ], [reportTotals]);

  const growthPercent = reportTotals.prevMonthTotal > 0
    ? ((reportTotals.monthTotal - reportTotals.prevMonthTotal) / reportTotals.prevMonthTotal * 100).toFixed(1)
    : '+100';

  return (
    <div className="flex flex-col gap-5">
      {activeSedes.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtrar por tienda:</span>
          <select
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer"
          >
            <option value="">Todas las sedes</option>
            {activeSedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Ventas Hoy</span>
            <Calendar size={16} />
          </div>
          <p className="text-2xl font-black font-mono mt-2">${reportTotals.dayTotal.toFixed(2)}</p>
        </div>
        <div className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Esta Semana</span>
            <BarChart3 size={16} />
          </div>
          <p className="text-2xl font-black font-mono mt-2">${reportTotals.weekTotal.toFixed(2)}</p>
        </div>
        <div className="p-5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl text-white shadow-lg shadow-violet-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Últimos 30 Días</span>
            <ShoppingBag size={16} />
          </div>
          <p className="text-2xl font-black font-mono mt-2">${reportTotals.monthTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Pedidos Activos', value: activeOrders, icon: ShoppingBag, accent: 'violet' },
          { label: 'Ingresos (USD)', value: `$${reportTotals.salesUSD.toFixed(1)}`, icon: DollarSign, accent: 'emerald' },
          { label: 'Ingresos (Bs)', value: reportTotals.salesBs.toFixed(1), icon: Landmark, accent: 'blue' },
          { label: 'Órdenes Totales', value: reportTotals.ordersCount, icon: ShoppingCart, accent: 'slate' },
          { label: 'Unidades Vendidas', value: reportTotals.partsSoldCount, icon: Package, accent: 'indigo' },
          { label: 'Ahorro Cupones', value: `$${reportTotals.couponSavingsUSD.toFixed(1)}`, icon: Ticket, accent: 'pink' },
        ].map(m => (
          <div key={m.label} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-violet-300 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium truncate">{m.label}</span>
              <div className={`p-1.5 rounded-lg bg-${m.accent}-50 text-${m.accent}-600 shrink-0`}>
                <m.icon size={14} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 mt-1 truncate">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Crecimiento Mensual</h4>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${reportTotals.monthTotal >= reportTotals.prevMonthTotal ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {growthPercent}%
            </span>
          </div>
          <div className="w-full h-[220px] mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyComparisonData}>
                <XAxis dataKey="period" stroke="#64748b" interval="preserveStartEnd" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value: unknown) => [`$${Number(value).toFixed(2)}`, 'Ventas']} />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Flujo Diario de Ventas (USD)</h4>
          <div className="w-full h-[220px] mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesChartData}>
                <XAxis dataKey="fecha" stroke="#64748b" interval="preserveStartEnd" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="Ventas" stroke="#7c3aed" strokeWidth={2.5} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top 5 Productos (Unidades)</h4>
          <div className="w-full h-[220px] mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProductsChartData}>
                <XAxis dataKey="name" stroke="#64748b" interval="preserveStartEnd" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="Unidades" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col gap-2 md:col-span-2 lg:col-span-1">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Uso Diario de Cupones</h4>
          <div className="w-full h-[220px] mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={couponUsageChartData}>
                <XAxis dataKey="fecha" stroke="#64748b" interval="preserveStartEnd" />
                <YAxis stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="Usos" stroke="#ec4899" strokeWidth={2.5} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumenGeneralSection;
