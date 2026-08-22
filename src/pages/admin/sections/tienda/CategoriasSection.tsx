import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Plus, Trash2, X, Check } from 'lucide-react';
import ImageField from '../../components/ImageField';

const CategoriasSection: React.FC = () => {
  const { config, updateConfig, addCategory, deleteCategory, updateCategory } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [editInput, setEditInput] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-4">
        <p className="admin-label mb-3">Gestionar Categorias</p>
        <div className="flex gap-2 mb-3">
          <input type="text" id="tienda-new-category" placeholder="Nueva categoria..."
            className="admin-input flex-1"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val && !(config.categories || []).includes(val)) {
                  addCategory(val);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }} />
          <button onClick={() => {
            const el = document.getElementById('tienda-new-category') as HTMLInputElement;
            const val = el?.value.trim();
            if (val && !(config.categories || []).includes(val)) {
              addCategory(val);
              el.value = '';
            }
          }} className="admin-btn px-4 cursor-pointer">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {(config.categories || []).map((cat) => {
            const subcats = (config.subcategories || {})[cat] || [];
            return (
              <div key={cat} className="rounded-lg" style={{ background: 'var(--ios-bg)' }}>
                <div className="flex items-center justify-between p-2">
                  {editInput === cat ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="admin-input flex-1 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editValue.trim() && editValue.trim() !== cat) {
                            updateCategory(cat, editValue.trim());
                            setEditInput(null);
                          } else if (e.key === 'Escape') {
                            setEditInput(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editValue.trim() && editValue.trim() !== cat) {
                            updateCategory(cat, editValue.trim());
                          }
                          setEditInput(null);
                        }}
                        className="p-1 rounded cursor-pointer"
                        style={{ color: '#34C759' }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditInput(null)}
                        className="p-1 rounded cursor-pointer"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold truncate pr-1" style={{ color: 'var(--ios-text)' }}>{cat}</span>
                  )}
                  <div className="flex gap-1 shrink-0">
                    {editInput !== cat && (
                      <button onClick={() => {
                        setEditInput(cat);
                        setEditValue(cat);
                      }} className="p-1 rounded cursor-pointer" style={{ color: 'var(--ios-text-secondary)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    {deleteConfirm === cat ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            deleteCategory(cat);
                            setDeleteConfirm(null);
                          }}
                          className="p-1 rounded cursor-pointer"
                          style={{ color: '#FF3B30' }}
                          title="Confirmar"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1 rounded cursor-pointer"
                          style={{ color: 'var(--ios-text-secondary)' }}
                          title="Cancelar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(cat)} className="p-1 rounded cursor-pointer" style={{ color: '#FF3B30' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-2 pb-2">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {subcats.map((sub) => (
                      <span key={sub} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium" style={{ background: 'var(--ios-surface)', color: 'var(--ios-text-secondary)' }}>
                        {sub}
                        <button onClick={() => {
                          const updated = subcats.filter(s => s !== sub);
                          const subs = { ...(config.subcategories || {}), [cat]: updated };
                          updateConfig({ subcategories: subs });
                        }} className="hover:text-red-500 cursor-pointer"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input type="text" id={`new-sub-${cat}`} placeholder="Nueva subcategoria..."
                      className="admin-input flex-1 text-[11px]"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !subcats.includes(val)) {
                            const subs = { ...(config.subcategories || {}), [cat]: [...subcats, val] };
                            updateConfig({ subcategories: subs });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }} />
                    <button onClick={() => {
                      const el = document.getElementById(`new-sub-${cat}`) as HTMLInputElement;
                      const val = el?.value.trim();
                      if (val && !subcats.includes(val)) {
                        const subs = { ...(config.subcategories || {}), [cat]: [...subcats, val] };
                        updateConfig({ subcategories: subs });
                        el.value = '';
                      }
                    }} className="admin-btn px-2 cursor-pointer text-[11px]">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Imagenes de Categorias</p>
        <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
          Sube una imagen de fondo para cada categoria (aparece como tarjeta en Home).
        </p>
        <div className="flex flex-col gap-3">
          {(config.categories || []).map((cat) => (
            <div key={cat} className="p-3 rounded-lg" style={{ background: 'var(--ios-bg)', border: '1px solid var(--ios-border)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--ios-text)' }}>{cat}</p>
              <ImageField
                value={(config.categories_images || {})[cat] || ''}
                onChange={url => updateConfig({ categories_images: { ...(config.categories_images || {}), [cat]: url } })}
                bucket="categories"
                folder={cat.replace(/\s+/g, '-').toLowerCase()}
                maxSize={400}
                previewSize="sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoriasSection;
