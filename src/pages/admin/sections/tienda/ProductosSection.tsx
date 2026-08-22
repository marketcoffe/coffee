import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import { FoodItem } from '../../../../types/store';
import {
  Search, Plus, Eye, Edit3, Trash2, ToggleLeft, ToggleRight,
  Tag, Package, Download, Upload, Mic, MicOff, Grid, List, X, Check
} from 'lucide-react';
import { getCategories, hasCategory, formatCategories } from '../../../../utils/categoryUtils';

type SortBy = 'nombre' | 'precio' | 'stock' | 'order_count';
type FilterStatus = 'todos' | 'activos' | 'inactivos' | 'promo' | 'bajo_stock';

interface ProductosSectionProps {
  onEdit: (product: FoodItem) => void;
  onCreate: () => void;
  config: any;
}

const ProductosSection: React.FC<ProductosSectionProps> = ({ onEdit, onCreate, config }) => {
  const { foodItems, addFoodItem, updateFoodItem, deleteFoodItem, searchItems } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('nombre');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isListening, setIsListening] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'precio_usd' | 'stock' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(foodItems.flatMap(p => getCategories(p)).filter(Boolean));
    return Array.from(cats).sort();
  }, [foodItems]);

  const filteredProducts = useMemo(() => {
    let result = search ? searchItems(search, true) : [...foodItems];

    // Filter by status
    switch (filterStatus) {
      case 'activos': result = result.filter(p => p.activo !== false); break;
      case 'inactivos': result = result.filter(p => p.activo === false); break;
      case 'promo': result = result.filter(p => p.es_promo); break;
      case 'bajo_stock': result = result.filter(p => p.stock <= 5 && p.activo !== false); break;
    }

    // Filter by category
    if (filterCategory) {
      result = result.filter(p => hasCategory(p, filterCategory));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'nombre': return a.nombre.localeCompare(b.nombre);
        case 'precio': return b.precio_usd - a.precio_usd;
        case 'stock': return a.stock - b.stock;
        case 'order_count': return (b.order_count || 0) - (a.order_count || 0);
        default: return 0;
      }
    });

    return result;
  }, [foodItems, search, filterStatus, filterCategory, sortBy, searchItems]);

  const stats = useMemo(() => ({
    total: foodItems.length,
    activos: foodItems.filter(p => p.activo !== false).length,
    inactivos: foodItems.filter(p => p.activo === false).length,
    promo: foodItems.filter(p => p.es_promo).length,
    bajoStock: foodItems.filter(p => p.stock <= 5 && p.activo !== false).length,
    agotados: foodItems.filter(p => p.stock === 0).length,
  }), [foodItems]);

  const toggleActive = (product: FoodItem) => {
    const newStatus = product.activo === false ? true : false;
    updateFoodItem(product.id, { activo: newStatus });
    showToast('success', `${product.nombre} ${newStatus ? 'activado' : 'desactivado'}`);
  };

  const togglePromo = (product: FoodItem) => {
    updateFoodItem(product.id, { es_promo: !product.es_promo });
    showToast('success', `${product.nombre} ${!product.es_promo ? 'marcado como promo' : 'quitado de promo'}`);
  };

  const handleDelete = (product: FoodItem) => {
    deleteFoodItem(product.id);
    setDeleteConfirm(null);
    showToast('success', `${product.nombre} eliminado`);
  };

  const startEdit = (product: FoodItem, field: 'precio_usd' | 'stock') => {
    setEditingCell({ id: product.id, field });
    setEditValue(field === 'precio_usd' ? product.precio_usd.toString() : product.stock.toString());
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const product = foodItems.find(p => p.id === editingCell.id);
    if (!product) return;
    if (editingCell.field === 'precio_usd') {
      const val = parseFloat(editValue);
      if (!isNaN(val) && val >= 0) {
        updateFoodItem(editingCell.id, { precio_usd: val });
        showToast('success', `Precio actualizado: $${val.toFixed(2)}`);
      }
    } else {
      const val = parseInt(editValue, 10);
      if (!isNaN(val) && val >= 0) {
        updateFoodItem(editingCell.id, { stock: val });
        showToast('success', `Stock actualizado: ${val}`);
      }
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('error', 'Busqueda por voz no soportada en este navegador');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-VE';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearch(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
  };

  const exportCSV = () => {
    const headers = ['nombre', 'descripcion', 'categoria', 'precio_usd', 'stock', 'imagen_urls', 'es_promo', 'es_nuevo', 'es_mas_vendido', 'delivery_gratis', 'activo'];
    const rows = filteredProducts.map(p => [
      p.nombre,
      p.descripcion,
      p.categoria.join(', '),
      p.precio_usd,
      p.stock,
      (p.imagen_urls || []).join(';'),
      p.es_promo,
      p.es_nuevo,
      p.es_mas_vendido,
      p.delivery_gratis,
      p.activo !== false
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('success', 'CSV exportado correctamente');
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-50';
    if (stock <= 3) return 'text-red-500';
    if (stock <= 5) return 'text-amber-500';
    return 'text-slate-600';
  };

  const getAvailabilityBadge = (product: FoodItem) => {
    if (product.activo === false) return { label: 'Inactivo', color: 'bg-slate-100 text-slate-500' };
    if (product.stock === 0) return { label: 'Agotado', color: 'bg-red-100 text-red-600' };
    if (product.stock <= 3) return { label: 'Bajo Stock', color: 'bg-amber-100 text-amber-600' };
    return { label: 'Disponible', color: 'bg-emerald-100 text-emerald-600' };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--ios-text)' }}>Gestión de Productos</h2>
          <p className="text-xs text-slate-500">{stats.total} productos · {stats.activos} activos · {stats.bajoStock} bajo stock</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={onCreate} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg cursor-pointer transition-all" style={{ backgroundColor: themeColor }}>
            <Plus size={14} /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Activos', value: stats.activos, color: 'text-emerald-600' },
          { label: 'Inactivos', value: stats.inactivos, color: 'text-slate-400' },
          { label: 'En Promo', value: stats.promo, color: 'text-violet-600' },
          { label: 'Bajo Stock', value: stats.bajoStock, color: 'text-amber-600' },
          { label: 'Agotados', value: stats.agotados, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={14} />
            </button>
          )}
          <button
            onClick={handleVoiceSearch}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)} className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">
            <option value="todos">Todos ({stats.total})</option>
            <option value="activos">Activos ({stats.activos})</option>
            <option value="inactivos">Inactivos ({stats.inactivos})</option>
            <option value="promo">En Promo ({stats.promo})</option>
            <option value="bajo_stock">Bajo Stock ({stats.bajoStock})</option>
          </select>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">
            <option value="nombre">Nombre</option>
            <option value="precio">Precio</option>
            <option value="stock">Stock</option>
            <option value="order_count">Más vendidos</option>
            <option value="created_at">Recientes</option>
          </select>

          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>
              <List size={14} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}>
              <Grid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center">
          <Package size={48} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-400">No se encontraron productos</p>
          <p className="text-xs text-slate-400 mt-1">Intenta con otros filtros o crea un nuevo producto</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {filteredProducts.map(product => {
            const badge = getAvailabilityBadge(product);
            return (
              <div key={product.id} className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  {/* Image */}
                  <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    {product.imagen_urls?.[0] ? (
                      <img src={product.imagen_urls[0]} alt={product.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{product.nombre}</h3>
                      {product.es_nuevo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600">NUEVO</span>}
                      {product.es_promo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">PROMO</span>}
                      {product.es_mas_vendido && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">TOP</span>}
                      {product.delivery_gratis && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-600">ENVÍO GRATIS</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">{formatCategories(product)}</span>
                      {editingCell?.id === product.id && editingCell.field === 'stock' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Stock:</span>
                          <input
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            className="erp-inline-edit w-14 text-[10px]"
                            autoFocus
                          />
                          <button onClick={saveEdit} className="p-0.5 rounded bg-emerald-100 text-emerald-600 cursor-pointer"><Check size={8} /></button>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-bold ${getStockColor(product.stock)} erp-inline-editable cursor-pointer hover:opacity-70`}
                          onClick={() => startEdit(product, 'stock')}
                          title="Clic para editar stock"
                        >
                          Stock: {product.stock}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Price - Inline Editable */}
                  <div className="text-right shrink-0">
                    {editingCell?.id === product.id && editingCell.field === 'precio_usd' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="erp-inline-edit w-20 text-right"
                          autoFocus
                        />
                        <button onClick={saveEdit} className="p-0.5 rounded bg-emerald-100 text-emerald-600 cursor-pointer"><Check size={10} /></button>
                      </div>
                    ) : (
                      <p
                        className="text-sm font-black erp-inline-editable cursor-pointer hover:opacity-70"
                        style={{ color: themeColor }}
                        onClick={() => startEdit(product, 'precio_usd')}
                        title="Clic para editar precio"
                      >
                        ${product.precio_usd.toFixed(2)}
                      </p>
                    )}
                    {product.es_promo && product.precio_anterior_usd && product.precio_anterior_usd > product.precio_usd && (
                      <p className="text-[10px] text-slate-400 line-through">${product.precio_anterior_usd.toFixed(2)}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(product)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors" title={product.activo !== false ? 'Pausar' : 'Activar'}>
                      {product.activo !== false ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} className="text-slate-300" />}
                    </button>
                    <button onClick={() => togglePromo(product)} className={`p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors ${product.es_promo ? 'text-violet-500' : 'text-slate-300'}`} title="Toggle Promo">
                      <Tag size={14} />
                    </button>
                    <button onClick={() => onEdit(product)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors text-slate-500" title="Editar">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirm(product.id)} className="p-2 rounded-lg hover:bg-red-50 cursor-pointer transition-colors text-red-400" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === product.id && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg flex items-center justify-between">
                    <p className="text-xs text-red-600">¿Eliminar <strong>{product.nombre}</strong>?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">Cancelar</button>
                      <button onClick={() => handleDelete(product)} className="px-3 py-1 text-xs font-bold text-white bg-red-500 rounded-lg cursor-pointer">Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredProducts.map(product => {
            const badge = getAvailabilityBadge(product);
            return (
              <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-square bg-slate-100 relative">
                  {product.imagen_urls?.[0] ? (
                    <img src={product.imagen_urls[0]} alt={product.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package size={32} />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {product.es_nuevo && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">NUEVO</span>}
                    {product.es_promo && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-violet-500 text-white">PROMO</span>}
                  </div>
                  <button onClick={() => toggleActive(product)} className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 cursor-pointer">
                    {product.activo !== false ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} className="text-slate-300" />}
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-bold text-slate-800 truncate">{product.nombre}</h3>
                  <p className="text-[10px] text-slate-400 truncate">{formatCategories(product)}</p>
                  <div className="flex items-center justify-between mt-2">
                    {editingCell?.id === product.id && editingCell.field === 'precio_usd' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">$</span>
                        <input type="number" step="0.01" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} className="erp-inline-edit w-16 text-[10px]" autoFocus />
                      </div>
                    ) : (
                      <span className="text-sm font-black erp-inline-editable cursor-pointer hover:opacity-70" style={{ color: themeColor }} onClick={() => startEdit(product, 'precio_usd')} title="Clic para editar">
                        ${product.precio_usd.toFixed(2)}
                      </span>
                    )}
                    {editingCell?.id === product.id && editingCell.field === 'stock' ? (
                      <input type="number" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} className="erp-inline-edit w-12 text-[10px]" autoFocus />
                    ) : (
                      <span className={`text-[10px] font-semibold ${getStockColor(product.stock)} erp-inline-editable cursor-pointer hover:opacity-70`} onClick={() => startEdit(product, 'stock')} title="Clic para editar">
                        Stock: {product.stock}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => onEdit(product)} className="flex-1 py-1.5 text-[10px] font-semibold bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200">Editar</button>
                    <button onClick={() => togglePromo(product)} className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg cursor-pointer ${product.es_promo ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>Promo</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductosSection;
