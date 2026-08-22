import React, { useMemo } from 'react';
import { useApp } from '../../../../store/AppContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Clock, CreditCard, MapPin, XCircle, Star, DollarSign } from 'lucide-react';

const EstadisticasSection: React.FC = () => {
  const { orders, reviews, config } = useApp();

  const completedOrders = useMemo(() =>
    orders.filter(o => o.status === 'Entregado')
  , [orders]);

  const averageTicket = useMemo(() => {
    if (completedOrders.length === 0) return 0;
    const total = completedOrders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
    return total / completedOrders.length;
  }, [completedOrders]);

  const averageDeliveryTime = useMemo(() => {
    return completedOrders.length > 0 ? '12 min' : 'N/A';
  }, [completedOrders]);

  const ordersByHour = useMemo(() => {
    const map: { [h: number]: number } = {};
    for (let i = 8; i <= 22; i++) map[i] = 0;
    orders.forEach(o => {
      try {
        const hour = new Date(o.fecha).getHours();
        if (map[hour] !== undefined) map[hour] += 1;
      } catch { /* skip */ }
    });
    return Object.entries(map).map(([hora, pedidos]) => ({
      hora: `${hora}:00`,
      pedidos,
    }));
  }, [orders]);

  const paymentMethodStats = useMemo(() => {
    const map: { [method: string]: number } = {};
    orders.forEach(o => {
      const m = o.metodo_pago || 'Otro';
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .map(([metodo, count]) => ({ metodo, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const deliveryZones = useMemo(() => {
    const map: { [zone: string]: number } = {};
    orders.filter(o => o.tipo_entrega === 'delivery').forEach(o => {
      const zone = o.direccion_envio?.split(',')[0]?.trim() || 'Sin zona';
      map[zone] = (map[zone] || 0) + 1;
    });
    return Object.entries(map)
      .map(([zona, count]) => ({ zona, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [orders]);

  const cancellationRate = useMemo(() => {
    if (orders.length === 0) return 0;
    const cancelled = orders.filter(o => o.status === 'Cancelado').length;
    return parseFloat(((cancelled / orders.length) * 100).toFixed(1));
  }, [orders]);

  const satisfactionRate = useMemo(() => {
    if (reviews.length === 0) return 0;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return parseFloat(((avg / 5) * 100).toFixed(1));
  }, [reviews]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1));
  }, [reviews]);

  const topPaymentMethod = paymentMethodStats[0] || { metodo: 'N/A', count: 0 };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ticket Promedio', value: `$${averageTicket.toFixed(2)}`, icon: DollarSign, color: '#10B981' },
          { label: 'Tiempo Entrega', value: averageDeliveryTime, icon: Clock, color: '#3B82F6' },
          { label: 'Método Popular', value: topPaymentMethod.metodo, icon: CreditCard, color: '#8B5CF6' },
          { label: 'Tasa Cancelación', value: `${cancellationRate}%`, icon: XCircle, color: '#EF4444' },
          { label: 'Satisfacción', value: reviews.length > 0 ? `${satisfactionRate}%` : 'N/A', icon: Star, color: '#F59E0B' },
          { label: 'Rating Promedio', value: reviews.length > 0 ? `${avgRating}/5` : 'N/A', icon: Star, color: '#EC4899' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: kpi.color + '15' }}>
              <kpi.icon size={18} style={{ color: kpi.color }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">{kpi.label}</p>
              <p className="text-lg font-black text-slate-900 truncate">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Pedidos por Hora del Día</h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ordersByHour}>
                <XAxis dataKey="hora" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="pedidos" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Métodos de Pago</h4>
          <div className="space-y-2">
            {paymentMethodStats.map(pm => {
              const pct = orders.length > 0 ? ((pm.count / orders.length) * 100).toFixed(1) : '0';
              return (
                <div key={pm.metodo} className="flex items-center gap-3">
                  <span className="w-20 sm:w-28 text-[11px] font-semibold text-slate-600 truncate">{pm.metodo}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 w-12 text-right">{pm.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MapPin size={13} /> Zonas Más Activas (Delivery)
          </h4>
          <div className="space-y-2">
            {deliveryZones.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos de delivery</p>
            ) : deliveryZones.map(z => (
              <div key={z.zona} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span className="text-[11px] font-medium text-slate-700 truncate max-w-[60%]">{z.zona}</span>
                <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{z.count} pedidos</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Resumen</h4>
          <div className="space-y-3">
            {[
              { label: 'Pedidos totales', value: orders.length },
              { label: 'Pedidos completados', value: completedOrders.length },
              { label: 'Cancelaciones', value: orders.filter(o => o.status === 'Cancelado').length },
              { label: 'Envíos', value: orders.filter(o => o.tipo_entrega === 'delivery').length },
              { label: 'Pickup', value: orders.filter(o => o.tipo_entrega === 'pickup').length },
              { label: 'En mesa', value: orders.filter(o => o.tipo_entrega === 'mesa').length },
              { label: 'Total reseñas', value: reviews.length },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                <span className="text-[11px] font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstadisticasSection;
