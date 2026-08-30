import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Ticket, Trash2, Plus, Edit2, X, Check } from 'lucide-react';
import { useToast } from '../../../../components/Toast';
import type { Coupon } from '../../../../types/store';

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

  // Edición
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAmount, setEditAmount] = useState(0);
  const [editMinPurchase, setEditMinPurchase] = useState(0);
  const [editLimit, setEditLimit] = useState<number | ''>('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const startEdit = (coupon: Coupon) => {
    console.log('[Cupones] startEdit', { id: coupon.id, code: coupon.code, type: coupon.coupon_type });
    setEditingCoupon(coupon);
    setEditCode(coupon.code);
    setEditType(coupon.coupon_type || 'percentage');
    setEditDiscount(coupon.discount_percent || 0);
    setEditAmount(coupon.discount_amount || 0);
    setEditMinPurchase(coupon.min_purchase || 0);
    setEditLimit(coupon.usage_limit ?? '');
    setEditValidUntil(coupon.valid_until || '');
    setEditDescription(coupon.description || '');
  };

  const saveEdit = () => {
    if (!editingCoupon) return;
    if (!editCode.trim()) return showToast('error', 'El código es obligatorio');
    console.log('[Cupones] saveEdit — updateCoupon', { id: editingCoupon.id, code: editCode, type: editType, discount: editDiscount, amount: editAmount });
    updateCoupon(editingCoupon.id, {
      code: editCode.toUpperCase().trim(),
      coupon_type: editType,
      discount_percent: editType === 'percentage' ? editDiscount : 0,
      discount_amount: editType === 'fixed' ? editAmount : 0,
      min_purchase: editMinPurchase || undefined,
      usage_limit: editLimit === '' ? undefined : editLimit || undefined,
      valid_until: editValidUntil || undefined,
      description: editDescription,
    });
    setEditingCoupon(null);
    showToast('success', 'Cupón actualizado');
  };

  const resetForm = () => {
    setNewCouponCode('');
    setNewCouponDescription('');
    setNewCouponMinPurchase(0);
    setNewCouponValidUntil('');
    setNewCouponAmount(0);
    setNewCouponDiscount(10);
    setNewCouponLimit('');
    setNewCouponType('percentage');
  };

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
            resetForm();
            showToast('success', 'Cupón creado');
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
            {editingCoupon?.id === coupon.id ? (
              /* ─── MODO EDICIÓN ─── */
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Editando</span>
                  <button onClick={() => setEditingCoupon(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
                </div>
                <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="Código" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold" />
                <select value={editType} onChange={(e) => setEditType(e.target.value as 'percentage' | 'fixed' | 'free_shipping')}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs">
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo ($)</option>
                  <option value="free_shipping">Envío Gratis</option>
                </select>
                {editType === 'percentage' && (
                  <input type="number" value={editDiscount} onChange={(e) => setEditDiscount(Number(e.target.value))}
                    placeholder="% Descuento" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                )}
                {editType === 'fixed' && (
                  <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))}
                    placeholder="Monto $" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                )}
                <input type="number" step="0.01" value={editMinPurchase || ''} onChange={(e) => setEditMinPurchase(Number(e.target.value))}
                  placeholder="Compra mínima $" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                <input type="number" value={editLimit} onChange={(e) => setEditLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Límite usos (∞)" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción" className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                <div className="flex gap-2 mt-1">
                  <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer"
                    style={{ backgroundColor: '#10b981' }}><Check size={12} /> Guardar</button>
                  <button onClick={() => setEditingCoupon(null)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer">
                    Cancelar</button>
                </div>
              </div>
            ) : (
              /* ─── MODO VISUALIZACIÓN ─── */
              <>
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(coupon)} className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer" title="Editar"><Edit2 size={14} /></button>
                    <button onClick={() => deleteCoupon(coupon.id)} className="text-red-500 hover:text-red-700 transition-colors cursor-pointer" title="Eliminar"><Trash2 size={14}/></button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CuponesSection;
