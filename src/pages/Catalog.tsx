import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { FoodItem } from '../types/store';
import { Search, X, ChevronLeft, Menu } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { ProductCard } from '../components/ProductCard';
import { getCategories, hasCategory, categoryIncludes } from '../utils/categoryUtils';

interface CatalogProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedSubcategory?: string;
  setSelectedSubcategory?: (subcategory: string) => void;
  onViewProductDetails: (part: FoodItem) => void;
  passedSearchTerm?: string;
  clearPassedSearchTerm?: () => void;
  resetGlobalFilters: () => void;
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout') => void;
  onOpenDrawer?: () => void;
}

export const Catalog: React.FC<CatalogProps> = ({
  selectedCategory, setSelectedCategory,
  selectedSubcategory, setSelectedSubcategory,
  onViewProductDetails, passedSearchTerm, clearPassedSearchTerm, resetGlobalFilters, setTab, onOpenDrawer
}) => {
  const { foodItems, config, addToCart, isDarkMode } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [searchQuery, setSearchQuery] = useState('');

  const c = {
    bg: isDarkMode ? '#0a0a0a' : '#f9f9fb',
    card: isDarkMode ? '#161616' : '#ffffff',
    surface: isDarkMode ? '#1a1a1a' : '#eeeef0',
    border: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    t1: isDarkMode ? '#f0f0f5' : '#111827',
    t2: isDarkMode ? '#8b8ba3' : '#6b7280',
  };

  useEffect(() => {
    if (passedSearchTerm) {
      setSearchQuery(passedSearchTerm);
      clearPassedSearchTerm?.();
    }
  }, [passedSearchTerm, clearPassedSearchTerm]);

  const filtered = useMemo(() => {
    let list = foodItems.filter(p => p.activo !== false);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        categoryIncludes(p, q) ||
        (p.subcategoria || '').toLowerCase().includes(q)
      );
    }
    if (selectedCategory) {
      list = list.filter(p => hasCategory(p, selectedCategory));
    }
    if (selectedSubcategory) {
      list = list.filter(p => (p.subcategoria || '').toLowerCase() === selectedSubcategory.toLowerCase());
    }
    return list;
  }, [foodItems, searchQuery, selectedCategory, selectedSubcategory]);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: c.bg }}>
      <SEOHead type="catalog" />

      {/* Top Bar */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: isDarkMode ? 'rgba(10,10,20,0.85)' : 'rgba(249,249,251,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* Mobile back button */}
          <button
            onClick={() => setTab('home')}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: c.surface }}
          >
            <ChevronLeft size={18} style={{ color: c.t1 }} />
          </button>

          {/* Desktop title */}
          <h2 className="hidden lg:block text-[16px] font-bold shrink-0" style={{ color: c.t1, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {selectedCategory || 'Menú'}
          </h2>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.t2 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-xl pl-10 pr-9 py-2.5 text-[14px] outline-none transition-colors"
              style={{
                backgroundColor: c.card,
                border: `1px solid ${c.border}`,
                color: c.t1
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 cursor-pointer"
              style={{ color: c.t2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Desktop count */}
          <span className="hidden lg:block text-[12px] shrink-0" style={{ color: c.t2 }}>{filtered.length} productos</span>

          {/* Mobile menu */}
          {onOpenDrawer && (
            <button
              onClick={onOpenDrawer}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
              style={{ backgroundColor: c.surface }}
            >
              <Menu size={18} style={{ color: c.t1 }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-24 max-w-7xl mx-auto w-full">
        {/* Category Filters */}
        {!selectedCategory && (
          <div className="mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
            <div className="flex gap-2 w-max">
              <button
                onClick={() => resetGlobalFilters()}
                className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold min-h-[40px]"
                style={{ backgroundColor: themeColor, color: '#fff' }}
              >
                Todos
              </button>
              {(config.categories || []).slice(0, 10).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors min-h-[40px]"
                  style={{
                    backgroundColor: c.surface,
                    color: c.t2
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subcategory filters */}
        {selectedCategory && (config.subcategories?.[selectedCategory] || []).length > 0 && (
          <div className="mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
            <div className="flex gap-2 w-max">
              <button
                onClick={() => setSelectedSubcategory?.('')}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors min-h-[32px] border`}
                style={{
                  backgroundColor: !selectedSubcategory ? `${themeColor}15` : 'transparent',
                  borderColor: !selectedSubcategory ? themeColor : c.border,
                  color: !selectedSubcategory ? themeColor : c.t2
                }}
              >
                Todas
              </button>
              {(config.subcategories?.[selectedCategory] || []).map(sub => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory?.(sub)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors min-h-[32px] border`}
                  style={{
                    backgroundColor: selectedSubcategory === sub ? `${themeColor}15` : 'transparent',
                    borderColor: selectedSubcategory === sub ? themeColor : c.border,
                    color: selectedSubcategory === sub ? themeColor : c.t2
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active category chip */}
        {selectedCategory && (
          <button
            onClick={() => { setSelectedCategory(''); setSelectedSubcategory?.(''); resetGlobalFilters(); }}
            className="text-[13px] font-semibold w-fit px-3 py-2 rounded-xl cursor-pointer transition-colors mb-4 flex items-center gap-1"
            style={{ backgroundColor: themeColor + '15', color: themeColor }}
          >
            ← {selectedCategory}{selectedSubcategory ? ` > ${selectedSubcategory}` : ''}
          </button>
        )}

        {/* Products Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-2">
            <p className="text-[14px]" style={{ color: c.t2 }}>No se encontraron productos</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory(''); resetGlobalFilters(); }}
              className="text-[13px] font-semibold px-4 py-2 rounded-xl text-white cursor-pointer"
              style={{ backgroundColor: themeColor }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(item => (
              <ProductCard key={item.id} item={item} config={config}
                onViewProductDetails={onViewProductDetails}
                addToCart={(food) => addToCart(food)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
