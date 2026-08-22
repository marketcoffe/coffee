import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Ticket, Trash2, Plus } from 'lucide-react';
import { useToast } from '../../../../components/Toast';

const CuponesSection: React.FC = () => {
  const { coupons, addCoupon, updateCoupon, deleteCoupon, config } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState(10);
  const [newCouponLimit, setNewCouponLimit] = useState<number | ''>('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [newCouponAmount, setNewCouponAmount] = useState(0);
  const [newCouponMinPurchase, setNewCouponMinPurchase] = useState(0);
  const [newCouponValidUntil, setNewCouponValidUntil] = useState('');
  const [newCouponDescription, setNewCouponDescription] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-4">
        <h4 className="text-xs font-bold font-display text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Ticket size={16} style={{ color: themeColor }} /> Crear Nuevo Cupón
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Código</label>
            <input 
              type="text" 
              value={newCouponCode} 
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="EJ: DESCUENTO10"
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
            <select value={newCouponType} onChange={(e) => setNewCouponType(e.target.value as 'percentage' | 'fixed' | 'free_shipping')}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs">
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Monto Fijo ($)</option>
              <option value="free_shipping">Envío Gratis</option>
            </select>
          </div>
          {newCouponType === 'percentage' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">% Descuento</label>
              <input type="number" value={newCouponDiscount} onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
            </div>
          ) : newCouponType === 'fixed' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Monto ($)</label>
              <input type="number" step="0.01" value={newCouponAmount} onChange={(e) => setNewCouponAmount(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Compra Mínima ($)</label>
            <input type="number" step="0.01" value={newCouponMinPurchase || ''} onChange={(e) => setNewCouponMinPurchase(Number(e.target.value))}
              placeholder="0 = Sin mínimo" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Válido Hasta</label>
            <input type="date" value={newCouponValidUntil} onChange={(e) => setNewCouponValidUntil(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Límite de Usos</label>
            <input type="number" value={newCouponLimit} onChange={(e) => setNewCouponLimit(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="∞" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción (opcional)</label>
            <input type="text" value={newCouponDescription} onChange={(e) => setNewCouponDescription(e.target.value)}
              placeholder="Ej: Descuento de fin de semana" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
          </div>
        </div>
        <button 
          onClick={() => {
            if(!newCouponCode) return showToast('error', 'Indique el código');
            addCoupon({ 
              code: newCouponCode, 
              discount_percent: newCouponType === 'percentage' ? newCouponDiscount : 0,
              active: true, 
              usage_limit: newCouponLimit === '' ? undefined : newCouponLimit,
              description: newCouponDescription,
              min_purchase: newCouponMinPurchase,
              coupon_type: newCouponType,
              discount_amount: newCouponType === 'fixed' ? newCouponAmount : 0,
              valid_until: newCouponValidUntil || undefined,
            });
            setNewCouponCode('');
            setNewCouponDescription('');
            setNewCouponMinPurchase(0);
            setNewCouponValidUntil('');
            setNewCouponAmount(0);
          }}
          className="hover:opacity-90 text-white font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          style={{ backgroundColor: themeColor }}
        >
          <Plus size={14} /> Guardar Cupón
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {coupons.map(coupon => (
          <div key={coupon.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2 relative">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black font-mono" style={{ color: themeColor }}>{coupon.code}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                {coupon.coupon_type === 'free_shipping' ? 'Envío Gratis' : coupon.coupon_type === 'fixed' ? `-$${coupon.discount_amount || 0}` : `-${coupon.discount_percent}%`}
              </span>
            </div>
            {coupon.description && <p className="text-[10px] text-slate-500">{coupon.description}</p>}
            <div className="text-[10px] text-slate-500 font-mono">
              Usos: {coupon.usage_count} / {coupon.usage_limit || '∞'}
              {coupon.min_purchase ? ` · Mín: $${coupon.min_purchase}` : ''}
            </div>
            {coupon.valid_until && (
              <div className="text-[10px] text-slate-400 font-mono">
                Válido hasta: {new Date(coupon.valid_until).toLocaleDateString('es-VE')}
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={coupon.active} onChange={(e) => updateCoupon(coupon.id, { active: e.target.checked })} className="accent-violet-600" />
                <span className="text-[10px] font-bold uppercase text-slate-600">Activo</span>
              </label>
              <button onClick={() => deleteCoupon(coupon.id)} className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CuponesSection;
