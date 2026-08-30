import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FoodItem, Order, StoreConfig, InAppNotification, OrderItem, AppUser, Coupon, CartItem, SelectedOption, ProductReview, FlashSale, LoyaltyTransaction, LoyaltyTier, Promotion, RewardItem, UserRole, Mesa } from '../types/store';
import { supabase } from './supabaseClient';
import { secureLogin, type LoginSeguroResult } from '../security/authService';
import productsData from '../data/products.json';
import panProductsData from '../data/productos-pan-imported.json';
import { getCategories, hasCategory, toArray } from '../utils/categoryUtils';
import { fetchBcvRate, storeRate, getStoredRate, shouldFetchRate, msUntilNextScheduledFetch } from '../utils/bcvRate';

interface AppContextProps {
  foodItems: FoodItem[];
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  orders: Order[];
  config: StoreConfig;
  coupons: Coupon[];
  notifications: InAppNotification[];
  cart: CartItem[];
  isAdminAuthenticated: boolean;
  userRole: UserRole | null;
  adminScopeSedeId: string;
  favorites: string[];
  toggleFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  
  // Dark Mode
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Haptic Feedback
  hapticEnabled: boolean;
  toggleHaptic: () => void;
  
  // User Management
  displayCurrency: 'USD' | 'BS';
  toggleCurrency: () => void;
  users: AppUser[];
  currentUser: AppUser | null;
  registerUser: (nombre: string, username: string, email: string, telefono: string, contrasena: string) => Promise<AppUser>;
  loginUser: (identifier: string, contrasena: string) => Promise<AppUser | null>;
  logoutUser: () => void;
  updateUser: (updated: Partial<AppUser>) => void;
  sendPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUserByAdmin: (userId: string, updated: Partial<AppUser>) => void;
  requestPart: (nombre: string, telefono: string, descripcion: string, imagenUrl?: string) => Promise<boolean>;
  
  // Catalog actions
  addFoodItem: (product: Omit<FoodItem, 'id'>) => void;
  updateFoodItem: (id: string, updated: Partial<FoodItem>) => void;
  deleteFoodItem: (id: string) => void;
  searchItems: (query: string, includeInactive?: boolean) => FoodItem[];
  
  // Cart Actions
  addToCart: (item: FoodItem, qty?: number, selectedOptions?: SelectedOption[], optionsTotal?: number, removedIngredients?: string[]) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  
  // Checkout & Order Actions
  createOrder: (orderData: Omit<Order, 'id' | 'subtotal_usd' | 'total_usd' | 'total_bs' | 'fecha' | 'status'> & { descuento_cupon_usd?: number; cupon_codigo?: string }, preGeneratedId?: string) => Promise<Order | null>;
  registerGuestUser: (orderData: { cliente_nombre: string; cliente_telefono: string; cliente_email?: string }) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status'], estimatedTime?: string, notas?: string) => Promise<boolean>;
  confirmMesaPayment: (orderId: string) => Promise<boolean>;
  updateOrderItems: (orderId: string, newItems: OrderItem[]) => Promise<void>;
  refreshOrders: () => Promise<void>;

  // Coupon Actions
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usage_count'>) => Promise<void>;
  updateCoupon: (id: string, updated: Partial<Coupon>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  
  // Config Actions
  updateConfig: (newConfig: Partial<StoreConfig>) => void;
  updateExchangeRate: (rate: number) => void;
  fetchExchangeRate: () => Promise<boolean>;
  rateDate: string | null;
  addCategory: (categoryName: string) => void;
  deleteCategory: (categoryName: string) => void;
  updateCategory: (oldCategory: string, newCategory: string) => void;
  
  // Notification Actions
  addNotification: (title: string, message: string, tipo?: 'todos' | 'personal' | 'admin' | 'request', targetPhone?: string, imageUrl?: string, linkUrl?: string) => Promise<boolean>;
  markNotificationAsRead: (id: string) => void;
  toggleNotificationReadStatus: (id: string) => void;
  registerNotificationClick: (id: string) => Promise<void>;
  syncPushSubscription: () => Promise<{ success: boolean; error?: string }>;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // App State
  isGlobalLoading: boolean;
  
  // Reviews
  reviews: ProductReview[];
  addReview: (productId: string, rating: number, comment?: string) => Promise<boolean>;
  getProductReviews: (productId: string) => ProductReview[];
  getProductAverageRating: (productId: string) => number;
  
  // Flash Sales
  flashSales: FlashSale[];
  updateFlashSales: (sales: FlashSale[]) => void;
  getActiveFlashSale: (productId: string) => FlashSale | null;
  
  // Loyalty
  loyaltyTransactions: LoyaltyTransaction[];
  earnLoyaltyPoints: (userId: string, orderId: string, amountUsd: number, sedeId?: string) => Promise<void>;
  redeemLoyaltyPoints: (userId: string, pointsToRedeem: number, orderId?: string) => Promise<boolean>;
  getUserLoyaltyPoints: (userId: string) => number;
  getUserLoyaltyTier: (userId: string) => LoyaltyTier | null;
  adjustUserPoints: (userId: string, points: number, reason: string) => Promise<void>;
  getLoyaltyTransactions: (userId: string) => LoyaltyTransaction[];
  
  // PWA Install
  markUserAsPwaInstalled: (userId: string) => Promise<void>;
  
  // Reward Catalog
  rewardCatalog: RewardItem[];
  addRewardItem: (item: Omit<RewardItem, 'id'>) => Promise<void>;
  updateRewardItem: (id: string, updated: Partial<RewardItem>) => Promise<void>;
  deleteRewardItem: (id: string) => Promise<void>;
  redeemRewardItem: (userId: string, rewardId: string) => Promise<boolean>;
  
  // Mesas
  mesas: Mesa[];
  fetchMesas: () => Promise<void>;
  addMesa: (numeroMesa: number, nombrePersonalizado?: string) => Promise<boolean>;
  updateMesa: (id: string, updates: Partial<Mesa>) => Promise<void>;
  deleteMesa: (id: string) => Promise<void>;

  // Auth
  authenticateAdmin: (email: string, pass: string) => Promise<boolean | import('../security/authService').LoginSeguroResult>;
  logoutAdmin: () => Promise<void>;
  updateAdminCredentials: (user: string, pass: string) => void;
  adminUser: string;
  adminPass: string;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

  // INITIAL PRODUCTS DATA - Market Coffee Sweet
const DEFAULT_PRODUCTS: FoodItem[] = [
  // ═══════════════════════════════════════════════════
  // PRODUCTOS IMPORTADOS DESDE CSV
  // ═══════════════════════════════════════════════════
  ...(productsData as any[]).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    subcategoria: p.subcategoria || '',
    precio_usd: p.precio_usd,
    stock: p.stock,
    imagen_urls: p.imagen_urls || [],
    es_promo: p.es_promo || false,
    es_nuevo: p.es_nuevo || false,
    es_mas_vendido: p.es_mas_vendido || false,
    delivery_gratis: false,
    ingredientes: [],
    option_groups: p.sizes ? [{
      id: `og-${p.id}`,
      nombre: 'Presentación',
      min_select: 1,
      max_select: 1,
      options: p.sizes.map((s: any) => ({
        id: s.id,
        nombre: s.name,
        precio_usd: s.price_usd,
        activo: true
      }))
    }] : []
  })),
  // ═══════════════════════════════════════════════════
  // PRODUCTOS PAN - Importados desde CSV
  // ═══════════════════════════════════════════════════
  ...(panProductsData as any[]).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    subcategoria: p.subcategoria || '',
    precio_usd: p.precio_usd,
    stock: p.stock,
    imagen_urls: p.imagen_urls || [],
    es_promo: p.es_promo || false,
    es_nuevo: p.es_nuevo || false,
    es_mas_vendido: p.es_mas_vendido || false,
    delivery_gratis: false,
    ingredientes: p.ingredientes || [],
    option_groups: []
  }))
];


