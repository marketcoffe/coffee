import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { FoodItem, Sede } from '../types/store';
import {
  ArrowRight, ChevronLeft, ChevronRight, ChevronDown,
  Zap, Star, Plus, ShoppingCart, Clock, MapPin, X, LocateFixed, Check,
  Smartphone, Instagram, Twitter, Facebook,
  MessageCircle, Download, Award, Sparkles, TrendingUp, BadgeCheck, Flame,
  UtensilsCrossed, Shield,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { useToast } from '../components/Toast';
import { FloatingCartButton } from '../components/FloatingCartButton';
import { SedesMap } from '../components/SedesMap';
import { findNearestSede } from '../utils/geo';
import { getWhatsAppPhone } from '../utils/phone';
import { hasCategory, hasAnyCategory, categoryIncludes, formatCategories } from '../utils/categoryUtils';
import { formatVes } from '../utils/bcvRate';
import { CATEGORY_ICON_MAP, DEFAULT_CATEGORY_ICON } from '../utils/categoryIcons';

interface BeforeInstallPromptEvent {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

const CATEGORY_HERO_BG: Record<string, string> = {
  'mercado': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800',
  'panaderia': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
  'comida rapida':' https://images.unsplash.com/photo-1716393197312-2a3f9848fa25?w=1500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjE1fHxicmVhZHxlbnwwfDB8MHx8fDA%3D',
  'combos': 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=1500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZmFzdCUyMGZvb2R8ZW58MHwwfDB8fHww',
  'frutas y verduras': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800',
  'lacteos y embutidos': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=800',
  'abarrotes': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800',
  'snacks': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=800',
  'bebidas': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=800',
  'limpieza e higiene': 'https://images.unsplash.com/photo-1584556812952-90061e065e34?auto=format&fit=crop&q=80&w=800',
  'panes': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
  'pasteleria': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
  'dulces': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=800',
  'hamburguesas': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
  'shawarmas': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=800',
  'perros calientes': 'https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=800',
};

const DEFAULT_FAQ = [
  { id: 'faq-1', question: '¿Cuánto tarda mi pedido en llegar?', answer: 'Nuestro tiempo promedio es de 15 a 25 minutos dependiendo de tu ubicación. Contamos con una flota propia optimizada para asegurar que tus productos lleguen siempre frescos.' },
  { id: 'faq-2', question: '¿Venden productos de mercado?', answer: '¡Sí! Somos un mercado completo. Tenemos frutas, verduras, lácteos, embutidos, abarrotes, snacks, bebidas, artículos de limpieza e higiene personal.' },
  { id: 'faq-3', question: '¿Cómo puedo aplicar un código de descuento?', answer: 'Al finalizar tu compra en el carrito, verás un campo llamado "Código Promocional". Ingresa tu código ahí y el descuento se aplicará automáticamente al total de tu pedido.' },
  { id: 'faq-4', question: '¿Cuál es el pedido mínimo para delivery?', answer: 'El pedido mínimo para delivery es de $5.00. Para pedidos menores, puedes recoger gratis en nuestro local.' },
  { id: 'faq-5', question: '¿Tienen pan fresco?', answer: '¡Sí! Horneamos pan fresco todos los días. Tenemos pan campesino, canilla, pan de guayaba, arequipe con queso, palmeritas, tortas y dulces.' },
  { id: 'faq-6', question: '¿Aceptan tarjetas de crédito o débito?', answer: 'Sí, aceptamos todas las tarjetas de crédito y débito Visa, Mastercard y American Express. También aceptamos pagos móviles y Zelle.' },
];

interface HomeProps {
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout') => void;
  setSelectedCategory: (category: string) => void;
  onViewProductDetails: (food: FoodItem) => void;
  globalSearch: string;
  setGlobalSearch: (term: string) => void;
  navigateToCatalog: (filters?: { category?: string }) => void;
  deferredPrompt?: BeforeInstallPromptEvent | null;
  onInstallClick?: () => void;
  onAdminClick?: () => void;
  isAdminAuthenticated?: boolean;
}

export const Home: React.FC<HomeProps> = ({
  setTab, setSelectedCategory,
  onViewProductDetails, navigateToCatalog: _navigateToCatalog,
  deferredPrompt, onInstallClick, onAdminClick, isAdminAuthenticated
}) => {
  const { foodItems, config, cart, addToCart, getProductAverageRating, isDarkMode, promotions } = useApp();
  const { showToast } = useToast();
  const tc = config.theme_color || '#A4D045';
  const categories = config.categories || [];
  const vesRate = config.tasa_cambio && config.tasa_cambio > 10 ? config.tasa_cambio : null;
  const safeImg = (urls?: string[]) => urls?.[0] || '';

  const activeItems = useMemo(() => foodItems.filter(p => p.activo !== false), [foodItems]);
  const promoItems = useMemo(() => activeItems.filter(p => p.es_promo), [activeItems]);
  const activeCombos = useMemo(() => (config.combos || []).filter(c => c?.active), [config.combos]);
  const faqItems = useMemo(() => config.faq_items && config.faq_items.length > 0 ? config.faq_items : DEFAULT_FAQ, [config.faq_items]);
  const activePromotions = useMemo(() => {
    const now = new Date().toISOString();
    return (promotions || []).filter(p => p.status === 'active' && p.start_date <= now && p.end_date >= now);
  }, [promotions]);

  const panaderiaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Panaderia') || hasCategory(p, 'Panadería')).slice(0, 8), [activeItems]);
  const comidaRapidaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Comida Rapida') || hasCategory(p, 'Comida Rápida')).slice(0, 8), [activeItems]);
  const reposteriaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Repostería')).slice(0, 8), [activeItems]);
  const charcuteriaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Charcutería y Embutidos')).slice(0, 8), [activeItems]);
  const frutasItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Frutas y Verduras')).slice(0, 8), [activeItems]);
  const viveresItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Viveres') || hasCategory(p, 'Víveres')).slice(0, 8), [activeItems]);
  const bebidasItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Bebidas')).slice(0, 8), [activeItems]);
  const mascotasItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Mascotas')).slice(0, 8), [activeItems]);
  const higieneItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Higiene Personal')).slice(0, 8), [activeItems]);
  const salsasItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Salsas y Condimentos')).slice(0, 8), [activeItems]);
  const licoresItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Licores')).slice(0, 8), [activeItems]);
  const limpiezaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Limpieza')).slice(0, 8), [activeItems]);
  const hogarItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Hogar')).slice(0, 8), [activeItems]);
  const carniceriaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Carnicería')).slice(0, 8), [activeItems]);
  const lacteosItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Lácteos')).slice(0, 8), [activeItems]);
  const combosFamiliaresItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Combos Familiares')).slice(0, 8), [activeItems]);

  const masVendidosItems = useMemo(() => activeItems.filter(p => p.es_mas_vendido).slice(0, 8), [activeItems]);
  const combosCategoriaItems = useMemo(() => activeItems.filter(p => hasCategory(p, 'Combos') || hasAnyCategory(p, ['Combos', 'combos'])).slice(0, 8), [activeItems]);

  const coveredCategoryKeywords = useMemo(() => [
    'panaderia', 'panadería', 'comida rapida', 'comida rápida', 'repostería', 'reposteria',
    'charcutería', 'charcuteria', 'frutas', 'verduras', 'víveres', 'viveres', 'bebidas',
    'mascotas', 'higiene', 'salsas', 'condimentos', 'licores', 'limpieza', 'hogar',
    'carnicería', 'carniceria', 'lácteos', 'lacteos', 'combos familiares', 'combos',
  ], []);

  const missingCategories = useMemo(() => {
    const cats = config.categories || [];
    return cats
      .filter(cat => !coveredCategoryKeywords.some(kw => cat.toLowerCase().includes(kw)))
      .map(cat => ({
        name: cat,
        items: activeItems.filter(p => hasCategory(p, cat)).slice(0, 8),
      }))
      .filter(cat => cat.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 7);
  }, [config.categories, activeItems, coveredCategoryKeywords]);

  const [heroSlide, setHeroSlide] = useState(0);
  const heroBanners = (config.banners || []).slice(0, 3);
  const [activeCategory, setActiveCategory] = useState('Todas');

  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return activeItems.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      categoryIncludes(p, q) ||
      (p.subcategoria && p.subcategoria.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQuery, activeItems]);

  const activeSedes = useMemo(() => (config.sedes || []).filter(s => s.activa), [config.sedes]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('trv_selected_sede');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id) return parsed.id;
      }
    } catch { /* almacenamiento no disponible */ }
    return '';
  });
  const [showSedeModal, setShowSedeModal] = useState(false);
  const selectedSede = useMemo(
    () => activeSedes.find(s => s.id === selectedSedeId) || activeSedes.find(s => s.es_principal) || activeSedes[0],
    [activeSedes, selectedSedeId]
  );

  // Multi-sucursal activa: muestra el modal "Elegir tu tienda" automáticamente
  // al inicio si el usuario aún no ha seleccionado una sede.
  useEffect(() => {
    if (activeSedes.length > 1 && !selectedSedeId) {
      setShowSedeModal(true);
    }
  }, [activeSedes.length, selectedSedeId]);

  const selectSede = useCallback((sede: Sede) => {
    setSelectedSedeId(sede.id);
    localStorage.setItem('trv_selected_sede', JSON.stringify({ id: sede.id }));
    setShowSedeModal(false);
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('warning', 'Tu navegador no soporta geolocalizacion. Elige una sucursal manualmente.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestSede(activeSedes, { lat: position.coords.latitude, lng: position.coords.longitude });
        if (nearest) {
          setSelectedSedeId(nearest.id);
          localStorage.setItem('trv_selected_sede', JSON.stringify({ id: nearest.id }));
        }
        setShowSedeModal(false);
      },
      () => { showToast('error', 'No se pudo obtener tu ubicacion. Elige una sucursal manualmente.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [activeSedes, showToast]);

  const [flashTimer, setFlashTimer] = useState({ h: 2, m: 45, s: 12 });
  useEffect(() => {
    const t = setInterval(() => {
      setFlashTimer(p => {
        let { h, m, s } = p;
        s--; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; } if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const heroScrollRef = useRef<HTMLDivElement>(null);

  const snapHeroTo = useCallback((idx: number) => {
    const el = heroScrollRef.current;
    if (!el || !el.children[idx]) return;
    const child = el.children[idx] as HTMLElement;
    el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const t = setInterval(() => {
      setHeroSlide(p => {
        const next = (p + 1) % heroBanners.length;
        snapHeroTo(next);
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [heroBanners.length, snapHeroTo]);

  const handleHeroScroll = useCallback(() => {
    const el = heroScrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.offsetWidth;
    const idx = Math.round(scrollLeft / width);
    setHeroSlide(idx);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const panaderiaRef = useRef<HTMLDivElement>(null);
  const comidaRapidaRef = useRef<HTMLDivElement>(null);
  const reposteriaRef = useRef<HTMLDivElement>(null);
  const charcuteriaRef = useRef<HTMLDivElement>(null);
  const frutasRef = useRef<HTMLDivElement>(null);
  const viveresRef = useRef<HTMLDivElement>(null);
  const bebidasRef = useRef<HTMLDivElement>(null);
  const mascotasRef = useRef<HTMLDivElement>(null);
  const higieneRef = useRef<HTMLDivElement>(null);
  const salsasRef = useRef<HTMLDivElement>(null);
  const licoresRef = useRef<HTMLDivElement>(null);
  const limpiezaRef = useRef<HTMLDivElement>(null);
  const hogarRef = useRef<HTMLDivElement>(null);
  const carniceriaRef = useRef<HTMLDivElement>(null);
  const lacteosRef = useRef<HTMLDivElement>(null);
  const combosFamiliaresRef = useRef<HTMLDivElement>(null);
  const masVendidosRef = useRef<HTMLDivElement>(null);
  const combosCategoriaRef = useRef<HTMLDivElement>(null);
  const missingCat1Ref = useRef<HTMLDivElement>(null);
  const missingCat2Ref = useRef<HTMLDivElement>(null);
  const missingCat3Ref = useRef<HTMLDivElement>(null);
  const missingCat4Ref = useRef<HTMLDivElement>(null);
  const missingCat5Ref = useRef<HTMLDivElement>(null);
  const missingCat6Ref = useRef<HTMLDivElement>(null);
  const missingCat7Ref = useRef<HTMLDivElement>(null);
  const missingCatRefs = [missingCat1Ref, missingCat2Ref, missingCat3Ref, missingCat4Ref, missingCat5Ref, missingCat6Ref, missingCat7Ref];

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    if (ref.current) {
      const amt = ref.current.offsetWidth * 0.75;
      ref.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => {
    const ex = i.selected_options?.reduce((e, o) => e + o.precio_usd, 0) || 0;
    return s + (i.item.precio_usd + ex) * i.quantity;
  }, 0);

  const getWhatsApp = () => getWhatsAppPhone(config, { sede: selectedSede });

  const bg = isDarkMode ? '#111111' : '#f9f9fb';
  const cardBg = isDarkMode ? '#1a1a1a' : '#ffffff';
  const cardBorder = isDarkMode ? 'rgba(42,42,42,0.6)' : 'rgba(228,190,177,0.15)';
  const text1 = isDarkMode ? '#e8e8f0' : '#1a1c1d';
  const text2 = isDarkMode ? '#a0a0b8' : '#5b4137';
  const surfaceContainer = isDarkMode ? '#222222' : '#eeeef0';

  const renderStars = (rating: number, size = 12) => {
    const full = Math.floor(rating);
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={size} className={i < full ? 'text-amber-400' : isDarkMode ? 'text-gray-600' : 'text-gray-300'} fill={i < full ? 'currentColor' : 'none'} />
        ))}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: bg }}>
      <SEOHead title={`${config.site_nombre || 'Market Coffee Sweet'} - Mercado, Panaderia & Comida Rapida`} type="home" />

      {/* ═══ CONTENIDO PRINCIPAL ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

      {/* ═══ 1. HERO — Horizontal Swipe Carousel ═══ */}
      <section className="relative w-full mt-3 overflow-hidden aspect-[3/4] md:max-w-[1400px] md:mx-auto md:h-[600px] md:aspect-auto">
        <div
          ref={heroScrollRef}
          onScroll={handleHeroScroll}
          className="w-full h-full overflow-x-auto no-scrollbar snap-x snap-mandatory flex"
          style={{ scrollBehavior: 'smooth' }}
        >
          {heroBanners.length > 0 ? heroBanners.map((banner, idx) => {
            const isHero = idx === 0;
            const title = isHero
              ? (config.hero_title || config.site_nombre || 'Market Coffee Sweet')
              : (config.banner_titles?.[idx] || config.hero_title || config.site_nombre || '');
            const subtitle = isHero
              ? (config.hero_subtitle || config.mensaje_bienvenida || 'Tu comida favorita, más rápido que nunca.')
              : (config.banner_descriptions?.[idx] || '');
            const ctaText = isHero ? (config.hero_cta_text || 'Ordenar Ahora') : (config.banner_cta_texts?.[idx] || '');
            const ctaUrl = isHero ? (config.hero_cta_url || '') : (config.banner_cta_urls?.[idx] || '');

            return (
              <div key={idx} className="relative w-full h-full shrink-0 snap-start">
                <picture>
                  {config.banners_mobile?.[idx] && (
                    <source media="(max-width: 767px)" srcSet={config.banners_mobile[idx]} />
                  )}
                  <img alt="" className="absolute inset-0 w-full h-full object-cover object-center" src={banner} loading={idx === 0 ? 'eager' : 'lazy'} fetchPriority={idx === 0 ? 'high' : 'auto'} />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
                <div className="absolute bottom-8 left-5 right-5 md:bottom-16 md:left-16 md:right-auto md:max-w-2xl">
                  {isHero && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-white font-bold text-[10px] uppercase tracking-widest mb-3"
                      style={{ backgroundColor: tc }}>
                      {idx === 0 ? 'NUEVO' : idx === 1 ? 'HOT' : 'BEST'}
                    </span>
                  )}
                  {title && (
                    <h2 className="text-white font-extrabold text-2xl md:text-5xl leading-[1.05] mb-3"
                      style={{ fontFamily: 'var(--font-display)' }}>
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-white/75 text-sm md:text-lg mb-5 max-w-sm md:max-w-md leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                  {ctaText && (
                    <button onClick={() => {
                      if (ctaUrl) {
                        if (ctaUrl.startsWith('http')) {
                          window.open(ctaUrl, '_blank');
                        } else if (ctaUrl.startsWith('#')) {
                          const el = document.getElementById(ctaUrl.slice(1));
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          const tab = ctaUrl.replace('/', '') as string;
                          const validTabs = ['home', 'catalog', 'cart', 'admin', 'profile', 'checkout'];
                          setTab(validTabs.includes(tab) ? tab as 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' : 'catalog');
                        }
                      } else {
                        setTab('catalog');
                      }
                    }} className="font-bold text-sm md:text-base px-7 py-3 md:px-9 md:py-3.5 rounded-xl flex items-center gap-2 shadow-xl active:scale-95 transition-transform"
                      style={{ backgroundColor: tc, color: '#fff', boxShadow: `0 8px 30px ${tc}50` }}>
                      {ctaText} <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          }) : <div className="w-full h-full" style={{ backgroundColor: cardBg }} />}
        </div>

        {heroBanners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {heroBanners.map((_: string, i: number) => (
              <button key={i} onClick={() => { setHeroSlide(i); snapHeroTo(i); }}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === heroSlide ? '24px' : '8px',
                  height: '8px',
                  backgroundColor: i === heroSlide ? '#ffffff' : 'rgba(255,255,255,0.4)',
                }} />
            ))}
          </div>
        )}

        {heroBanners.length > 1 && (
          <>
            <button onClick={() => { const prev = (heroSlide - 1 + heroBanners.length) % heroBanners.length; setHeroSlide(prev); snapHeroTo(prev); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors hidden md:flex">
              <ChevronLeft size={22} />
            </button>
            <button onClick={() => { const next = (heroSlide + 1) % heroBanners.length; setHeroSlide(next); snapHeroTo(next); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors hidden md:flex">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </section>

      {/* ═══ 1B. SEARCH BAR ═══ */}
      <section className="px-4 md:px-8 max-w-[1440px] mx-auto w-full -mt-5 relative z-20">
        <div className="relative">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg border"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar productos, categorías..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
              onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-gray-400"
              style={{ color: text1 }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowSearchResults(false); }} className="p-1 rounded-full" style={{ color: text2 }}>
                <X size={16} />
              </button>
            )}
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-xl overflow-hidden z-30"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              {searchResults.map((item) => (
                <button key={item.id}
                  onClick={() => { setSearchQuery(''); setShowSearchResults(false); onViewProductDetails(item); }}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-black/5 border-b last:border-b-0"
                  style={{ borderColor: cardBorder }}>
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: text1 }}>{item.nombre}</p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: text2 }}>{formatCategories(item)}{item.subcategoria ? ` · ${item.subcategoria}` : ''}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0 text-right" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                </button>
              ))}
            </div>
          )}

          {showSearchResults && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-xl p-6 text-center z-30"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <p className="text-sm font-medium" style={{ color: text2 }}>No se encontró "{searchQuery}"</p>
              <p className="text-[11px] mt-1" style={{ color: text2 }}>Intenta con otro nombre o categoría</p>
            </div>
          )}
        </div>
      </section>

      {activeSedes.length > 1 && (
        <section className="py-3 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <button
            onClick={() => setShowSedeModal(true)}
            className="w-full flex items-center gap-3 text-left p-3.5 rounded-2xl border transition-all hover:opacity-90 active:scale-[0.99] cursor-pointer"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tc}18`, color: tc }}>
              <MapPin size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: text2 }}>
                Recibe tu pedido desde
              </p>
              <p className="font-bold text-sm truncate" style={{ color: text1 }}>
                {selectedSede?.nombre || (activeSedes[0]?.nombre || 'Sucursal')}
              </p>
              {selectedSede?.direccion && (
                <p className="text-xs truncate mt-0.5" style={{ color: text2 }}>{selectedSede.direccion}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0" style={{ color: tc }}>
              <span className="text-xs font-semibold">Cambiar</span>
              <ChevronDown size={16} />
            </div>
          </button>
        </section>
      )}

      {/* ═══ 2. CATEGORY PILLS ═══ */}
      <section className="lg:hidden py-3 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold" style={{ color: text1 }}>Explorar por categorías</h3>
          <div className="hidden md:flex gap-1.5">
            <button onClick={() => scroll(scrollRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scroll(scrollRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {/* Main category pills */}
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {['Todas', ...(config.categories || [])].map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => {
                setActiveCategory(cat);
                if (cat !== 'Todas') {
                  setSelectedCategory(cat);
                  setTab('catalog');
                }
              }}
                className="px-5 py-2 rounded-full font-semibold text-xs whitespace-nowrap transition-all shrink-0"
                style={{
                  backgroundColor: isActive ? tc : surfaceContainer,
                  color: isActive ? '#ffffff' : text2,
                  boxShadow: isActive ? `0 4px 12px ${tc}30` : 'none',
                }}>{cat}</button>
            );
          })}
        </div>
        {/* Subcategory pills */}

      </section>

      {/* ═══ PROMOCIONES ACTIVAS ═══ */}
      {activePromotions.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} style={{ color: tc }} />
            <h3 className="text-lg font-bold" style={{ color: text1 }}>Promociones</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {activePromotions.map((promo) => (
              <div key={promo.id} className="flex-shrink-0 w-[180px] rounded-xl overflow-hidden border" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  {promo.image_url ? (
                    <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Sparkles size={24} style={{ color: tc, opacity: 0.4 }} /></div>
                  )}
                </div>
                <div className="p-2">
                  <h4 className="font-bold text-xs line-clamp-2" style={{ color: text1 }}>{promo.title}</h4>
                  <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: text2 }}>{promo.message}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${tc}20`, color: tc }}>
                      {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : promo.discount_type === 'fixed' ? `$${promo.discount_value} OFF` : promo.discount_type === '2x1' ? '2x1' : 'Combo'}
                    </span>
                    {promo.coupon_code && (
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {promo.coupon_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 3. OFERTAS FLASH ═══ */}
      {promoItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: tc }}>
                <Zap size={14} className="animate-pulse" fill="currentColor" />
                <span className="font-semibold text-[11px] uppercase tracking-tight">
                  Termina en {String(flashTimer.h).padStart(2, '0')}:{String(flashTimer.m).padStart(2, '0')}:{String(flashTimer.s).padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Ofertas Flash</h3>
            </div>
            <button onClick={() => setTab('catalog')} className="font-semibold text-xs flex items-center gap-1 transition-all" style={{ color: tc }}>
              Ver Todo <ChevronRight size={14} />
            </button>
          </div>

          {/* Desktop: Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
            {promoItems.slice(0, 8).map((item) => {
              const discount = item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd
                ? Math.round(((item.precio_anterior_usd - item.precio_usd) / item.precio_anterior_usd) * 100) : 0;
              return (
                <div key={item.id} className="relative rounded-2xl border-2 overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ backgroundColor: cardBg, borderColor: tc, boxShadow: `0 0 20px ${tc}25` }}
                  onClick={() => onViewProductDetails(item)}>
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-bold text-[9px]"
                    style={{ backgroundColor: tc }}>
                    <Zap size={10} fill="currentColor" /> FLASH
                  </div>
                  <div className="relative h-36 overflow-hidden">
                    <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {discount > 0 && <div className="absolute top-2 right-2 bg-red-500 text-white font-bold px-2 py-0.5 rounded-lg text-[10px]">-{discount}%</div>}
                    {item.estimated_prep_time && (
                      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Clock size={10} /> {item.estimated_prep_time}min
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                      style={{ backgroundColor: tc, color: '#fff' }}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: text2 }}>{formatCategories(item)}</p>
                    <h4 className="text-sm font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {renderStars(getProductAverageRating(item.id))}
                      <span className="text-[10px] font-medium" style={{ color: text2 }}>{getProductAverageRating(item.id).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[10px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                        {item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd && (
                          <span className="line-through text-[11px]" style={{ color: `${text2}66` }}>${item.precio_anterior_usd.toFixed(2)}</span>
                        )}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center md:hidden"
                        style={{ backgroundColor: surfaceContainer, color: tc }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: Horizontal Carousel */}
          <div ref={offerRef} className="flex md:hidden gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {promoItems.slice(0, 8).map((item) => {
              const discount = item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd
                ? Math.round(((item.precio_anterior_usd - item.precio_usd) / item.precio_anterior_usd) * 100) : 0;
              return (
                <div key={item.id} className="relative w-[180px] rounded-xl border-2 overflow-hidden shrink-0 cursor-pointer"
                  style={{ backgroundColor: cardBg, borderColor: tc, boxShadow: `0 0 12px ${tc}20` }}
                  onClick={() => onViewProductDetails(item)}>
                  <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white font-bold text-[8px]"
                    style={{ backgroundColor: tc }}>
                    <Zap size={8} fill="currentColor" /> FLASH
                  </div>
                  <div className="relative h-[130px]">
                    <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-cover" />
                    {discount > 0 && <div className="absolute top-1.5 right-1.5 bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md text-[9px]">-{discount}%</div>}
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow"
                      style={{ backgroundColor: tc, color: '#fff' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{formatCategories(item)}</p>
                    <h4 className="text-xs font-bold line-clamp-2 mb-0.5" style={{ color: text1 }}>{item.nombre}</h4>
                    <div className="flex items-center gap-0.5 mb-1">
                      {renderStars(getProductAverageRating(item.id), 9)}
                      <span className="text-[9px]" style={{ color: text2 }}>{getProductAverageRating(item.id).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                      {item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd && (
                        <span className="line-through text-[10px]" style={{ color: `${text2}66` }}>${item.precio_anterior_usd.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ 3B. MÁS VENDIDOS ═══ */}
      {masVendidosItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: tc }}>
                <TrendingUp size={14} fill="currentColor" />
                <span className="font-semibold text-[11px] uppercase tracking-tight">Los favoritos</span>
              </div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Más Vendidos</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTab('catalog')} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(masVendidosRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(masVendidosRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Desktop: Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
            {masVendidosItems.map((item) => (
              <div key={item.id} className="relative rounded-2xl border overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-bold text-[9px]"
                  style={{ backgroundColor: '#f97316' }}>
                  <TrendingUp size={10} fill="currentColor" /> MÁS VENDIDO
                </div>
                <div className="relative h-36 overflow-hidden">
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  {item.estimated_prep_time && (
                    <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <Clock size={10} /> {item.estimated_prep_time}min
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: text2 }}>{formatCategories(item)}</p>
                  <h4 className="text-sm font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {renderStars(getProductAverageRating(item.id))}
                    <span className="text-[10px] font-medium" style={{ color: text2 }}>{getProductAverageRating(item.id).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[10px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                      {item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd && (
                        <span className="line-through text-[11px]" style={{ color: `${text2}66` }}>${item.precio_anterior_usd.toFixed(2)}</span>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: Horizontal Carousel */}
          <div ref={masVendidosRef} className="flex md:hidden gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {masVendidosItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  <span className="absolute top-1.5 left-1.5 text-[7px] font-bold text-white px-1 py-px rounded"
                    style={{ backgroundColor: '#f97316' }}>
                    <TrendingUp size={7} className="inline mr-px" fill="currentColor" /> TOP
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 3C. PÍDELO EN COMBO ═══ */}
      {combosCategoriaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: tc }}>
                <ShoppingCart size={14} />
                <span className="font-semibold text-[11px] uppercase tracking-tight">Ahorra más</span>
              </div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Pídelo en combo</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Combos'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(combosCategoriaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(combosCategoriaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Desktop: Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
            {combosCategoriaItems.map((item) => (
              <div key={item.id} className="relative rounded-2xl border overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: tc, boxShadow: `0 0 15px ${tc}15` }}
                onClick={() => onViewProductDetails(item)}>
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-bold text-[9px]"
                  style={{ backgroundColor: tc }}>
                  <ShoppingCart size={10} /> COMBO
                </div>
                <div className="relative h-36 overflow-hidden">
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  {item.estimated_prep_time && (
                    <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <Clock size={10} /> {item.estimated_prep_time}min
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: text2 }}>{formatCategories(item)}</p>
                  <h4 className="text-sm font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {renderStars(getProductAverageRating(item.id))}
                    <span className="text-[10px] font-medium" style={{ color: text2 }}>{getProductAverageRating(item.id).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[10px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                      {item.precio_anterior_usd && item.precio_anterior_usd > item.precio_usd && (
                        <span className="line-through text-[11px]" style={{ color: `${text2}66` }}>${item.precio_anterior_usd.toFixed(2)}</span>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: Horizontal Carousel */}
          <div ref={combosCategoriaRef} className="flex md:hidden gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {combosCategoriaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  <span className="absolute top-1.5 left-1.5 text-[7px] font-bold text-white px-1 py-px rounded"
                    style={{ backgroundColor: tc }}>
                    COMBO
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 2. COMBOS EXPLOSIVOS ═══ */}
      {activeCombos.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold" style={{ color: text1 }}>Combos Explosivos</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setTab('catalog')} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(comboRef, 'left')} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: cardBorder, color: text1 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(comboRef, 'right')} className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow" style={{ backgroundColor: tc }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Desktop: Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCombos.map((combo) => {
              const prods = (combo.product_ids || []).map(id => activeItems.find(p => p.id === id)).filter(Boolean) as FoodItem[];
              const img = combo.imagen_url || prods[0]?.imagen_urls?.[0] || '';
              return (
                <div key={combo.id} className="flex rounded-2xl border overflow-hidden h-36 transition-all hover:-translate-y-1 group cursor-pointer"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                  <div className="w-1/3 relative overflow-hidden">
                    {img ? <img src={img} alt={combo.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ backgroundColor: cardBg }}>🎁</div>}
                  </div>
                  <div className="w-2/3 p-4 flex flex-col justify-center">
                    <h5 className="text-sm font-bold mb-1 line-clamp-2" style={{ color: text1 }}>{combo.nombre}</h5>
                    <p className="text-[11px] mb-3 line-clamp-2" style={{ color: text2 }}>{combo.descripcion}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="font-bold text-base" style={{ color: tc }}>-{combo.discount_percent}%</span>
                      <button onClick={(e) => { e.stopPropagation(); setTab('catalog'); }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:text-white"
                        style={{ backgroundColor: surfaceContainer, color: tc }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tc; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = surfaceContainer; e.currentTarget.style.color = tc; }}>
                        <ShoppingCart size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: Horizontal Carousel */}
          <div ref={comboRef} className="flex md:hidden gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {activeCombos.map((combo) => {
              const prods = (combo.product_ids || []).map(id => activeItems.find(p => p.id === id)).filter(Boolean) as FoodItem[];
              const img = combo.imagen_url || prods[0]?.imagen_urls?.[0] || '';
              return (
                <div key={combo.id} className="flex w-[180px] rounded-xl border overflow-hidden h-[150px] shrink-0"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                  <div className="w-1/3">
                    {img ? <img src={img} alt={combo.nombre} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ backgroundColor: cardBg }}>🎁</div>}
                  </div>
                  <div className="w-2/3 p-3 flex flex-col justify-center">
                    <h5 className="text-sm font-bold mb-0.5 line-clamp-2" style={{ color: text1 }}>{combo.nombre}</h5>
                    <p className="text-[10px] mb-2 line-clamp-2" style={{ color: text2 }}>{combo.descripcion}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm" style={{ color: tc }}>-{combo.discount_percent}%</span>
                      <button className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: surfaceContainer, color: tc }}>
                        <ShoppingCart size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ 5A. PANADERÍA ═══ */}
      {panaderiaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Panadería</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Panes, pastelería y dulces frescos</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Panaderia'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(panaderiaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(panaderiaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={panaderiaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {panaderiaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ BANNER COMIDA RÁPIDA ═══ */}
      <section className="px-4 md:px-8 max-w-[1440px] mx-auto w-full">
        <div className="rounded-2xl overflow-hidden cursor-pointer group" onClick={() => { setSelectedCategory('Comida Rapida'); setTab('catalog'); }}>
          <img src="/imagen/banner-menu.webp" alt="Comida Rápida" className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      </section>

      {/* ═══ 5C. COMIDA RÁPIDA ═══ */}
      {comidaRapidaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Comida Rápida</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Hamburguesas, shawarmas y perros calientes</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Comida Rapida'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(comidaRapidaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(comidaRapidaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={comidaRapidaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {comidaRapidaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center gap-0.5 mb-1">
                    {renderStars(getProductAverageRating(item.id), 9)}
                    <span className="text-[9px]" style={{ color: text2 }}>{getProductAverageRating(item.id).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 6. REPOSTERÍA ═══ */}
      {reposteriaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Repostería</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Tortas, pasteles y dulces artesanales</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Repostería'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(reposteriaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(reposteriaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={reposteriaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {reposteriaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 7. CHARCUTERÍA ═══ */}
      {charcuteriaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Charcutería</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Chorizos, morcillas y embutidos frescos</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Charcutería y Embutidos'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(charcuteriaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(charcuteriaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={charcuteriaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {charcuteriaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 8. FRUTAS Y VERDURAS ═══ */}
      {frutasItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Frutas y Verduras</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Productos frescos del día</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Frutas y Verduras'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(frutasRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(frutasRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={frutasRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {frutasItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 9. VÍVERES ═══ */}
      {viveresItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Víveres</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Arroz, pasta, aceites y más</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Viveres'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(viveresRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(viveresRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={viveresRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {viveresItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 10. BEBIDAS ═══ */}
      {bebidasItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Bebidas</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Refrescos, jugos, té y agua</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Bebidas'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(bebidasRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(bebidasRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={bebidasRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {bebidasItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 11. MASCOTAS ═══ */}
      {mascotasItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Mascotas</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Alimento y cuidado para tus mascotas</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Mascotas'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(mascotasRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(mascotasRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={mascotasRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {mascotasItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 12. HIGIENE PERSONAL ═══ */}
      {higieneItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Higiene Personal</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Cuidado personal y bienestar</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Higiene Personal'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(higieneRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(higieneRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={higieneRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {higieneItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ BANNER RECARGA DE AGUA ═══ */}
      <section className="px-4 md:px-8 max-w-[1440px] mx-auto w-full">
        <div className="rounded-2xl overflow-hidden cursor-pointer group" onClick={() => { setSelectedCategory('Recarga de Agua'); setTab('catalog'); }}>
          <img src="/imagen/banner_agua.webp" alt="Recarga de Agua" className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      </section>

      {/* ═══ 13. SALSAS Y CONDIMENTOS ═══ */}
      {salsasItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Salsas y Condimentos</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Sabores para realzar tus comidas</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Salsas y Condimentos'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(salsasRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(salsasRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={salsasRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {salsasItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 14. LICORES ═══ */}
      {licoresItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Licores</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Vinos, whisky, ron y más</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Licores'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(licoresRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(licoresRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={licoresRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {licoresItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 15. LIMPIEZA ═══ */}
      {limpiezaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Limpieza</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Productos para tu hogar</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Limpieza'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(limpiezaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(limpiezaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={limpiezaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {limpiezaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 16. HOGAR ═══ */}
      {hogarItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Hogar</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Artículos para el hogar</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Hogar'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(hogarRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(hogarRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={hogarRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {hogarItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 17. CARNICERÍA ═══ */}
      {carniceriaItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Carnicería</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Carnes frescas y embutidos</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Carnicería'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(carniceriaRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(carniceriaRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={carniceriaRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {carniceriaItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 18. LÁCTEOS ═══ */}
      {lacteosItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full" style={{ backgroundColor: isDarkMode ? '#111111' : '#fafafa' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Lácteos</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Leche, queso, mantequilla y más</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Lácteos'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(lacteosRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(lacteosRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={lacteosRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {lacteosItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 19. COMBOS FAMILIARES ═══ */}
      {combosFamiliaresItems.length > 0 && (
        <section className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>Combos Familiares</h3>
              <p className="text-[11px]" style={{ color: text2 }}>Combos para toda la familia</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedCategory('Combos Familiares'); setTab('catalog'); }} className="font-semibold text-[11px] flex items-center gap-1 transition-all whitespace-nowrap" style={{ color: tc }}>
                Ver más <ChevronRight size={14} />
              </button>
              <button onClick={() => scroll(combosFamiliaresRef, 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(combosFamiliaresRef, 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={combosFamiliaresRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {combosFamiliaresItems.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || formatCategories(item)}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ DYNAMIC MISSING CATEGORY CAROUSELS ═══ */}
      {missingCategories.map((cat, idx) => (
        <section key={cat.name} className="py-4 px-4 md:px-8 max-w-[1440px] mx-auto w-full"
          style={idx % 2 === 1 ? { backgroundColor: isDarkMode ? '#111111' : '#fafafa' } : undefined}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: text1 }}>{cat.name}</h3>
              <p className="text-[11px]" style={{ color: text2 }}>{cat.items.length} productos disponibles</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => scroll(missingCatRefs[idx], 'left')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scroll(missingCatRefs[idx], 'right')} className="hidden md:flex w-8 h-8 rounded-full border items-center justify-center transition-all" style={{ borderColor: cardBorder, color: text2 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={missingCatRefs[idx]} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {cat.items.map((item) => (
              <div key={item.id} className="w-[180px] rounded-xl border overflow-hidden shrink-0 cursor-pointer group transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                onClick={() => onViewProductDetails(item)}>
                <div className="relative h-[130px] overflow-hidden" style={{ backgroundColor: cardBg }}>
                  <img src={safeImg(item.imagen_urls)} alt={item.nombre} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-400" />
                  {item.es_nuevo && <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: tc }}>NEW</span>}
                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    style={{ backgroundColor: tc, color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5 line-clamp-2" style={{ color: text2 }}>{item.subcategoria || cat.name}</p>
                  <h4 className="text-xs font-bold line-clamp-2 mb-1" style={{ color: text1 }}>{item.nombre}</h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: tc }}>${item.precio_usd.toFixed(2)}{vesRate && <span className="text-[9px] font-medium block" style={{ color: text2 }}>{formatVes(item.precio_usd, vesRate)} Bs</span>}</span>
                    <button onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center md:hidden"
                      style={{ backgroundColor: surfaceContainer, color: tc }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* ═══ 8. PWA DOWNLOAD INVITATION ═══ */}
      <section id="download-app" className="py-6 px-4 md:px-8 max-w-[1440px] mx-auto w-full scroll-mt-4">
        <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ backgroundColor: '#A4D045', color: '#1a1c1d' }}>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-black/5 rounded-full blur-2xl" />
          <div className="absolute -left-8 -top-8 w-24 h-24 bg-black/5 rounded-full blur-xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={16} className="text-black/60" />
                <span className="font-semibold text-[10px] uppercase tracking-widest text-black/50">Exclusivo Móvil</span>
              </div>
              <h3 className="text-lg md:text-xl font-extrabold mb-2 text-black">
                Descarga la app en tu móvil
              </h3>
              <p className="text-black/60 mb-4 text-xs md:text-sm max-w-md">
                Instálala directamente desde tu navegador y estate al tanto de nuestras promociones exclusivas. Sin descargas pesadas, directo a tu pantalla de inicio.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => {
                  if (deferredPrompt) {
                    onInstallClick?.();
                  } else {
                    setShowIOSInstallModal(true);
                  }
                }} className="h-10 bg-black text-white rounded-lg px-5 flex items-center justify-center gap-2 border border-black/10 hover:bg-black/80 transition-colors font-bold text-xs">
                  <Download size={16} />
                  Instalar App Web
                </button>
                <p className="text-[10px] text-black/50 flex items-center gap-1">
                  <Smartphone size={12} />
                  Funciona como una app nativa en tu celular
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center w-24 h-24 rounded-2xl bg-black/5 backdrop-blur-sm shrink-0">
              <Smartphone size={36} className="text-black/70" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 9. GANA Y ACUMULA PUNTOS ═══ */}
      <section className="py-6 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
        <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ backgroundColor: '#c2aa97' }}>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ backgroundColor: tc }} />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <Award size={16} style={{ color: tc }} />
              <span className="font-semibold text-[10px] uppercase tracking-widest" style={{ color: tc }}>Programa de Fidelidad</span>
            </div>
            <h3 className="text-lg md:text-xl font-extrabold mb-2 text-white">
              Gana y acumula puntos por tu compra
            </h3>
            <p className="text-white/50 mb-6 text-xs md:text-sm max-w-lg">
              En cada pedido que realices acumularás puntos canjeables por comida gratis, descuentos exclusivos y beneficios especiales.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { icon: '🛒', title: '2x Puntos', desc: 'En tu primer pedido' },
                { icon: '⭐', title: 'Puntos Extra', desc: 'En días especiales' },
                { icon: '🎁', title: 'Canjea', desc: 'Por productos gratis' },
                { icon: '🚀', title: 'Niveles VIP', desc: 'Beneficios Premium' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: isDarkMode ? '#222222' : 'rgba(255,255,255,0.08)' }}>
                  <span className="text-xl mb-1.5 block">{item.icon}</span>
                  <p className="text-white font-bold text-xs mb-0.5">{item.title}</p>
                  <p className="text-white/40 text-[10px]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 11. FAQ ACCORDION ═══ */}
      <section className="py-8 px-4 md:px-8 max-w-3xl mx-auto w-full">
        <h3 className="text-lg md:text-xl text-center mb-2 font-bold" style={{ color: text1 }}>Preguntas Frecuentes</h3>
        <p className="text-center mb-6 text-xs" style={{ color: text2 }}>Todo lo que necesitas saber sobre nuestro servicio.</p>
        <div className="space-y-2">
          {faqItems.map((item) => (
            <div key={item.id} className="rounded-xl border overflow-hidden transition-all"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <button className="w-full px-4 py-3 flex justify-between items-center text-left"
                onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}>
                <span className="text-sm font-bold pr-3" style={{ color: text1 }}>{item.question}</span>
                <ChevronDown size={18} className="shrink-0 transition-transform duration-300" style={{ color: tc, transform: openFaq === item.id ? 'rotate(180deg)' : 'rotate(0)' }} />
              </button>
              <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: openFaq === item.id ? '120px' : '0' }}>
                <div className="px-4 pb-3 pt-0" style={{ color: text2 }}>
                  <div className="border-t pt-2" style={{ borderColor: cardBorder }}>
                    <p className="leading-relaxed text-xs">{item.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 11b. UBICANOS ═══ */}
      <section className="py-8 md:py-12 px-4 md:px-8">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tc}18`, color: tc }}>
              <MapPin size={16} />
            </div>
            <h2 className="text-lg md:text-2xl font-extrabold" style={{ color: text1 }}>Ubícanos</h2>
          </div>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tc}18`, color: tc }}>
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base" style={{ color: text1 }}>{config.site_nombre || 'Market Coffee Sweet'}</h3>
                  <p className="text-sm mt-0.5" style={{ color: text2 }}>{config.direccion_fisica || 'Dirección no configurada'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps?q=${config.coordenadas_tienda?.lat || 0},${config.coordenadas_tienda?.lng || 0}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: tc }}
                >
                  <MapPin size={14} /> Ver en Google Maps
                </a>
                <button
                  onClick={() => {
                    const url = `https://www.google.com/maps?q=${config.coordenadas_tienda?.lat || 0},${config.coordenadas_tienda?.lng || 0}`;
                    navigator.clipboard.writeText(url).then(() => showToast('success', 'Link copiado al portapapeles'));
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                  style={{ borderColor: cardBorder, color: text1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copiar link
                </button>
              </div>
            </div>
            <div className="w-full h-48 md:h-64 relative border-t" style={{ borderColor: cardBorder }}>
              <iframe
                title="Ubicación en Google Maps"
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1963.2083043602725!2d-67.9976162!3d10.2279443!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e805d6dc676e98f%3A0xba3a0b197129594d!2sCoffee%20market%20sweet!5e0!3m2!1ses!2sve!4v1787513029771!5m2!1ses!2sve"
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 12. FOOTER ═══ */}
      <footer className="py-8 md:py-12 px-4 md:px-8 border-t" style={{ backgroundColor: isDarkMode ? '#0a0a0a' : '#f3f3f5', borderColor: cardBorder }}>
        <div className="max-w-[1440px] mx-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-8">
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            {config.logo_url ? <img src={config.logo_url} alt={config.site_nombre} className="h-7 w-auto mb-4" />
              : <h4 className="text-base font-extrabold mb-4" style={{ color: tc }}>{config.site_nombre || 'Market Coffee Sweet'}</h4>}
              <p className="text-[11px] leading-relaxed mb-4" style={{ color: text2 }}>
              {config.footer_about_text || 'Tu mercado, panaderia y comida rapida favorita. Todo en un solo lugar con delivery express.'}
            </p>
            <div className="flex gap-2">
              {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ backgroundColor: surfaceContainer, color: text2 }}><Instagram size={14} /></a>}
              {config.twitter_url && <a href={config.twitter_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ backgroundColor: surfaceContainer, color: text2 }}><Twitter size={14} /></a>}
              {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ backgroundColor: surfaceContainer, color: text2 }}><Facebook size={14} /></a>}
            </div>
          </div>
          <div>
            <h5 className="font-bold mb-3 uppercase tracking-widest text-[10px]" style={{ color: text1 }}>Menú</h5>
            <ul className="space-y-2 text-[11px]" style={{ color: text2 }}>
              {(config.categories || []).slice(0, 5).map((cat) => (
                <li key={cat}><button onClick={() => { setSelectedCategory(cat); setTab('catalog'); }} className="hover:opacity-80 transition-colors">{cat}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-3 uppercase tracking-widest text-[10px]" style={{ color: text1 }}>Soporte</h5>
            <ul className="space-y-2 text-[11px]" style={{ color: text2 }}>
              <li><a href={`https://wa.me/${getWhatsApp().replace(/[+ ]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-colors flex items-center gap-1.5"><MessageCircle size={11} className="text-green-500" /> WhatsApp</a></li>
              <li><button onClick={() => setShowTermsModal(true)} className="hover:opacity-80 transition-colors">Terminos de Servicio</button></li>
              <li><button onClick={() => setShowPrivacyModal(true)} className="hover:opacity-80 transition-colors">Politica de Privacidad</button></li>
              {onAdminClick && <li><button onClick={onAdminClick} className="hover:opacity-80 transition-colors flex items-center gap-1" title="Admin"><Shield size={11} /></button></li>}
            </ul>
          </div>
        </div>
        <div className="max-w-[1440px] mx-auto pt-4 border-t flex flex-col md:flex-row justify-between items-center gap-2 text-[10px]"
          style={{ borderColor: cardBorder, color: isDarkMode ? '#5a5a7a' : '#8f7065' }}>
         <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
            <span>Market Coffee Sweet C.A.</span>
            <span>RIF: J-500338260</span>
            <span>Tel: 0412-3758879</span>
            <span>{config.direccion_fisica || 'Venezuela'}</span>
              <p>© {new Date().getFullYear()} {config.footer_copyright || config.site_nombre || 'Market Coffee Sweet'}. Todos los derechos reservados.</p>
          <a href="https://maketo.site" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-90 transition-opacity text-[8px]">Desarrollado por Maketo Web</a>
         
          </div>
        </div>
      </footer>

      {/* ═══ MODAL TERMINOS DE SERVICIO ═══ */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Terminos de Servicio</h3>
              <button onClick={() => setShowTermsModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-5 text-[11px] leading-relaxed text-slate-600 space-y-4">
              <p className="text-[10px] text-slate-400">Ultima actualizacion: Julio 2026</p>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">1. Acceptacion de los Terminos</h4>
                <p>Al acceder y utilizar la plataforma Market Coffee Sweet ("la Plataforma"), el usuario acepta presente terminos y condiciones. Si no esta de acuerdo, debe abstenerse de utilizar el servicio.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">2. Descripcion del Servicio</h4>
                <p>Market Coffee Sweet es una plataforma de pedidos en linea que ofrece productos de mercado, panaderia y comida rapida con servicio de delivery. El servicio esta disponible exclusivamente en la Republica Bolivariana de Venezuela.</p>
                <p className="mt-2"><strong>Market Coffee Sweet C.A.</strong> | <strong>RIF:</strong> J-500338260</p>
                <p><strong>Dominio:</strong> https://marketcoffeesweet.com | <strong>Telefono:</strong> 0412-3758879</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">3. Registro y Cuenta</h4>
                <p>El usuario se compromete a proporcionar informacion veraz y actualizada durante el registro. Es responsable de mantener la confidencialidad de sus credenciales de acceso. Queda prohibido compartir cuentas con terceros.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">4. Pedidos y Pagos</h4>
                <p>Los precios mostrados estan en Dolares Americanos (USD) y se convierten a la moneda local segun la tasa de cambio vigente. El pago se realiza contra entrega (efectivo, transferencia o punto de venta) segun las opciones disponibles en su zona. Los pedidos estan sujetos a disponibilidad de producto.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">5. Delivery y Entregas</h4>
                <p>Los tiempos de entrega son estimados y pueden variar segun ubicacion, trafico y disponibilidad. Market Coffee Sweet no se hace responsable por demoras causadas por fuerza mayor. Las zonas de cobertura estan sujetas a disponibilidad.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">6. Politica de Devoluciones</h4>
                <p>En caso de productos danados o pedidos incorrectos, el usuario debe comunicarse dentro de las 2 horas siguientes a la recepcion. Se ofrecera reemplazo o reembolso segun el caso. No se aceptan devoluciones de productos perecederos una vez entregados.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">7. Puntos de Fidelidad</h4>
                <p>Los puntos acumulados son personales e intransferibles. No tienen valor monetario directo y no pueden canjearse por efectivo. Los puntos expiran segun la politica vigente. El uso indebido del sistema de puntos podra resultar en la suspension de la cuenta.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">8. Conducta del Usuario</h4>
                <p>El usuario se compromete a no utilizar la plataforma para fines ilicitos, no interferir con su operacion, y no intentar acceder a areas restringidas. El uso indebido podra resultar en la suspension permanente de la cuenta.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">9. Limitacion de Responsabilidad</h4>
                <p>Market Coffee Sweet actua como intermediario entre el usuario y los proveedores de productos. No somos fabricantes de los productos y limitamos nuestra responsabilidad por defectos de fabricacion. En ningun caso nuestra responsabilidad excedera el monto del pedido.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">10. Legislacion Aplicable</h4>
                <p>Estos terminos se rigen por las leyes de la Republica Bolivariana de Venezuela. Cualquier controversia sera resuelta por los tribunales competentes de la jurisdiccion correspondiente.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL POLITICA DE PRIVACIDAD ═══ */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Politica de Privacidad</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-5 text-[11px] leading-relaxed text-slate-600 space-y-4">
              <p className="text-[10px] text-slate-400">Ultima actualizacion: Julio 2026</p>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">1. Informacion que Recopilamos</h4>
                <p>Recopilamos la siguiente informacion: nombre, numero de telefono, direccion de entrega, historial de pedidos, datos de uso de la plataforma y informacion del dispositivo (tipo de navegador, sistema operativo). Cuando el usuario se registra, tambien se recopila su correo electronico.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">2. Uso de la Informacion</h4>
                <p>Utilizamos su informacion para: procesar y entregar pedidos, comunicarnos sobre su pedido, mejorar nuestro servicio, enviar notificaciones sobre promociones y ofertas (con su consentimiento), prevenir fraudes y cumplir con obligaciones legales.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">3. Compartir Informacion</h4>
                <p>No vendemos ni compartimos su informacion personal con terceros, excepto: con repartidores para completar la entrega, con proveedores de servicios de pago, cuando lo requiera la ley, o con su consentimiento explicito.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">4. Seguridad de los Datos</h4>
                <p>Implementamos medidas de seguridad tecnicas y organizativas para proteger su informacion. Utilizamos conexiones cifradas (HTTPS) y almacenamiento seguro. Sin embargo, ningun metodo de transmision por internet es 100% seguro.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">5. Cookies y Tecnologias de Rastreo</h4>
                <p>Utilizamos cookies y tecnologias similares para mejorar su experiencia, recordar sus preferencias y analizar el uso de la plataforma. Puede configurar su navegador para rechazar cookies, aunque esto podria afectar la funcionalidad.</p>
              </div>
              <div>
                <h4 className="font-bold text-style-800 mb-1">6. Sus Derechos</h4>
                <p>Segun la Ley Organica de Proteccion de Datos Personales y su Reglamento de Venezuela, usted tiene derecho a: acceder a sus datos personales, solicitar su rectificacion o eliminacion, oponerse al tratamiento de sus datos, y solicitar la portabilidad de sus datos. Para ejercer estos derechos, contactenos a traves de WhatsApp.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">7. Retencion de Datos</h4>
                <p>Conservamos su informacion personal mientras su cuenta este activa o sea necesaria para proporcionarle servicios. Despues de eliminar su cuenta, conservaremos algunos datos por el tiempo requerido por la ley o para fines legitimos de negocio.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">8. Menores de Edad</h4>
                <p>Nuestro servicio no esta dirigido a menores de 18 anos. No recopilamos intencionalmente informacion de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos de inmediato.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">9. Cambios en esta Politica</h4>
                <p>Nos reservamos el derecho de actualizar esta politica en cualquier momento. Los cambios importantes seran comunicados a traves de la plataforma o por correo electronico. El uso continuado de nuestros servicios despues de los cambios constituye aceptacion de la nueva politica.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">10. Contacto</h4>
                <p>Para cualquier consulta sobre esta politica de privacidad o para ejercer sus derechos, puede contactarnos a traves de WhatsApp al numero proporcionado en la plataforma.</p>
                <p className="mt-2"><strong>Market Coffee Sweet C.A.</strong> | <strong>RIF:</strong> J-500338260</p>
                <p><strong>Dominio:</strong> https://marketcoffeesweet.com | <strong>Telefono:</strong> 0412-3758879</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 14. SUCURSAL SELECTOR MODAL ═══ */}
      {showSedeModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSedeModal(false)} />
          <div className="relative w-full md:max-w-sm bg-white rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-900">Elegir sucursal</p>
                <p className="text-[11px] text-slate-500">Recibe tu pedido desde la tienda que prefieras.</p>
              </div>
              <button onClick={() => setShowSedeModal(false)} className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={useMyLocation}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-left hover:bg-slate-100 transition-colors mb-2 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tc}18`, color: tc }}>
                  <LocateFixed size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-800">Usar mi ubicación</p>
                  <p className="text-[11px] text-slate-500">Seleccionar la sucursal más cercana automáticamente.</p>
                </div>
              </button>

              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-2 py-1">O elige manualmente</div>

              <div className="flex flex-col max-h-[40vh] overflow-y-auto">
                {activeSedes.map(sede => {
                  const isActive = selectedSedeId === sede.id;
                  return (
                    <button
                      key={sede.id}
                      onClick={() => selectSede(sede)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-slate-800">{sede.nombre}</span>
                          {sede.es_principal && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Principal</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{sede.direccion}</p>
                        {sede.horario && <p className="text-[10px] text-slate-400 mt-0.5">{sede.horario}</p>}
                      </div>
                      {isActive && <Check size={18} style={{ color: tc }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-t border-slate-100">
              <button onClick={() => setShowSedeModal(false)} className="w-full py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer" style={{ backgroundColor: tc, color: '#fff' }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 14. iOS INSTALL MODAL ═══ */}
      {showIOSInstallModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowIOSInstallModal(false)} />
          <div className="relative w-full md:max-w-sm bg-white rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-900">Instalar la App</p>
                <p className="text-[11px] text-slate-500">Sigue estos pasos para agregarla a tu pantalla de inicio.</p>
              </div>
              <button onClick={() => setShowIOSInstallModal(false)} className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs" style={{ backgroundColor: tc }}>1</div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Toca el botón de compartir</p>
                  <p className="text-xs text-slate-500 mt-0.5">Toca el ícono de compartir (cuadro con flecha arriba) en la barra inferior de Safari.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs" style={{ backgroundColor: tc }}>2</div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Selecciona "Agregar a pantalla de inicio"</p>
                  <p className="text-xs text-slate-500 mt-0.5">Desplázate hacia abajo y toca la opción "Agregar a pantalla de inicio".</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs" style={{ backgroundColor: tc }}>3</div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Confirma tocando "Agregar"</p>
                  <p className="text-xs text-slate-500 mt-0.5">Toca "Agregar" en la esquina superior derecha. ¡Listo! La app aparecerá en tu pantalla de inicio.</p>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-slate-100">
              <button onClick={() => setShowIOSInstallModal(false)} className="w-full py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer" style={{ backgroundColor: tc, color: '#fff' }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 15. FLOATING CART ═══ */}
      <FloatingCartButton itemCount={cartCount} total={cartTotal} onClick={() => setTab('checkout')} themeColor={tc} />
      </div>
    </div>
  );
};
