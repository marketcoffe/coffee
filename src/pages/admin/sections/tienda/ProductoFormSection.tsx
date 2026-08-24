import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import { FoodItem, FoodOptionGroup, FoodOption, PizzaSize } from '../../../../types/store';
import { uploadImage } from '../../../../store/supabaseClient';
import {
  Save, X, Plus, Trash2, Image as ImageIcon, GripVertical, Package,
  Tag, Palette, List, Link2, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Upload
} from 'lucide-react';
import { toArray } from '../../../../utils/categoryUtils';

interface ProductoFormSectionProps {
  product: FoodItem | null;
  onSave: (product: Partial<FoodItem>) => Promise<void>;
  onClose: () => void;
}

const ALLERGEN_OPTIONS = [
  'Gluten', 'Lácteos', 'Frutos secos', 'Mariscos', 'Soja', 'Huevos',
  'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Cacahuetes', 'Moluscos', 'Crustáceos', 'Altramuces'
];

const ProductoFormSection: React.FC<ProductoFormSectionProps> = ({ product, onSave, onClose }) => {
  const { config, foodItems } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';
  const isEditing = !!product;

  // ── Form State ──
  const [nombre, setNombre] = useState(product?.nombre || '');
  const [descripcionCorta, setDescripcionCorta] = useState(product?.descripcion || '');
  const [descripcionCompleta, setDescripcionCompleta] = useState((product as any)?.descripcion_completa || '');
  const [categoria, setCategoria] = useState<string[]>(toArray(product?.categoria));

  const [precioUsd, setPrecioUsd] = useState(product?.precio_usd || 0);
  const [precioAnterior, setPrecioAnterior] = useState(product?.precio_anterior_usd || 0);
  const [stock, setStock] = useState(product?.stock || 0);
  const [activo, setActivo] = useState(product?.activo !== false);
  const [disponibilidad, setDisponibilidad] = useState<'Disponible' | 'Agotado' | 'En Reposición'>(product?.disponibilidad || 'Disponible');
  const [esNuevo, setEsNuevo] = useState(product?.es_nuevo || false);
  const [esPromo, setEsPromo] = useState(product?.es_promo || false);
  const [esMasVendido, setEsMasVendido] = useState(product?.es_mas_vendido || false);
  const [deliveryGratis, setDeliveryGratis] = useState(product?.delivery_gratis || false);
  const [imagenUrls, setImagenUrls] = useState<string[]>(product?.imagen_urls?.length ? product.imagen_urls : ['']);
  const [sizes, setSizes] = useState<PizzaSize[]>(product?.sizes || []);
  const [optionGroups, setOptionGroups] = useState<FoodOptionGroup[]>(product?.option_groups || []);
  const [relatedIds, setRelatedIds] = useState<string[]>(product?.related_ids || []);
  const [comboIds, setComboIds] = useState<string[]>(product?.combo_ids || []);
  const [alergenos, setAlergenos] = useState<string[]>(product?.alergenos || []);
  const [ingredientes, setIngredientes] = useState<string[]>(product?.ingredientes || []);
  const [calorias, setCalorias] = useState(product?.calorias || 0);
  const [tiempoPreparacion, setTiempoPreparacion] = useState(product?.estimated_prep_time || 0);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    info: true, estado: true, imagenes: false, variaciones: false,
    extras: false, recomendados: false, combos: false, adicional: false, stock: false
  });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const categories = config.categories || [];


  // ── Image Management ──
  const handleImageUpload = async (index: number, file: File) => {
    setUploadingImage(index);
    try {
      console.log('[Upload] Inicio:', file.name, file.type, file.size, 'bytes');
      const url = await uploadImage(file, 'productos', 'products', { maxWidth: 800 });
      console.log('[Upload] OK:', url);
      const newUrls = [...imagenUrls];
      newUrls[index] = url;
      setImagenUrls(newUrls.filter(u => u));
      showToast('success', 'Imagen subida correctamente');
    } catch (err: any) {
      console.error('[Upload] Error completo:', err);
      showToast('error', 'Error al subir imagen: ' + (err?.message || err?.error?.message || JSON.stringify(err)));
    } finally {
      setUploadingImage(null);
    }
  };

  const addImageSlot = () => setImagenUrls([...imagenUrls, '']);
  const removeImageSlot = (index: number) => setImagenUrls(imagenUrls.filter((_, i) => i !== index));

  // ── Size Management ──
  const addSize = () => setSizes([...sizes, { id: `sz-${crypto.randomUUID()}`, name: '', price_usd: 0, description: '' }]);
  const updateSize = (index: number, field: keyof PizzaSize, value: any) => {
    const newSizes = [...sizes];
    newSizes[index] = { ...newSizes[index], [field]: value };
    setSizes(newSizes);
  };
  const removeSize = (index: number) => setSizes(sizes.filter((_, i) => i !== index));

  // ── Option Groups Management ──
  const addOptionGroup = () => {
    setOptionGroups([...optionGroups, {
      id: `og-${crypto.randomUUID()}`, nombre: '', min_select: 0, max_select: 1, options: []
    }]);
  };
  const updateOptionGroup = (index: number, field: keyof FoodOptionGroup, value: any) => {
    const newGroups = [...optionGroups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setOptionGroups(newGroups);
  };
  const removeOptionGroup = (index: number) => setOptionGroups(optionGroups.filter((_, i) => i !== index));

  const addOptionToGroup = (groupIndex: number) => {
    const newGroups = [...optionGroups];
    newGroups[groupIndex].options = [...newGroups[groupIndex].options, {
      id: `opt-${crypto.randomUUID()}`, nombre: '', precio_usd: 0, activo: true
    }];
    setOptionGroups(newGroups);
  };
  const updateOption = (groupIndex: number, optIndex: number, field: keyof FoodOption, value: any) => {
    const newGroups = [...optionGroups];
    newGroups[groupIndex].options[optIndex] = { ...newGroups[groupIndex].options[optIndex], [field]: value };
    setOptionGroups(newGroups);
  };
  const removeOption = (groupIndex: number, optIndex: number) => {
    const newGroups = [...optionGroups];
    newGroups[groupIndex].options = newGroups[groupIndex].options.filter((_, i) => i !== optIndex);
    setOptionGroups(newGroups);
  };

  // ── Tags ──
  const addTag = (field: 'ingredientes' | 'alergenos', value: string) => {
    const setter = field === 'ingredientes' ? setIngredientes : setAlergenos;
    const current = field === 'ingredientes' ? ingredientes : alergenos;
    if (value.trim() && !current.includes(value.trim())) {
      setter([...current, value.trim()]);
    }
  };
  const removeTag = (field: 'ingredientes' | 'alergenos', index: number) => {
    if (field === 'ingredientes') setIngredientes(ingredientes.filter((_, i) => i !== index));
    else setAlergenos(alergenos.filter((_, i) => i !== index));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!nombre.trim()) { showToast('error', 'El nombre es obligatorio'); return; }
    if (!categoria.length) { showToast('error', 'Seleccioná al menos una categoría'); return; }
    if (precioUsd <= 0) { showToast('error', 'El precio debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      const productData: Partial<FoodItem> = {
        nombre: nombre.trim(),
        descripcion: descripcionCorta.trim(),
        categoria: categoria,

        precio_usd: precioUsd,
        precio_anterior_usd: esPromo && precioAnterior > 0 ? precioAnterior : undefined,
        stock,
        activo,
        disponibilidad,
        es_nuevo: esNuevo,
        es_promo: esPromo,
        es_mas_vendido: esMasVendido,
        delivery_gratis: deliveryGratis,
        imagen_urls: imagenUrls.filter(u => u),
        sizes: sizes.length > 0 ? sizes : undefined,
        option_groups: optionGroups.length > 0 ? optionGroups : undefined,
        related_ids: relatedIds.length > 0 ? relatedIds : undefined,
        combo_ids: comboIds.length > 0 ? comboIds : undefined,
        alergenos: alergenos.length > 0 ? alergenos : undefined,
        ingredientes: ingredientes.length > 0 ? ingredientes : undefined,
        calorias: calorias > 0 ? calorias : undefined,
        estimated_prep_time: tiempoPreparacion > 0 ? tiempoPreparacion : undefined,
      };

      if (isEditing && product) {
        await onSave({ ...productData, id: product.id });
        showToast('success', 'Producto actualizado correctamente');
      } else {
        await onSave(productData);
        showToast('success', 'Producto creado correctamente');
      }
      onClose();
    } catch (err) {
      showToast('error', 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader = ({ title, sectionKey, icon }: { title: string; sectionKey: string; icon: React.ReactNode }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-slate-700">{title}</span>
      </div>
      {expandedSections[sectionKey] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
    </button>
  );

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ios-text)' }}>
          {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Section 1: Info Básica */}
        <SectionHeader title="Información Básica" sectionKey="info" icon={<Package size={16} className="text-slate-500" />} />
        {expandedSections.info && (
          <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-100">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Nombre del producto" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción Corta</label>
              <input value={descripcionCorta} onChange={(e) => setDescripcionCorta(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Descripción breve" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción Completa</label>
              <textarea value={descripcionCompleta} onChange={(e) => setDescripcionCompleta(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 resize-none" placeholder="Descripción detallada del producto" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Categorías *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {categories.map((c: string) => (
                  <label key={c} className={`text-xs px-2 py-1 rounded-lg border cursor-pointer transition-all ${categoria.includes(c) ? 'border-current font-bold' : 'border-slate-200 hover:border-slate-300'}`}
                    style={categoria.includes(c) ? { backgroundColor: themeColor + '15', color: themeColor, borderColor: themeColor } : {}}>
                    <input type="checkbox" className="hidden" checked={categoria.includes(c)}
                      onChange={() => setCategoria(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Precio USD *</label>
                <input type="number" step="0.01" min="0" value={precioUsd} onChange={(e) => setPrecioUsd(parseFloat(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Precio Anterior USD</label>
                <input type="number" step="0.01" min="0" value={precioAnterior} onChange={(e) => setPrecioAnterior(parseFloat(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Estado y Etiquetas */}
        <SectionHeader title="Estado y Etiquetas" sectionKey="estado" icon={<Tag size={16} className="text-slate-500" />} />
        {expandedSections.estado && (
          <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Activo (visible en tienda)</span>
              <button onClick={() => setActivo(!activo)} className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${activo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Disponibilidad</label>
              <div className="flex gap-2 mt-1">
                {(['Disponible', 'Agotado', 'En Reposición'] as const).map(d => (
                  <button key={d} onClick={() => setDisponibilidad(d)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${disponibilidad === d ? 'text-white' : 'bg-slate-100 text-slate-600'}`} style={disponibilidad === d ? { backgroundColor: themeColor } : {}}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nuevo', value: esNuevo, setter: setEsNuevo, color: 'emerald' },
                { label: 'En Oferta', value: esPromo, setter: setEsPromo, color: 'violet' },
                { label: 'Más Vendido', value: esMasVendido, setter: setEsMasVendido, color: 'amber' },
                { label: 'Envío Gratis', value: deliveryGratis, setter: setDeliveryGratis, color: 'cyan' },
              ].map(tag => (
                <button key={tag.label} onClick={() => tag.setter(!tag.value)} className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${tag.value ? `bg-${tag.color}-100 text-${tag.color}-600 border-${tag.color}-200` : 'bg-slate-50 text-slate-500 border-slate-200'} border`}>
                  <div className={`w-3 h-3 rounded border-2 flex items-center justify-center ${tag.value ? `border-${tag.color}-500 bg-${tag.color}-500` : 'border-slate-300'}`}>
                    {tag.value && <span className="text-white text-[8px]">✓</span>}
                  </div>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Imágenes */}
        <SectionHeader title="Imágenes" sectionKey="imagenes" icon={<ImageIcon size={16} className="text-slate-500" />} />
        {expandedSections.imagenes && (
          <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-100">
            {imagenUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                  {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={16} /></div>}
                </div>
                <input value={url} onChange={(e) => { const newUrls = [...imagenUrls]; newUrls[index] = e.target.value; setImagenUrls(newUrls); }} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="URL de imagen" />
                <label className="p-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200">
                  <Upload size={12} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(index, e.target.files[0]); }} />
                </label>
                {imagenUrls.length > 1 && (
                  <button onClick={() => removeImageSlot(index)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                )}
              </div>
            ))}
            <button onClick={addImageSlot} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"><Plus size={12} /> Agregar imagen</button>
          </div>
        )}

        {/* Section 4: Variaciones (Tamaños) */}
        <SectionHeader title="Variaciones / Tamaños" sectionKey="variaciones" icon={<List size={16} className="text-slate-500" />} />
        {expandedSections.variaciones && (
          <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-100">
            {sizes.map((size, index) => (
              <div key={size.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <input value={size.name} onChange={(e) => updateSize(index, 'name', e.target.value)} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Nombre (ej: Mediana)" />
                <input type="number" step="0.01" min="0" value={size.price_usd} onChange={(e) => updateSize(index, 'price_usd', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Precio" />
                <button onClick={() => removeSize(index)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
              </div>
            ))}
            <button onClick={addSize} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"><Plus size={12} /> Agregar variación</button>
          </div>
        )}

        {/* Section 5: Extras / Opciones */}
        <SectionHeader title="Extras / Opciones" sectionKey="extras" icon={<Palette size={16} className="text-slate-500" />} />
        {expandedSections.extras && (
          <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-100">
            {optionGroups.map((group, gIdx) => (
              <div key={group.id} className="p-2 bg-slate-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input value={group.nombre} onChange={(e) => updateOptionGroup(gIdx, 'nombre', e.target.value)} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold" placeholder="Nombre del grupo (ej: Toppings)" />
                  <input type="number" min="0" value={group.min_select} onChange={(e) => updateOptionGroup(gIdx, 'min_select', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center" title="Mín" />
                  <input type="number" min="1" value={group.max_select} onChange={(e) => updateOptionGroup(gIdx, 'max_select', parseInt(e.target.value) || 1)} className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center" title="Máx" />
                  <button onClick={() => removeOptionGroup(gIdx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                </div>
                {group.options.map((opt, oIdx) => (
                  <div key={opt.id} className="flex items-center gap-2 ml-4">
                    <input value={opt.nombre} onChange={(e) => updateOption(gIdx, oIdx, 'nombre', e.target.value)} className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-xs" placeholder="Opción" />
                    <input type="number" step="0.01" min="0" value={opt.precio_usd} onChange={(e) => updateOption(gIdx, oIdx, 'precio_usd', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs" placeholder="+$0" />
                    <button onClick={() => removeOption(gIdx, oIdx)} className="p-1 text-red-400 hover:bg-red-50 rounded cursor-pointer"><X size={10} /></button>
                  </div>
                ))}
                <button onClick={() => addOptionToGroup(gIdx)} className="ml-4 text-[10px] font-semibold text-slate-500 cursor-pointer"><Plus size={10} className="inline" /> Agregar opción</button>
              </div>
            ))}
            <button onClick={addOptionGroup} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"><Plus size={12} /> Agregar grupo de opciones</button>
          </div>
        )}

        {/* Section 6: Recomendados */}
        <SectionHeader title="Productos Recomendados" sectionKey="recomendados" icon={<Link2 size={16} className="text-slate-500" />} />
        {expandedSections.recomendados && (
          <div className="p-3 bg-white rounded-xl border border-slate-100">
            <p className="text-[10px] text-slate-400 mb-2">Selecciona productos que se mostrarán como "También te puede gustar"</p>
            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {foodItems.filter(p => p.id !== product?.id && p.activo !== false).map(p => (
                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${relatedIds.includes(p.id) ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={relatedIds.includes(p.id)} onChange={() => setRelatedIds(relatedIds.includes(p.id) ? relatedIds.filter(id => id !== p.id) : [...relatedIds, p.id])} className="rounded" />
                  <span className="truncate">{p.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Section 7: Combos */}
        <SectionHeader title="Combos" sectionKey="combos" icon={<Package size={16} className="text-slate-500" />} />
        {expandedSections.combos && (
          <div className="p-3 bg-white rounded-xl border border-slate-100">
            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {(config.combos || []).map((combo: any) => (
                <label key={combo.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${comboIds.includes(combo.id) ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={comboIds.includes(combo.id)} onChange={() => setComboIds(comboIds.includes(combo.id) ? comboIds.filter(id => id !== combo.id) : [...comboIds, combo.id])} className="rounded" />
                  <span className="truncate">{combo.nombre} (-{combo.discount_percent}%)</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Section 8: Info Adicional */}
        <SectionHeader title="Información Adicional" sectionKey="adicional" icon={<Clock size={16} className="text-slate-500" />} />
        {expandedSections.adicional && (
          <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tiempo Prep. (min)</label>
                <input type="number" min="0" value={tiempoPreparacion} onChange={(e) => setTiempoPreparacion(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Calorías</label>
                <input type="number" min="0" value={calorias} onChange={(e) => setCalorias(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ingredientes</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ingredientes.map((ing, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-[10px] font-semibold">
                    {ing} <button onClick={() => removeTag('ingredientes', i)} className="text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
                  </span>
                ))}
                <input
                  onKeyDown={(e) => { if (e.key === 'Enter') { addTag('ingredientes', (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                  className="px-2 py-1 text-[10px] border border-dashed border-slate-300 rounded-full w-20 focus:outline-none"
                  placeholder="+ Agregar"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Alérgenos</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ALLERGEN_OPTIONS.map(a => (
                  <button key={a} onClick={() => alergenos.includes(a) ? removeTag('alergenos', alergenos.indexOf(a)) : addTag('alergenos', a)} className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${alergenos.includes(a) ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 9: Stock */}
        <SectionHeader title="Stock / Inventario" sectionKey="stock" icon={<AlertTriangle size={16} className="text-slate-500" />} />
        {expandedSections.stock && (
          <div className="p-3 bg-white rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad en Stock</label>
                <input type="number" min="0" value={stock} onChange={(e) => setStock(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div className={`mt-5 px-3 py-1.5 rounded-lg text-xs font-bold ${stock === 0 ? 'bg-red-100 text-red-600' : stock <= 5 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {stock === 0 ? 'AGOTADO' : stock <= 5 ? 'BAJO STOCK' : 'OK'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer">Cancelar</button>
        <button onClick={handleSubmit} disabled={saving} className="px-6 py-2 text-sm font-bold text-white rounded-xl cursor-pointer disabled:opacity-50" style={{ backgroundColor: themeColor }}>
          {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Producto'}
        </button>
      </div>
    </div>
  );
};

export default ProductoFormSection;