const DEFAULT_CONFIG: StoreConfig = {
  site_nombre: 'Market Coffee Sweet',
  telefono_soporte: '+584123758879',
  direccion_fisica: '2001 Calle 159, C. Apolo, Valencia 2001, Carabobo',
  coordenadas_tienda: { lat: 10.2279443, lng: -67.997616 },
  correo_interno: 'marketcoffee.ve@gmail.com',
  instagram_url: 'https://www.instagram.com/marketcoffee_sweet',
  banners: [
    '/imagen/descarga_app.webp',
    '/imagen/combo-banner.webp',
    '/imagen/panaderia_pc.webp'
  ],
  banners_mobile: [
    '/imagen/descarga_appmovil.webp',
    '/imagen/combos_movil.webp',
    '/imagen/panaderia_movil.webp'
  ],
  zelle_enabled: true,
  zelle_data: 'pagos@marketcoffesweet.com',
  zelle_discount_percent: 0,
  pagomovil_enabled: true,
  pagomovil_data: 'Banesco (0134) - Tel: 0412-375-88-79 - Cédula: V-33112679',
  pagomovil_discount_percent: 0,
  efectivo_enabled: true,
  efectivo_data: 'Paga al motorizado en efectivo (USD/Bs) al recibir tu delivery',
  efectivo_discount_percent: 0,
  transferencia_enabled: true,
  transferencia_data: 'Banesco Cuenta Corriente - 0134-1122-33-4455667788 - Market Coffee C.A. - RIF J-50123456-7',
  transferencia_discount_percent: 0,
  tasa_cambio: 612.43,
  logo_url: '/logo.png',
  theme_color: '#6E472A',
  secondary_color: '#A4D045',
  mensaje_bienvenida: 'Tu minimarket de confianza, panadería, comida rápida de la buena y víveres para resolver el mercado.',
  delivery_gratis: false,
  costo_delivery_km: 1.5,
  recogida_en_local: true,
  entrega_por_zonas: true,
  delivery_zonas: [
    { id: 'z1', name: 'Trigal / Prebo / Chimeneas', cost: 1.00, minKm: 0, maxKm: 3 },
    { id: 'z2', name: 'Mañongo / Trigaleña / Naguanagua / Av Bolívar', cost: 2.00, minKm: 3, maxKm: 7 },
    { id: 'z3', name: 'San Diego / Otras zonas', cost: 3.00, minKm: 7, maxKm: 18 },
  ],
  favicon_url: '',
  pwa_icon_url: '',
  splash_logo_url: '',
  banner_texts: [
    'Panadería, Comida Rápida y Víveres',
    'Combos que Enamoran',
    'Pan Fresco todos los dias'
  ],
  banner_titles: [
    '',
    'Combos Especiales para ti',
    'Pan Artesanal Fresco'
  ],
  banner_descriptions: [
    '',
    'Ahorra más comprando en combo, ofertas listas para toda ocasión',
    'Pan fresco, tortas, dulces y pastelería del día'
  ],
  banner_cta_texts: ['', 'Ver combos', ''],
  banner_cta_urls: ['', '/catalog', ''],
  hero_title: 'Market Coffee Sweet',
  hero_subtitle: 'Tu minimarket de confianza en C. Apolo, Valencia. Panadería fresca, comida rápida, víveres y más con delivery a domicilio.',
  hero_cta_text: 'Descargar la app',
  hero_cta_url: '#download-app',
  categories: [
    'Bebidas',
    'Carnicería',
    'Charcutería',
    'Charcutería y Embutidos',
    'Combos Familiares',
    'Comida Rapida',
    'Frutas y Verduras',
    'Higiene Personal',
    'Hogar',
    'Lácteos',
    'Licores',
    'Limpieza',
    'Mascotas',
    'Panaderia',
    'Dulces y Postres',
    'Salsas y Condimentos',
    'Snacks y Frituras',
    'Viveres',
  ],
  subcategories: {},
  seo_home_title: 'Market Coffee Sweet | Panadería, Comida Rápida y Víveres en Valencia',
  seo_home_description: 'Tu minimarket de confianza en C. Apolo, Valencia. Panadería fresca, comida rápida (hamburguesas, shawarmas, perros calientes), víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.',
  seo_home_keywords: 'panadería, comida rápida, hamburguesas, shawarmas, víveres, delivery, Valencia, El Trigal, Prebo, La Viña, Mañongo, Naguanagua, San Diego, minimarket, pan fresco, agua potable',
  seo_catalog_title: 'Catálogo de Productos',
  seo_catalog_description: 'Explora nuestro catálogo completo: panadería fresca, comida rápida, víveres, frutas, verduras, bebidas y más con delivery en Valencia y alrededores.',
  jsonld_type: 'FastFoodRestaurant',
  jsonld_priceRange: '$$',
  jsonld_servesCuisine: ['Panadería', 'Comida Rápida', 'Hamburguesas', 'Shawarma', 'Víveres', 'Bebidas'],
  push_webhook_url: import.meta.env.VITE_PUSH_WEBHOOK_URL || '',
  push_webhook_secret: '',
  esta_abierta: true,
  multi_sucursal_enabled: false,
  sedes: [
    {
      id: 'sede-1',
      nombre: 'Sede Principal',
      direccion: '2001 Calle 159, C. Apolo, Valencia 2001, Carabobo',
      telefono: '+584123758879',
      coordenadas: { lat: 10.2279443, lng: -67.997616 },
      horario: '11am - 10pm',
      activa: true,
      es_principal: true
    }
  ],
  loyalty: {
    enabled: false,
    points_per_dollar: 1,
    min_order_for_points: 5,
    redemption_rate: 100,
    max_discount_percent: 30,
    welcome_bonus: 50,
    first_order_bonus: 25,
    referral_bonus_referrer: 100,
    referral_bonus_referred: 50,
    daily_login_bonus: 5,
    review_bonus: 10,
    bonus_actions: { daily_login: 5, first_order: 25, review: 10, referral: 100 },
    tiers: [
      { id: 'tier-bronze', name: 'Bronce', min_points: 0, multiplier: 1, benefits: ['Puntos base'], color: '#CD7F32', icon: '🥉', sort_order: 1, active: true },
      { id: 'tier-silver', name: 'Plata', min_points: 500, multiplier: 1.25, benefits: ['25% más puntos'], color: '#8E8E93', icon: '🥈', sort_order: 2, active: true },
      { id: 'tier-gold', name: 'Oro', min_points: 1500, multiplier: 1.5, benefits: ['50% más puntos', 'Envío gratis'], color: '#FF9500', icon: '🥇', sort_order: 3, active: true },
    ],
  },
  brand_stat1_value: '20min',
  brand_stat1_label: 'Entrega Promedio',
  brand_stat2_value: '7+',
  brand_stat2_label: 'Categorías',
  brand_users_count: '',
  brand_section_title: 'Es tu tienda favorita.',
  brand_section_subtitle: 'Todo lo que necesitas, cerca de ti.',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistence state loaders
  const PRODUCTS_VERSION = '4.0';
  const [products, setProducts] = useState<FoodItem[]>(() => {
    const savedVersion = localStorage.getItem('trv_products_version');
    const saved = localStorage.getItem('trv_products');
    if (saved && savedVersion === PRODUCTS_VERSION) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* fallback */ }
    }
    // Si version cambia o no hay productos, usar defaults
    localStorage.setItem('trv_products_version', PRODUCTS_VERSION);
    localStorage.setItem('trv_products', JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('trv_orders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const saved = localStorage.getItem('trv_coupons');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [mesas, setMesas] = useState<Mesa[]>(() => {
    try {
      const saved = localStorage.getItem('trv_mesas');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [config, setConfig] = useState<StoreConfig>(() => {
    const saved = localStorage.getItem('trv_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        merged.subcategories = {};
        return merged;
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [rateDate, setRateDate] = useState<string | null>(() => {
    const stored = getStoredRate();
    return stored ? stored.date : null;
  });

  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('trv_notifications');
      if (saved) return JSON.parse(saved);
    } catch { /* use default */ }
    return [
      {
        id: 'init-notif',
        titulo: 'Bienvenidos a Market Coffee',
        mensaje: 'Tu mercado, panaderia y comida rapida favorita. Frutas, verduras, pan fresco, hamburguesas, shawarma y mas con delivery express.',
        fecha: new Date().toLocaleDateString(),
        tipo: 'todos',
        leida: false,
        click_count: 0
      }
    ];
  });

  const [isGlobalLoading, setIsGlobalLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('trv_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('trv_admin_auth') === 'true';
  });

  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('trv_user_role');
    return (saved === 'admin' || saved === 'operator' || saved === 'customer') ? saved : null;
  });

  const [adminScopeSedeId, setAdminScopeSedeId] = useState<string>(() => {
    return localStorage.getItem('trv_admin_scope_sede') || '';
  });

  const [adminUser] = useState<string>(import.meta.env.VITE_ADMIN_USER || '');
  const [adminPass] = useState<string>(import.meta.env.VITE_ADMIN_PASS || '');

  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'BS'>(() => {
    return (localStorage.getItem('trv_currency') as 'USD' | 'BS') || 'USD';
  });

  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('trv_haptic_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('trv_dark_mode');
    if (saved !== null) return saved === 'true';
    return false;
  });

  const hapticEnabledRef = useRef(hapticEnabled);
  useEffect(() => {
    hapticEnabledRef.current = hapticEnabled;
  }, [hapticEnabled]);

  const toggleHaptic = () => {
    const newVal = !hapticEnabled;
    setHapticEnabled(newVal);
    localStorage.setItem('trv_haptic_enabled', String(newVal));
  };

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    localStorage.setItem('trv_dark_mode', String(newVal));
  };

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleCurrency = () => {
    const newCurrency = displayCurrency === 'USD' ? 'BS' : 'USD';
    setDisplayCurrency(newCurrency);
    localStorage.setItem('trv_currency', newCurrency);
  };

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('trv_users');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('trv_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('trv_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    try {
      const saved = localStorage.getItem('trv_reviews');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [flashSales, setFlashSales] = useState<FlashSale[]>(() => {
    try {
      const saved = localStorage.getItem('trv_flash_sales');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('trv_loyalty_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [rewardCatalog, setRewardCatalog] = useState<RewardItem[]>(() => {
    try {
      const saved = localStorage.getItem('trv_reward_catalog');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // --- MOTOR DE TIEMPO REAL (SUPABASE CHANNELS) ---
  const normalizePhone = (phone: unknown): string => {
    return String(phone || '').replace(/[\s\-()+]/g, '').trim();
  };

  const currentUserRef = useRef<AppUser | null>(currentUser);
  const isAdminAuthenticatedRef = useRef(isAdminAuthenticated);
  const configSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfigRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    isAdminAuthenticatedRef.current = isAdminAuthenticated;
  }, [isAdminAuthenticated]);

  // --- SISTEMA DE LIMPIEZA AUTOMÁTICA DE NOTIFICACIONES ---
  // Limpia del estado local las notificaciones ya leídas que tengan más de 7 días de antigüedad.
  useEffect(() => {
    if (isGlobalLoading) return;

    const now = new Date().getTime();
    const limit = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

    setNotifications(prev => prev.filter(n => {
      // Conservar siempre las no leídas para que el usuario las gestione
      if (!n.leida) return true;

      // Usamos 'created_at' de la DB. Si no existe (notificación local muy reciente), se conserva.
      const createdAt = (n as InAppNotification & { created_at?: string }).created_at;
      if (!createdAt) return true; 

      return (now - new Date(createdAt).getTime()) < limit;
    }));
  }, [isGlobalLoading]);

  const playNotificationSound = (type: 'new' | 'update' | 'addToCart' | 'error' | 'swipe', status?: Order['status']) => {
    const soundUrl = type === 'new'
      ? 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
      : type === 'addToCart'
      ? 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'
      : 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

    try {
      const audio = new Audio(soundUrl);
      audio.volume = 0.8;
      audio.play().catch((err) => {
        if (err.name === 'NotAllowedError') {
          console.warn('📢 Audio bloqueado — se necesita interacción previa del usuario.');
        } else {
          console.warn('📢 Error al reproducir audio:', err.message);
        }
      });
    } catch {
      // Fallback: intentar con Audio global si falla
      console.warn('📢 Audio no disponible');
    }

    if (hapticEnabledRef.current && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const patterns: Record<string, number | number[]> = {
        addToCart: 50,
        orderConfirmed: [100, 50, 100],
        error: 200,
        swipe: 30,
        new: [200, 100, 200],
        update: status === 'En camino' ? 100 : 50
      };
      try {
        navigator.vibrate(patterns[type] || 50);
      } catch {
        // Chrome requiere interacción previa del usuario para permitir vibrate
      }
    }
  };

  // ✅ FIX: Sincronizar suscripción push automáticamente cuando el usuario inicia sesión
  // Si el usuario ya tiene permisos de notificación granted, sincronizar su suscripción con la DB
  useEffect(() => {
    if (!currentUser) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const syncOnLogin = async () => {
      try {
        const permission = Notification.permission;
        if (permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          const existingSub = await registration.pushManager.getSubscription();
          if (existingSub) {
            console.warn('🔔 Marketo: Sincronizando suscripción push automáticamente tras login...');
            await syncPushSubscription();
          }
        }
      } catch (err) {
        console.warn('⚠️ Marketo: No se pudo sincronizar push automáticamente:', err);
      }
    };

    syncOnLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    let mainChannel: ReturnType<typeof supabase.channel> | null = null;
    let broadcastChan: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectRetries = 0;
    const MAX_DELAY = 30000;
    const BASE_DELAY = 2000;

    const connectRealtime = () => {
      if (mainChannel) {
        supabase.removeChannel(mainChannel);
        mainChannel = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      try {
        mainChannel = supabase.channel('marketo_realtime_system');

        mainChannel
        // Escuchar cambios en Configuración
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_config' }, (payload: Record<string, unknown>) => {
          const newRow = (payload as { new?: Record<string, unknown> })?.new;
          if (newRow) {
            setConfig(prev => {
              // Excluir campos que están pendientes de guardado local (debounce activo)
              // para que no se sobreescriban con valores viejos de la DB
              const pending = pendingConfigRef.current;
              const safeNewRow: Record<string, unknown> = {};
              Object.keys(newRow).forEach(key => {
                if (!(key in pending)) {
                  safeNewRow[key] = newRow[key];
                }
              });

              return {
                ...prev,
                ...safeNewRow,
                tasa_cambio: Number(safeNewRow.tasa_cambio) || prev.tasa_cambio,
                coordenadas_tienda: safeNewRow.tienda_lat ? { lat: Number(safeNewRow.tienda_lat), lng: Number(safeNewRow.tienda_lng) } : prev.coordenadas_tienda,
                banners: [safeNewRow.banner_url_1, safeNewRow.banner_url_2, safeNewRow.banner_url_3].filter(Boolean).length > 0 
                  ? [safeNewRow.banner_url_1, safeNewRow.banner_url_2, safeNewRow.banner_url_3].filter(Boolean) as string[]
                  : prev.banners
              };
            });
          }
        })
        // Escuchar cambios en Pedidos (CDC)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
          const updated = payload.new as Order;
          const old = payload.old as Order;

          if (!updated?.id) return;
          
          // Si el status cambió, emitir sonido
          if (old && old.status !== updated.status) {
            playNotificationSound('update', updated.status);
          }

          setOrders(prev =>
            prev.map(o =>
              o.id === updated.id
                ? { ...o, ...updated }
                : o
            )
          );

          const cu = currentUserRef.current;
          if (cu && normalizePhone(updated.cliente_telefono) === normalizePhone(cu.telefono)) {
            // ✅ FIX: Usar SW showNotification (aparece en pantalla inicial del móvil)
            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
              const direccion = updated.direccion_envio || '';
              const tiempo = updated.tiempo_estimado_entrega || '';
              const extras = [direccion ? `Ubicación: ${direccion}` : '', tiempo ? `Tiempo estimado: ${tiempo}` : '']
                .filter(Boolean)
                .join(' • ');

              navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(`${config.site_nombre || 'App'}: Actualización de Pedido`, {
                  body: `Tu pedido ${updated.id} ahora está: ${updated.status}${extras ? `\n${extras}` : ''}`,
                  icon: '/icon.png',
                  badge: '/icon.png',
                  tag: `order-update-${updated.id}`,
                  renotify: true,
                  vibrate: [200, 100, 200],
                  requireInteraction: true,
                  data: { url: '/profile' }
                } as NotificationOptions);
              }).catch((err) => console.warn('[Push] showNotification CDC UPDATE failed:', err));
            }

            // Respaldo push servidor para segundo plano en móvil (iOS/Android)
            import('../utils/pushTrigger').then(({ triggerBroadcastPush }) => {
              const direccion = updated.direccion_envio || '';
              const tiempo = updated.tiempo_estimado_entrega || '';
              const extras = [direccion ? `\nUbicación: ${direccion}` : '', tiempo ? `\nTiempo estimado: ${tiempo}` : '']
                .filter(Boolean)
                .join('');

              triggerBroadcastPush({
                id: `order-update-${updated.id}`,
                titulo: `${config.site_nombre || 'App'}: Actualización de Pedido`,
                mensaje: `Tu pedido ${updated.id} ahora está: ${updated.status}${extras}`,
                tipo: 'personal',
                destinatario_telefono: updated.cliente_telefono,
                link_url: '/profile'
              }).catch(err => console.warn('[Push] Error disparando push order update:', err));
            });
          }
        })
        // Escuchar Pedidos Nuevos vía CDC (INSERT) — respaldo si el broadcast no llega
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: Record<string, unknown>) => {
          const newOrder = payload.new as Order;
          if (!newOrder?.id) return;

          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });

          // Notificación visual para pedidos de mesa
          if (newOrder.tipo_pedido === 'mesa' || newOrder.tipo_entrega === 'mesa') {
            playNotificationSound('new');
          }
        })
        // Escuchar Pedidos Nuevos vía BROADCAST (Ultra Rápido)
        .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
          const newOrder = payload.payload;
          setOrders(prev => [newOrder, ...prev]);
          window.dispatchEvent(new CustomEvent('new_order_received', { detail: newOrder }));
          playNotificationSound('new');
          
          // Toast visual en la app
          window.dispatchEvent(new CustomEvent('push_notification_received', {
            detail: { title: '🛒 ¡NUEVO PEDIDO!', body: `Cliente: ${newOrder.cliente_nombre} — Total: $${newOrder.total_usd?.toFixed(2)}` }
          }));
          
          // ✅ FIX: Usar SW showNotification para que aparezca en pantalla bloqueada
          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification('¡NUEVO PEDIDO! 🛒', {
                body: `Cliente: ${newOrder.cliente_nombre} — Total: $${newOrder.total_usd?.toFixed(2)}`,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: `new-order-${newOrder.id}`,
                renotify: true,
                vibrate: [200, 100, 200],
                requireInteraction: true,
                  data: { url: '/admin' }
                } as NotificationOptions);
            }).catch((err) => console.warn('[Push] showNotification new_order mainChannel failed:', err));
          }

          // Respaldo push servidor para admins en segundo plano
          import('../utils/pushTrigger').then(({ triggerBroadcastPush }) => {
            triggerBroadcastPush({
              id: `new-order-${newOrder.id}`,
              titulo: '🛒 ¡NUEVO PEDIDO!',
              mensaje: `Cliente: ${newOrder.cliente_nombre} — Total: $${newOrder.total_usd?.toFixed(2)}`,
              tipo: 'admin',
              link_url: '/admin'
            }).catch(err => console.warn('[Push] Error disparando push new order:', err));
          });
        })
        // Escuchar cambios de estado vía BROADCAST (Ultra Rápido, <100ms)
        .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
          const updatedOrder = payload.payload;
          if (!updatedOrder?.id) return;

          setOrders(prev =>
            prev.map(o =>
              o.id === updatedOrder.id
                ? { ...o, ...updatedOrder }
                : o
            )
          );

          window.dispatchEvent(new CustomEvent('order_status_changed', { detail: updatedOrder }));

          playNotificationSound('update', updatedOrder.status);

          const cu = currentUserRef.current;
          if (cu && normalizePhone(updatedOrder.cliente_telefono) === normalizePhone(cu.telefono)) {
            // Toast visual en la app
            window.dispatchEvent(new CustomEvent('push_notification_received', {
              detail: { title: '📦 Actualización de Pedido', body: `Tu pedido ahora está: ${updatedOrder.status}` }
            }));
            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
              const tiempo = updatedOrder.tiempo_estimado_entrega || '';
              navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(`${config.site_nombre || 'App'}: Actualización de Pedido`, {
                  body: `Tu pedido ${updatedOrder.id} ahora está: ${updatedOrder.status}${tiempo ? `\nTiempo estimado: ${tiempo}` : ''}`,
                  icon: '/icon.png',
                  badge: '/icon.png',
                  tag: `order-update-${updatedOrder.id}`,
                  renotify: true,
                  vibrate: [200, 100, 200],
                  requireInteraction: true,
                  data: { url: '/profile' }
                } as NotificationOptions);
              }).catch((err) => console.warn('[Push] showNotification order_status mainChannel failed:', err));
            }

            // Respaldo push servidor para segundo plano en móvil
            import('../utils/pushTrigger').then(({ triggerBroadcastPush }) => {
              const tiempo = updatedOrder.tiempo_estimado_entrega || '';
              triggerBroadcastPush({
                id: `order-update-${updatedOrder.id}`,
                titulo: `${config.site_nombre || 'App'}: Actualización de Pedido`,
                mensaje: `Tu pedido ${updatedOrder.id} ahora está: ${updatedOrder.status}${tiempo ? `\nTiempo estimado: ${tiempo}` : ''}`,
                tipo: 'personal',
                destinatario_telefono: updatedOrder.cliente_telefono,
                link_url: '/profile'
              }).catch(err => console.warn('[Push] Error disparando push order status:', err));
            });
          }
        })
        // Escuchar Notificaciones (CDC)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: Record<string, unknown>) => {
          const newNotif = payload.new as InAppNotification;
          
          // Validar si es para el usuario actual (broadcasts visibles para todos)
          const cu = currentUserRef.current;
          const isForMe = newNotif.tipo === 'todos' ||
                         (cu && newNotif.tipo === 'personal' && normalizePhone(newNotif.destinatario_telefono) === normalizePhone(cu.telefono)) ||
                         (isAdminAuthenticatedRef.current && (newNotif.tipo === 'request' || newNotif.tipo === 'admin'));

          if (isForMe) {
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            playNotificationSound('update');
            // Toast visual en la app
            window.dispatchEvent(new CustomEvent('push_notification_received', {
              detail: { title: '🔔 Notificación', body: newNotif.mensaje || newNotif.titulo || 'Nueva notificación' }
            }));
          }
        })
        // Escuchar cambios en FoodItems (CDC)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'products' },
          (payload: Record<string, unknown>) => {
            const inserted = (payload as { new?: Record<string, unknown> })?.new;
            if (!inserted?.id) return;

            setProducts(prev => {
              const idxById = prev.findIndex(p => p.id === inserted.id);
              if (idxById >= 0) {
                const copy = [...prev];
                copy[idxById] = { ...copy[idxById], ...inserted };
                return copy;
              }

              return [inserted as unknown as FoodItem, ...prev];
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'products' },
          (payload: Record<string, unknown>) => {
            const updated = (payload as { new?: Record<string, unknown> })?.new;
            if (!updated?.id) return;

            setProducts(prev => {
              // Upsert por id
              const idxById = prev.findIndex(p => p.id === updated.id);
              if (idxById >= 0) {
                const copy = [...prev];
                copy[idxById] = { ...copy[idxById], ...updated };
                return copy;
              }

              return [updated as unknown as FoodItem, ...prev];
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'products' },
          (payload: Record<string, unknown>) => {
            const deleted = (payload as { old?: Record<string, unknown> })?.old;
            if (!deleted) return;

            setProducts(prev => {
              return deleted.id ? prev.filter(p => p.id !== deleted.id) : prev;
            });
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.warn('✅ Conectado al sistema Realtime de Marketo');
            reconnectRetries = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Canal desconectado (${status}), reconectando...`);
            const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectRetries), MAX_DELAY);
            reconnectRetries += 1;
            reconnectTimer = setTimeout(() => connectRealtime(), delay);
          }
        });

    // Canal separado para broadcasts (enviados desde createOrder/updateOrderStatus sin destruir listeners)
    broadcastChan = supabase.channel('marketo_broadcast_send')
      .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
        const newOrder = payload.payload;
        if (!newOrder?.id) return;
        setOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        window.dispatchEvent(new CustomEvent('new_order_received', { detail: newOrder }));
        playNotificationSound('new');

        const cu = currentUserRef.current;
        const isOwner = cu && normalizePhone(newOrder.cliente_telefono) === normalizePhone(cu.telefono);
        const isAdmin = isAdminAuthenticatedRef.current;

        if (isAdmin || isOwner) {
          window.dispatchEvent(new CustomEvent('push_notification_received', {
            detail: { title: '🛒 ¡NUEVO PEDIDO!', body: `Cliente: ${newOrder.cliente_nombre} — Total: $${newOrder.total_usd?.toFixed(2)}` }
          }));

          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification('¡NUEVO PEDIDO! 🛒', {
                body: `Cliente: ${newOrder.cliente_nombre} — Total: $${newOrder.total_usd?.toFixed(2)}`,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: `new-order-${newOrder.id}`,
                renotify: true,
                vibrate: [200, 100, 200],
                requireInteraction: true,
                data: { url: isAdmin ? '/admin' : '/profile' }
              } as NotificationOptions);
            }).catch((err) => console.warn('[Push] showNotification new_order broadcastChan failed:', err));
          }
        }
      })
      .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
        const updatedOrder = payload.payload;
        if (!updatedOrder?.id) return;
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
        window.dispatchEvent(new CustomEvent('order_status_changed', { detail: updatedOrder }));
        playNotificationSound('update', updatedOrder.status);

        const cu = currentUserRef.current;
        const isOwner = cu && normalizePhone(updatedOrder.cliente_telefono) === normalizePhone(cu.telefono);

        if (isOwner) {
          window.dispatchEvent(new CustomEvent('push_notification_received', {
            detail: { title: '📦 Actualización de Pedido', body: `Tu pedido ahora está: ${updatedOrder.status}` }
          }));

          const tiempo = updatedOrder.tiempo_estimado_entrega || '';
          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(`${config.site_nombre || 'App'}: Actualización de Pedido`, {
                body: `Tu pedido ${updatedOrder.id} ahora está: ${updatedOrder.status}${tiempo ? `\nTiempo estimado: ${tiempo}` : ''}`,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: `order-update-${updatedOrder.id}`,
                renotify: true,
                vibrate: [200, 100, 200],
                requireInteraction: true,
                data: { url: '/profile' }
              } as NotificationOptions);
            }).catch((err) => console.warn('[Push] showNotification order_status broadcastChan failed:', err));
          }

          import('../utils/pushTrigger').then(({ triggerBroadcastPush }) => {
            triggerBroadcastPush({
              id: `order-update-${updatedOrder.id}`,
              titulo: `${config.site_nombre || 'App'}: Actualización de Pedido`,
              mensaje: `Tu pedido ${updatedOrder.id} ahora está: ${updatedOrder.status}${tiempo ? `\nTiempo estimado: ${tiempo}` : ''}`,
              tipo: 'personal',
              destinatario_telefono: updatedOrder.cliente_telefono,
              link_url: '/profile'
            }).catch(err => console.warn('[Push] Error disparando push order status broadcastChan:', err));
          });
        }
      })
      .subscribe();

    } catch (e) {
      console.error('Realtime channels failed:', e);
    }
    };

    connectRealtime();

    return () => {
      if (mainChannel) supabase.removeChannel(mainChannel);
      if (broadcastChan) supabase.removeChannel(broadcastChan);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [currentUser]);
  useEffect(() => {
    localStorage.setItem('trv_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('trv_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('trv_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('trv_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('trv_coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    localStorage.setItem('trv_mesas', JSON.stringify(mesas));
  }, [mesas]);

  useEffect(() => {
    localStorage.setItem('trv_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('trv_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('trv_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('trv_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem('trv_flash_sales', JSON.stringify(flashSales));
  }, [flashSales]);

  useEffect(() => {
    localStorage.setItem('trv_loyalty_transactions', JSON.stringify(loyaltyTransactions));
  }, [loyaltyTransactions]);

  useEffect(() => {
    localStorage.setItem('trv_reward_catalog', JSON.stringify(rewardCatalog));
  }, [rewardCatalog]);

  // ── BCV Exchange Rate — programado 7 AM y 1 PM ──
  const fetchExchangeRate = async (): Promise<boolean> => {
    const rate = await fetchBcvRate();
    if (rate) {
      updateExchangeRate(rate);
      setRateDate(new Date().toISOString().slice(0, 10));
      return true;
    }
    return false;
  };

  // Verificar si la tasa necesita actualización
  const needsRateUpdate = (): boolean => {
    return shouldFetchRate();
  };

  useEffect(() => {
    const initData = async () => {
      setIsGlobalLoading(true);

      try {

      // BUG FIX: Si es admin/operador/customer, cargar TODO. Obtener sesión primero.
      const { data: { session } } = await supabase.auth.getSession();
      const sessionRole = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
      let isAdmin = sessionRole === 'admin';
      let isOperator = sessionRole === 'operator';
      let isCustomer = sessionRole === 'customer';

      // FALLBACK: When signInWithPassword fails there is no real Supabase session,
      // but authenticateAdmin already set localStorage flags. Detect this so
      // initData loads admin data (orders, users, notifications) instead of
      // falling through to the guest branch and showing an empty panel.
      if (!isAdmin && !isOperator && !isCustomer && !session) {
        const storedRole = localStorage.getItem('trv_user_role');
        if (storedRole === 'admin') { isAdmin = true; }
        else if (storedRole === 'operator') { isOperator = true; }
        else if (storedRole === 'customer') { isCustomer = true; }
        if (isAdmin || isOperator || isCustomer) {
          setIsAdminAuthenticated(true);
        }
      }

      // Si localStorage dice admin y hay sesión válida, mantener el flag
      if ((isAdmin || isOperator || isCustomer) && localStorage.getItem('trv_admin_auth') !== 'true') {
        localStorage.setItem('trv_admin_auth', 'true');
        setIsAdminAuthenticated(true);
      } else if (!isAdmin && !isOperator && !isCustomer && localStorage.getItem('trv_admin_auth') === 'true' && session) {
        // Sesión existe pero no es admin/operator/customer - limpiar flag
        localStorage.removeItem('trv_admin_auth');
        setIsAdminAuthenticated(false);
        setUserRole(null);
        localStorage.removeItem('trv_user_role');
      }

      // Sincronizar rol desde la sesión
      if (isAdmin || isOperator || isCustomer) {
        // When session is null (fallback mode), get user ID from localStorage
        const userId = session?.user?.id || (() => {
          try { return JSON.parse(localStorage.getItem('trv_admin_user') || '{}').id; } catch { return ''; }
        })();

        if (isAdmin) {
          setUserRole('admin');
          localStorage.setItem('trv_user_role', 'admin');
          setAdminScopeSedeId('');
          localStorage.setItem('trv_admin_scope_sede', '');
        } else if (isOperator) {
          // OPERATOR = same data access as admin, only UI sections differ
          if (userId) {
            const { data: opRecord } = await supabase
              .from('admin_users')
              .select('active')
              .eq('id', userId)
              .single();

            if (opRecord && opRecord.active !== false) {
              setUserRole('operator');
              localStorage.setItem('trv_user_role', 'operator');
              setAdminScopeSedeId('');
              localStorage.setItem('trv_admin_scope_sede', '');
            } else {
              setIsAdminAuthenticated(false);
              setUserRole(null);
              localStorage.removeItem('trv_admin_auth');
              localStorage.removeItem('trv_user_role');
              localStorage.removeItem('trv_admin_scope_sede');
              setAdminScopeSedeId('');
              await supabase.auth.signOut();
            }
          } else {
            setUserRole('operator');
            localStorage.setItem('trv_user_role', 'operator');
            setAdminScopeSedeId('');
            localStorage.setItem('trv_admin_scope_sede', '');
          }
        } else if (isCustomer) {
          if (userId) {
            const { data: custRecord } = await supabase
              .from('admin_users')
              .select('active, sede_id')
              .eq('id', userId)
              .single();

            if (custRecord && custRecord.active !== false) {
              setUserRole('customer');
              localStorage.setItem('trv_user_role', 'customer');
              const scopeSede = custRecord.sede_id || '';
              setAdminScopeSedeId(scopeSede);
              localStorage.setItem('trv_admin_scope_sede', scopeSede);
            } else {
              setIsAdminAuthenticated(false);
              setUserRole(null);
              localStorage.removeItem('trv_admin_auth');
              localStorage.removeItem('trv_user_role');
              localStorage.removeItem('trv_admin_scope_sede');
              setAdminScopeSedeId('');
              await supabase.auth.signOut();
            }
          } else {
            setUserRole('customer');
            localStorage.setItem('trv_user_role', 'customer');
            const storedScope = localStorage.getItem('trv_admin_scope_sede') || '';
            setAdminScopeSedeId(storedScope);
          }
        }
      }

      // Cargar productos de Supabase (si es admin, incluir inactivos)
      let productsQuery = supabase.from('products').select('*').range(0, 9999);
      if (!isAdmin && !isOperator) {
        productsQuery = productsQuery.or('activo.is.true,activo.is.null');
      }
      const { data: dbProducts } = await productsQuery;
      if (dbProducts && dbProducts.length > 0) {
        const merged = (dbProducts as FoodItem[]).map(p => {
          const hasDbOptions = Array.isArray(p.option_groups) && p.option_groups.length > 0;
          if (hasDbOptions) return p;
          const fallback = DEFAULT_PRODUCTS.find(d => d.nombre === p.nombre && hasCategory(p, getCategories(d)[0] || ''));
          return { ...p, option_groups: fallback?.option_groups || [] };
        });
        setProducts(merged);
      }

      // Cargar promociones activas
      try {
        const { data: dbPromotions, error: promErr } = await supabase.from('promotions').select('*');
        if (promErr) console.warn('[initData] promotions error:', promErr.message);
        if (dbPromotions) {
          setPromotions(dbPromotions as Promotion[]);
        }
      } catch (e) { console.warn('[initData] promotions failed:', e); }
      
      // Cargar configuración COMPLETA de la tienda
      const { data: dbConfig } = await supabase.from('store_config').select('*').single();
      if (dbConfig) {
        setConfig(prev => ({
          ...prev,
          esta_abierta: dbConfig.esta_abierta,
          site_nombre: dbConfig.site_nombre || prev.site_nombre,
          telefono_soporte: dbConfig.telefono_soporte || prev.telefono_soporte,
          direccion_fisica: dbConfig.direccion_fisica || prev.direccion_fisica,
          tasa_cambio: dbConfig.tasa_cambio || prev.tasa_cambio,
          coordenadas_tienda: { lat: dbConfig.tienda_lat, lng: dbConfig.tienda_lng },
          banners: [dbConfig.banner_url_1, dbConfig.banner_url_2, dbConfig.banner_url_3].filter(Boolean),
          banners_mobile: [dbConfig.banner_url_1_mobile, dbConfig.banner_url_2_mobile, dbConfig.banner_url_3_mobile].filter(Boolean),
          pagomovil_data: dbConfig.pagomovil_data,
          pagomovil_enabled: dbConfig.pagomovil_enabled ?? prev.pagomovil_enabled,
          pagomovil_discount_percent: dbConfig.pagomovil_discount_percent ?? prev.pagomovil_discount_percent,
          zelle_data: dbConfig.zelle_data,
          zelle_enabled: dbConfig.zelle_enabled ?? prev.zelle_enabled,
          zelle_discount_percent: dbConfig.zelle_discount_percent ?? prev.zelle_discount_percent,
          efectivo_data: dbConfig.efectivo_data,
          efectivo_enabled: dbConfig.efectivo_enabled ?? prev.efectivo_enabled,
          efectivo_discount_percent: dbConfig.efectivo_discount_percent ?? prev.efectivo_discount_percent,
          transferencia_data: dbConfig.transferencia_data,
          transferencia_enabled: dbConfig.transferencia_enabled ?? prev.transferencia_enabled,
          transferencia_discount_percent: dbConfig.transferencia_discount_percent ?? prev.transferencia_discount_percent,
          push_webhook_url: dbConfig.push_webhook_url || import.meta.env.VITE_PUSH_WEBHOOK_URL || '',
          push_webhook_secret: '',
          logo_url: dbConfig.logo_url || prev.logo_url,
          theme_color: dbConfig.theme_color || prev.theme_color,
          favicon_url: dbConfig.favicon_url || prev.favicon_url,
          banner_texts: dbConfig.banner_texts || prev.banner_texts,
          banner_titles: dbConfig.banner_titles || prev.banner_titles,
          banner_descriptions: dbConfig.banner_descriptions || prev.banner_descriptions,
          banner_cta_texts: dbConfig.banner_cta_texts || prev.banner_cta_texts,
          banner_cta_urls: dbConfig.banner_cta_urls || prev.banner_cta_urls,
          categories: dbConfig.categories || prev.categories,
          mensaje_bienvenida: dbConfig.mensaje_bienvenida || prev.mensaje_bienvenida,
          delivery_gratis: dbConfig.delivery_gratis ?? prev.delivery_gratis,
          costo_delivery_km: dbConfig.costo_delivery_km ?? prev.costo_delivery_km,
          recogida_en_local: dbConfig.recogida_en_local ?? prev.recogida_en_local,
          entrega_por_zonas: dbConfig.entrega_por_zonas ?? prev.entrega_por_zonas,
          delivery_zonas: dbConfig.delivery_zonas ?? prev.delivery_zonas,
          secondary_color: dbConfig.secondary_color || prev.secondary_color,
          accent_color: dbConfig.accent_color || prev.accent_color,
          pwa_icon_url: dbConfig.pwa_icon_url || prev.pwa_icon_url,
          splash_logo_url: dbConfig.splash_logo_url || prev.splash_logo_url,
          secondary_logo_url: dbConfig.secondary_logo_url || prev.secondary_logo_url,
          font_display: dbConfig.font_display || prev.font_display,
          delivery_gratis_threshold: dbConfig.delivery_gratis_threshold ?? prev.delivery_gratis_threshold,
          envio_nacional: dbConfig.envio_nacional ?? prev.envio_nacional,
          costo_envio_nacional: dbConfig.costo_envio_nacional ?? prev.costo_envio_nacional,
          hero_title: dbConfig.hero_title || prev.hero_title,
          hero_subtitle: dbConfig.hero_subtitle || prev.hero_subtitle,
          hero_cta_text: dbConfig.hero_cta_text || prev.hero_cta_text,
          hero_cta_url: dbConfig.hero_cta_url || prev.hero_cta_url,
          hero_effect: dbConfig.hero_effect || prev.hero_effect,
          hero_height: dbConfig.hero_height || prev.hero_height,
          hero_overlay_opacity: dbConfig.hero_overlay_opacity ?? prev.hero_overlay_opacity,
          section_highlights_title: dbConfig.section_highlights_title || prev.section_highlights_title,
          section_categories_title: dbConfig.section_categories_title || prev.section_categories_title,
          section_bestseller_title: dbConfig.section_bestseller_title || prev.section_bestseller_title,
          section_rewards_title: dbConfig.section_rewards_title || prev.section_rewards_title,
          section_rewards_description: dbConfig.section_rewards_description || prev.section_rewards_description,
          rewards_step1_title: dbConfig.rewards_step1_title || prev.rewards_step1_title,
          rewards_step1_desc: dbConfig.rewards_step1_desc || prev.rewards_step1_desc,
          rewards_step2_title: dbConfig.rewards_step2_title || prev.rewards_step2_title,
          rewards_step2_desc: dbConfig.rewards_step2_desc || prev.rewards_step2_desc,
          rewards_step3_title: dbConfig.rewards_step3_title || prev.rewards_step3_title,
          rewards_step3_desc: dbConfig.rewards_step3_desc || prev.rewards_step3_desc,
          footer_text: dbConfig.footer_text || prev.footer_text,
          footer_copyright: dbConfig.footer_copyright || prev.footer_copyright,
          footer_about_title: dbConfig.footer_about_title || prev.footer_about_title,
          footer_about_text: dbConfig.footer_about_text || prev.footer_about_text,
          site_url: dbConfig.site_url || prev.site_url,
          seo_home_title: dbConfig.seo_home_title || prev.seo_home_title,
          seo_home_description: dbConfig.seo_home_description || prev.seo_home_description,
          seo_home_keywords: dbConfig.seo_home_keywords || prev.seo_home_keywords,
          seo_catalog_title: dbConfig.seo_catalog_title || prev.seo_catalog_title,
          seo_catalog_description: dbConfig.seo_catalog_description || prev.seo_catalog_description,
          jsonld_type: dbConfig.jsonld_type || prev.jsonld_type,
          jsonld_priceRange: dbConfig.jsonld_priceRange || prev.jsonld_priceRange,
          categories_colors: dbConfig.categories_colors || prev.categories_colors,
          faq_items: dbConfig.faq_items || prev.faq_items,
          instagram_url: dbConfig.instagram_url || prev.instagram_url,
          twitter_url: dbConfig.twitter_url || prev.twitter_url,
          facebook_url: dbConfig.facebook_url || prev.facebook_url,
          tiktok_url: dbConfig.tiktok_url || prev.tiktok_url,
          youtube_url: dbConfig.youtube_url || prev.youtube_url,
          sedes: dbConfig.sedes && Array.isArray(dbConfig.sedes) && dbConfig.sedes.length > 0 ? dbConfig.sedes : prev.sedes,
          sede_activa_id: dbConfig.sede_activa_id || prev.sede_activa_id,
          multi_sucursal_enabled: typeof dbConfig.multi_sucursal_enabled === 'boolean' ? dbConfig.multi_sucursal_enabled : prev.multi_sucursal_enabled,
          loyalty: dbConfig.loyalty ? {
            ...prev.loyalty,
            ...dbConfig.loyalty,
            tiers: dbConfig.loyalty.tiers?.length ? dbConfig.loyalty.tiers : (prev.loyalty?.tiers || []),
            bonus_actions: { ...(prev.loyalty?.bonus_actions || {}), ...(dbConfig.loyalty?.bonus_actions || {}) },
          } : prev.loyalty,
        }));
      }

      // Cargar cupones
      const { data: dbCoupons } = await supabase.from('coupons').select('*');
      if (dbCoupons) setCoupons(dbCoupons as Coupon[]);

      // Cargar reviews
      try {
        const { data: dbReviews, error: revErr } = await supabase.from('product_reviews').select('*').order('created_at', { ascending: false });
        if (revErr) console.warn('[initData] product_reviews error:', revErr.message);
        if (dbReviews) setReviews(dbReviews as ProductReview[]);
      } catch (e) { console.warn('[initData] product_reviews failed:', e); }

      // Cargar flash sales activas
      try {
        const { data: dbFlashSales, error: fsErr } = await supabase.from('flash_sales').select('*').eq('active', true);
        if (fsErr) console.warn('[initData] flash_sales error:', fsErr.message);
        if (dbFlashSales) setFlashSales(dbFlashSales as FlashSale[]);
      } catch (e) { console.warn('[initData] flash_sales failed:', e); }

      // Cargar catálogo de recompensas
      try {
        const { data: dbRewards, error: rwErr } = await supabase.from('reward_catalog').select('*');
        if (rwErr) console.warn('[initData] reward_catalog error:', rwErr.message);
        if (dbRewards) setRewardCatalog(dbRewards as RewardItem[]);
      } catch (e) { console.warn('[initData] reward_catalog failed:', e); }

      // Cargar transacciones de lealtad desde Supabase
      try {
        const { data: dbLoyaltyTx, error: ltErr } = await supabase.from('loyalty_transactions')
          .select('*').order('created_at', { ascending: false }).limit(500);
        if (ltErr) console.warn('[initData] loyalty_transactions error:', ltErr.message);
        if (dbLoyaltyTx && dbLoyaltyTx.length > 0) {
          setLoyaltyTransactions(dbLoyaltyTx as LoyaltyTransaction[]);
        }
      } catch (e) { console.warn('[initData] loyalty_transactions failed:', e); }

      if (isAdmin) {
        setIsAdminAuthenticated(true);
        // Cargar TODO para el admin ignorando filtros de usuario
        const [ordersRes, usersRes, notifsRes] = await Promise.all([
          supabase.from('orders').select('*').order('fecha', { ascending: false }),
          supabase.from('usuarios_clientes').select('*'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false })
        ]);

        if (ordersRes.data) setOrders(ordersRes.data as Order[]);
        if (usersRes.data) setUsers(usersRes.data.map(u => ({ ...u, createdAt: u.created_at, contrasena: 'managed' })));
        if (notifsRes.data) setNotifications(notifsRes.data as InAppNotification[]);

        // Cargar mesas
        try {
          const { data: dbMesas } = await supabase.from('mesas').select('*').order('numero_mesa');
          if (dbMesas && dbMesas.length > 0) {
            setMesas(dbMesas as Mesa[]);
            localStorage.setItem('trv_mesas', JSON.stringify(dbMesas));
          }
        } catch (e) { console.warn('[initData] mesas failed:', e); }
      } else if (isOperator) {
        // OPERATOR = same data access as admin (no sede filtering)
        const [ordersRes, usersRes, notifsRes] = await Promise.all([
          supabase.from('orders').select('*').order('fecha', { ascending: false }),
          supabase.from('usuarios_clientes').select('*'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        ]);

        if (ordersRes.data) setOrders(ordersRes.data as Order[]);
        if (usersRes.data) setUsers(usersRes.data.map(u => ({ ...u, createdAt: u.created_at, contrasena: 'managed' })));
        if (notifsRes.data) setNotifications(notifsRes.data as InAppNotification[]);

        try {
          const { data: dbMesas } = await supabase.from('mesas').select('*').order('numero_mesa');
          if (dbMesas && dbMesas.length > 0) setMesas(dbMesas as Mesa[]);
        } catch (e) { console.warn('[initData] mesas for operator failed:', e); }
      } else if (currentUser) {
        // Cargar Pedidos del usuario (por teléfono o ID)
        const { data: dbOrders } = await supabase.from('orders')
          .select('*')
          .or(`cliente_telefono.eq."${currentUser.telefono}",cliente_uid.eq."${currentUser.id}"`)
          .order('fecha', { ascending: false });
        if (dbOrders) setOrders(dbOrders as Order[]);

        // Cargar Notificaciones (broadcasts + personales + requests del usuario)
        const { data: dbNotifs } = await supabase.from('notifications')
          .select('*')
          .or(`tipo.eq.todos,and(tipo.eq.personal,destinatario_telefono.eq.${currentUser.telefono}),and(tipo.eq.request,destinatario_telefono.eq.${currentUser.telefono})`)
          .order('id', { ascending: false });
        if (dbNotifs) setNotifications(dbNotifs as InAppNotification[]);

        // Cargar mesas para que el checkout pueda mostrar el selector
        try {
          const { data: dbMesasUser } = await supabase.from('mesas').select('*').order('numero_mesa');
          if (dbMesasUser && dbMesasUser.length > 0) {
            setMesas(dbMesasUser as Mesa[]);
            localStorage.setItem('trv_mesas', JSON.stringify(dbMesasUser));
          }
        } catch (e) { console.warn('[initData] mesas load for user failed:', e); }

        // Cargar datos del usuario actual para que users[] tenga loyalty_points
        try {
          const { data: dbUser } = await supabase.from('usuarios_clientes')
            .select('*').eq('id', currentUser.id).single();
          if (dbUser) {
            setUsers([{ ...dbUser, createdAt: dbUser.created_at, contrasena: 'managed' } as AppUser]);
            setCurrentUser(prev => prev ? { ...prev, ...dbUser } : prev);
          }
        } catch (e) { console.warn('[initData] user profile load failed:', e); }
      } else {
        // Visitante anónimo (sin sesión): cargar solo mesas para el selector de checkout
        try {
          const { data: dbMesasGuest } = await supabase.from('mesas').select('*').order('numero_mesa');
          if (dbMesasGuest && dbMesasGuest.length > 0) {
            setMesas(dbMesasGuest as Mesa[]);
            localStorage.setItem('trv_mesas', JSON.stringify(dbMesasGuest));
          }
        } catch (e) { console.warn('[initData] mesas load for guest failed:', e); }
      }

      if (needsRateUpdate()) {
        await fetchExchangeRate();
      }

      } catch (err) {
        console.error('[initData] Error general:', err);
      } finally {
        setIsGlobalLoading(false);
      }
    };
    initData();

    // Intervalo: re-intentar cada 30 minutos si la tasa no se ha actualizado
    const rateInterval = setInterval(() => {
      if (needsRateUpdate()) {
        fetchExchangeRate();
      }
    }, 30 * 60 * 1000); // 30 minutos

    return () => clearInterval(rateInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, isAdminAuthenticated]); // Re-ejecutar al cambiar usuario o estado de admin

  // Listener de auth state para sincronizar sesión de Supabase con estado local
  useEffect(() => {
    if (!supabase?.auth?.onAuthStateChange) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          const sessionRole = session.user?.app_metadata?.role || session.user?.user_metadata?.role;
          const isAdmin = sessionRole === 'admin';
          const isOperator = sessionRole === 'operator';
          const isCustomer = sessionRole === 'customer';
          if (isAdmin || isOperator || isCustomer) {
            setIsAdminAuthenticated(true);
            localStorage.setItem('trv_admin_auth', 'true');
            const roleStr = isAdmin ? 'admin' : isOperator ? 'operator' : 'customer';
            setUserRole(roleStr);
            localStorage.setItem('trv_user_role', roleStr);
            // Reintentar sync de config pendiente cuando la sesión se restaura
            if (Object.keys(pendingConfigRef.current).length > 0) {
              const settingsToSave = { ...pendingConfigRef.current };
              pendingConfigRef.current = {};
              const updatePayload: Record<string, unknown> = { id: 1 };
              Object.keys(settingsToSave).forEach(key => {
                const value = settingsToSave[key];
                if (value !== undefined) {
                  if (key === 'coordenadas_tienda' && value) {
                    updatePayload.tienda_lat = (value as StoreConfig['coordenadas_tienda']).lat;
                    updatePayload.tienda_lng = (value as StoreConfig['coordenadas_tienda']).lng;
                  } else if (key === 'banners' && Array.isArray(value)) {
                    if (value[0] !== undefined) updatePayload.banner_url_1 = value[0];
                    if (value[1] !== undefined) updatePayload.banner_url_2 = value[1];
                    if (value[2] !== undefined) updatePayload.banner_url_3 = value[2];
                  } else {
                    updatePayload[key] = value;
                  }
                }
              });
              if (Object.keys(updatePayload).length > 1) {
                supabase.from('store_config').upsert(updatePayload).then(({ error }) => {
                  if (error) console.error('[Config] Retry sync failed:', error.message);
                });
              }
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        // En SIGNED_OUT, session es null - intentar restaurar la sesión antes de limpiar el estado.
        if (localStorage.getItem('trv_admin_auth') === 'true') {
          supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
            if (restoredSession) {
              const sessionRole = restoredSession.user?.app_metadata?.role || restoredSession.user?.user_metadata?.role;
              const isAdmin = sessionRole === 'admin';
              const isOperator = sessionRole === 'operator';
              const isCustomer = sessionRole === 'customer';
              if (isAdmin || isOperator || isCustomer) {
                setIsAdminAuthenticated(true);
                localStorage.setItem('trv_admin_auth', 'true');
                const roleStr = isAdmin ? 'admin' : isOperator ? 'operator' : 'customer';
                setUserRole(roleStr);
                localStorage.setItem('trv_user_role', roleStr);
                return;
              }
            }
            // Sesión no restaurable, limpiar admin
            setIsAdminAuthenticated(false);
            setUserRole(null);
            localStorage.removeItem('trv_admin_auth');
            localStorage.removeItem('trv_user_role');
          });
        }
      }
    });

    return () => subscription?.unsubscribe?.();
  }, []);

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const isFavorite = (itemId: string) => {
    return favorites.includes(itemId);
  };

  // --- REVIEWS ---
  const addReview = async (productId: string, rating: number, comment?: string): Promise<boolean> => {
    if (!currentUser) return false;
    
    const newReview: ProductReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      product_id: productId,
      user_id: currentUser.id,
      user_name: currentUser.nombre,
      rating,
      comment: comment || undefined,
      created_at: new Date().toISOString()
    };

    // Save to Supabase
    const { error } = await supabase.from('product_reviews').insert({
      id: newReview.id,
      product_id: newReview.product_id,
      user_id: newReview.user_id,
      user_name: newReview.user_name,
      rating: newReview.rating,
      comment: newReview.comment
    });

    if (error) {
      console.error('Error adding review:', error);
      return false;
    }

    setReviews(prev => [...prev, newReview]);
    
    addNotification(
      'Nueva Reseña ⭐',
      `${currentUser.nombre} calificó un producto con ${rating} estrella${rating !== 1 ? 's' : ''}.`,
      'admin'
    );
    
    return true;
  };

  const getProductReviews = (productId: string): ProductReview[] => {
    return reviews.filter(r => r.product_id === productId);
  };

  const getProductAverageRating = (productId: string): number => {
    const productReviews = reviews.filter(r => r.product_id === productId);
    if (productReviews.length === 0) return 0;
    const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / productReviews.length;
  };

  // --- FLASH SALES ---
  const getActiveFlashSale = (productId: string): FlashSale | null => {
    const now = new Date().toISOString();
    return flashSales.find(
      fs => fs.product_id === productId && fs.active && fs.end_date > now
    ) || null;
  };

  const requestPart = async (nombre: string, telefono: string, descripcion: string, imagenUrl?: string): Promise<boolean> => {
    console.warn('AppContext: Procesando solicitud de producto:', descripcion);
    // Fire-and-forget: no bloquear si falla RLS
    const adminRes = await addNotification(
      'Nueva Solicitud de Producto Especial',
      `Solicitud de: ${nombre} (${telefono})\n\nFoodItem: ${descripcion}${imagenUrl ? `\n\nImagen disponible` : ''}`,
      'request',
      telefono
    ).catch(() => false);
     // Also notify user that request was received
     const userRes = await addNotification(
      'Solicitud de Producto Recibida',
      `Hola ${nombre}, hemos recibido tu solicitud para "${descripcion.substring(0, 30)}...". Un agente de ${config.site_nombre || 'nuestra tienda'} te contactará pronto.`,
      'personal',
      telefono
    ).catch(() => false);
    console.warn('AppContext: Resultados de envío:', { adminRes, userRes });
    return adminRes || userRes;
  };

  // Catalog CRUD Functions
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const DB_PRODUCT_COLUMNS = [
    'nombre', 'descripcion', 'descripcion_completa', 'categoria', 'precio_usd', 'precio_anterior_usd',
    'stock', 'imagen_urls', 'es_promo', 'es_nuevo', 'es_mas_vendido',
    'delivery_gratis', 'activo', 'ingredientes', 'alergenos', 'calorias',
    'sizes', 'option_groups', 'related_ids', 'estimated_prep_time',
    'order_count', 'promo_end_date', 'disponibilidad', 'combo_ids',
  ];

  const addProduct = async (productData: Omit<FoodItem, 'id'>): Promise<void> => {
    // Supabase Async Sync - only include columns that exist in DB and avoid undefined
    const insertPayload: Record<string, unknown> = {};
    for (const key of DB_PRODUCT_COLUMNS) {
      if (key in productData && (productData as any)[key] !== undefined) {
        (insertPayload as any)[key] = (productData as any)[key];
      }
    }
    const { data, error } = await supabase.from('products').insert([insertPayload]).select().single();
    if (error) {
      console.error('Add product error:', error);
      addNotification('Error al agregar producto', error.message || 'Error de base de datos', 'admin');
      throw error;
    }
    if (data) setProducts(prev => [data as FoodItem, ...prev]);
  };

  const updateProduct = async (id: string, updated: Partial<FoodItem>): Promise<void> => {
    const prevSnapshot = products;
    // Optimistic local update
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updated } : p)));

    // Only sync to Supabase if ID is a valid UUID
    if (UUID_RE.test(id)) {
      const updatePayload: Record<string, unknown> = {};
      for (const key of DB_PRODUCT_COLUMNS) {
        if (key in updated && (updated as any)[key] !== undefined) {
          (updatePayload as any)[key] = (updated as any)[key];
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('products').update(updatePayload).eq('id', id);
        if (error) {
          // Revert optimistic update on failure
          setProducts(prevSnapshot);
          console.error('Update product error:', error);
          addNotification('Error al actualizar producto', error.message || 'Error de base de datos', 'admin');
          throw error;
        }
      }
    }
  };

  const deleteProduct = async (id: string): Promise<void> => {
    if (UUID_RE.test(id)) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        console.error('Delete product error:', error);
        addNotification('Error al eliminar producto', error.message || 'Error de base de datos', 'admin');
        throw error;
      }
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Buscador Inteligente
  const searchItems = useCallback((query: string, includeInactive = false): FoodItem[] => {
    const itemsToSearch = products || [];
    if (!query || query.trim() === '') return itemsToSearch.filter(p => includeInactive || p.activo !== false);
    
    const cleanQuery = query.toLowerCase().trim();
    const tokens = cleanQuery.split(/\s+/);
    
    return itemsToSearch.filter(item => {
      if (!includeInactive && item.activo === false) {
        return false;
      }
      
      const itemSearchText = `${item.nombre} ${item.descripcion} ${getCategories(item).join(' ')} ${(item.ingredientes || []).join(' ')} ${item.delivery_gratis ? 'delivery gratis' : ''}`.toLowerCase();
      
      return tokens.every(tok => itemSearchText.includes(tok));
    }).sort((a, b) => {
      const aName = a.nombre.toLowerCase();
      const bName = b.nombre.toLowerCase();
      
      const aStarts = aName.startsWith(cleanQuery);
      const bStarts = bName.startsWith(cleanQuery);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return 0;
    });
  }, [products]);

  // Cart Actions
  const addToCart = (item: FoodItem, qty = 1, selectedOptions?: SelectedOption[], optionsTotal = 0, removedIngredients?: string[]) => {
    setCart(prev => {
      const optionsKey = selectedOptions && selectedOptions.length > 0
        ? JSON.stringify([...selectedOptions].sort((a, b) => a.option_name.localeCompare(b.option_name)))
        : '';
      const cartKey = `${item.id}${optionsKey ? `_${optionsKey}` : ''}`;

      const idx = prev.findIndex(ci => {
        const itemOptionsKey = ci.selected_options && ci.selected_options.length > 0
          ? JSON.stringify([...ci.selected_options].sort((a, b) => a.option_name.localeCompare(b.option_name)))
          : '';
        return `${ci.item.id}${itemOptionsKey ? `_${itemOptionsKey}` : ''}` === cartKey;
      });

      if (idx > -1) {
        const currentQty = prev[idx].quantity;
        const targetQty = Math.min(item.stock, currentQty + qty);
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: targetQty };
        return copy;
      } else {
        return [...prev, {
          item: item,
          quantity: Math.min(item.stock, qty),
          selected_options: selectedOptions,
          options_total_usd: optionsTotal,
          ingredientes_removidos: removedIngredients || []
        }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(ci => ci.item.id !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.item.id === itemId);
      if (idx > -1) {
        const itemStock = prev[idx].item.stock;
        const targetQty = Math.max(1, Math.min(itemStock, quantity));
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: targetQty };
        return copy;
      }
      return prev;
    });
  };

  const clearCart = useCallback(() => {
    setCart([]);
    try { localStorage.removeItem('trv_cart'); } catch {}
  }, []);

  // Mesas Management
  const fetchMesas = useCallback(async () => {
    const { data, error } = await supabase.from('mesas').select('*').order('numero_mesa');
    if (!error && data) {
      setMesas(data as Mesa[]);
      localStorage.setItem('trv_mesas', JSON.stringify(data));
    }
  }, []);

  const addMesa = useCallback(async (numeroMesa: number, nombrePersonalizado?: string): Promise<boolean> => {
    // Verificar que no exista una mesa con ese número
    if (mesas.some(m => m.numero_mesa === numeroMesa)) {
      console.warn(`[addMesa] Ya existe una mesa con el número ${numeroMesa}`);
      return false;
    }
    const newMesa = {
      numero_mesa: numeroMesa,
      nombre_personalizado: nombrePersonalizado || `Mesa ${numeroMesa}`,
      estado: 'Disponible' as const,
    };
    const { data, error } = await supabase.from('mesas').insert([newMesa]).select().single();
    if (error) {
      console.error('[addMesa] Error:', error);
      return false;
    }
    if (data) {
      setMesas(prev => [...prev, data as Mesa].sort((a, b) => a.numero_mesa - b.numero_mesa));
      localStorage.setItem('trv_mesas', JSON.stringify([...mesas, data].sort((a, b) => a.numero_mesa - b.numero_mesa)));
    }
    return true;
  }, [mesas]);

  const deleteMesa = useCallback(async (id: string): Promise<void> => {
    const prevMesas = mesas;
    setMesas(prev => prev.filter(m => m.id !== id));
    localStorage.setItem('trv_mesas', JSON.stringify(prevMesas.filter(m => m.id !== id)));
    const { error } = await supabase.from('mesas').delete().eq('id', id);
    if (error) {
      setMesas(prevMesas);
      localStorage.setItem('trv_mesas', JSON.stringify(prevMesas));
      console.error('[deleteMesa] Error:', error);
    }
  }, [mesas]);

  const updateMesa = useCallback(async (id: string, updates: Partial<Mesa>) => {
    const prevMesas = mesas;
    setMesas(prev => {
      const next = prev.map(m => m.id === id ? { ...m, ...updates } : m);
      localStorage.setItem('trv_mesas', JSON.stringify(next));
      return next;
    });
    const { error } = await supabase.from('mesas').update(updates).eq('id', id);
    if (error) {
      setMesas(prevMesas);
      localStorage.setItem('trv_mesas', JSON.stringify(prevMesas));
      console.error('[updateMesa] Error:', error);
    }
  }, [mesas]);

  // Orders Management
  const createOrder = async (orderData: Omit<Order, 'id' | 'subtotal_usd' | 'total_usd' | 'total_bs' | 'fecha' | 'status'> & { descuento_cupon_usd?: number; cupon_codigo?: string; guest_password?: string; status_override?: string }, preGeneratedId?: string) => {
    // Recalculate Totals securely - includes extras/options pricing
    const items = cart.map(item => ({
      food_id: item.item.id,
      nombre: item.item.nombre,
      precio_usd: item.item.precio_usd,
      cantidad: item.quantity,
      selected_options: item.selected_options,
      options_total_usd: item.options_total_usd,
      ingredientes_removidos: item.ingredientes_removidos || []
    }));

    const subtotal = items.reduce((acc, item) => {
      const itemTotal = (item.precio_usd + (item.options_total_usd || 0)) * item.cantidad;
      return acc + itemTotal;
    }, 0);
    console.warn('Subtotal:', subtotal);
    
    // Apply discount based on payment method
    let discountPercent = 0;
    if (orderData.metodo_pago === 'Pago Móvil') discountPercent = config.pagomovil_discount_percent || 0;
    else if (orderData.metodo_pago === 'Zelle') discountPercent = config.zelle_discount_percent || 0;
    else if (orderData.metodo_pago === 'Efectivo') discountPercent = config.efectivo_discount_percent || 0;
    else if (orderData.metodo_pago === 'Transferencia') discountPercent = config.transferencia_discount_percent || 0;
    
    console.warn('Discount Percent:', discountPercent, 'Payment Method:', orderData.metodo_pago);
    
    const discountAmount = (subtotal || 0) * ((discountPercent || 0) / 100);
    const subtotalAfterDiscount = (subtotal || 0) - (discountAmount || 0) - (orderData.descuento_cupon_usd || 0);
    
    console.warn('Discount Amount:', discountAmount, 'Costo Envío:', orderData.costo_envio_usd);
    
    const totalUsd = (subtotalAfterDiscount || 0) + (orderData.costo_envio_usd || 0);
    const totalBs = (totalUsd || 0) * (config.tasa_cambio || 1);

    console.warn('Total USD:', totalUsd, 'Total BS:', totalBs);



    const newOrder: Order = {
      ...orderData,
      id: preGeneratedId || `ORD-${String(Math.floor(10000 + Math.random() * 90000)).padStart(6, '0')}`,
      usuario_id: orderData.usuario_id || (currentUser ? currentUser.id : undefined),
      items,
      subtotal_usd: subtotal,
      total_usd: totalUsd,
      total_bs: totalBs,
      status: (orderData as any).status_override || 'Pendiente',
      fecha: new Date().toLocaleString()
    };

    // Nota: El stock se decrementa via trigger handle_new_order_actions en Supabase.
    // Solo enviamos alerta de stock bajo aquí.
    for (const cartItem of cart) {
      const nextStock = Math.max(0, cartItem.item.stock - cartItem.quantity);
      if (cartItem.item.stock >= 5 && nextStock < 5) {
        addNotification(
          'Alerta de Stock Bajo (Admin)',
          `El producto "${cartItem.item.nombre}" tiene un nivel crítico de ${nextStock} unidades.`,
          'admin'
        );
      }
    }

    // Supabase Insert
    const { error } = await supabase.from('orders').insert([{
      id: newOrder.id,
      cliente_nombre: newOrder.cliente_nombre,
      cliente_telefono: newOrder.cliente_telefono,
      cliente_email: newOrder.cliente_email,
      cliente_uid: newOrder.usuario_id,
      usuario_id: newOrder.usuario_id || '',
      items: newOrder.items,
      descuento_cupon_usd: orderData.descuento_cupon_usd || 0,
      cupon_codigo: orderData.cupon_codigo || null,
      subtotal_usd: newOrder.subtotal_usd,
      costo_envio_usd: newOrder.costo_envio_usd,
      total_usd: newOrder.total_usd,
      total_bs: newOrder.total_bs,
      metodo_pago: newOrder.metodo_pago,
      tipo_pedido: (orderData as any).tipo_pedido || newOrder.tipo_entrega || 'delivery',
      tipo_entrega: newOrder.tipo_entrega || (orderData as any).tipo_pedido || 'delivery',
      numero_mesa: (orderData as any).numero_mesa || null,
      nombre_cliente: (orderData as any).nombre_cliente || '',
      referencia_pago: (orderData as any).referencia_pago || '',
      banco_origen: (orderData as any).banco_origen || '',
      lat: newOrder.lat,
      lng: newOrder.lng,
      direccion_envio: newOrder.direccion_envio,
      distancia_km: newOrder.distancia_km,
      status: newOrder.status,
      tiempo_estimado_entrega: newOrder.tiempo_estimado_entrega,
      guest_phone: orderData.guest_phone || null,
      guest_email: (!currentUser && orderData.cliente_email) ? orderData.cliente_email : null,
      crear_cuenta: orderData.crear_cuenta || false,
      sede_id: (orderData as any).sede_id || '',
      notas_admin: orderData.notas_admin || '',
      fecha: new Date().toISOString()
    }]);

    if (error) {
      console.error('Insert order error:', error);
      addNotification('Error al procesar pedido', 'No se pudo crear la orden. Intente de nuevo.', 'admin');
      return null;
    }

    setOrders(prev => [newOrder, ...prev]);

    // NOTA: La auto-registro de invitados se ejecuta DESPUÉS del checkout
    // para evitar que setCurrentUser dispare initData y desmonte el componente
    // mientras el usuario está en el flujo de pago. Se llama desde Checkout.tsx
    // después de setProcessedOrder().

    // BROADCAST: Enviar señal inmediata al Admin sin esperar a la DB
    try {
      const broadcastChannel = supabase.channel('marketo_broadcast_send');
      await new Promise<void>((resolve) => {
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
      });
      const sendResult = await broadcastChannel.send({
        type: 'broadcast',
        event: 'new_order_broadcast',
        payload: newOrder
      });
      if (sendResult === 'ok' || (typeof sendResult === 'object' && sendResult !== null && (sendResult as { error?: unknown }).error === null)) {
        console.log('[Broadcast] new_order_broadcast enviado:', newOrder.id);
      } else {
        console.warn('[Broadcast] new_order_broadcast resultado inesperado:', sendResult);
      }
      supabase.removeChannel(broadcastChannel);
    } catch (broadcastErr) {
      console.error('[Broadcast] Error enviando new_order_broadcast:', broadcastErr);
    }

    // Nota: La notificacion admin del nuevo pedido la genera el trigger de Supabase
    // handle_new_order_actions (SECURITY DEFINER), no el frontend. Asi evitamos
    // duplicados y fallos de RLS con clientes anonimos.

    // Notify the client that their order was received
    if (newOrder.cliente_telefono) {
      addNotification(
        'Pedido Recibido con Exito 📦',
        `Hola ${newOrder.cliente_nombre}! Tu pedido con ID ${newOrder.id} por un monto de $${newOrder.total_usd.toFixed(2)} (${newOrder.total_bs.toFixed(2)} Bs) ha sido ingresado en estado: Pendiente. Estamos listos para atenderte.`,
        'personal',
        newOrder.cliente_telefono,
        undefined,
        '/profile'
      );
    }

    return newOrder;
  };

  // Auto-registro de invitados: se llama DESPUÉS de que el checkout ya procesó
  // el pedido, para evitar que setCurrentUser dispare initData y desmonte el
  // componente durante el flujo de pago.
  const registerGuestUser = async (orderData: { cliente_nombre: string; cliente_telefono: string; cliente_email?: string }) => {
    if (currentUser) return;
    if (!orderData.cliente_email && !orderData.cliente_telefono) return;

    const cleanPhone = orderData.cliente_telefono.replace(/[\s\-()]/g, '');
    const email = (orderData.cliente_email || '').trim().toLowerCase() || `${cleanPhone}@guest.foodapp.local`;
    let userId = '';
    let authSucceeded = false;

    // 1. Primero intentar signIn (si ya tiene cuenta por email)
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: cleanPhone
      });
      if (!signInError && signInData?.user) {
        userId = signInData.user.id;
        authSucceeded = true;
      }
    } catch { /* signIn falló, intentar signUp */ }

    // 2. Si signIn falla, intentar signUp con options flowType: 'implicit' para evitar
    //    problemas con PKCE + email confirmation en invitados
    if (!authSucceeded) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: cleanPhone,
          options: {
            data: {
              nombre: orderData.cliente_nombre,
              telefono: cleanPhone
            },
            emailRedirectTo: window.location.origin
          }
        });
        if (!authError && authData?.user) {
          userId = authData.user.id;
          // Si hay sesión activa (auto-confirmado), auth funciona
          // Si no (email confirmation pendiente), igual guardamos el userId
          if (authData.session) {
            authSucceeded = true;
          } else {
            // signUp exitoso pero sin sesión (email confirmation pendiente)
            // Usamos el userId pero marcamos authSucceeded como false
            // para que el frontend funcione con phone-based RLS
            console.warn('[registerGuestUser] signUp ok pero sin sesión (email confirmation pendiente)');
          }
        }
      } catch (e) { console.warn('[registerGuestUser] signUp exception:', e); }
    }

    // 3. Si no hay auth, generar un userId estable basado en teléfono (no aleatorio)
    if (!userId) {
      // Usar un ID determinista basado en teléfono para que sea reutilizable
      userId = `guest-${cleanPhone}`;
    }

    // 4. SIEMPRE hacer setCurrentUser para que el cliente quede logueado
    const newUser: AppUser = {
      id: userId,
      nombre: orderData.cliente_nombre,
      email,
      telefono: cleanPhone,
      contrasena: 'auth_managed',
      createdAt: new Date().toISOString()
    };
    setCurrentUser(newUser);

    // 5. Vincular pedidos guest existentes al nuevo usuario registrado
    if (authSucceeded && userId && !userId.startsWith('guest-')) {
      try {
        await supabase.rpc('link_guest_orders', { p_phone: cleanPhone });
      } catch (e) {
        console.warn('No se pudieron vincular pedidos guest:', e);
      }
    }

    // 6. Notificación de bienvenida (no bloquear si falla)
    if (authSucceeded) {
      addNotification(
        '¡Cuenta Creada!',
        `Hola ${newUser.nombre}. Tu cuenta fue creada automáticamente. Tu contraseña es tu número de teléfono.`,
        'personal',
        newUser.telefono
      ).catch(() => {});
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status'], estimatedTime?: string, notas?: string) => {
    const updatePayload: any = { status };
    if (estimatedTime !== undefined) updatePayload.tiempo_estimado_entrega = estimatedTime;
    if (notas !== undefined) updatePayload.notas_admin = notas;

    const prevOrder = ordersRef.current.find(o => o.id === orderId);

    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      ...updatePayload
    } : o));

    const targetPhone = prevOrder?.cliente_telefono;
    const clientName = prevOrder?.cliente_nombre || 'Cliente';
    const isMesa = prevOrder?.tipo_entrega === 'mesa' || prevOrder?.tipo_pedido === 'mesa';
    const mesaNum = prevOrder?.numero_mesa;

    let statusMsg = `Tu pedido ${orderId} ahora se encuentra en estado: ${status}.`;
    if (isMesa) {
      if (status === 'En preparación') {
        statusMsg = `🍳 ¡${clientName}! Tu pedido de Mesa ${mesaNum} está en preparación.`;
      } else if (status === 'Listo') {
        statusMsg = `✅ ¡${clientName}! Tu pedido de Mesa ${mesaNum} está listo. ¡Puedes pasar a recogerlo!`;
      } else if (status === 'Entregado') {
        statusMsg = `✅ Pedido de Mesa ${mesaNum} completado. ¡Gracias por preferirnos!`;
      }
    } else {
      if (status === 'En preparación') {
        statusMsg = `🥬 ¡Buenas noticias, ${clientName}! Tu pedido ${orderId} ya está en preparación.`;
      } else if (status === 'En camino') {
        statusMsg = `🛵 ¡Tu pedido ${orderId} va en camino!`;
      } else if (status === 'Entregado') {
        statusMsg = `✅ Pedido ${orderId} entregado con éxito. ¡Gracias por preferir a ${config.site_nombre || 'nuestra tienda'}!`;
      }
    }
    if (estimatedTime) statusMsg += ` Tiempo estimado: ${estimatedTime}.`;

    const { error } = await supabase.from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) {
      console.error('Update order status error:', error);
      if (prevOrder) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...prevOrder } : o));
      }
      return false;
    } else {
      // Enviar notificación DESPUÉS del UPDATE exitoso (fire-and-forget, no bloquea)
      if (targetPhone) {
        addNotification('Estado de Pedido Actualizado', statusMsg, 'personal', targetPhone, undefined, '/profile');
      } else {
        addNotification('Estado de Pedido Actualizado', statusMsg, 'admin', undefined, undefined, '/admin');
      }

      // Broadcast instantáneo para que el cliente reciba el cambio en <100ms
      try {
        const updatedOrder = { ...prevOrder, ...updatePayload } as Order;
        const statusChannel = supabase.channel('marketo_broadcast_send');
        await new Promise<void>((resolve) => {
          statusChannel.subscribe((st) => { if (st === 'SUBSCRIBED') resolve(); });
        });
        await statusChannel.send({
          type: 'broadcast',
          event: 'order_status_broadcast',
          payload: updatedOrder
        });
        supabase.removeChannel(statusChannel);
      } catch (e) {
        console.warn('Broadcast status update failed:', e);
      }
      return true;
    }
  };

  const confirmMesaPayment = async (orderId: string) => {
    const prevOrder = ordersRef.current.find(o => o.id === orderId);
    if (!prevOrder) return false;

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completado' as Order['status'] } : o));

    const { error } = await supabase.from('orders')
      .update({ status: 'completado' })
      .eq('id', orderId);

    if (error) {
      console.error('confirmMesaPayment error:', error);
      if (prevOrder) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...prevOrder } : o));
      }
      return false;
    }

    try {
      const updatedOrder = { ...prevOrder, status: 'completado' } as Order;
      const paymentChannel = supabase.channel('marketo_broadcast_send');
      await new Promise<void>((resolve) => {
        paymentChannel.subscribe((st) => { if (st === 'SUBSCRIBED') resolve(); });
      });
      await paymentChannel.send({
        type: 'broadcast',
        event: 'order_status_broadcast',
        payload: updatedOrder
      });
      supabase.removeChannel(paymentChannel);
    } catch (e) {
      console.warn('Broadcast confirm payment failed:', e);
    }

    return true;
  };

  // Re-fetch orders from the DB (used to guarantee the admin panel reflects the
  // latest orders even if the realtime subscription missed an event).
  const refreshOrders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const sessionRole = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
    let isAdmin = sessionRole === 'admin';
    let isOperator = sessionRole === 'operator';
    const principalSedeId = (config.sedes || []).find(s => s.es_principal)?.id || (config.sedes || [])[0]?.id || '';

    // FALLBACK: detect local admin session when no Supabase session exists
    if (!isAdmin && !isOperator && !session) {
      const storedRole = localStorage.getItem('trv_user_role');
      if (storedRole === 'admin') isAdmin = true;
      else if (storedRole === 'operator') isOperator = true;
    }

    try {
      if (isAdmin) {
        const { data } = await supabase.from('orders').select('*').order('fecha', { ascending: false });
        if (data) setOrders(data as Order[]);
      } else if (isOperator) {
        const { data } = await supabase.from('orders').select('*').order('fecha', { ascending: false });
        if (data) setOrders(data as Order[]);
      } else if (currentUser) {
        const { data } = await supabase.from('orders')
          .select('*')
          .or(`cliente_telefono.eq."${currentUser.telefono}",cliente_uid.eq."${currentUser.id}"`)
          .order('fecha', { ascending: false });
        if (data) setOrders(data as Order[]);
      }
    } catch (err) {
      console.warn('[refreshOrders] failed:', err);
    }
  }, [config.sedes, adminScopeSedeId, currentUser]);

  const updateOrderItems = async (orderId: string, newItems: OrderItem[]) => {
    const originalOrder = ordersRef.current.find(o => o.id === orderId);
    if (!originalOrder) return;

    const oldItems = originalOrder.items;

    // Lógica para sincronizar stock automáticamente
    const stockChanges = new Map<string, number>();

    oldItems.forEach(item => {
      stockChanges.set(item.food_id, -(item.cantidad || 0));
    });

    newItems.forEach(item => {
      const current = stockChanges.get(item.food_id) || 0;
      stockChanges.set(item.food_id, current + (item.cantidad || 0));
    });

    for (const [itemId, diff] of stockChanges.entries()) {
      if (diff === 0) continue;
      // Decremento atomico en BD para evitar carreras (TOCTOU / overselling).
      const { error: rpcError } = await supabase.rpc('adjust_stock', { p_id: itemId, p_delta: -diff });
      if (!rpcError) continue;
      // Si el RPC no esta desplegado/habilitado: fallback con guardia de stock suficiente.
      console.warn('rpc adjust_stock fallo, usando fallback:', rpcError.message);
      if (!UUID_RE.test(itemId)) continue;
      const { data: p } = await supabase.from('products').select('stock').eq('id', itemId).single();
      if (p && p.stock >= diff) {
        await supabase.from('products').update({ stock: p.stock - diff }).eq('id', itemId);
      }
    }

    // Recalcular totales basados en la nueva lista de items
    const subtotal = newItems.reduce((acc, item) => acc + (item.precio_usd * item.cantidad), 0);
    
    let discountPercent = 0;
    if (originalOrder.metodo_pago === 'Pago Móvil') discountPercent = config.pagomovil_discount_percent || 0;
    else if (originalOrder.metodo_pago === 'Zelle') discountPercent = config.zelle_discount_percent || 0;
    else if (originalOrder.metodo_pago === 'Efectivo') discountPercent = config.efectivo_discount_percent || 0;
    else if (originalOrder.metodo_pago === 'Transferencia') discountPercent = config.transferencia_discount_percent || 0;

    const discountAmount = subtotal * (discountPercent / 100);
    const subtotalAfterDiscount = subtotal - discountAmount - (originalOrder.descuento_cupon_usd || 0);
    const totalUsd = subtotalAfterDiscount + (originalOrder.costo_envio_usd || 0);
    const totalBs = totalUsd * config.tasa_cambio;

    const updatePayload = {
      items: newItems,
      subtotal_usd: subtotal,
      total_usd: totalUsd,
      total_bs: totalBs
    };

    const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
    if (error) {
      console.error('Update order items error:', error);
      throw error;
    }

    // Actualizar estado local y notificar al cliente
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
    addNotification('Pedido Modificado', `Se han actualizado los productos de tu pedido ${orderId}. El nuevo total es $${totalUsd.toFixed(2)}.`, 'personal', originalOrder.cliente_telefono);
  };

  // --- COUPON MANAGEMENT ---
  const addCoupon = async (coupon: Omit<Coupon, 'id' | 'usage_count'>) => {
    const { data, error } = await supabase.from('coupons').insert([coupon]).select().single();
    if (error) {
      console.error('Error adding coupon:', error);
      return;
    }
    if (data) setCoupons(prev => [...prev, data as Coupon]);
  };

  const updateCoupon = async (id: string, updated: Partial<Coupon>) => {
    const { error } = await supabase.from('coupons').update(updated).eq('id', id);
    if (error) {
      console.error('Error updating coupon:', error);
      return;
    }
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const deleteCoupon = async (id: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) return;
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  // User Management Implementation
  const registerUser = async (nombre: string, username: string, email: string, telefono: string, contrasena: string): Promise<AppUser> => {
    // 1. Registrar primero en Supabase Auth para obtener el UID oficial
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: contrasena.trim(),
      options: { data: { nombre: nombre.trim(), username: username.trim(), telefono: telefono.trim() } }
    });

    if (authError) {
      // Auditar registro fallido
      await supabase.rpc('register_client_audit', {
        p_email: email.trim().toLowerCase(),
        p_username: username.trim(),
        p_success: false,
        p_error: authError.message,
      }).then(() => {}, () => {}); // No bloquear si falla auditoría
      
      if (authError.status === 429) {
        throw new Error("Límite de intentos alcanzado. Por favor, espere un minuto antes de intentar de nuevo.");
      }
      throw authError;
    }

    const newUser: AppUser = {
      id: authData.user?.id || `user-${Date.now()}`,
      nombre: nombre.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono.trim(),
      contrasena: 'auth_managed',
      createdAt: new Date().toISOString()
    };

    // NOTA: El insert en 'usuarios_clientes' lo maneja el Trigger 'on_auth_user_created' 
    // en la base de datos para evitar errores 409 de duplicidad y asegurar atomicidad.

    setUsers(prev => {
      // Remove any existing user with the same phone to avoid duplicates
      const filtered = prev.filter(u => u.telefono.trim() !== newUser.telefono.trim());
      return [...filtered, newUser];
    });
    setCurrentUser(newUser);

    // Auditar registro exitoso
    await supabase.rpc('register_client_audit', {
      p_email: email.trim().toLowerCase(),
      p_username: username.trim(),
      p_success: true,
    }).then(() => {}, () => {}); // No bloquear si falla auditoría

    // Aplicar welcome bonus de lealtad si esta habilitado
    const loyaltyConfig = config.loyalty;
    if (loyaltyConfig?.enabled && loyaltyConfig.welcome_bonus > 0 && authData.user?.id) {
      const bonusPoints = loyaltyConfig.welcome_bonus;
      try {
        await supabase.from('loyalty_history').insert({
          user_id: authData.user.id,
          points: bonusPoints,
          operation: 'suma',
          reason: 'bienvenida',
          description: 'Bonus de bienvenida',
          created_by: 'system',
        });
        await supabase.from('usuarios_clientes')
          .update({ puntos_fidelidad: bonusPoints, puntos_historicos: bonusPoints })
          .eq('id', authData.user.id);
      } catch (e) {
        console.error('[Loyalty] Welcome bonus sync failed:', e);
      }
      setLoyaltyTransactions(prev => [...prev, {
        id: `loy-tx-welcome-${Date.now()}`,
        user_id: authData.user!.id,
        operation: 'suma',
        reason: 'bienvenida',
        points: bonusPoints,
        description: 'Bonus de bienvenida',
        created_at: new Date().toISOString(),
      }]);
      setUsers(prev => prev.map(u => {
        if (u.id !== authData.user?.id) return u;
        return { ...u, puntos_fidelidad: bonusPoints, puntos_historicos: bonusPoints, loyalty_points: bonusPoints, loyalty_lifetime_points: bonusPoints };
      }));
      setCurrentUser(prev => prev ? { ...prev, puntos_fidelidad: bonusPoints, puntos_historicos: bonusPoints, loyalty_points: bonusPoints, loyalty_lifetime_points: bonusPoints } : prev);
    }

    addNotification(
      '¡Registro Exitoso! 🎉',
      `Hola ${newUser.nombre}. Te has registrado con éxito. Recuerda que con tu usuario (${newUser.username}), teléfono (${newUser.telefono}) y tu clave secreta podrás acceder siempre a tu panel de usuario.`,
      'personal',
      newUser.telefono
    );
    
    return newUser;
  };

  const loginUser = async (identifier: string, contrasena: string): Promise<AppUser | null> => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password: contrasena.trim() }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Login error:', result.error);
        return null;
      }

      if (!result.user) {
        console.error('Login success but no user data');
        return null;
      }

      const user: AppUser = {
        id: result.user.id,
        nombre: result.user.nombre,
        email: result.user.email,
        username: result.user.username,
        telefono: result.user.telefono,
        contrasena: 'auth_managed',
        createdAt: new Date().toISOString(),
        puntos_fidelidad: 0,
        puntos_historicos: 0,
        codigo_referido: '',
        referred_by: '',
        referral_count: 0,
        sede_preferida_id: '',
        is_pwa_installed: false,
        pwa_installed_at: undefined,
        loyalty_points: 0,
        loyalty_lifetime_points: 0,
      };

      // Cargar datos completos del cliente desde usuarios_clientes
      const { data: dbUser } = await supabase
        .from('usuarios_clientes')
        .select('*')
        .eq('id', result.user.id)
        .single();

      if (dbUser) {
        user.puntos_fidelidad = dbUser.puntos_fidelidad || dbUser.loyalty_points || 0;
        user.puntos_historicos = dbUser.puntos_historicos || dbUser.loyalty_lifetime_points || 0;
        user.codigo_referido = dbUser.codigo_referido || '';
        user.referred_by = dbUser.referred_by || '';
        user.referral_count = dbUser.referral_count || 0;
        user.sede_preferida_id = dbUser.sede_preferida_id || '';
        user.is_pwa_installed = dbUser.is_pwa_installed || false;
        user.pwa_installed_at = dbUser.pwa_installed_at || undefined;
        user.loyalty_points = dbUser.loyalty_points || 0;
        user.loyalty_lifetime_points = dbUser.loyalty_lifetime_points || 0;
        user.createdAt = dbUser.created_at || user.createdAt;
      }

      // Establecer sesión en Supabase Auth si tenemos token
      if (result.session_token) {
        await supabase.auth.setSession({
          access_token: result.session_token,
          refresh_token: '',
        });
      }

      setCurrentUser(user);
      addNotification(
        'Sesión Iniciada',
        `Bienvenido de vuelta, ${user.nombre}. Accede a tus notificaciones y estatus de compras desde este panel.`,
        'personal',
        user.telefono
      );

      // Check PWA install status on login
      if (!user.is_pwa_installed && detectPwaInstalled()) {
        markUserAsPwaInstalled(user.id);
      }

      return user;
    } catch (error) {
      console.error('Login exception:', error);
      return null;
    }
  };

  const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile?reset=true`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logoutUser = async () => {
    setCurrentUser(null);
    await supabase.auth.signOut();
  };

  const updateUser = (updated: Partial<AppUser>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updated };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

    // Update in Supabase in background (sin contraseña - manejada por Supabase Auth)
    const updatePayload: any = {};
    if (updated.nombre !== undefined) updatePayload.nombre = updated.nombre;
    if (updated.telefono !== undefined) updatePayload.telefono = updated.telefono;
    if (updated.email !== undefined) updatePayload.email = updated.email;

    if (Object.keys(updatePayload).length > 0) {
      supabase.from('usuarios_clientes')
        .update(updatePayload)
        .eq('id', currentUser.id)
        .then(({ error }) => {
          if (error) console.error('Error updating user in Supabase:', error);
        });
    }

    addNotification(
      'Datos Actualizados ⚙️',
      `Tus datos han sido guardados. Nombre: ${updatedUser.nombre}, Teléfono: ${updatedUser.telefono}.`,
      'personal',
      updatedUser.telefono
    );
  };

  const updateUserByAdmin = (userId: string, updated: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
    
    // If the updated user is the current user, update current user too
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, ...updated } : null);
    }

    // Sync to Supabase in background (sin contraseña - manejada por Supabase Auth)
    const updatePayload: any = {};
    if (updated.nombre !== undefined) updatePayload.nombre = updated.nombre;
    if (updated.telefono !== undefined) updatePayload.telefono = updated.telefono;
    if (updated.email !== undefined) updatePayload.email = updated.email;

    if (Object.keys(updatePayload).length > 0) {
      supabase.from('usuarios_clientes')
        .update(updatePayload)
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.error('Error updating user by admin in Supabase:', error);
        });
    }
  };

  const syncCategoriesToSupabase = (newCategories: string[]) => {
    supabase.from('store_config').upsert({ id: 1, categories: newCategories })
      .then(({ error }) => { if (error) console.error('[Categories] Sync error:', error.message); });
  };

  const addCategory = (categoryName: string) => {
    setConfig(prev => {
      const currentCats = prev.categories || [];
      if (currentCats.includes(categoryName)) return prev;
      const updatedCats = [...currentCats, categoryName];
      const updated = { ...prev, categories: updatedCats };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      syncCategoriesToSupabase(updatedCats);
      return updated;
    });
  };

  const deleteCategory = (categoryName: string) => {
    setConfig(prev => {
      const currentCats = prev.categories || [];
      const updatedCats = currentCats.filter(c => c !== categoryName);
      const updated = { ...prev, categories: updatedCats };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      syncCategoriesToSupabase(updatedCats);
      return updated;
    });

    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        if (hasCategory(p, categoryName)) {
          const newCats = getCategories(p).filter(c => c.toLowerCase() !== categoryName.toLowerCase());
          const updated = { ...p, categoria: newCats };
          if (UUID_RE.test(p.id)) {
            supabase.from('products').update({ categoria: newCats }).eq('id', p.id)
              .then(({ error }) => { if (error) console.error('[Category] Product sync error:', error.message); });
          }
          return updated;
        }
        return p;
      });
      localStorage.setItem('trv_foodItems', JSON.stringify(updatedProducts));
      return updatedProducts;
    });
  };

  const updateCategory = (oldCategory: string, newCategory: string) => {
    setConfig(prev => {
      const currentCats = prev.categories || [];
      const updatedCats = currentCats.map(c => c === oldCategory ? newCategory : c);
      const updated = { ...prev, categories: updatedCats };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      syncCategoriesToSupabase(updatedCats);
      return updated;
    });
    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        if (hasCategory(p, oldCategory)) {
          const newCats = getCategories(p).map(c => c.toLowerCase() === oldCategory.toLowerCase() ? newCategory : c);
          const updated = { ...p, categoria: newCats };
          if (UUID_RE.test(p.id)) {
            supabase.from('products').update({ categoria: newCats }).eq('id', p.id)
              .then(({ error }) => { if (error) console.error('[Category] Product sync error:', error.message); });
          }
          return updated;
        }
        return p;
      });
      localStorage.setItem('trv_foodItems', JSON.stringify(updatedProducts));
      return updatedProducts;
    });
  };

  // Configurations
  const updateConfig = (newSettings: Partial<StoreConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('trv_config', JSON.stringify(updated));

      // Acumular cambios pendientes para el debounce (evita que se pierdan cambios rapidos)
      Object.entries(newSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          pendingConfigRef.current[key] = value;
        }
      });

      // Supabase Async Sync con debounce
      if (configSaveTimeoutRef.current) {
        clearTimeout(configSaveTimeoutRef.current);
      }
      configSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.warn('[Config] No hay sesión activa, reintentando sync en próximo cambio...');
            // NO borramos pendingConfigRef - se reintentará en el próximo cambio
            return;
          }

          const settingsToSave = { ...pendingConfigRef.current };
          pendingConfigRef.current = {};

          const updatePayload: any = { id: 1 };

          Object.keys(settingsToSave).forEach(key => {
            const value = settingsToSave[key];
            if (value !== undefined) {
              if (key === 'coordenadas_tienda' && value) {
                const coord = value as { lat: number; lng: number };
                updatePayload.tienda_lat = coord.lat;
                updatePayload.tienda_lng = coord.lng;
              } else if (key === 'banners' && Array.isArray(value)) {
                if (value[0] !== undefined) updatePayload.banner_url_1 = value[0];
                if (value[1] !== undefined) updatePayload.banner_url_2 = value[1];
                if (value[2] !== undefined) updatePayload.banner_url_3 = value[2];
              } else if (key === 'banners_mobile' && Array.isArray(value)) {
                if (value[0] !== undefined) updatePayload.banner_url_1_mobile = value[0];
                if (value[1] !== undefined) updatePayload.banner_url_2_mobile = value[1];
                if (value[2] !== undefined) updatePayload.banner_url_3_mobile = value[2];
              } else {
                updatePayload[key] = value;
              }
            }
          });
          
          if (Object.keys(updatePayload).length > 1) {
            const { error: upsertErr } = await supabase.from('store_config').upsert(updatePayload);
            if (upsertErr) {
              console.error('[Config] Upsert error:', upsertErr.message);
              // Re-acumular cambios fallidos para reintento
              Object.keys(settingsToSave).forEach(key => {
                pendingConfigRef.current[key] = settingsToSave[key];
              });
            }
          }
        } catch (e) {
          console.error('[Config] Failed to sync config', e);
        }
      }, 500);
      
      return updated;
    });
  };

  const updateExchangeRate = (rate: number) => {
    if (isNaN(rate) || rate <= 10 || rate > 10000) {
      console.warn('Tasa de cambio rechazada por seguridad:', rate);
      return;
    }
    setConfig(prev => ({ ...prev, tasa_cambio: rate }));
    
    // Sincronizar con Supabase (con auth check)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('[Config] No hay sesión activa, omitiendo sync de tasa a Supabase');
          return;
        }
        const { error } = await supabase.from('store_config').update({ tasa_cambio: rate }).eq('id', 1);
        if (error) console.error('[Config] Error syncing rate to DB:', error);
      } catch (e) {
        console.error('[Config] Error syncing rate:', e);
      }
    })();
  };

  // Log notifications
  const addNotification = async (title: string, message: string, tipo: 'todos' | 'personal' | 'admin' | 'request' = 'todos', targetPhone?: string, imageUrl?: string, linkUrl?: string): Promise<boolean> => {
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newNotif: InAppNotification = {
      id: notifId,
      titulo: title,
      mensaje: message,
      fecha: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipo,
      destinatario_telefono: targetPhone,
      imagen_url: imageUrl,
      link_url: linkUrl,
      leida: false
    };

    setNotifications(prev => {
      if (prev.some(n => n.id === notifId)) return prev;
      return [newNotif, ...prev];
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (tipo === 'todos' || tipo === 'admin') {
        return true;
      }
    }

    // Disparar push ANTES del INSERT para que siempre llegue al cliente
    if (tipo === 'todos' || tipo === 'personal' || tipo === 'admin' || tipo === 'request') {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        import('../utils/pushTrigger').then(({ triggerBroadcastPush }) => {
          triggerBroadcastPush({
            id: notifId,
            titulo: title,
            mensaje: message,
            tipo,
            destinatario_telefono: targetPhone || '',
            imagen_url: imageUrl || '',
            link_url: linkUrl || '/',
          }).then(ok => {
            if (ok) console.log('[Push] Push disparado OK para:', notifId);
          }).catch(err => console.warn('[Push] Error disparando push:', err));
        });
      }
    }

    const { error } = await supabase.from('notifications').insert({
      id: notifId,
      titulo: newNotif.titulo,
      mensaje: newNotif.mensaje,
      fecha: newNotif.fecha,
      tipo: newNotif.tipo,
      destinatario_telefono: newNotif.destinatario_telefono,
      leida: newNotif.leida,
      imagen_url: newNotif.imagen_url,
      link_url: newNotif.link_url
    }).select();

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission')) {
        console.warn('[Notif] INSERT blocked by RLS, push ya disparado:', notifId);
        return true;
      }
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      return false;
    }

    return true;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    supabase.from('notifications').update({ leida: true }).eq('id', id)
      .then(({ error }) => {
        if (error) {
          // Anon users may not have UPDATE permission — silenciar si es RLS
          if (error.code === '42501' || error.message?.includes('permission')) {
            console.warn('[Notification] Mark read blocked by RLS (anon user):', error.message);
          } else {
            console.error('[Notification] Mark read sync error:', error.message);
          }
        }
      });
  };

  const toggleNotificationReadStatus = (id: string) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      const newLeida = target ? !target.leida : false;
      supabase.from('notifications').update({ leida: newLeida }).eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (error.code === '42501' || error.message?.includes('permission')) {
              console.warn('[Notification] Toggle read blocked by RLS (anon user)');
            } else {
              console.error('[Notification] Toggle read sync error:', error.message);
            }
          }
        });
      return prev.map(n => n.id === id ? { ...n, leida: newLeida } : n);
    });
  };

  const registerNotificationClick = async (id: string) => {
    // Incrementar en Supabase mediante RPC (evita problemas de RLS de escritura)
    const { error } = await supabase.rpc('increment_notification_click', { notif_id: id });
    
    if (error) {
      console.error('❌ Error al registrar clic:', error.message);
    } else {
      // Actualizar localmente para feedback inmediato en el Admin si está viendo
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, click_count: (n.click_count || 0) + 1 } : n));
    }
  };

  /**
   * Sincroniza la suscripción Push del navegador con el teléfono actual del usuario en la DB.
   * Se debe llamar siempre que el teléfono cambie.
   */
  const syncPushSubscription = async (): Promise<{ success: boolean; error?: string }> => {
    console.log('[PushSync] Iniciando syncPushSubscription...');
    if (typeof window === 'undefined') {
      console.warn('[PushSync] window no disponible (SSR)');
      return { success: false, error: 'window no disponible (SSR?)' };
    }
    if (!('serviceWorker' in navigator)) {
      console.warn('[PushSync] Service Worker no soportado');
      return { success: false, error: 'Service Worker no soportado en este navegador' };
    }
    if (!('PushManager' in window)) {
      console.warn('[PushSync] PushManager no disponible');
      return { success: false, error: 'PushManager no disponible en este navegador' };
    }
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      console.warn('[PushSync] Permiso de notificacion denegado o default');
      return { success: false, error: 'Permiso de notificacion no concedido' };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('[PushSync] SW registration lista:', registration.scope);
      const existingSub = await registration.pushManager.getSubscription();
      console.log('[PushSync] Suscripción existente:', existingSub ? existingSub.endpoint.substring(0, 50) : 'NINGUNA');

      if (!existingSub) {
        console.warn('[PushSync] No existe suscripción push activa — el usuario debe habilitar notificaciones');
        return { success: false, error: 'No existe suscripción push activa.' };
      }

      const subJSON = existingSub.toJSON();
      console.log('[PushSync] Sub keys:', { hasEndpoint: !!subJSON.endpoint, hasP256dh: !!subJSON.keys?.p256dh, hasAuth: !!subJSON.keys?.auth });

      if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
        console.warn('[PushSync] Suscripción push corrupta — faltan campos');
        return { success: false, error: 'Suscripción push corrupta.' };
      }

      // Usar /api/register-subscription (service_role) para evitar problemas de RLS con UPDATE
      const guestPhone = localStorage.getItem('trv_guest_phone') || '';
      const phone = currentUser?.telefono?.trim() || guestPhone || '';

      const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios'
        : /Android/.test(navigator.userAgent) ? 'android' : 'desktop';

      const resp = await fetch('/api/register-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subJSON,
          anonymous_id: localStorage.getItem('trv_anonymous_id') || crypto.randomUUID(),
          phone,
          user_id: currentUser?.id || null,
          platform,
          user_agent: navigator.userAgent,
        }),
      });

      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || result.error) {
        console.error('[PushSync] Error guardando suscripción via API:', resp.status, result);
        return { success: false, error: result.error || `HTTP ${resp.status}` };
      }
      console.log('[PushSync] Suscripción guardada exitosamente via /api/register-subscription');
      return { success: true };
    } catch (err: any) {
      console.error('[PushSync] Excepción en syncPushSubscription:', err);
      return { success: false, error: err?.message || String(err) };
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    supabase.from('notifications').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[Notification] Delete sync error:', error.message); });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    supabase.from('notifications').delete().neq('id', '')
      .then(({ error }) => { if (error) console.error('[Notification] ClearAll sync error:', error.message); });
  };

  // Admin/Operator Auth functions — blindado con RPC login_seguro + fallback sesión local
  const authenticateAdmin = async (identifier: string, pass: string): Promise<boolean | LoginSeguroResult> => {
    try {
      // 1. Validar credenciales via RPC seguro (rate limiting + lockout)
      const rpcResult = await secureLogin(identifier, pass);

      if (!rpcResult.success) {
        return rpcResult;
      }
      // 2. RPC validó — establecer sesión directamente (sin signInWithPassword)
      // signInWithPassword falla cuando auth.users tiene instance_id incorrecto.
      // El RPC ya validó credenciales, rate limiting y lockout — es seguro usar sesión local.

      const role = rpcResult.role!;
      const sedeId = rpcResult.sede_id || '';
      const userId = rpcResult.user_id || '';
      const nombre = rpcResult.nombre || '';
      const email = rpcResult.email || identifier.trim();

      setIsAdminAuthenticated(true);
      localStorage.setItem('trv_admin_auth', 'true');
      setUserRole(role);
      localStorage.setItem('trv_user_role', role);
      setAdminScopeSedeId(sedeId);
      localStorage.setItem('trv_admin_scope_sede', sedeId);

      localStorage.setItem('trv_admin_user', JSON.stringify({
        id: userId, email, nombre, role, sede_id: sedeId
      }));

      // Cargar datos del admin panel
      try {
        const [ordersRes, notifsRes, productsRes, configRes, mesasRes] = await Promise.all([
          supabase.from('orders').select('*').order('fecha', { ascending: false }),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('products').select('*').range(0, 9999),
          supabase.from('store_config').select('*').single(),
          supabase.from('mesas').select('*').order('numero_mesa'),
        ]);
        if (ordersRes.data) setOrders(ordersRes.data as Order[]);
        if (notifsRes.data) setNotifications(notifsRes.data as InAppNotification[]);
        if (productsRes.data && productsRes.data.length > 0) {
          const merged = (productsRes.data as FoodItem[]).map(p => {
            const hasDbOptions = Array.isArray(p.option_groups) && p.option_groups.length > 0;
            if (hasDbOptions) return p;
            const fallback = DEFAULT_PRODUCTS.find(d => d.nombre === p.nombre);
            return { ...p, option_groups: fallback?.option_groups || [] };
          });
          setProducts(merged);
        }
        if (configRes.data) {
          const dbConfig = configRes.data;
          setConfig(prev => ({
            ...prev,
            esta_abierta: dbConfig.esta_abierta,
            site_nombre: dbConfig.site_nombre || prev.site_nombre,
            tasa_cambio: dbConfig.tasa_cambio || prev.tasa_cambio,
          }));
        }
        if (mesasRes.data && mesasRes.data.length > 0) setMesas(mesasRes.data as Mesa[]);
      } catch (dataErr) {
        console.warn('[Auth] Data load partially failed:', dataErr);
      }

      return true;
    } catch (err) {
      console.error('[Auth] authenticateAdmin error:', err);
      return { success: false, error: 'Error de conexión.' };
    }
  };

  const logoutAdmin = async () => {
    await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    setUserRole(null);
    localStorage.removeItem('trv_admin_auth');
    localStorage.removeItem('trv_user_role');
    localStorage.removeItem('trv_admin_scope_sede');
    setAdminScopeSedeId('');
  };

  const updateAdminCredentials = async (email: string, pass: string) => {
    const { error } = await supabase.auth.updateUser({
      email: email.trim(),
      password: pass.trim()
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Credenciales de acceso administrativo actualizadas correctamente en Supabase Auth.' };
  };

  // --- LOYALTY / FIDELIZACIÓN ---
  const earnLoyaltyPoints = async (userId: string, orderId: string, _amountUsd: number, _sedeId?: string) => {
    console.log('[Loyalty] earnLoyaltyPoints — syncDesdeDB', { userId, orderId });
    // SEGURIDAD: La acreditación de puntos por compra la maneja el trigger
    // `trigger_order_delivery_points` en PostgreSQL cuando el status cambia a 'Entregado'.
    // Esta función SOLO sincroniza el saldo desde la DB al estado local del frontend.
    try {
      const { data: userData, error } = await supabase
        .from('usuarios_clientes')
        .select('puntos_fidelidad, puntos_historicos')
        .eq('id', userId)
        .single();
      if (error || !userData) {
        console.error('[Loyalty] earnLoyaltyPoints — DB query failed:', error);
        return;
      }

      const newPoints = userData.puntos_fidelidad ?? 0;
      const newLifetime = userData.puntos_historicos ?? 0;
      console.log('[Loyalty] earnLoyaltyPoints — DB result', { newPoints, newLifetime });

      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return { ...u, puntos_fidelidad: newPoints, puntos_historicos: newLifetime, loyalty_points: newPoints, loyalty_lifetime_points: newLifetime };
      }));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, puntos_fidelidad: newPoints, puntos_historicos: newLifetime, loyalty_points: newPoints, loyalty_lifetime_points: newLifetime } : prev);
      }
      console.log('[Loyalty] earnLoyaltyPoints — state updated');

      // Notificar al usuario (el trigger ya acreditó los puntos en DB)
      const user = users.find(u => u.id === userId);
      if (user) {
        addNotification(
          '¡Puntos Ganados!',
          `Tus puntos por el pedido #${orderId.slice(-8)} han sido acreditados. ¡Sigue comprando para subir de nivel!`,
          'personal',
          user.telefono || undefined,
          undefined,
          '/profile'
        );
      }
    } catch (e) {
      console.error('[Loyalty] earnLoyaltyPoints — exception:', e);
    }
  };

  // --- PWA INSTALL DETECTION ---
  const markUserAsPwaInstalled = async (userId: string) => {
    localStorage.setItem('foodapp_pwa_installed', 'true');
    await supabase.from('usuarios_clientes')
      .update({ is_pwa_installed: true, pwa_installed_at: new Date().toISOString() })
      .eq('id', userId);
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_pwa_installed: true, pwa_installed_at: new Date().toISOString() } : u
    ));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, is_pwa_installed: true, pwa_installed_at: new Date().toISOString() } : prev);
    }

    // Reclamar bono PWA si el sistema de fidelización está habilitado
    try {
      const { data: result } = await supabase.rpc('claim_pwa_bonus', { p_user_id: userId });
      if (result?.success) {
        console.log('[Loyalty] PWA bonus claimed:', result.points_awarded, 'points');
        // Sincronizar saldo desde DB
        const { data: userData } = await supabase
          .from('usuarios_clientes')
          .select('puntos_fidelidad, puntos_historicos')
          .eq('id', userId)
          .single();
        if (userData) {
          setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, puntos_fidelidad: userData.puntos_fidelidad, puntos_historicos: userData.puntos_historicos } : u
          ));
          if (currentUser?.id === userId) {
            setCurrentUser(prev => prev ? { ...prev, puntos_fidelidad: userData.puntos_fidelidad, puntos_historicos: userData.puntos_historicos } : prev);
          }
        }
      }
    } catch (e) {
      console.warn('[Loyalty] claim_pwa_bonus failed (non-critical):', e);
    }
  };

  const detectPwaInstalled = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if ((navigator as any).standalone === true) return true;
    if (localStorage.getItem('foodapp_pwa_installed') === 'true') return true;
    return false;
  };

  // --- REWARD CATALOG CRUD ---
  const addRewardItem = async (item: Omit<RewardItem, 'id'>) => {
    try {
      const { data, error } = await supabase.from('reward_catalog').insert({
        name: item.name,
        description: item.description || '',
        points_cost: item.points_cost,
        reward_type: item.reward_type || 'discount',
        reward_value: item.reward_value || 0,
        product_id: item.product_id || null,
        imagen_url: item.imagen_url || null,
        active: item.active !== false,
      }).select().single();
      if (error) { console.error('[Rewards] Insert error:', error.message); return; }
      if (data) setRewardCatalog(prev => [...prev, data as RewardItem]);
    } catch (e) {
      console.error('[Rewards] Add failed:', e);
    }
  };

  const updateRewardItem = async (id: string, updated: Partial<RewardItem>) => {
    try {
      const { error } = await supabase.from('reward_catalog').update(updated).eq('id', id);
      if (error) console.error('[Rewards] Update error:', error.message);
    } catch (e) {
      console.error('[Rewards] Update failed:', e);
    }
    setRewardCatalog(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
  };

  const deleteRewardItem = async (id: string) => {
    try {
      const { error } = await supabase.from('reward_catalog').delete().eq('id', id);
      if (error) console.error('[Rewards] Delete error:', error.message);
    } catch (e) {
      console.error('[Rewards] Delete failed:', e);
    }
    setRewardCatalog(prev => prev.filter(r => r.id !== id));
  };

  const redeemRewardItem = async (userId: string, rewardId: string): Promise<boolean> => {
    console.log('[Loyalty] redeemRewardItem — RPC call', { userId, rewardId });
    // SEGURIDAD: Usar RPC atómica con FOR UPDATE para prevenir race conditions
    const { data: result, error } = await supabase.rpc('redeem_loyalty_reward', {
      p_user_id: userId,
      p_reward_id: rewardId,
    });

    if (error || !result?.success) {
      console.error('[Loyalty] redeemRewardItem — RPC failed:', error || result?.error);
      return false;
    }
    console.log('[Loyalty] redeemRewardItem — RPC success', { remaining: result.remaining_points, spent: result.points_spent, coupon: result.coupon_code });

    // Sincronizar estado local desde la respuesta de la RPC
    const newPoints = result.remaining_points;
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, puntos_fidelidad: newPoints, loyalty_points: newPoints };
    }));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, puntos_fidelidad: newPoints, loyalty_points: newPoints } : prev);
    }

    // Registrar en transactions local
    const reward = rewardCatalog.find(r => r.id === rewardId);
    const tx: LoyaltyTransaction = {
      id: `loy-tx-${Date.now()}`,
      user_id: userId,
      operation: 'resta',
      reason: 'canje',
      points: result.points_spent,
      description: `Canje: ${reward?.name || 'Recompensa'}`,
      created_at: new Date().toISOString(),
    };
    setLoyaltyTransactions(prev => [...prev, tx]);
    console.log('[Loyalty] redeemRewardItem — state updated');

    return true;
  };

  const redeemLoyaltyPoints = async (userId: string, pointsToRedeem: number, orderId?: string): Promise<boolean> => {
    console.log('[Loyalty] redeemLoyaltyPoints — RPC call', { userId, pointsToRedeem, orderId });
    const loyaltyConfig = config.loyalty;
    if (!loyaltyConfig?.enabled) {
      console.warn('[Loyalty] redeemLoyaltyPoints — loyalty disabled, aborting');
      return false;
    }

    // SEGURIDAD: Usar RPC atómica con FOR UPDATE para prevenir race conditions
    const { data: result, error } = await supabase.rpc('process_loyalty_points', {
      p_user_id: userId,
      p_points: pointsToRedeem,
      p_operation: 'resta',
      p_reason: 'canje',
      p_description: orderId ? `Canje en pedido #${orderId.slice(-8)}` : 'Canje de puntos',
      p_order_id: orderId || null,
      p_created_by: userId,
    });

    if (error || !result?.success) {
      console.error('[Loyalty] redeemLoyaltyPoints — RPC failed:', error || result?.error);
      return false;
    }
    console.log('[Loyalty] redeemLoyaltyPoints — RPC success', { newPoints: result.new_points, previous: result.previous_points, change: result.points_change });

    // Sincronizar estado local desde la respuesta de la RPC
    const newPoints = result.new_points;
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, puntos_fidelidad: newPoints, loyalty_points: newPoints };
    }));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, puntos_fidelidad: newPoints, loyalty_points: newPoints } : prev);
    }

    // Registrar en transactions local para historial inmediato
    const tx: LoyaltyTransaction = {
      id: result.history_id || `loy-tx-${Date.now()}`,
      user_id: userId,
      operation: 'resta',
      reason: 'canje',
      points: pointsToRedeem,
      description: orderId ? `Canje en pedido #${orderId.slice(-8)}` : 'Canje de puntos',
      order_id: orderId,
      created_at: new Date().toISOString(),
    };
    setLoyaltyTransactions(prev => [...prev, tx]);
    console.log('[Loyalty] redeemLoyaltyPoints — state updated');

    return true;
  };

  const getUserLoyaltyPoints = (userId: string): number => {
    const user = users.find(u => u.id === userId);
    if (user) return user.puntos_fidelidad || user.loyalty_points || 0;
    if (currentUser?.id === userId) return currentUser.puntos_fidelidad || currentUser.loyalty_points || 0;
    return 0;
  };

  const getUserLoyaltyTier = (userId: string): LoyaltyTier | null => {
    const loyaltyConfig = config.loyalty;
    if (!loyaltyConfig?.enabled || !loyaltyConfig.tiers?.length) return null;
    
    const user = users.find(u => u.id === userId);
    const lifetimePoints = user?.puntos_historicos || user?.loyalty_lifetime_points
      || (currentUser?.id === userId ? (currentUser.puntos_historicos || currentUser.loyalty_lifetime_points || 0) : 0);
    
    let bestTier: LoyaltyTier | null = null;
    for (const tier of loyaltyConfig.tiers) {
      if (lifetimePoints >= tier.min_points) {
        if (!bestTier || tier.min_points > bestTier.min_points) {
          bestTier = tier;
        }
      }
    }
    return bestTier;
  };

  const adjustUserPoints = async (userId: string, points: number, reason: string) => {
    console.log('[Loyalty] adjustUserPoints — RPC call', { userId, points, reason, adminId: currentUser?.id });
    // SEGURIDAD: Usar RPC atómica con verificación de rol admin
    const { data: result, error } = await supabase.rpc('adjust_loyalty_points', {
      p_user_id: userId,
      p_points: Math.abs(points),
      p_operation: points >= 0 ? 'suma' : 'resta',
      p_reason: 'ajuste_admin',
      p_description: reason,
      p_admin_id: currentUser?.id || 'unknown',
    });

    if (error || !result?.success) {
      console.error('[Loyalty] adjustUserPoints — RPC failed:', error || result?.error);
      return;
    }
    console.log('[Loyalty] adjustUserPoints — RPC success', { newPoints: result.new_points, previous: result.previous_points, change: result.points_change });

    // Sincronizar estado local desde la respuesta de la RPC
    const newPoints = result.new_points;
    const user = users.find(u => u.id === userId);
    const newLifetime = points > 0
      ? (user?.puntos_historicos || user?.loyalty_lifetime_points || 0) + Math.abs(points)
      : user?.puntos_historicos || user?.loyalty_lifetime_points || 0;

    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, puntos_fidelidad: newPoints, puntos_historicos: newLifetime, loyalty_points: newPoints, loyalty_lifetime_points: newLifetime };
    }));

    const tx: LoyaltyTransaction = {
      id: result.history_id || `loy-tx-${Date.now()}`,
      user_id: userId,
      operation: points >= 0 ? 'suma' : 'resta',
      reason: 'ajuste_admin',
      points: Math.abs(points),
      description: reason,
      created_at: new Date().toISOString(),
    };
    setLoyaltyTransactions(prev => [...prev, tx]);
    console.log('[Loyalty] adjustUserPoints — state updated');
  };

  const getLoyaltyTransactions = (userId: string): LoyaltyTransaction[] => {
    return loyaltyTransactions
      .filter(tx => tx.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  return (
    <AppContext.Provider value={{
      // NOTE: the store currently uses `products` as the source of truth.
      // Keeping the exposed context API consistent with the rest of the app.
      foodItems: products,
      promotions,
      setPromotions,
      orders,
      config,
      coupons,
      notifications,
      cart,
      isAdminAuthenticated,
      userRole,
      adminScopeSedeId,
      isGlobalLoading,
      favorites,
      toggleFavorite,
      isFavorite,
      users,
      currentUser,
      registerUser,
      loginUser,
      logoutUser,
      sendPasswordResetEmail,
      updateUser,
      updateUserByAdmin,
      // Catalog CRUD compatibility: map legacy API names to current implementations
      addCoupon,
      updateCoupon,
      deleteCoupon,
      addFoodItem: addProduct,
      updateFoodItem: updateProduct,
      deleteFoodItem: deleteProduct,
      searchItems,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      createOrder,
      registerGuestUser,
      updateOrderStatus,
      confirmMesaPayment,
      updateOrderItems,
      refreshOrders,
      updateConfig,
      updateExchangeRate,
      fetchExchangeRate,
      rateDate,
      addCategory,
      deleteCategory,
      updateCategory,
      addNotification,
      markNotificationAsRead,
      toggleNotificationReadStatus,
      registerNotificationClick,
      syncPushSubscription,
      deleteNotification,
      clearAllNotifications,
      authenticateAdmin,
      logoutAdmin,
      updateAdminCredentials,
      adminUser,
      adminPass,
      requestPart,
      displayCurrency,
      toggleCurrency,
      hapticEnabled,
      toggleHaptic,
      isDarkMode,
      toggleDarkMode,
      reviews,
      addReview,
      getProductReviews,
      getProductAverageRating,
      flashSales,
      updateFlashSales: (sales: FlashSale[]) => setFlashSales(sales),
      getActiveFlashSale,
      loyaltyTransactions,
      earnLoyaltyPoints,
      redeemLoyaltyPoints,
      getUserLoyaltyPoints,
      getUserLoyaltyTier,
      adjustUserPoints,
      getLoyaltyTransactions,
      markUserAsPwaInstalled,
      rewardCatalog,
      addRewardItem,
      updateRewardItem,
      deleteRewardItem,
      redeemRewardItem,
      mesas,
      fetchMesas,
      addMesa,
      updateMesa,
      deleteMesa
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside an AppProvider');
  }
  return context;
};
