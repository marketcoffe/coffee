import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import { FlashSale } from '../../../../types/store';
import { Plus, Trash2, Edit, Check, X, Zap } from 'lucide-react';
import { categoryIncludes, formatCategories } from '../../../../utils/categoryUtils';

const OfertasSection: React.FC = () => {
  const { flashSales, foodItems, updateFlashSales, config } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';
  const [isEditing, setIsEditing] = useState(false);
  const [editingSale, setEditingSale] = useState<FlashSale | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [discountPercent, setDiscountPercent] = useState(20);
  const [endDate, setEndDate] = useState('');
  const [maxQuantity, setMaxQuantity] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredProducts = foodItems.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    categoryIncludes(p, searchTerm)
  );

  const startEdit = (sale?: FlashSale) => {
    if (sale) {
      setEditingSale(sale);
      setSelectedProductId(sale.product_id);
      setDiscountPercent(sale.discount_percent);
      setEndDate(sale.end_date.split('T')[0]);
      setMaxQuantity(sale.max_quantity || 0);
    } else {
      setEditingSale(null);
      setSelectedProductId('');
      setDiscountPercent(20);
      setEndDate('');
      setMaxQuantity(0);
    }
    setIsEditing(true);
  };

  const saveSale = () => {
    if (!selectedProductId || !endDate) {
      showToast('error', 'Selecciona un producto y una fecha de fin.');
      return;
    }

    const newSale: FlashSale = {
      id: editingSale?.id || `sale-${crypto.randomUUID()}`,
      product_id: selectedProductId,
      discount_percent: discountPercent,
      end_date: new Date(endDate).toISOString(),
      max_quantity: maxQuantity || undefined,
      sold_quantity: editingSale?.sold_quantity || 0,
      active: true,
    };

    let updatedSales: FlashSale[];
    if (editingSale) {
      updatedSales = flashSales.map(s => s.id === editingSale.id ? newSale : s);
    } else {
      updatedSales = [...flashSales, newSale];
    }

    updateFlashSales(updatedSales);
    setIsEditing(false);
    setEditingSale(null);
  };

  const deleteSale = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDeleteSale = (id: string) => {
    const updatedSales = flashSales.filter(s => s.id !== id);
    updateFlashSales(updatedSales);
    setDeleteConfirm(null);
  };

  const toggleSaleActive = (id: string) => {
    const updatedSales = flashSales.map(s =>
      s.id === id ? { ...s, active: !s.active } : s
    );
    updateFlashSales(updatedSales);
  };

  const getTimeRemaining = (endDateStr: string) => {
    const end = new Date(endDateStr).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'Expirada';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--ios-border)' }}>
            <h3 className="text-sm font-bold uppercase" style={{ color: 'var(--ios-text)' }}>
              {editingSale ? 'Editar Oferta Flash' : 'Nueva Oferta Flash'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="p-1 rounded-lg cursor-pointer" style={{ color: 'var(--ios-text-secondary)' }}>
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--ios-text-secondary)' }}>Seleccionar Producto *</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="admin-input"
              />
              <div className="max-h-[250px] overflow-y-auto rounded-xl" style={{ border: '1px solid var(--ios-border)' }}>
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-all ${
                      selectedProductId === p.id ? 'border-l-2' : ''
                    }`}
                    style={{
                      borderBottom: '1px solid var(--ios-border)',
                      background: selectedProductId === p.id ? themeColor + '10' : 'transparent',
                      borderLeftColor: selectedProductId === p.id ? themeColor : 'transparent',
                    }}
                  >
                    {p.imagen_urls[0] ? (
                      <img src={p.imagen_urls[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: themeColor + '30' }}>
                        {p.nombre[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--ios-text)' }}>{p.nombre}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--ios-text-secondary)' }}>{formatCategories(p)} · ${p.precio_usd.toFixed(2)}</p>
                    </div>
                    {selectedProductId === p.id && (
                      <Check size={16} style={{ color: themeColor }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--ios-text-secondary)' }}>Descuento (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: themeColor }}
                />
                <span className="text-sm font-bold w-14 text-right" style={{ color: themeColor }}>{discountPercent}%</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--ios-text-secondary)' }}>Fecha de Fin *</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="admin-input"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--ios-text-secondary)' }}>Cantidad Maxima (0 = ilimitado)</label>
              <input
                type="number"
                min="0"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 0)}
                className="admin-input"
              />
            </div>

            {selectedProductId && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--ios-bg)', border: '1px solid var(--ios-border)' }}>
                <p className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--ios-text-secondary)' }}>Vista Previa</p>
                {(() => {
                  const p = foodItems.find(item => item.id === selectedProductId);
                  if (!p) return null;
                  const salePrice = p.precio_usd * (1 - discountPercent / 100);
                  return (
                    <div className="flex items-center gap-3">
                      {p.imagen_urls[0] && <img src={p.imagen_urls[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--ios-text)' }}>{p.nombre}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs line-through" style={{ color: 'var(--ios-text-tertiary)' }}>${p.precio_usd.toFixed(2)}</span>
                          <span className="text-sm font-black" style={{ color: '#34C759' }}>${salePrice.toFixed(2)}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FF3B3020', color: '#FF3B30' }}>-{discountPercent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              onClick={saveSale}
              className="w-full text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer"
              style={{ background: themeColor }}
            >
              {editingSale ? 'Guardar Cambios' : 'Crear Oferta Flash'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-5">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--ios-border)' }}>
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: '#FF9500' }} />
            <h3 className="text-sm font-bold uppercase" style={{ color: 'var(--ios-text)' }}>Ofertas Flash</h3>
          </div>
          <button
            onClick={() => startEdit()}
            className="px-3 py-1.5 text-[10px] font-bold text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            style={{ background: '#FF9500' }}
          >
            <Plus size={12} /> Nueva Oferta
          </button>
        </div>

        {flashSales.length === 0 ? (
          <div className="text-center py-12">
            <Zap size={48} className="mx-auto mb-3" style={{ color: 'var(--ios-text-tertiary)' }} />
            <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>No hay ofertas flash creadas</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--ios-text-tertiary)' }}>Crea ofertas con tiempo limitado para generar urgencia</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {flashSales.map((sale) => {
              const product = foodItems.find(p => p.id === sale.product_id);
              const salePrice = product ? product.precio_usd * (1 - sale.discount_percent / 100) : 0;
              const timeLeft = getTimeRemaining(sale.end_date);
              const isExpired = timeLeft === 'Expirada';
              const percentageSold = sale.max_quantity ? Math.round((sale.sold_quantity / sale.max_quantity) * 100) : 0;

              return (
                <div
                  key={sale.id}
                  className="p-4 rounded-xl transition-all"
                  style={{
                    border: `1px solid ${sale.active && !isExpired ? '#FF950040' : 'var(--ios-border)'}`,
                    background: sale.active && !isExpired ? '#FF950008' : 'var(--ios-bg)',
                    opacity: !sale.active || isExpired ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>
                          {product?.nombre || 'Producto eliminado'}
                        </h4>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FF3B3020', color: '#FF3B30' }}>
                          -{sale.discount_percent}%
                        </span>
                        {!sale.active && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--ios-surface)', color: 'var(--ios-text-tertiary)' }}>
                            Inactivo
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FF3B3020', color: '#FF3B30' }}>
                            Expirada
                          </span>
                        )}
                      </div>
                      {product && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs line-through" style={{ color: 'var(--ios-text-tertiary)' }}>${product.precio_usd.toFixed(2)}</span>
                          <span className="text-sm font-black" style={{ color: '#34C759' }}>${salePrice.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                        <span>Quedan: <b style={{ color: !isExpired ? '#FF9500' : 'var(--ios-text-tertiary)' }}>{timeLeft}</b></span>
                        {sale.max_quantity && (
                          <span>Vendidos: {sale.sold_quantity}/{sale.max_quantity} ({percentageSold}%)</span>
                        )}
                      </div>
                      {sale.max_quantity && (
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ios-surface)' }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(percentageSold, 100)}%`,
                            background: percentageSold > 80 ? '#FF3B30' : '#FF9500',
                          }} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-3">
                      <button
                        onClick={() => toggleSaleActive(sale.id)}
                        className="p-1.5 rounded-md transition-colors cursor-pointer"
                        style={{ color: sale.active ? '#FF9500' : '#34C759' }}
                        title={sale.active ? 'Desactivar' : 'Activar'}
                      >
                        {sale.active ? <X size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => startEdit(sale)}
                        className="p-1.5 rounded-md transition-colors cursor-pointer"
                        style={{ color: themeColor }}
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                      {deleteConfirm === sale.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => confirmDeleteSale(sale.id)}
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
                          onClick={() => deleteSale(sale.id)}
                          className="p-1.5 rounded-md transition-colors cursor-pointer"
                          style={{ color: '#FF3B30' }}
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

export default OfertasSection;
