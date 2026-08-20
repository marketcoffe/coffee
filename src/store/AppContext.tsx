import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FoodItem, Order, StoreConfig, InAppNotification, OrderItem, AppUser, Coupon, CartItem, SelectedOption, ProductReview, FlashSale, LoyaltyTransaction, LoyaltyTier, Promotion, RewardItem, UserRole } from '../types/store';
import { supabase } from './supabaseClient';
import productsData from '../data/products.json';

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
  registerUser: (nombre: string, email: string, telefono: string, contrasena: string) => Promise<AppUser>;
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
  updateOrderStatus: (orderId: string, status: Order['status'], estimatedTime?: string, notas?: string) => Promise<void>;
  updateOrderItems: (orderId: string, newItems: OrderItem[]) => Promise<void>;

  // Coupon Actions
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usage_count'>) => Promise<void>;
  updateCoupon: (id: string, updated: Partial<Coupon>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  
  // Config Actions
  updateConfig: (newConfig: Partial<StoreConfig>) => void;
  updateExchangeRate: (rate: number) => void;
  fetchExchangeRate: () => Promise<boolean>;
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
  
  // Auth
  authenticateAdmin: (email: string, pass: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  updateAdminCredentials: (user: string, pass: string) => void;
  adminUser: string;
  adminPass: string;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

  // INITIAL PRODUCTS DATA - Market Coffee Sweet
const DEFAULT_PRODUCTS: FoodItem[] = [
  // ═══════════════════════════════════════════════════
  // MERCADO - Frutas y Verduras
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-001', nombre: 'Manzana Roja (lb)', descripcion: 'Manzana roja fresca, crujiente y dulce. Perfecta para snack saludable.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.80, stock: 100, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQRaDAOBQk2ZpCHOXrAPwn36yBdb5gnvQd5MTg59JTDTw&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Manzana roja'], option_groups: []
  },
  {
    id: 'mrc-002', nombre: 'Platano (lb)', descripcion: 'Platano maduro natural, ideal para cocinar o comer fresco.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 0.80, stock: 150, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSnjREoq0RzI_spDUNL8Irtra2INJm1nS5_jPGEprn2g&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Platano'], option_groups: []
  },
  {
    id: 'mrc-003', nombre: 'Naranja (lb)', descripcion: 'Naranja jugosa y fresca, ideal para jugo natural.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.20, stock: 120, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlwY41x7xRzv9aWkF5J4StGKlOFQ3_KKMl6Akp12SC9A&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Naranja'], option_groups: []
  },
  {
    id: 'mrc-004', nombre: 'Tomate (lb)', descripcion: 'Tomate rojo maduro, fresco del dia.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.50, stock: 80, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcIqO5SZx0LNnmfGv-YkN1LZDqE1FPVN9yVSuT0mi7ew&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Tomate'], option_groups: []
  },
  {
    id: 'mrc-005', nombre: 'Cebolla (lb)', descripcion: 'Cebolla blanca fresca para tus preparaciones.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.00, stock: 90, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrn_Fs4e0jslUNFVVBbV3UmtI86n0_TLf4RxWmqEXidQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Cebolla'], option_groups: []
  },
  {
    id: 'mrc-006', nombre: 'Papa (lb)', descripcion: 'Papa fresca para freir, hervir o asar.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.30, stock: 100, imagen_urls: ['https://images.unsplash.com/photo-1518977676601-b53f82ber0a?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Papa'], option_groups: []
  },
  {
    id: 'mrc-007', nombre: 'Lechuga (unidad)', descripcion: 'Lechuga fresca y crocante, base perfecta para ensaladas.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 0.90, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Lechuga'], option_groups: []
  },
  {
    id: 'mrc-008', nombre: 'Aguacate (unidad)', descripcion: 'Aguacate maduro, cremoso y perfecto para guacamole.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.50, stock: 50, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpOH-G48dBFGBQrJczw4Dnir6wITvFnfD6tO0BUgQctQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Aguacate'], option_groups: []
  },
  {
    id: 'mrc-009', nombre: 'Limon (lb)', descripcion: 'Limon fresco para cocinar, jugo o aderezos.',
    categoria: 'Mercado', subcategoria: 'Frutas y Verduras', precio_usd: 1.00, stock: 80, imagen_urls: ['https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Limon'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // MERCADO - Lacteos y Embutidos
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-010', nombre: 'Queso Blanco (lb)', descripcion: 'Queso blanco fresco, ideal para arepas y cachapas.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 3.50, stock: 40, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRyoaF1w8AwuG4KQXimxqcTTiLPUIaRFEabk8I2IGHv0w&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Queso blanco'], option_groups: []
  },
  {
    id: 'mrc-011', nombre: 'Queso Manchego (lb)', descripcion: 'Queso manchego maduro, sabor intenso y textura firme.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 4.50, stock: 30, imagen_urls: ['https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Queso manchego'], option_groups: []
  },
  {
    id: 'mrc-012', nombre: 'Queso Crema (250g)', descripcion: 'Queso crema suave y untuoso, perfecto para reposteria.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 2.20, stock: 45, imagen_urls: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Queso crema'], option_groups: []
  },
  {
    id: 'mrc-013', nombre: 'Leche Entera (1L)', descripcion: 'Leche entera pasteurizada, fresca y nutritiva.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 1.80, stock: 60, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_QWvVr7x4ULEhrACSJFd9FuCUvsJKzOIo2Qfbg18hWg&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Leche entera'], option_groups: []
  },
  {
    id: 'mrc-014', nombre: 'Mantequilla (200g)', descripcion: 'Mantequilla natural, ideal para cocinar y Untar.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 2.00, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Mantequilla'], option_groups: []
  },
  {
    id: 'mrc-015', nombre: 'Jamón de Pierna (lb)', descripcion: 'Jamón de pierna premium, en lonchas finas.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 4.00, stock: 35, imagen_urls: ['https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Jamón de pierna'], option_groups: []
  },
  {
    id: 'mrc-016', nombre: 'Salchichon (lb)', descripcion: 'Salchichon artesanal, sabor tradicional.',
    categoria: 'Mercado', subcategoria: 'Lacteos y Embutidos', precio_usd: 3.50, stock: 30, imagen_urls: ['https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Salchichon'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // MERCADO - Abarrotes
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-017', nombre: 'Harina de Maiz (1kg)', descripcion: 'Harina de maiz precocida, ideal para arepas.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.50, stock: 100, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWrsw5avRY3rKvW4hjxGP-wObM-LFQHGf4I_5UAya6Kg&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Harina de maiz'], option_groups: []
  },
  {
    id: 'mrc-018', nombre: 'Harina de Trigo (1kg)', descripcion: 'Harina de trigo todo uso, para panes y reposteria.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.30, stock: 80, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFxAhF6I1oAorrIINtHHyY47Qp5knSBoaJ3z1eKT2zdQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Harina de trigo'], option_groups: []
  },
  {
    id: 'mrc-019', nombre: 'Arroz (1kg)', descripcion: 'Arroz granecho de primera calidad.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.20, stock: 120, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKdYTGzYwlGmQ5tSYY85wZKg03X0V835ISMM34pGImEA&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Arroz'], option_groups: []
  },
  {
    id: 'mrc-020', nombre: 'Aceite Vegetal (1L)', descripcion: 'Aceite vegetal refinado para freir y cocinar.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 2.50, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Aceite vegetal'], option_groups: []
  },
  {
    id: 'mrc-021', nombre: 'Azucar (1kg)', descripcion: 'Azucar refinada blanca.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.00, stock: 100, imagen_urls: ['https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Azucar'], option_groups: []
  },
  {
    id: 'mrc-022', nombre: 'Atun (lata)', descripcion: 'Atun en agua, proteina sana y practica.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.80, stock: 70, imagen_urls: ['https://images.unsplash.com/photo-1534604973900-c43f59309207?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Atun'], option_groups: []
  },
  {
    id: 'mrc-023', nombre: 'Salsa de Tomate', descripcion: 'Salsa de tomate natural para pasta y pizza.',
    categoria: 'Mercado', subcategoria: 'Abarrotes', precio_usd: 1.20, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Salsa de tomate'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // MERCADO - Snacks
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-024', nombre: 'Doritos Nacho', descripcion: 'Tortillas de maiz sabor nacho, crujientes y picantes.',
    categoria: 'Mercado', subcategoria: 'Snacks', precio_usd: 1.20, stock: 80, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ40Fc02hMN3crakYUavnulncOHF9ZdlUYSOQT70kdl3A&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Doritos nacho'], option_groups: []
  },
  {
    id: 'mrc-025', nombre: 'Cheetos Crunchy', descripcion: 'Snack de queso crujiente, sabor irresistile.',
    categoria: 'Mercado', subcategoria: 'Snacks', precio_usd: 1.20, stock: 70, imagen_urls: ['https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Cheetos'], option_groups: []
  },
  {
    id: 'mrc-026', nombre: 'Papas Margarita (100g)', descripcion: 'Papas fritas clasicas, sal y sabor natural.',
    categoria: 'Mercado', subcategoria: 'Snacks', precio_usd: 0.90, stock: 90, imagen_urls: ['https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Papas fritas'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // MERCADO - Bebidas de Market
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-027', nombre: 'Coca-Cola 500ml', descripcion: 'Refresco de cola 500ml bien frio.',
    categoria: 'Mercado', subcategoria: 'Bebidas', precio_usd: 1.50, stock: 150, imagen_urls: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Coca-Cola 500ml'], option_groups: []
  },
  {
    id: 'mrc-028', nombre: 'Agua Mineral 500ml', descripcion: 'Agua mineral natural sin gas.',
    categoria: 'Mercado', subcategoria: 'Bebidas', precio_usd: 1.00, stock: 200, imagen_urls: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Agua mineral'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // MERCADO - Limpieza & Higiene
  // ═══════════════════════════════════════════════════
  {
    id: 'mrc-029', nombre: 'Papel Higienico (4 rollos)', descripcion: 'Papel higienico suave, rollos individuales.',
    categoria: 'Mercado', subcategoria: 'Limpieza e Higiene', precio_usd: 2.50, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1584556812952-90061e065e34?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Papel higienico'], option_groups: []
  },
  {
    id: 'mrc-030', nombre: 'Jabon de Manos', descripcion: 'Jabon liquido antibacterial para manos.',
    categoria: 'Mercado', subcategoria: 'Limpieza e Higiene', precio_usd: 1.80, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1584556812952-90061e065e34?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Jabon de manos'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // PANADERIA - Panes
  // ═══════════════════════════════════════════════════
  {
    id: 'pnd-001', nombre: 'Pan Campesino', descripcion: 'Pan campesino artesanal, crujiente por fuera y suave por dentro.',
    categoria: 'Panaderia', subcategoria: 'Panes', precio_usd: 0.50, stock: 100, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQimXcXbyBdjCHLJlkUp7j9wU3BR1VtJw3dbFVRljTl-Q&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Harina de trigo', 'Agua', 'Sal', 'Levadura'], option_groups: []
  },
  {
    id: 'pnd-002', nombre: 'Pan Canilla', descripcion: 'Pan de canilla suave y esponjoso, ideal para desayuno.',
    categoria: 'Panaderia', subcategoria: 'Panes', precio_usd: 0.30, stock: 150, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoiQjBLL1Y9ebaTbT1T2TI13ZXqh2VM4pveX2K0B1eaQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Harina de trigo', 'Leche', 'Mantequilla', 'Levadura'], option_groups: []
  },
  {
    id: 'pnd-003', nombre: 'Pan de Guayaba', descripcion: 'Pan dulce relleno de guayaba, horneado artesanalmente.',
    categoria: 'Panaderia', subcategoria: 'Panes', precio_usd: 0.75, stock: 80, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsAypaleIOSqzdR3MkeK2Jmz0ypVeOhWvJyE8gjN5Ykw&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Harina', 'Guayaba', 'Mantequilla', 'Azucar'], option_groups: []
  },
  {
    id: 'pnd-004', nombre: 'Arequipe con Queso', descripcion: 'Pan relleno de arequipe y queso blanco, combo perfecto.',
    categoria: 'Panaderia', subcategoria: 'Panes', precio_usd: 0.80, stock: 60, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTT1SUAsA1OGQxTfLuoI1pJwaoKVNf-4ZkKeYQha8mJjQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan', 'Arequipe', 'Queso blanco'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // PANADERIA - Pasteleria
  // ═══════════════════════════════════════════════════
  {
    id: 'pnd-005', nombre: 'Palmeritas (6 uds)', descripcion: 'Palmeras de hojaldre crujientes y dulces, 6 unidades.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 1.50, stock: 50, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzwVjFvQxqmTlNLG_FB3631xclD0zLI831wtK07wyDBQ&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Masa hojaldre', 'Azucar', 'Mantequilla'], option_groups: []
  },
  {
    id: 'pnd-006', nombre: 'Torta de Jamon y Queso', descripcion: 'Torta salada de jamon, queso y huevo, receta de la casa.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 2.50, stock: 30, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJpDAmZ_PgY8s8GppGYRfHbLrZvqDc7iAKbQ67gax6uw&s=10'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Masa', 'Jamón', 'Queso', 'Huevo'], option_groups: []
  },
  {
    id: 'pnd-007', nombre: 'Torta de Mantecada', descripcion: 'Torta dulce de mantecada esponjosa, sabor tradicional.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 2.00, stock: 35, imagen_urls: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQATNuc48jj6IlXRSzaoa7qc5j86wXSOca4OmtgOEbV7g&s=10'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Harina', 'Mantequilla', 'Azúcar', 'Huevo'], option_groups: []
  },
  {
    id: 'pnd-008', nombre: 'Tres Leches (porcion)', descripcion: 'Porcion de torta tres leches, cremosa y deliciosa.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 3.00, stock: 25, imagen_urls: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Bizcocho', 'Leche condensada', 'Leche evaporada', 'Crema'], option_groups: []
  },
  {
    id: 'pnd-009', nombre: 'Bollos (6 uds)', descripcion: 'Bollos dulces suaves, ideal para el desayuno o merienda.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 1.20, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1509365390695-33aee754301f?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Harina', 'Azúcar', 'Mantequilla', 'Levadura'], option_groups: []
  },
  {
    id: 'pnd-010', nombre: 'Ensaimada (unidad)', descripcion: 'Ensaimada Mallorquina con azúcar glass, esponjosa.',
    categoria: 'Panaderia', subcategoria: 'Pasteleria', precio_usd: 1.50, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Masa fermentada', 'Manteca', 'Azúcar glass'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // COMIDA RAPIDA - Hamburguesas
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-001', nombre: 'Hamburguesa Clasica', descripcion: 'Hamburguesa de carne 100% res, lechuga, tomate, queso y salsa especial.',
    categoria: 'Comida Rapida', subcategoria: 'Hamburguesas', precio_usd: 5.50, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Pan brioche', 'Carne 150g', 'Queso Americano', 'Lechuga', 'Tomate', 'Salsa especial'],
    option_groups: [
      { id: 'og-size-cra-001', nombre: 'Tamaño', min_select: 1, max_select: 1, options: [
        { id: 'opt-sgl-cra-001', nombre: 'Single', precio_usd: 0 },
        { id: 'opt-dbl-cra-001', nombre: 'Double', precio_usd: 2.50 }
      ]},
      { id: 'og-ext-cra-001', nombre: 'Extras', min_select: 0, max_select: 3, options: [
        { id: 'opt-qso-cra-001', nombre: 'Extra Queso', precio_usd: 0.75 },
        { id: 'opt-bcn-cra-001', nombre: 'Tocino', precio_usd: 1.00 },
        { id: 'opt-hvo-cra-001', nombre: 'Huevo Frito', precio_usd: 0.75 }
      ]}
    ]
  },
  {
    id: 'cra-002', nombre: 'Hamburguesa Doble', descripcion: 'Doble carne smash, doble queso, cebolla crispy y salsa BBQ.',
    categoria: 'Comida Rapida', subcategoria: 'Hamburguesas', precio_usd: 8.50, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&q=80&w=500'],
    es_promo: true, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Pan brioche', 'Doble carne smash', 'Doble queso', 'Cebolla crispy', 'Salsa BBQ'],
    option_groups: [
      { id: 'og-ext-cra-002', nombre: 'Extras', min_select: 0, max_select: 3, options: [
        { id: 'opt-qso-cra-002', nombre: 'Extra Queso', precio_usd: 0.75 },
        { id: 'opt-bcn-cra-002', nombre: 'Bacon Extra', precio_usd: 1.50 }
      ]}
    ]
  },
  {
    id: 'cra-003', nombre: 'Hamburguesa Pollo', descripcion: 'Pechuga de pollo empanizada crujiente con lechuga y mayonesa.',
    categoria: 'Comida Rapida', subcategoria: 'Hamburguesas', precio_usd: 5.00, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan brioche', 'Pechuga empanizada', 'Lechuga', 'Mayonesa'],
    option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // COMIDA RAPIDA - Shawarma
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-004', nombre: 'Shawarma de Pollo', descripcion: 'Shawarma de pollo con vegetales frescos, salsa de ajo y tahini.',
    categoria: 'Comida Rapida', subcategoria: 'Shawarmas', precio_usd: 6.00, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Pan pita', 'Pollo', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa de ajo'],
    option_groups: [
      { id: 'og-sal-cra-004', nombre: 'Salsa', min_select: 1, max_select: 2, options: [
        { id: 'opt-aio-cra-004', nombre: 'Salsa de Ajo', precio_usd: 0 },
        { id: 'opt-tah-cra-004', nombre: 'Tahini', precio_usd: 0 },
        { id: 'opt-pic-cra-004', nombre: 'Picante', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-005', nombre: 'Shawarma de Res', descripcion: 'Shawarma de res marinada con especias, vegetales y salsa especial.',
    categoria: 'Comida Rapida', subcategoria: 'Shawarmas', precio_usd: 7.00, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan pita', 'Res marinada', 'Lechuga', 'Tomate', 'Cebolla morada', 'Salsa especial'],
    option_groups: [
      { id: 'og-sal-cra-005', nombre: 'Salsa', min_select: 1, max_select: 2, options: [
        { id: 'opt-aio-cra-005', nombre: 'Salsa de Ajo', precio_usd: 0 },
        { id: 'opt-esp-cra-005', nombre: 'Salsa Especial', precio_usd: 0 },
        { id: 'opt-pic-cra-005', nombre: 'Picante', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-006', nombre: 'Shawarma Mixto', descripcion: 'Shawarma de pollo y res combinados, doble sabor.',
    categoria: 'Comida Rapida', subcategoria: 'Shawarmas', precio_usd: 7.50, stock: 35, imagen_urls: ['https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan pita', 'Pollo', 'Res', 'Vegetales', 'Salsa de ajo'],
    option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // COMIDA RAPIDA - Perros Calientes
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-007', nombre: 'Perro Clasico', descripcion: 'Salchicha en pan suave con ketchup, mostaza y mayonesa.',
    categoria: 'Comida Rapida', subcategoria: 'Perros Calientes', precio_usd: 3.50, stock: 80, imagen_urls: ['https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Pan de perro', 'Salchicha', 'Ketchup', 'Mostaza', 'Mayonesa'],
    option_groups: [
      { id: 'og-top-cra-007', nombre: 'Toppings', min_select: 0, max_select: 3, options: [
        { id: 'opt-cbn-cra-007', nombre: 'Cebolla', precio_usd: 0.25 },
        { id: 'opt-qso-cra-007', nombre: 'Queso Rallado', precio_usd: 0.50 },
        { id: 'opt-tst-cra-007', nombre: 'Tostones', precio_usd: 0.75 }
      ]}
    ]
  },
  {
    id: 'cra-008', nombre: 'Perro Especial', descripcion: 'Salchicha premium con cebolla caramelizada, queso derretido y salsa de la casa.',
    categoria: 'Comida Rapida', subcategoria: 'Perros Calientes', precio_usd: 4.50, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan de perro', 'Salchicha premium', 'Cebolla caramelizada', 'Queso', 'Salsa de la casa'],
    option_groups: [
      { id: 'og-top-cra-008', nombre: 'Toppings', min_select: 0, max_select: 3, options: [
        { id: 'opt-bcn-cra-008', nombre: 'Tocino', precio_usd: 0.75 },
        { id: 'opt-chr-cra-008', nombre: 'Chorizo', precio_usd: 1.00 },
        { id: 'opt-jlp-cra-008', nombre: 'Jalapeños', precio_usd: 0.50 }
      ]}
    ]
  },
  {
    id: 'cra-009', nombre: 'Perro Completo', descripcion: 'Perro cargado con papas fritas, queso, guacamole y salsa picante.',
    categoria: 'Comida Rapida', subcategoria: 'Perros Calientes', precio_usd: 5.50, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Pan de perro', 'Salchicha', 'Papas fritas', 'Queso', 'Guacamole', 'Salsa picante'],
    option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // COMBOS
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-010', nombre: 'Combo Hamburguesa + Bebida', descripcion: 'Hamburguesa Clasica + Bebida 500ml a elegir.',
    categoria: 'Combos', subcategoria: 'Combo Individual', precio_usd: 7.50, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'],
    es_promo: true, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Hamburguesa a elegir', 'Bebida 500ml'],
    option_groups: [
      { id: 'og-dri-cra-010', nombre: 'Bebida', min_select: 1, max_select: 1, options: [
        { id: 'opt-col-cra-010', nombre: 'Coca-Cola 500ml', precio_usd: 0 },
        { id: 'opt-spr-cra-010', nombre: 'Sprite 500ml', precio_usd: 0 },
        { id: 'opt-fan-cra-010', nombre: 'Fanta 500ml', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-011', nombre: 'Combo Shawarma + Papas', descripcion: 'Shawarma a elegir + Papas Fritas + Bebida 500ml.',
    categoria: 'Combos', subcategoria: 'Combo Individual', precio_usd: 9.50, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: true, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Shawarma a elegir', 'Papas fritas', 'Bebida 500ml'],
    option_groups: [
      { id: 'og-shw-cra-011', nombre: 'Shawarma', min_select: 1, max_select: 1, options: [
        { id: 'opt-plo-cra-011', nombre: 'Pollo', precio_usd: 0 },
        { id: 'opt-res-cra-011', nombre: 'Res', precio_usd: 1.00 },
        { id: 'opt-mix-cra-011', nombre: 'Mixto', precio_usd: 1.50 }
      ]},
      { id: 'og-dri-cra-011', nombre: 'Bebida', min_select: 1, max_select: 1, options: [
        { id: 'opt-col-cra-011', nombre: 'Coca-Cola 500ml', precio_usd: 0 },
        { id: 'opt-spr-cra-011', nombre: 'Sprite 500ml', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-012', nombre: 'Combo Perro + Papas', descripcion: 'Perro Caliente a elegir + Papas Fritas + Bebida 500ml.',
    categoria: 'Combos', subcategoria: 'Combo Individual', precio_usd: 6.50, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1612392062126-d7f2b1e8c8a8?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Perro a elegir', 'Papas fritas', 'Bebida 500ml'],
    option_groups: [
      { id: 'og-dri-cra-012', nombre: 'Bebida', min_select: 1, max_select: 1, options: [
        { id: 'opt-col-cra-012', nombre: 'Coca-Cola 500ml', precio_usd: 0 },
        { id: 'opt-fan-cra-012', nombre: 'Fanta 500ml', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-013', nombre: 'Combo Doble Hamburguesa', descripcion: 'Doble Hamburguesa + Papas Grandes + 2 Bebidas 500ml.',
    categoria: 'Combos', subcategoria: 'Combo Familiar', precio_usd: 14.90, stock: 30, imagen_urls: ['https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Doble Hamburguesa', 'Papas Grandes', '2 Bebidas'],
    option_groups: [
      { id: 'og-dri-cra-013', nombre: 'Bebidas', min_select: 1, max_select: 1, options: [
        { id: 'opt-col-cra-013', nombre: '2x Coca-Cola', precio_usd: 0 },
        { id: 'opt-var-cra-013', nombre: '2x Mixtas', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-014', nombre: 'Combo Familiar', descripcion: '2 Hamburguesas + 2 Perros + Papas Familiares + 4 Bebidas.',
    categoria: 'Combos', subcategoria: 'Combo Familiar', precio_usd: 24.90, stock: 20, imagen_urls: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=500'],
    es_promo: true, es_nuevo: false, es_mas_vendido: false, delivery_gratis: true,
    ingredientes: ['2 Hamburguesas', '2 Perros', 'Papas familiares', '4 Bebidas'],
    option_groups: []
  },
  {
    id: 'cra-015', nombre: 'Combo Infantil', descripcion: 'Hamburguesa small + Papas pequenas + Jugo + Juguete.',
    categoria: 'Combos', subcategoria: 'Combo Especial', precio_usd: 6.50, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Hamburguesa small', 'Papas pequeñas', 'Jugo', 'Juguete sorpresa'],
    option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // COMIDA RAPIDA - Bebidas
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-016', nombre: 'Limonada Natural', descripcion: 'Limonada fresca preparada al momento con limon natural.',
    categoria: 'Comida Rapida', subcategoria: 'Bebidas', precio_usd: 2.00, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Limón', 'Agua', 'Azúcar', 'Hielo'],
    option_groups: [
      { id: 'og-ext-cra-016', nombre: 'Extra', min_select: 0, max_select: 1, options: [
        { id: 'opt-lev-cra-016', nombre: 'Leche (Limonada con Leche)', precio_usd: 0.50 }
      ]}
    ]
  },
  {
    id: 'cra-017', nombre: 'Milkshake Vainilla', descripcion: 'Malteada cremosa de vainilla con crema batida.',
    categoria: 'Comida Rapida', subcategoria: 'Bebidas', precio_usd: 4.00, stock: 40, imagen_urls: ['https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Helado de vainilla', 'Leche', 'Crema batida'],
    option_groups: [
      { id: 'og-sab-cra-017', nombre: 'Sabor', min_select: 1, max_select: 1, options: [
        { id: 'opt-van-cra-017', nombre: 'Vainilla', precio_usd: 0 },
        { id: 'opt-chc-cra-017', nombre: 'Chocolate', precio_usd: 0 },
        { id: 'opt-frs-cra-017', nombre: 'Fresa', precio_usd: 0 }
      ]}
    ]
  },
  {
    id: 'cra-018', nombre: 'Agua en Vaso', descripcion: 'Agua natural bien fria en vaso.',
    categoria: 'Comida Rapida', subcategoria: 'Bebidas', precio_usd: 0.50, stock: 200, imagen_urls: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Agua'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // PANADERIA - Dulces
  // ═══════════════════════════════════════════════════
  {
    id: 'cra-019', nombre: 'Dulce de Leche', descripcion: 'Dulce de leche cremoso, postre tipico.',
    categoria: 'Panaderia', subcategoria: 'Dulces', precio_usd: 1.50, stock: 50, imagen_urls: ['https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: true, delivery_gratis: false,
    ingredientes: ['Leche', 'Azúcar', 'Vainilla'], option_groups: []
  },
  {
    id: 'cra-020', nombre: 'Torta de Chocolate', descripcion: 'Porcion de torta de chocolate negro, intensa y deliciosa.',
    categoria: 'Panaderia', subcategoria: 'Dulces', precio_usd: 3.00, stock: 30, imagen_urls: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Chocolate negro', 'Harina', 'Huevo', 'Mantequilla'], option_groups: []
  },
  {
    id: 'cra-021', nombre: 'Gelatina (unidad)', descripcion: 'Gelatina de sabores, fresca y refrescante.',
    categoria: 'Panaderia', subcategoria: 'Dulces', precio_usd: 1.00, stock: 60, imagen_urls: ['https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=500'],
    es_promo: false, es_nuevo: false, es_mas_vendido: false, delivery_gratis: false,
    ingredientes: ['Gelatina'], option_groups: []
  },
  // ═══════════════════════════════════════════════════
  // PRODUCTOS IMPORTADOS DESDE CSV
  // ═══════════════════════════════════════════════════
  ...(productsData as any[]).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    subcategoria: '',
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
  }))
];

const DEFAULT_CONFIG: StoreConfig = {
  site_nombre: 'Market Coffee Sweet',
  telefono_soporte: '+584124058904',
  direccion_fisica: 'Av. Principal El Trigal, justo al frente de Patio Trigal, Valencia, Carabobo',
  coordenadas_tienda: { lat: 10.2185, lng: -68.0021 },
  banners: [
    '/imagen/combo-banner.webp',
    '/imagen/panaderia-banner.webp',
    '/imagen/charcuteria-banner.webp'
  ],
  zelle_enabled: true,
  zelle_data: 'pagos@marketcoffee.com.ve',
  zelle_discount_percent: 0,
  pagomovil_enabled: true,
  pagomovil_data: 'Banesco (0134) - RIF J-50123456-7 - Tel: 0412-4058904',
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
    { id: 'z1', name: 'El Trigal (0-3 km)', cost: 2.00, minKm: 0, maxKm: 3 },
    { id: 'z2', name: 'La Trigaleña / Prebo (3-8 km)', cost: 4.50, minKm: 3, maxKm: 8 },
    { id: 'z3', name: 'La Viña / Mañongo / Naguanagua / San Diego (8-18 km)', cost: 7.00, minKm: 8, maxKm: 18 },
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
    'Panadería, Comida Rápida y Víveres',
    'Combos Especiales para ti',
    'Pan Artesanal Fresco'
  ],
  banner_descriptions: [
    'Pan fresco, tortas, dulces y pastelería del día',
    'Hamburguesas, shawarma, perros calientes y más',
    'Frutas, verduras, víveres y todo para tu hogar'
  ],
  hero_title: 'Market Coffee Sweet',
  hero_subtitle: 'Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida, víveres y más con delivery a domicilio.',
  hero_cta_text: 'Ver Catálogo',
  hero_cta_url: '',
  categories: [
    'Bebidas',
    'Carnicería',
    'Charcutería y Embutidos',
    'Comida Rapida',
    'Conservas',
    'Higiene Personal',
    'Hogar',
    'Lácteos',
    'Limpieza',
    'Mascotas',
    'Panaderia',
    'Repostería',
    'Salsas y Condimentos',
    'Snacks y Frituras',
    'Viveres',
  ],
  subcategories: {
    'Bebidas': ['Agua', 'Jugos', 'Té', 'Gaseosas', 'Lácteos', 'Alcohólicas'],
    'Carnicería': ['Cerdo', 'Res', 'Pollo', 'Embutidos'],
    'Charcutería y Embutidos': ['Chorizo', 'Morcilla', 'Tequeños', 'Congelados'],
    'Comida Rapida': ['Hamburguesas', 'Shawarmas', 'Perros Calientes', 'Club House'],
    'Conservas': ['Atún', 'Sardinas', 'Aceitunas', 'Vegetales', 'Legumbres'],
    'Higiene Personal': ['Shampoo', 'Acondicionador', 'Cuidado Dental', 'Desodorantes', 'Toallas', 'Cuidado del Cabello'],
    'Hogar': ['Papel', 'Bolsas', 'Velas', 'Aromatizantes', 'Utensilios'],
    'Lácteos': ['Quesos', 'Margarina', 'Mayonesa', 'Mantequilla', 'Yogurt'],
    'Limpieza': ['Detergentes', 'Desinfectantes', 'Suavizantes', 'Limpiadores'],
    'Mascotas': ['Perros', 'Gatos', 'Higiene'],
    'Panaderia': ['Panes', 'Pasteleria', 'Dulces', 'Tortas'],
    'Repostería': ['Harinas', 'Chocolate', 'Vainilla', 'Especias'],
    'Salsas y Condimentos': ['Ketchup', 'Mostaza', 'Mayonesa', 'Salsas', 'Adobos'],
    'Snacks y Frituras': ['Papas', 'Tostones', 'Chicharrones'],
    'Viveres': ['Arroces', 'Pastas', 'Harinas', 'Aceites', 'Vinagres', 'Enlatados', 'Cereales', 'Especias'],
  },
  seo_home_title: 'Market Coffee Sweet | Panadería, Comida Rápida y Víveres en Valencia',
  seo_home_description: 'Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida (hamburguesas, shawarmas, perros calientes), víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.',
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
      direccion: 'Av. Principal, Local #12, Ciudad',
      telefono: '+584124058904',
      coordenadas: { lat: 10.198300, lng: -68.004400 },
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
    bonus_actions: { daily_login: 5, first_order: 25, review: 10, referral: 100 },
    tiers: [
      { id: 'tier-bronze', name: 'Bronce', min_points: 0, multiplier: 1, benefits: ['Puntos base'], color: '#CD7F32' },
      { id: 'tier-silver', name: 'Plata', min_points: 500, multiplier: 1.25, benefits: ['25% más puntos'], color: '#8E8E93' },
      { id: 'tier-gold', name: 'Oro', min_points: 1500, multiplier: 1.5, benefits: ['50% más puntos', 'Envío gratis'], color: '#FF9500' },
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
  const PRODUCTS_VERSION = '2.0';
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
    const saved = localStorage.getItem('trv_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('trv_coupons');
    return saved ? JSON.parse(saved) : [];
  });

  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [config, setConfig] = useState<StoreConfig>(() => {
    const saved = localStorage.getItem('trv_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        // Si no tiene subcategories o están vacías, usar las del DEFAULT_CONFIG
        if (!merged.subcategories || Object.keys(merged.subcategories).length === 0) {
          merged.subcategories = DEFAULT_CONFIG.subcategories;
        }
        return merged;
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const saved = localStorage.getItem('trv_notifications');
    return saved ? JSON.parse(saved) : [
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
    const saved = localStorage.getItem('trv_cart');
    return saved ? JSON.parse(saved) : [];
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
    const saved = localStorage.getItem('trv_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('trv_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('trv_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    const saved = localStorage.getItem('trv_reviews');
    return saved ? JSON.parse(saved) : [];
  });

  const [flashSales, setFlashSales] = useState<FlashSale[]>(() => {
    const saved = localStorage.getItem('trv_flash_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(() => {
    const saved = localStorage.getItem('trv_loyalty_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [rewardCatalog, setRewardCatalog] = useState<RewardItem[]>(() => {
    const saved = localStorage.getItem('trv_reward_catalog');
    return saved ? JSON.parse(saved) : [];
  });

  // --- MOTOR DE TIEMPO REAL (SUPABASE CHANNELS) ---
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

    const audio = new Audio(soundUrl);
    audio.volume = 0.8;
    audio.play().catch((err) => {
      if (err.name === 'NotAllowedError') {
        console.warn('📢 Audio bloqueado — se necesita interacción previa del usuario.');
      } else {
        console.warn('📢 Error al reproducir audio:', err.message);
      }
    });

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

  // ✅ FIX: Escuchar mensajes del Service Worker para reproducir sonido desde el cliente
  // (Audio API no está disponible en SW — el SW hace postMessage y el cliente reproduce)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        const url = event.data.soundUrl || '/sounds/notification.mp3';
        const audio = new Audio(url);
        audio.volume = 0.8;
        audio.play().catch(err =>
          console.warn('[SW→Client] No se pudo reproducir sonido:', err.message)
        );
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, []);

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

    try {
      // CANAL UNIFICADO PARA BROADCAST Y POSTGRES CHANGES
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
                ? { ...o, status: updated.status, tiempo_estimado_entrega: updated.tiempo_estimado_entrega }
                : o
            )
          );

          const cu = currentUserRef.current;
          if (cu && updated.cliente_telefono === cu.telefono) {
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
                  data: { url: '/' }
                } as NotificationOptions);
              });
            }
          }
        })
        // Escuchar Pedidos Nuevos vía BROADCAST (Ultra Rápido)
        .on('broadcast', { event: 'new_order_broadcast' }, (payload: { payload: Order }) => {
          const newOrder = payload.payload;
          setOrders(prev => [newOrder, ...prev]);
          window.dispatchEvent(new CustomEvent('new_order_received', { detail: newOrder }));
          playNotificationSound('new');
          
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
            });
          }
        })
        // Escuchar Notificaciones (CDC)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: Record<string, unknown>) => {
          const newNotif = payload.new as InAppNotification;
          
          // Validar si es para todos o específicamente para el usuario actual
          const cu = currentUserRef.current;
          const isForMe = (newNotif.tipo === 'todos') || 
                         (cu && newNotif.tipo === 'personal' && newNotif.destinatario_telefono === cu.telefono) ||
                         (isAdminAuthenticatedRef.current && (newNotif.tipo === 'request' || newNotif.tipo === 'admin'));

          if (isForMe) {
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            playNotificationSound('update');
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
          }
        });

    } catch (e) {
      console.error('Realtime channels failed:', e);
    }

    setIsGlobalLoading(false);
    return () => {
      if (mainChannel) supabase.removeChannel(mainChannel);
    };
  }, [currentUser, config.site_nombre]);
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

  // Daily Exchange Rate Update Routine (BCV Oficial)
  const fetchExchangeRate = async (retryCount = 0): Promise<boolean> => {
    const MAX_RETRIES = 2;
    const endpoints = [
      'https://ve.dolarapi.com/v1/dolares',
      'https://pydolarve.org/api/v1/dollar'
    ];

    for (const url of endpoints) {
      try {
        console.warn(`🔍 Marketo: Intentando obtener tasa BCV desde ${url}...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) continue;
        const data = await response.json();
        let newRate: number | null = null;

        if (Array.isArray(data)) {
          const oficial = data.find((d: { nombre?: string; fuente?: string; promedio?: string; venta?: string; compra?: string }) => d.nombre === 'Oficial' || d.fuente === 'oficial');
          if (oficial) {
            newRate = parseFloat((oficial.promedio || oficial.venta || oficial.compra) as string);
          }
        } else if (data && typeof data === 'object') {
          if (data.venta) newRate = parseFloat(data.venta);
          else if (data.valor) newRate = parseFloat(data.valor);
          else if (data.dollar && data.dollar.price) newRate = parseFloat(data.dollar.price);
          else if (data.promedio) newRate = parseFloat(data.promedio);
        }

        // Validar: debe ser un número razonable para Bs/USD en Venezuela (actual ~600+)
        if (newRate && !isNaN(newRate) && newRate > 10 && newRate < 10000) {
          updateExchangeRate(newRate);
          const now = Date.now();
          localStorage.setItem('trv_last_rate_fetch', now.toString());
          console.warn(`✅ Tasa BCV actualizada automáticamente: ${newRate} Bs/USD.`);
          return true;
        }
      } catch (error: unknown) {
        console.warn(`⚠️ Marketo: Error con ${url}:`, (error as Error).message || error);
      }
    }

    // Reintentar si quedan intentos
    if (retryCount < MAX_RETRIES) {
      console.warn(`🔄 Marketo: Reintentando obtener tasa BCV (intento ${retryCount + 2}/${MAX_RETRIES + 1})...`);
      await new Promise(r => setTimeout(r, 3000));
      return fetchExchangeRate(retryCount + 1);
    }

    console.error('❌ Marketo: No se pudo obtener la tasa BCV de ninguna fuente tras varios intentos.');
    return false;
  };

  // Verificar si la tasa necesita actualización
  const needsRateUpdate = (): boolean => {
    const lastFetch = localStorage.getItem('trv_last_rate_fetch');
    if (!lastFetch) return true;
    const lastFetchTime = parseInt(lastFetch, 10);
    if (isNaN(lastFetchTime)) return true;
    // Actualizar si pasaron más de 4 horas desde la última obtención exitosa
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    return Date.now() - lastFetchTime > FOUR_HOURS;
  };

  useEffect(() => {
    const initData = async () => {
      setIsGlobalLoading(true);

      try {

      // BUG FIX: Si es admin/operador/customer, cargar TODO. Obtener sesión primero.
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email || '';
      const sessionRole = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
      const isAdmin = sessionEmail === 'kecho8a@gmail.com' || sessionRole === 'admin';
      const isOperator = sessionRole === 'operator';
      const isCustomer = sessionRole === 'customer';

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
        if (isAdmin) {
          setUserRole('admin');
          localStorage.setItem('trv_user_role', 'admin');
          setAdminScopeSedeId('');
          localStorage.setItem('trv_admin_scope_sede', '');
        } else if (isOperator) {
          // Verificar que el operador esté activo y obtener su sede
          const { data: opRecord } = await supabase
            .from('admin_users')
            .select('active, sede_id')
            .eq('id', session!.user.id)
            .single();

          if (opRecord && opRecord.active !== false) {
            setUserRole('operator');
            localStorage.setItem('trv_user_role', 'operator');
            const scopeSede = opRecord.sede_id || '';
            setAdminScopeSedeId(scopeSede);
            localStorage.setItem('trv_admin_scope_sede', scopeSede);
          } else {
            // Operador desactivado, cerrar sesión
            setIsAdminAuthenticated(false);
            setUserRole(null);
            localStorage.removeItem('trv_admin_auth');
            localStorage.removeItem('trv_user_role');
            localStorage.removeItem('trv_admin_scope_sede');
            setAdminScopeSedeId('');
            await supabase.auth.signOut();
          }
        } else if (isCustomer) {
          const { data: custRecord } = await supabase
            .from('admin_users')
            .select('active, sede_id')
            .eq('id', session!.user.id)
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
        }
      }

      // Cargar productos de Supabase (si es admin, incluir inactivos)
      let productsQuery = supabase.from('products').select('*');
      if (!isAdmin) {
        productsQuery = productsQuery.eq('activo', true);
      }
      const { data: dbProducts } = await productsQuery;
      if (dbProducts && dbProducts.length > 0) {
        const merged = (dbProducts as FoodItem[]).map(p => {
          const hasDbOptions = Array.isArray(p.option_groups) && p.option_groups.length > 0;
          if (hasDbOptions) return p;
          const fallback = DEFAULT_PRODUCTS.find(d => d.nombre === p.nombre && d.categoria === p.categoria);
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
          logo_url: dbConfig.logo_url ?? prev.logo_url,
          theme_color: dbConfig.theme_color || prev.theme_color,
          favicon_url: dbConfig.favicon_url || prev.favicon_url,
          banner_texts: dbConfig.banner_texts || prev.banner_texts,
          banner_titles: dbConfig.banner_titles || prev.banner_titles,
          banner_descriptions: dbConfig.banner_descriptions || prev.banner_descriptions,
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
      } else if (currentUser) {
        // Cargar Pedidos del usuario (por teléfono o ID)
        const { data: dbOrders } = await supabase.from('orders')
          .select('*')
          .or(`cliente_telefono.eq."${currentUser.telefono}",cliente_uid.eq."${currentUser.id}"`)
          .order('fecha', { ascending: false });
        if (dbOrders) setOrders(dbOrders as Order[]);

        // Cargar Notificaciones (Solo globales, personales o request del usuario)
        const { data: dbNotifs } = await supabase.from('notifications')
          .select('*')
          .or(`tipo.eq.todos,and(tipo.eq.personal,destinatario_telefono.eq.${currentUser.telefono}),and(tipo.eq.request,destinatario_telefono.eq.${currentUser.telefono})`)
          .order('id', { ascending: false });
        if (dbNotifs) setNotifications(dbNotifs as InAppNotification[]);

        // Cargar datos del usuario actual para que users[] tenga loyalty_points
        try {
          const { data: dbUser } = await supabase.from('usuarios_clientes')
            .select('*').eq('id', currentUser.id).single();
          if (dbUser) {
            setUsers([{ ...dbUser, createdAt: dbUser.created_at, contrasena: 'managed' } as AppUser]);
            setCurrentUser(prev => prev ? { ...prev, ...dbUser } : prev);
          }
        } catch (e) { console.warn('[initData] user profile load failed:', e); }
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
          const sessionEmail = session.user?.email || '';
          const sessionRole = session.user?.app_metadata?.role || session.user?.user_metadata?.role;
          const isAdmin = sessionEmail === 'kecho8a@gmail.com' || sessionRole === 'admin';
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
              const sessionEmail = restoredSession.user?.email || '';
              const sessionRole = restoredSession.user?.app_metadata?.role || restoredSession.user?.user_metadata?.role;
              const isAdmin = sessionEmail === 'kecho8a@gmail.com' || sessionRole === 'admin';
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
    console.warn('🛠️ AppContext: Procesando solicitud de producto:', descripcion);
    const adminRes = await addNotification(
      'Nueva Solicitud de FoodItem Especial 🍏',
      `Solicitud de: ${nombre} (${telefono})\n\nFoodItem: ${descripcion}${imagenUrl ? `\n\nImagen disponible` : ''}`,
      'request',
      telefono
    );
     // Also notify user that request was received
     const userRes = await addNotification(
      'Solicitud de FoodItem Recibida',
      `Hola ${nombre}, hemos recibido tu solicitud para "${descripcion.substring(0, 30)}...". Un agente de ${config.site_nombre || 'nuestra tienda'} te contactará pronto.`,
      'personal',
      telefono
    );
    console.warn('🛠️ AppContext: Resultados de envío:', { adminRes, userRes });
    return adminRes && userRes;
  };

  // Catalog CRUD Functions
  const addProduct = (productData: Omit<FoodItem, 'id'>) => {
    // No generamos ID manual para productos para que Supabase use gen_random_uuid()
    addNotification('Procesando...', `Agregando ${productData.nombre} al catálogo.`);
    
    // Supabase Async Sync
    supabase.from('products').insert([{
      nombre: productData.nombre,
      descripcion: productData.descripcion,
      categoria: productData.categoria,
      precio_usd: productData.precio_usd,
      stock: productData.stock,
      imagen_urls: productData.imagen_urls || [],
      es_promo: productData.es_promo,
      es_nuevo: productData.es_nuevo,
      es_mas_vendido: productData.es_mas_vendido
    }]).select().single().then(({ data, error }) => { 
      if (error) {
        console.error('Add part error:', error);
        addNotification('Error al agregar producto', error.message || 'Error de base de datos');
      }
      if (data) setProducts(prev => [data as FoodItem, ...prev]);
    });
  };

  const updateProduct = (id: string, updated: Partial<FoodItem>) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updatedPart = { ...p, ...updated };
        
        // Supabase Async Sync
        const updatePayload: any = { ...updated };
        delete updatePayload.id; // avoid id conflicts
        supabase.from('products').update(updatePayload).eq('id', updatedPart.id)
          .then(({ error }) => { if (error) {
            console.error('Update part error:', error);
            addNotification('Error al actualizar producto', error.message || 'Error de base de datos');
          } });
          
        return updatedPart;
      }
      return p;
    }));
  };

  const deleteProduct = (id: string) => {
    const targetPart = products.find(p => p.id === id);
    if (targetPart) {
      supabase.from('products').delete().eq('id', targetPart.id)
        .then(({ error }) => { if (error) {
          console.error('Delete part error:', error);
          addNotification('Error al eliminar producto', error.message || 'Error de base de datos');
        } });
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
      
      const itemSearchText = `${item.nombre} ${item.descripcion} ${item.categoria} ${(item.ingredientes || []).join(' ')} ${item.delivery_gratis ? 'delivery gratis' : ''}`.toLowerCase();
      
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
  }, []);

  // Orders Management
  const createOrder = async (orderData: Omit<Order, 'id' | 'subtotal_usd' | 'total_usd' | 'total_bs' | 'fecha' | 'status'> & { descuento_cupon_usd?: number; cupon_codigo?: string; guest_password?: string }, preGeneratedId?: string) => {
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
      id: preGeneratedId || `PED-${Math.floor(1000 + Math.random() * 9000)}-VAL-${new Date().getFullYear()}`,
      usuario_id: orderData.usuario_id || (currentUser ? currentUser.id : undefined),
      items,
      subtotal_usd: subtotal,
      total_usd: totalUsd,
      total_bs: totalBs,
      status: 'Pendiente',
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
      items: newOrder.items,
      descuento_cupon_usd: orderData.descuento_cupon_usd || 0,
      cupon_codigo: orderData.cupon_codigo || null,
      subtotal_usd: newOrder.subtotal_usd,
      costo_envio_usd: newOrder.costo_envio_usd,
      total_usd: newOrder.total_usd,
      total_bs: newOrder.total_bs,
      metodo_pago: newOrder.metodo_pago,
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

    // Auto-register guest after successful order (sin checkbox, con email o telefono)
    if (!currentUser && (orderData.cliente_email || orderData.cliente_telefono)) {
      const cleanPhone = orderData.cliente_telefono.replace(/[\s\-()]/g, '');
      const email = (orderData.cliente_email || '').trim().toLowerCase() || `${cleanPhone}@guest.foodapp.local`;
      let userId = '';
      let authSucceeded = false;

      // 1. Primero intentar signIn (si ya tiene cuenta por email o telefono)
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

      // 2. Si signIn falla, intentar signUp
      if (!authSucceeded) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: cleanPhone,
            options: {
              data: {
                nombre: orderData.cliente_nombre,
                telefono: cleanPhone
              }
            }
          });
          if (!authError && authData?.user) {
            userId = authData.user.id;
            authSucceeded = true;
          }
        } catch { /* signUp falló, usar ID local */ }
      }

      // 3. Si auth falló, usar ID local para que el usuario quede logueado
      if (!userId) {
        userId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

      if (authSucceeded) {
        addNotification(
          '¡Cuenta Creada! 🎉',
          `Hola ${newUser.nombre}. Tu cuenta fue creada automáticamente. Tu contraseña es tu número de teléfono (${cleanPhone}).`,
          'personal',
          newUser.telefono
        );
      }
    }

    // BROADCAST: Enviar señal inmediata al Admin sin esperar a la DB
    supabase.channel('marketo_realtime_system').send({
      type: 'broadcast',
      event: 'new_order_broadcast',
      payload: newOrder
    });

    // Nota: La notificacion admin del nuevo pedido la genera el trigger de Supabase
    // handle_new_order_actions (SECURITY DEFINER), no el frontend. Asi evitamos
    // duplicados y fallos de RLS con clientes anonimos.

    // Notify the client that their order was received
    if (newOrder.cliente_telefono) {
      addNotification(
        'Pedido Recibido con Exito 📦',
        `Hola ${newOrder.cliente_nombre}! Tu pedido con ID ${newOrder.id} por un monto de $${newOrder.total_usd.toFixed(2)} (${newOrder.total_bs.toFixed(2)} Bs) ha sido ingresado en estado: Pendiente. Estamos listos para atenderte.`,
        'personal',
        newOrder.cliente_telefono
      );
    }

    return newOrder;
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

    let statusMsg = `Tu pedido ${orderId} ahora se encuentra en estado: ${status}.`;
    if (status === 'En preparación') {
      statusMsg = `🥬 ¡Buenas noticias, ${clientName}! Tu pedido ${orderId} ya está en preparación en nuestros almacenes de Las Acacias.`;
    } else if (status === 'En camino') {
      statusMsg = `🛵 ¡Tu pedido ${orderId} va en camino! Nuestro motorizado se dirige a tu ubicación en Valencia con cadena de frío.`;
    } else if (status === 'Entregado') {
      statusMsg = `✅ Pedido ${orderId} entregado con éxito. ¡Gracias por preferir a ${config.site_nombre || 'nuestra tienda'}!`;
    }
    if (estimatedTime) statusMsg += ` Tiempo estimado de entrega: ${estimatedTime}.`;

    if (targetPhone) {
      addNotification('Estado de Pedido Actualizado', statusMsg, 'personal', targetPhone);
    } else {
      addNotification('Estado de Pedido Actualizado', statusMsg, 'todos');
    }

    const { error } = await supabase.from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) {
      console.error('Update order status error:', error);
      if (prevOrder) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...prevOrder } : o));
      }
    }
  };

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
  const registerUser = async (nombre: string, email: string, telefono: string, contrasena: string): Promise<AppUser> => {
    // 1. Registrar primero en Supabase Auth para obtener el UID oficial
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: contrasena.trim(),
      options: { data: { nombre: nombre.trim(), telefono: telefono.trim() } }
    });

    if (authError) {
      if (authError.status === 429) {
        throw new Error("Límite de intentos alcanzado. Por favor, espere un minuto antes de intentar de nuevo.");
      }
      throw authError;
    }

    const newUser: AppUser = {
      id: authData.user?.id || `user-${Date.now()}`, // Sincronizar con el ID de Auth
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono.trim(),
      contrasena: contrasena.trim(),
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

    // Aplicar welcome bonus de lealtad si esta habilitado
    const loyaltyConfig = config.loyalty;
    if (loyaltyConfig?.enabled && loyaltyConfig.welcome_bonus > 0 && authData.user?.id) {
      const bonusPoints = loyaltyConfig.welcome_bonus;
      const tx: LoyaltyTransaction = {
        id: `loy-tx-welcome-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: authData.user.id,
        type: 'earn',
        points: bonusPoints,
        description: 'Bonus de bienvenida',
        created_at: new Date().toISOString(),
      };
      try {
        await supabase.from('loyalty_transactions').insert({
          user_id: tx.user_id,
          type: tx.type,
          points: tx.points,
          description: tx.description,
          sede_id: '',
        });
        await supabase.from('usuarios_clientes')
          .update({ loyalty_points: bonusPoints, loyalty_lifetime_points: bonusPoints })
          .eq('id', authData.user.id);
      } catch (e) {
        console.error('[Loyalty] Welcome bonus sync failed:', e);
      }
      setLoyaltyTransactions(prev => [...prev, tx]);
      setUsers(prev => prev.map(u => {
        if (u.id !== authData.user?.id) return u;
        return { ...u, loyalty_points: bonusPoints, loyalty_lifetime_points: bonusPoints };
      }));
      setCurrentUser(prev => prev ? { ...prev, loyalty_points: bonusPoints, loyalty_lifetime_points: bonusPoints } : prev);
    }

    addNotification(
      '¡Registro Exitoso! 🎉',
      `Hola ${newUser.nombre}. Te has registrado con éxito. Recuerda que con tu nombre, teléfono (${newUser.telefono}) y tu clave secreta podrás acceder siempre a tu panel de usuario.`,
      'personal',
      newUser.telefono
    );
    
    return newUser;
  };

  const loginUser = async (identifier: string, contrasena: string): Promise<AppUser | null> => {
    const cleanId = identifier.trim().toLowerCase();
    
    // Determine if identifier is email or phone
    const isEmail = cleanId.includes('@');
    
    // Use Supabase Auth for secure login
    let authEmail = cleanId;
    if (!isEmail) {
      // If phone number, look up the email from usuarios_clientes
      const { data: lookupData } = await supabase
        .from('usuarios_clientes')
        .select('email')
        .eq('telefono', identifier.trim())
        .single();
      
      if (lookupData?.email) {
        authEmail = lookupData.email;
      } else {
        return null; // No account found for this phone
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: contrasena.trim()
    });

    if (error || !data.user) {
      console.error('Login error:', error?.message);
      return null;
    }

    // Load full user data from usuarios_clientes
    const { data: dbUser } = await supabase
      .from('usuarios_clientes')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const user: AppUser = {
      id: data.user.id,
      nombre: dbUser?.nombre || data.user.user_metadata?.nombre || data.user.email?.split('@')[0] || 'Usuario',
      email: dbUser?.email || data.user.email || '',
      telefono: dbUser?.telefono || data.user.user_metadata?.telefono || '',
      contrasena: 'auth_managed',
      createdAt: dbUser?.created_at || data.user.created_at || new Date().toISOString(),
      loyalty_points: dbUser?.loyalty_points || 0,
      loyalty_lifetime_points: dbUser?.loyalty_lifetime_points || 0,
      loyalty_tier_id: dbUser?.loyalty_tier_id || '',
      sede_preferida_id: dbUser?.sede_preferida_id || '',
      is_pwa_installed: dbUser?.is_pwa_installed || false,
      pwa_installed_at: dbUser?.pwa_installed_at || undefined,
    };

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
  };

  const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile?reset=true`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logoutUser = () => {
    setCurrentUser(null);
  };

  const updateUser = (updated: Partial<AppUser>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updated };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

    // Update in Supabase in background
    supabase.from('usuarios_clientes')
      .update({
        nombre: updatedUser.nombre,
        telefono: updatedUser.telefono,
        email: updatedUser.email,
        contrasena: updatedUser.contrasena
      })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (error) console.error('Error updating user in Supabase:', error);
      });

    addNotification(
      'Datos Actualizados ⚙️',
      `Tus datos han sido guardados. Nombre: ${updatedUser.nombre}, Teléfono: ${updatedUser.telefono}. Tus credenciales de acceso son tu correo, teléfono y contraseña guardada.`,
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

    // Sync to Supabase in background
    const updatePayload: any = {};
    if (updated.nombre !== undefined) updatePayload.nombre = updated.nombre;
    if (updated.telefono !== undefined) updatePayload.telefono = updated.telefono;
    if (updated.contrasena !== undefined) updatePayload.contrasena = updated.contrasena;

    if (Object.keys(updatePayload).length > 0) {
      supabase.from('usuarios_clientes')
        .update(updatePayload)
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.error('Error updating user by admin in Supabase:', error);
        });
    }
  };

  const addCategory = (categoryName: string) => {
    setConfig(prev => {
      const currentCats = prev.categories || [];
      if (currentCats.includes(categoryName)) return prev;
      const updated = { ...prev, categories: [...currentCats, categoryName] };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteCategory = (categoryName: string) => {
    setConfig(prev => {
      const currentCats = prev.categories || [];
      const updated = { ...prev, categories: currentCats.filter(c => c !== categoryName) };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      return updated;
    });

    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        if (p.categoria === categoryName) {
          return { ...p, categoria: 'Panaderia' };
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
      const updated = {
        ...prev,
        categories: currentCats.map(c => c === oldCategory ? newCategory : c)
      };
      localStorage.setItem('trv_config', JSON.stringify(updated));
      return updated;
    });
    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        if (p.categoria === oldCategory) {
          return { ...p, categoria: newCategory };
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
    console.warn(`🔔 Marketo System: Registrando notificación [${tipo}]...`);
    
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

    // Actualización optimista local para que el mensaje aparezca inmediatamente en el emisor
    setNotifications(prev => {
      if (prev.some(n => n.id === notifId)) return prev;
      return [newNotif, ...prev];
    });

    // Sincronización con Supabase
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
      const isBroadcast = tipo === 'todos' || tipo === 'admin';
      if (isBroadcast) {
        // Los broadcasts de sistema no se insertan desde el frontend: los genera
        // Supabase via los triggers handle_new_order_actions / handle_order_status_push_update.
        // Silenciamos el fallo RLS para que el checkout de un cliente anonimo no genere ruido.
        console.warn('⚠️ Marketo: Broadcast de sistema bloqueado por RLS (esperado para anon):', error.message);
        return false;
      }
      console.error('❌ Marketo Error (SQL):', error.message, '| Hint:', error.hint);
      // Rollback actualización optimista
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      return false;
    }
    
    console.warn('✅ Notificación guardada en Supabase:', notifId);

    // El disparo del Webhook Push ya no se hace desde el frontend por seguridad y para evitar errores 401.
    // Ahora lo gestiona exclusivamente el trigger "trigger_notify_push" en Supabase 
    // (definido en schema_definitivo.sql) usando la extensión pg_net, garantizando que el 
    // secreto de autenticación nunca viaje por el navegador del cliente.

    return true;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  };

  const toggleNotificationReadStatus = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: !n.leida } : n));
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
    if (typeof window === 'undefined') {
      return { success: false, error: 'window no disponible (SSR?)' };
    }
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service Worker no soportado en este navegador' };
    }
    if (!('PushManager' in window)) {
      return { success: false, error: 'PushManager no disponible en este navegador' };
    }
    if (!currentUser) {
      console.error('❌ Marketo Sync Error: Intento de sincronizar push sin usuario logueado');
      return { success: false, error: 'No hay usuario logueado. Inicia sesión para activar notificaciones.' };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();

      if (!existingSub) {
        console.warn('⚠️ Marketo Sync: No se encontró suscripción push activa en este navegador.');
        return { success: false, error: 'No existe suscripción push activa. Activa las notificaciones desde tu Perfil.' };
      }

      const subJSON = existingSub.toJSON();

      // Validar que tenemos las keys necesarias
      if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
        return { success: false, error: 'Suscripción push corrupta. Renuncia y activa las notificaciones de nuevo.' };
      }

      // Actualizamos la suscripción en la tabla push_subscriptions.
      // El upsert usa 'endpoint' como unique constraint (creado en schema_definitivo.sql).
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: subJSON.endpoint,
        p256dh: subJSON.keys?.p256dh,
        auth_secret: subJSON.keys?.auth,
        destinatario_telefono: currentUser.telefono.trim()
      }, { onConflict: 'endpoint' });

      if (error) {
        const msg = 'Error sincronizando suscripción push: ' + error.message;
        console.error('❌ Marketo:', msg);
        return { success: false, error: msg };
      } else {
        console.warn('✅ Marketo: Suscripción Push sincronizada con el teléfono:', currentUser.telefono);
        return { success: true };
      }
    } catch (err: any) {
      const msg = 'Fallo crítico en syncPushSubscription: ' + (err?.message || String(err));
      console.error('❌ Marketo:', msg);
      return { success: false, error: msg };
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Admin/Operator Auth functions
  const authenticateAdmin = async (email: string, pass: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass.trim()
      });
      if (error) {
        console.error('Supabase Auth Error:', error.message);
        return false;
      }
      if (data.session) {
        const sessionEmail = data.session.user?.email || '';
        const appRole = data.session.user?.app_metadata?.role || data.session.user?.user_metadata?.role;
        const isAdminEmail = sessionEmail === 'kecho8a@gmail.com';
        const isAdminRole = appRole === 'admin';
        const isOperatorRole = appRole === 'operator';

        if (isAdminEmail || isAdminRole) {
          setIsAdminAuthenticated(true);
          localStorage.setItem('trv_admin_auth', 'true');
          setUserRole('admin');
          localStorage.setItem('trv_user_role', 'admin');
          setAdminScopeSedeId('');
          localStorage.setItem('trv_admin_scope_sede', '');
          return true;
        }

        if (isOperatorRole) {
          // Verificar que el operador esté activo en la tabla admin_users y obtener su sede
          const { data: opRecord } = await supabase
            .from('admin_users')
            .select('active, sede_id')
            .eq('id', data.session.user.id)
            .single();

          if (opRecord && opRecord.active !== false) {
            setIsAdminAuthenticated(true);
            localStorage.setItem('trv_admin_auth', 'true');
            setUserRole('operator');
            localStorage.setItem('trv_user_role', 'operator');
            const scopeSede = opRecord.sede_id || '';
            setAdminScopeSedeId(scopeSede);
            localStorage.setItem('trv_admin_scope_sede', scopeSede);
            return true;
          }
        }

        const isCustomerRole = appRole === 'customer';
        if (isCustomerRole) {
          const { data: custRecord } = await supabase
            .from('admin_users')
            .select('active, sede_id')
            .eq('id', data.session.user.id)
            .single();

          if (custRecord && custRecord.active !== false) {
            setIsAdminAuthenticated(true);
            localStorage.setItem('trv_admin_auth', 'true');
            setUserRole('customer');
            localStorage.setItem('trv_user_role', 'customer');
            const scopeSede = custRecord.sede_id || '';
            setAdminScopeSedeId(scopeSede);
            localStorage.setItem('trv_admin_scope_sede', scopeSede);
            return true;
          }
        }

        // No tiene rol de admin, operador ni customer
        console.error('User has no admin/operator/customer role');
        await supabase.auth.signOut();
        return false;
      }
      return false;
    } catch {
      return false;
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
  const earnLoyaltyPoints = async (userId: string, orderId: string, amountUsd: number, sedeId?: string) => {
    const loyaltyConfig = config.loyalty;
    if (!loyaltyConfig?.enabled || amountUsd < loyaltyConfig.min_order_for_points) return;
    
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const tier = getUserLoyaltyTier(userId);
    const multiplier = tier?.multiplier || 1;
    const basePoints = Math.floor(amountUsd * loyaltyConfig.points_per_dollar * multiplier);
    const pwaBonus = user.is_pwa_installed ? 1.5 : 1;
    const pointsEarned = Math.floor(basePoints * pwaBonus);
    
    if (pointsEarned <= 0) return;
    
    const tx: LoyaltyTransaction = {
      id: `loy-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'earn',
      points: pointsEarned,
      description: user.is_pwa_installed ? `Compra #${orderId.slice(-8)} (Bonus App x1.5)` : `Compra #${orderId.slice(-8)}`,
      order_id: orderId,
      sede_id: sedeId,
      created_at: new Date().toISOString(),
    };
    
    // Persistir a Supabase (idempotente por unique index en user_id+order_id)
    try {
      const { error: txErr } = await supabase.from('loyalty_transactions').insert({
        user_id: tx.user_id,
        type: tx.type,
        points: tx.points,
        description: tx.description,
        order_id: tx.order_id,
        sede_id: tx.sede_id || '',
      });
      if (txErr && txErr.code !== '23505') { // 23505 = duplicate key (ya ganó puntos por esta orden)
        console.error('[Loyalty] Error guardando transaccion:', txErr.message);
      }
      // Actualizar puntos en Supabase
      const { error: ptsErr } = await supabase.from('usuarios_clientes')
        .update({
          loyalty_points: (user.loyalty_points || 0) + pointsEarned,
          loyalty_lifetime_points: (user.loyalty_lifetime_points || 0) + pointsEarned,
        })
        .eq('id', userId);
      if (ptsErr) console.error('[Loyalty] Error actualizando puntos:', ptsErr.message);
    } catch (e) {
      console.error('[Loyalty] Sync failed:', e);
    }
    
    // Actualizar estado local
    setLoyaltyTransactions(prev => [...prev, tx]);
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        loyalty_points: (u.loyalty_points || 0) + pointsEarned,
        loyalty_lifetime_points: (u.loyalty_lifetime_points || 0) + pointsEarned,
      };
    }));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? {
        ...prev,
        loyalty_points: (prev.loyalty_points || 0) + pointsEarned,
        loyalty_lifetime_points: (prev.loyalty_lifetime_points || 0) + pointsEarned,
      } : prev);
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
    const reward = rewardCatalog.find(r => r.id === rewardId);
    if (!reward || !reward.active) return false;
    const user = users.find(u => u.id === userId);
    if (!user || (user.loyalty_points || 0) < reward.points_cost) return false;
    
    const tx: LoyaltyTransaction = {
      id: `loy-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'redeem',
      points: -reward.points_cost,
      description: `Canje: ${reward.name}`,
      created_at: new Date().toISOString(),
    };

    const newPoints = (user.loyalty_points || 0) - reward.points_cost;

    // Persistir a Supabase
    try {
      const { error: txErr } = await supabase.from('loyalty_transactions').insert({
        user_id: tx.user_id,
        type: tx.type,
        points: tx.points,
        description: tx.description,
      });
      if (txErr) console.error('[Loyalty] Error guardando canje:', txErr.message);
      const { error: ptsErr } = await supabase.from('usuarios_clientes')
        .update({ loyalty_points: newPoints })
        .eq('id', userId);
      if (ptsErr) console.error('[Loyalty] Error actualizando puntos:', ptsErr.message);
    } catch (e) {
      console.error('[Loyalty] Sync failed:', e);
    }
    
    // Actualizar estado local
    setLoyaltyTransactions(prev => [...prev, tx]);
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, loyalty_points: newPoints };
    }));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, loyalty_points: newPoints } : prev);
    }
    return true;
  };

  const redeemLoyaltyPoints = async (userId: string, pointsToRedeem: number, orderId?: string): Promise<boolean> => {
    const loyaltyConfig = config.loyalty;
    if (!loyaltyConfig?.enabled) return false;
    
    const user = users.find(u => u.id === userId);
    if (!user || (user.loyalty_points || 0) < pointsToRedeem) return false;
    
    const tx: LoyaltyTransaction = {
      id: `loy-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'redeem',
      points: -pointsToRedeem,
      description: orderId ? `Canje en pedido #${orderId.slice(-8)}` : 'Canje de puntos',
      order_id: orderId,
      created_at: new Date().toISOString(),
    };
    
    const newPoints = (user.loyalty_points || 0) - pointsToRedeem;

    // Persistir a Supabase
    try {
      const { error: txErr } = await supabase.from('loyalty_transactions').insert({
        user_id: tx.user_id,
        type: tx.type,
        points: tx.points,
        description: tx.description,
        order_id: tx.order_id || null,
      });
      if (txErr) console.error('[Loyalty] Error guardando canje:', txErr.message);
      const { error: ptsErr } = await supabase.from('usuarios_clientes')
        .update({ loyalty_points: newPoints })
        .eq('id', userId);
      if (ptsErr) console.error('[Loyalty] Error actualizando puntos:', ptsErr.message);
    } catch (e) {
      console.error('[Loyalty] Sync failed:', e);
    }
    
    // Actualizar estado local
    setLoyaltyTransactions(prev => [...prev, tx]);
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, loyalty_points: newPoints };
    }));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, loyalty_points: newPoints } : prev);
    }
    
    return true;
  };

  const getUserLoyaltyPoints = (userId: string): number => {
    const user = users.find(u => u.id === userId);
    if (user) return user.loyalty_points || 0;
    if (currentUser?.id === userId) return currentUser.loyalty_points || 0;
    return 0;
  };

  const getUserLoyaltyTier = (userId: string): LoyaltyTier | null => {
    const loyaltyConfig = config.loyalty;
    if (!loyaltyConfig?.enabled || !loyaltyConfig.tiers?.length) return null;
    
    const user = users.find(u => u.id === userId);
    const lifetimePoints = user?.loyalty_lifetime_points
      || (currentUser?.id === userId ? currentUser.loyalty_lifetime_points || 0 : 0);
    
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
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const tx: LoyaltyTransaction = {
      id: `loy-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'adjustment',
      points: points,
      description: reason,
      created_at: new Date().toISOString(),
    };
    
    const newPoints = Math.max(0, (user.loyalty_points || 0) + points);
    const newLifetime = points > 0
      ? (user.loyalty_lifetime_points || 0) + points
      : user.loyalty_lifetime_points || 0;

    // Persistir a Supabase (solo admin puede llegar aqui)
    try {
      await supabase.from('loyalty_transactions').insert({
        user_id: tx.user_id,
        type: tx.type,
        points: tx.points,
        description: tx.description,
      });
      await supabase.from('usuarios_clientes')
        .update({ loyalty_points: newPoints, loyalty_lifetime_points: newLifetime })
        .eq('id', userId);
    } catch (e) {
      console.error('[Loyalty] Adjust sync failed:', e);
    }

    // Actualizar estado local
    setLoyaltyTransactions(prev => [...prev, tx]);
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, loyalty_points: newPoints, loyalty_lifetime_points: newLifetime };
    }));
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
      updateOrderStatus,
      updateOrderItems,
      updateConfig,
      updateExchangeRate,
      fetchExchangeRate,
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
      redeemRewardItem
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
