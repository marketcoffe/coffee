import React, { useMemo } from 'react';
import { useApp } from '../../../../store/AppContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { AlertTriangle, XCircle, DollarSign, Tag } from 'lucide-react';
import { getCategories } from '../../../../utils/categoryUtils';

const ProductosReportSection: React.FC = () => {
  const { orders, foodItems, config } = useApp();

  const productSalesMap = useMemo(() => {
    const map: { [id: string]: { nombre: string; unidades: number } } = {};
    orders.forEach(o => {
      o.items.forEach(it => {
        if (!map[it.food_id]) map[it.food_id] = { nombre: it.nombre, unidades: 0 };
        map[it.food_id].unidades += it.cantidad || 0;
      });
    });
    return map;
  }, [orders]);

  const topProductsData = useMemo(() => {
    return Object.values(productSalesMap)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10)
      .map(p => ({ name: p.nombre.substring(0, 12), Unidades: p.unidades }));
  }, [productSalesMap]);

  const lowStockProducts = useMemo(() =>
    foodItems.filter(p => p.stock > 0 && p.stock <= 5).sort((a, b) => a.stock - b.stock)
  , [foodItems]);

  const outOfStockProducts = useMemo(() =>
    foodItems.filter(p => p.stock <= 0)
  , [foodItems]);

  const totalInventoryValue = useMemo(() =>
    foodItems.reduce((sum, p) => sum + (p.precio_usd || 0) * (p.stock || 0), 0)
  , [foodItems]);

  const productsByCategory = useMemo(() => {
    const map: { [cat: string]: number } = {};
    foodItems.forEach(p => {
      const cats = getCategories(p);
      if (cats.length === 0) {
        map['Sin categoría'] = (map['Sin categoría'] || 0) + 1;
      } else {
        cats.forEach(cat => {
          map[cat] = (map[cat] || 0) + 1;
        });
      }
    });
    return Object.entries(map)
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => b.count - a.count);
  }, [foodItems]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Total Productos</span>
            <Tag size={14} className="text-violet-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">{foodItems.length}</p>
        </div>
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Inventario Total</span>
            <DollarSign size={14} className="text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">${totalInventoryValue.toFixed(2)}</p>
        </div>
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Stock Bajo (≤5)</span>
            <AlertTriangle size={14} className="text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">{lowStockProducts.length}</p>
        </div>
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Agotados</span>
            <XCircle size={14} className="text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">{outOfStockProducts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Top 10 Productos Más Vendidos</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProductsData} layout="vertical">
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" width={80} stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="Unidades" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-4 border border-amber-200 rounded-lg bg-amber-50 shadow-sm">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle size={14} /> Stock Bajo (≤5 unidades)
            </h4>
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-amber-600">Todos los productos tienen stock suficiente</p>
            ) : (
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {lowStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-1 border-b border-amber-100 last:border-0">
                    <span className="text-[11px] font-medium text-slate-700 truncate">{p.nombre}</span>
                    <span className="text-[11px] font-bold text-amber-700 ml-2 shrink-0">{p.stock} uds</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border border-red-200 rounded-lg bg-red-50 shadow-sm">
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <XCircle size={14} /> Agotados
            </h4>
            {outOfStockProducts.length === 0 ? (
              <p className="text-xs text-red-600">No hay productos agotados</p>
            ) : (
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {outOfStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-1 border-b border-red-100 last:border-0">
                    <span className="text-[11px] font-medium text-slate-700 truncate">{p.nombre}</span>
                    <span className="text-[11px] font-bold text-red-600 ml-2 shrink-0">Agotado</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Productos por Categoría</h4>
            <div className="space-y-1.5">
              {productsByCategory.map(c => (
                <div key={c.categoria} className="flex justify-between items-center py-1">
                  <span className="text-[11px] font-medium text-slate-600 truncate">{c.categoria}</span>
                  <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductosReportSection;
