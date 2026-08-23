import React, { useState } from 'react';
import { FoodItem, StoreConfig } from '../types/store';
import { Plus, Star, Users, Clock, Heart, TrendingUp } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { RippleButton } from './RippleButton';

interface ProductCardProps {
  item: FoodItem;
  config: StoreConfig;
  onViewProductDetails: (item: FoodItem) => void;
  addToCart: (item: FoodItem) => void;
  averageRating?: number;
  reviewCount?: number;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  config,
  onViewProductDetails,
  addToCart,
  averageRating = 0,
  reviewCount = 0,
  index = 0,
}) => {
  const { toggleFavorite, isFavorite, isDarkMode } = useApp();
  const [isAnimatingHeart, setIsAnimatingHeart] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const isAgotado = item.stock <= 0;
  const themeColor = config.theme_color || '#A4D045';
  const isLowStock = item.stock > 0 && item.stock < (config.stock_alert_threshold || 5);
  const hasPromoEnd = item.promo_end_date && new Date(item.promo_end_date) > new Date();
  const isFav = isFavorite(item.id);
  const tc = isDarkMode ? '#161616' : '#ffffff';
  const tcSurf = isDarkMode ? '#1a1a1a' : '#eeeef0';
  const tcT1 = isDarkMode ? '#f0f0f5' : '#1a1c1d';
  const tcT2 = isDarkMode ? '#8b8ba3' : '#5b4137';
  const tcT3 = isDarkMode ? '#6b6b85' : '#8f7065';
  const tcBorder = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(228,190,177,0.1)';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAgotado) return;
    addToCart(item);
    setShowAddedToast(true);
    setTimeout(() => setShowAddedToast(false), 1500);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimatingHeart(true);
    toggleFavorite(item.id);
    setTimeout(() => setIsAnimatingHeart(false), 600);
  };

  return (
    <div
      className="shrink-0 w-[170px] sm:w-[215px] flex flex-col rounded-xl overflow-hidden group relative cursor-pointer premium-hover"
      style={{
        backgroundColor: tc,
        border: `1px solid ${tcBorder}`,
        opacity: 0,
        animation: `fadeInScale 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 80}ms forwards`,
      }}
      onClick={() => onViewProductDetails(item)}
    >
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: tcSurf }}>
        <img
          src={item.imagen_urls[0]}
          alt={item.nombre}
          className={`w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 ${isAgotado ? 'grayscale opacity-50' : ''}`}
          referrerPolicy="no-referrer"
        />

        {/* Heart button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            isFav
              ? 'text-white shadow-lg'
              : 'backdrop-blur-sm hover:bg-white/90'
          } ${isAnimatingHeart ? 'animate-heart-beat' : ''}`}
          style={isFav ? { backgroundColor: themeColor } : { backgroundColor: isDarkMode ? 'rgba(20,20,40,0.8)' : 'rgba(255,255,255,0.8)', color: tcT2 }}
        >
          <Heart size={12} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2} />
        </button>

        {/* Badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {item.es_promo && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: themeColor }}
            >
              PROMO
            </span>
          )}
          {item.es_nuevo && !item.es_promo && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: '#521800' }}
            >
              NUEVO
            </span>
          )}
          {item.es_mas_vendido && !item.es_promo && !item.es_nuevo && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-sm flex items-center gap-0.5"
              style={{ backgroundColor: '#a73a00' }}
            >
              <TrendingUp size={8} /> TOP
            </span>
          )}
          {isAgotado && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#2f3132] text-white shadow-sm">
              AGOTADO
            </span>
          )}
          {isLowStock && !isAgotado && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-sm animate-pulse"
              style={{ backgroundColor: themeColor }}
            >
              ¡Solo quedan {item.stock}!
            </span>
          )}
          {hasPromoEnd && !isAgotado && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: '#ba1a1a' }}
            >
              Oferta limitada
            </span>
          )}
        </div>

        {/* Quick add button - Luminous Electric style */}
        <RippleButton
          onClick={handleAddToCart}
          disabled={isAgotado}
          className="absolute bottom-2 right-2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 hover:scale-110 disabled:opacity-50"
          style={{
            backgroundColor: themeColor,
            color: '#ffffff',
            boxShadow: `0 4px 12px ${themeColor}40`,
          }}
        >
          <Plus size={18} />
        </RippleButton>

        {/* Added toast */}
        {showAddedToast && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-xl animate-fade-in-scale flex items-center gap-1"
              style={{ backgroundColor: '#10b981' }}
            >
              ¡Agregado!
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h4 className="text-[13px] font-bold line-clamp-2 leading-tight min-h-[2rem]" style={{ color: tcT1 }}>
          {item.nombre}
        </h4>
        <p className="text-[10px] line-clamp-2 leading-tight" style={{ color: tcT2 }}>
          {item.descripcion}
        </p>

        {/* Social Proof Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {averageRating > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold" style={{ color: '#a73a00' }}>
              <Star size={9} fill="currentColor" strokeWidth={0} />
              {averageRating.toFixed(1)}
              {reviewCount > 0 && <span className="font-normal" style={{ color: tcT3 }}>({reviewCount})</span>}
            </span>
          )}
          {item.order_count !== undefined && item.order_count > 0 && (
            <span className="flex items-center gap-0.5 text-[9px]" style={{ color: tcT3 }}>
              <Users size={8} />
              {item.order_count} pedidos
            </span>
          )}
          {item.estimated_prep_time && (
            <span className="flex items-center gap-0.5 text-[9px]" style={{ color: tcT3 }}>
              <Clock size={8} />
              ~{item.estimated_prep_time} min
            </span>
          )}
        </div>

        {/* Delivery gratis */}
        {item.delivery_gratis && (
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
            Delivery Gratis
          </span>
        )}

        <div className="mt-auto flex items-center justify-between pt-1.5">
          <div className="flex flex-col">
            {item.es_promo && item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd && (
              <span className="text-[10px] line-through font-medium" style={{ color: tcT3 }}>
                ${item.precio_anterior_usd.toFixed(2)}
              </span>
            )}
            <span className="text-base font-bold" style={{ color: themeColor }}>
              ${item.precio_usd.toFixed(2)}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onViewProductDetails(item); }}
            className="text-[10px] font-bold uppercase tracking-wider hover:underline cursor-pointer flex items-center gap-1"
            style={{ color: themeColor }}
          >
            Ordenar
          </button>
        </div>
      </div>
    </div>
  );
};
