import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import { Package, Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { ProductCombo } from '../../../../types/store';
import { categoryIncludes, formatCategories } from '../../../../utils/categoryUtils';

const CombosSection: React.FC = () => {
  const { foodItems, config, updateConfig } = useApp();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ProductCombo | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const combos = config.combos || [];

  const filteredProducts = foodItems.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    categoryIncludes(p, searchTerm)
  );

  const startEdit = (combo?: ProductCombo) => {
    if (combo) {
      setEditingCombo(combo);
      setNombre(combo.nombre);
      setDescripcion(combo.descripcion);
      setDiscountPercent(combo.discount_percent);
      setSelectedProductIds(combo.product_ids);
    } else {
      setEditingCombo(null);
      setNombre('');
      setDescripcion('');
      setDiscountPercent(10);
      setSelectedProductIds([]);
    }
    setIsEditing(true);
  };

  const saveCombo = () => {
    if (!nombre.trim() || selectedProductIds.length < 2) {
      showToast('error', 'El nombre es requerido y debes seleccionar al menos 2 productos.');
      return;
    }

    const newCombo: ProductCombo = {
      id: editingCombo?.id || `combo-${crypto.randomUUID()}`,
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      product_ids: selectedProductIds,
      discount_percent: discountPercent,
      active: true,
    };

    let updatedCombos: ProductCombo[];
    if (editingCombo) {
      updatedCombos = combos.map(c => c.id === editingCombo.id ? newCombo : c);
    } else {
      updatedCombos = [...combos, newCombo];
    }

    updateConfig({ combos: updatedCombos });
    setIsEditing(false);
    setEditingCombo(null);
  };

  const deleteCombo = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDeleteCombo = (id: string) => {
    const updatedCombos = combos.filter(c => c.id !== id);
    updateConfig({ combos: updatedCombos });
    setDeleteConfirm(null);
  };

  const toggleComboActive = (id: string) => {
    const updatedCombos = combos.map(c =>
      c.id === id ? { ...c, active: !c.active } : c
    );
    updateConfig({ combos: updatedCombos });
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Combo *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Combo Hamburguesa"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Incluye refresco y papas"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Descuento (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="flex-1 accent-violet-600"
                />
                <span className="text-sm font-bold text-violet-600 w-12 text-right">{discountPercent}%</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Seleccionar Productos * ({selectedProductIds.length} seleccionados)
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-violet-500"
              />
              <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleProductSelection(p.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left border-b border-slate-100 last:border-0 transition-all ${
                      selectedProductIds.includes(p.id) ? 'bg-violet-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <img src={p.imagen_urls[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.nombre}</p>
                      <p className="text-[10px] text-slate-500">{formatCategories(p)} · ${p.precio_usd.toFixed(2)}</p>
                    </div>
                    {selectedProductIds.includes(p.id) && (
                      <Check size={16} className="text-violet-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selectedProductIds.length >= 2 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Vista Previa</p>
                <div className="flex items-center gap-2">
                  {selectedProductIds.slice(0, 3).map(id => {
                    const p = foodItems.find(item => item.id === id);
                    return p ? (
                      <img key={id} src={p.imagen_urls[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : null;
                  })}
                  {selectedProductIds.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{selectedProductIds.length - 3}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-800 mt-2">{nombre || 'Nombre del combo'}</p>
                <p className="text-[10px] text-slate-500">{descripcion || 'Descripción'}</p>
                <span className="text-xs font-black text-emerald-600">-{discountPercent}% OFF</span>
              </div>
            )}

            <button
              onClick={saveCombo}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
            >
              {editingCombo ? 'Guardar Cambios' : 'Crear Combo'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase">Gestión de Combos</h3>
          </div>
          <button
            onClick={() => startEdit()}
            className="px-3 py-1.5 text-[10px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> Nuevo Combo
          </button>
        </div>

        {combos.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-xs text-slate-500">No hay combos creados</p>
            <p className="text-[10px] text-slate-400 mt-1">Crea combos para ofrecer descuentos especiales</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {combos.map((combo) => {
              const comboProducts = combo.product_ids
                .map(id => foodItems.find(p => p.id === id))
                .filter(Boolean);

              return (
                <div
                  key={combo.id}
                  className={`p-4 rounded-xl border transition-all ${
                    combo.active ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{combo.nombre}</h4>
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          -{combo.discount_percent}%
                        </span>
                        {!combo.active && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {combo.descripcion && (
                        <p className="text-xs text-slate-500 mt-1">{combo.descripcion}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        {comboProducts.slice(0, 4).map((p) => p && (
                          <img key={p.id} src={p.imagen_urls[0]} alt="" className="w-8 h-8 rounded-lg object-cover border border-white" />
                        ))}
                        {comboProducts.length > 4 && (
                          <span className="text-[10px] text-slate-500 ml-1">+{comboProducts.length - 4}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-3">
                      <button
                        onClick={() => toggleComboActive(combo.id)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          combo.active ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'
                        }`}
                        title={combo.active ? 'Desactivar' : 'Activar'}
                      >
                        {combo.active ? <X size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => startEdit(combo)}
                        className="p-1.5 rounded-md hover:bg-violet-50 text-violet-600 transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                      {deleteConfirm === combo.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => confirmDeleteCombo(combo.id)}
                            className="p-1.5 rounded-md bg-red-500 text-white transition-colors cursor-pointer"
                            title="Confirmar"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-1.5 rounded-md bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => deleteCombo(combo.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CombosSection;
