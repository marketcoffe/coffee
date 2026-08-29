import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../store/AppContext';
import { supabase } from '../../../../store/supabaseClient';
import { Promotion } from '../../../../types/store';
import { useToast } from '../../../../components/Toast';
import { triggerBroadcastPush } from '../../../../utils/pushTrigger';
import { Megaphone, Plus, Trash2, Edit3, Send, Calendar, Eye, MousePointerClick, ShoppingCart, X, Check } from 'lucide-react';

const PromocionesSection: React.FC = () => {
  const { foodItems, updateFoodItem, config, promotions, setPromotions } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formDiscountValue, setFormDiscountValue] = useState(0);
  const [formSchedule, setFormSchedule] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadPromotions(); }, []);

  const loadPromotions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('[Promos] Error loading promotions:', error.message);
        setError(error.message);
      } else {
        setPromotions((data || []) as Promotion[]);
      }
    } catch (err: any) {
      console.error('[Promos] Load exception:', err);
      setError(err?.message || 'Error al cargar promociones');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle(''); setFormMessage(''); setFormImage(''); setFormDiscountValue(0);
    setFormSchedule(''); setEditing(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formMessage.trim()) return;
    const payload = {
      title: formTitle.trim(),
      message: formMessage.trim(),
      image_url: formImage,
      discount_type: 'percent' as const,
      discount_value: formDiscountValue,
      start_date: formSchedule || new Date().toISOString(),
      end_date: formSchedule || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      audience: 'all' as const,
      channel: 'in_app' as const,
      status: 'draft' as const,
      scheduled_at: formSchedule || undefined,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      current_uses: 0,
    };

    if (editing) {
      const { data } = await supabase.from('promotions').update(payload).eq('id', editing.id).select().single();
      if (data) setPromotions(prev => prev.map(p => p.id === editing.id ? data as Promotion : p));
    } else {
      const { data } = await supabase.from('promotions').insert([payload]).select().single();
      if (data) setPromotions(prev => [data as Promotion, ...prev]);
    }
    resetForm();
  };

  const confirmDelete = async (id: string) => {
    await supabase.from('promotions').delete().eq('id', id);
    setPromotions(prev => prev.filter(p => p.id !== id));
    setDeleteConfirm(null);
  };

  const handleSend = async (promo: Promotion) => {
    try {
      await supabase.from('promotions').update({ status: 'active', sent_at: new Date().toISOString() }).eq('id', promo.id);
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, status: 'active' as const, sent_at: new Date().toISOString() } : p));

      const { error } = await supabase.rpc('send_broadcast_promotion', {
        p_title: promo.title,
        p_message: promo.message,
        p_audience: 'all',
        p_target_value: '',
        p_image_url: promo.image_url || null,
        p_link_url: null,
        p_priority: 'normal',
      });

      if (error) {
        console.error('[Promos] RPC send_broadcast_promotion error:', error.message);
        showToast('error', 'Promocion marcada pero push falló: ' + error.message);
      } else {
        showToast('success', 'Promocion enviada correctamente');

        // Trigger push via webhook
        const pushId = 'promo-push-' + Date.now();
        triggerBroadcastPush({
          id: pushId,
          titulo: promo.title,
          mensaje: promo.message,
          tipo: 'todos',
          imagen_url: promo.image_url || '',
          link_url: '',
        });
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error al enviar promocion');
    }
  };

  const togglePromoProduct = (productId: string) => {
    const product = foodItems.find(p => p.id === productId);
    if (product) updateFoodItem(productId, { es_promo: !product.es_promo });
  };

  const startEdit = (p: Promotion) => {
    setEditing(p);
    setFormTitle(p.title); setFormMessage(p.message); setFormImage(p.image_url || '');
    setFormDiscountValue(p.discount_value || 0);
    setFormSchedule(p.scheduled_at || ''); setShowForm(true);
  };

  const promoProducts = foodItems.filter(p => p.es_promo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={18} style={{ color: themeColor }} />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Promociones</h3>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{promotions.length}</span>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white rounded-lg transition-colors" style={{ background: themeColor }}>
          <Plus size={12} /> Nueva
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Cargando...</p>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-2xl mb-2">⚠️</span>
          <p className="text-xs text-red-500 mb-2">{error}</p>
          <button onClick={loadPromotions} className="px-3 py-1.5 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs">No hay promociones creadas</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {promotions.map(promo => (
            <div key={promo.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-900 truncate">{promo.title}</h5>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{promo.message}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                  promo.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  promo.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{promo.status}</span>
              </div>
              {promo.discount_value ? <span className="text-[9px] font-bold" style={{ color: themeColor }}>-{promo.discount_value}%</span> : null}
              <div className="flex items-center gap-3 text-[9px] text-slate-400 font-mono">
                <span className="flex items-center gap-0.5"><Eye size={9} /> {promo.impressions || 0}</span>
                <span className="flex items-center gap-0.5"><MousePointerClick size={9} /> {promo.clicks || 0}</span>
                <span className="flex items-center gap-0.5"><ShoppingCart size={9} /> {promo.conversions || 0}</span>
              </div>
              {promo.scheduled_at && (
                <p className="text-[9px] text-slate-400 flex items-center gap-1"><Calendar size={9} /> Programada: {new Date(promo.scheduled_at).toLocaleString()}</p>
              )}
              <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                <button onClick={() => startEdit(promo)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100">
                  <Edit3 size={10} /> Editar
                </button>
                <button onClick={() => handleSend(promo)} disabled={promo.status === 'active'}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-white rounded-lg disabled:opacity-50"
                  style={{ background: themeColor }}>
                  <Send size={10} /> Enviar
                </button>
                <button onClick={() => setDeleteConfirm(promo.id)} className="py-1.5 px-2 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promo Product Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Productos en Promo ({promoProducts.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
          {foodItems.map(p => (
            <button key={p.id} onClick={() => togglePromoProduct(p.id)}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${p.es_promo ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
              <img src={p.imagen_urls[0]} className="w-8 h-8 rounded-lg object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-800 truncate">{p.nombre}</p>
                <p className="text-[9px] text-slate-500 font-mono">${p.precio_usd}</p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${p.es_promo ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
                {p.es_promo ? <Check size={10} /> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <h4 className="font-bold text-slate-800 text-xs">Eliminar esta promoción?</h4>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg">Cancelar</button>
              <button onClick={() => confirmDelete(deleteConfirm)} className="flex-1 py-2 text-[10px] font-bold bg-red-500 text-white rounded-lg">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase">{editing ? 'Editar' : 'Nueva'} Promocion</h4>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Titulo</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titulo..."
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mensaje</label>
                <textarea value={formMessage} onChange={e => setFormMessage(e.target.value)} placeholder="Descripcion..."
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs outline-none min-h-[80px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">% Descuento</label>
                  <input type="number" value={formDiscountValue} onChange={e => setFormDiscountValue(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Programar</label>
                  <input type="datetime-local" value={formSchedule} onChange={e => setFormSchedule(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL Imagen</label>
                <input type="text" value={formImage} onChange={e => setFormImage(e.target.value)} placeholder="https://..."
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
              </div>
              <button onClick={handleSave} disabled={!formTitle.trim() || !formMessage.trim()}
                className="w-full py-2.5 text-white font-bold text-xs rounded-xl disabled:opacity-50" style={{ background: themeColor }}>
                {editing ? 'Guardar Cambios' : 'Crear Promocion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromocionesSection;
