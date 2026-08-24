export type UserRole = 'admin' | 'operator' | 'customer';

export interface AdminUser {
  id: string;
  email: string;
  username?: string;
  nombre: string;
  role: UserRole;
  created_at?: string;
}

export interface AppUser {
  id: string;
  nombre: string;
  username?: string;
  telefono: string;
  contrasena: string;
  email?: string;
  createdAt: string;
  puntos_fidelidad?: number;
  puntos_historicos?: number;
  codigo_referido?: string;
  referred_by?: string;
  referral_count?: number;
  sede_preferida_id?: string;
  is_pwa_installed?: boolean;
  pwa_installed_at?: string;
  // Backward-compatible aliases (deprecated, kept for AppContext)
  loyalty_points?: number;
  loyalty_lifetime_points?: number;
  loyalty_tier_id?: string;
}

export interface FoodOption {
  id: string;
  nombre: string;
  precio_usd: number;
  activo?: boolean;
}

export interface FoodOptionGroup {
  id: string;
  nombre: string;
  min_select: number;
  max_select: number;
  options: FoodOption[];
}

export interface FoodItem {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string[];
  subcategoria?: string;
  precio_usd: number;
  stock: number;
  imagen_urls: string[];
  es_promo: boolean;
  es_nuevo: boolean;
  es_mas_vendido: boolean;
  delivery_gratis?: boolean;
  ingredientes?: string[];
  alergenos?: string[];
  calorias?: number;
  activo?: boolean;
  option_groups?: FoodOptionGroup[];
  related_ids?: string[];
  estimated_prep_time?: number;
  order_count?: number;
  promo_end_date?: string;
  precio_anterior_usd?: number;
  combo_ids?: string[];
  sizes?: PizzaSize[];
  disponibilidad?: 'Disponible' | 'Agotado' | 'En Reposición';
}

export interface PizzaSize {
  id: string;
  name: string;
  price_usd: number;
  description?: string;
}

export interface SelectedOption {
  group_name: string;
  option_name: string;
  precio_usd: number;
}

export interface OrderItem {
  food_id: string;
  nombre: string;
  precio_usd: number;
  cantidad: number;
  selected_options?: SelectedOption[];
  options_total_usd?: number;
  ingredientes_removidos?: string[];
}

export interface Mesa {
  id: string;
  numero_mesa: number;
  nombre_personalizado: string;
  estado: 'Disponible' | 'Ocupada' | 'Reservada' | 'Inactiva';
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email?: string;
  usuario_id?: string;
  cliente_uid?: string;
  guest_phone?: string;
  guest_email?: string;
  crear_cuenta?: boolean;
  guest_password?: string;
  items: OrderItem[];
  subtotal_usd: number;
  costo_envio_usd: number;
  descuento_cupon_usd?: number;
  cupon_codigo?: string;
  total_usd: number;
  total_bs: number;
  metodo_pago: 'Pago Móvil' | 'Zelle' | 'Efectivo' | 'Transferencia' | 'Otro';
  tipo_entrega: 'delivery' | 'mesa' | 'pickup';
  tipo_pedido?: 'delivery' | 'pickup' | 'mesa';
  numero_mesa?: number;
  nombre_cliente?: string;
  referencia_pago?: string;
  banco_origen?: string;
  lat: number;
  lng: number;
  direccion_envio: string;
  distancia_km: number;
  status: 'Pendiente' | 'Procesando' | 'En preparación' | 'En preparacion' | 'Listo' | 'En camino' | 'Entregado' | 'Cancelado' | 'pendiente_verificacion' | 'en_preparacion' | 'completado' | 'cancelado' | 'pago_enviado' | 'pendiente_pago';
  tiempo_estimado_entrega?: string;
  notas_admin?: string;
  fecha: string;
  sede_id?: string;
}

export interface SedeHorario {
  lunes?: { open: string; close: string };
  martes?: { open: string; close: string };
  miercoles?: { open: string; close: string };
  jueves?: { open: string; close: string };
  viernes?: { open: string; close: string };
  sabado?: { open: string; close: string };
  domingo?: { open: string; close: string };
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  coordenadas: { lat: number; lng: number };
  horario?: string;
  activa: boolean;
  es_principal: boolean;
  whatsapp_numero?: string;
  horario_detallado?: SedeHorario;
  esta_abierta_manual?: boolean;
  imagen_url?: string;
  delivery_mode?: 'zonas' | 'km' | 'both';
  delivery_zonas?: DeliveryZone[];
  costo_delivery_km?: number;
  delivery_gratis?: boolean;
  delivery_gratis_threshold?: number;
  permite_delivery?: boolean;
  permite_pickup?: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  cost: number;
  minKm: number;
  maxKm: number;
}

export interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  active: boolean;
  usage_limit?: number;
  usage_count: number;
  valid_until?: string;
  created_at?: string;
  description?: string;
  min_purchase?: number;
  coupon_type?: 'percentage' | 'fixed' | 'free_shipping';
  discount_amount?: number;
}

export interface InAppNotification {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  tipo: 'todos' | 'personal' | 'admin' | 'request';
  destinatario_telefono?: string;
  leida: boolean;
  imagen_url?: string;
  link_url?: string;
  click_count?: number;
}

export interface CartItem {
  item: FoodItem;
  quantity: number;
  selected_options?: SelectedOption[];
  options_total_usd?: number;
  ingredientes_removidos?: string[];
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface FlashSale {
  id: string;
  product_id: string;
  discount_percent: number;
  end_date: string;
  max_quantity?: number;
  sold_quantity: number;
  active: boolean;
}

export interface ProductCombo {
  id: string;
  nombre: string;
  descripcion: string;
  product_ids: string[];
  discount_percent: number;
  imagen_url?: string;
  active: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  message: string;
  image_url?: string;
  product_id?: string;
  discount_type: 'percent' | 'fixed' | '2x1' | 'combo';
  discount_value: number;
  coupon_code?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  audience: 'all' | 'returning' | 'new' | 'by_category' | 'by_zone';
  audience_config?: Record<string, unknown>;
  channel: 'push' | 'in_app' | 'both';
  status: 'draft' | 'scheduled' | 'active' | 'finished' | 'paused';
  scheduled_at?: string;
  sent_at?: string;
  max_uses?: number;
  current_uses: number;
  impressions: number;
  clicks: number;
  conversions: number;
  created_at?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  points_per_dollar: number;
  min_order_for_points: number;
  redemption_rate: number;
  max_discount_percent: number;
  welcome_bonus: number;
  first_order_bonus: number;
  referral_bonus_referrer: number;
  referral_bonus_referred: number;
  daily_login_bonus: number;
  review_bonus: number;
  // Backward-compatible fields (deprecated, kept for AppContext)
  bonus_actions?: {
    daily_login?: number;
    first_order?: number;
    review?: number;
    referral?: number;
  };
  tiers?: LoyaltyLevel[];
}

export interface LoyaltyLevel {
  id: string;
  name: string;
  min_points: number;
  multiplier: number;
  benefits: string[];
  color: string;
  icon: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: 'discount_percent' | 'discount_fixed' | 'free_product' | 'free_shipping' | 'custom';
  reward_value: number;
  product_id?: string;
  imagen_url?: string;
  stock: number;
  stock_used: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoyaltyHistory {
  id: string;
  user_id: string;
  points: number;
  operation: 'suma' | 'resta';
  reason: 'bienvenida' | 'primer_pedido' | 'compra' | 'referido' | 'referido_registro' | 'canje' | 'ajuste_admin' | 'bono_review' | 'bono_diario' | 'expiracion';
  description: string;
  order_id?: string;
  reward_id?: string;
  created_by?: string;
  created_at: string;
}

export interface LoyaltyUserLevel {
  current_points: number;
  lifetime_points: number;
  current_level: LoyaltyLevel | null;
  next_level: LoyaltyLevel | null;
  progress_percent: number;
}

export interface ReferralTracking {
  id: string;
  referrer_id: string;
  referred_id: string;
  referred_code: string;
  status: 'pending' | 'completed' | 'bonus_paid';
  referrer_bonus_paid: boolean;
  referred_bonus_paid: boolean;
  first_order_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  referral_code: string;
  referral_link: string;
  total_earned: number;
}

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: 'discount' | 'free_product' | 'free_shipping' | 'custom';
  reward_value: number;
  product_id?: string;
  imagen_url?: string;
  active: boolean;
  created_at?: string;
}

// Backward-compatible aliases for AppContext
export type LoyaltyTransaction = LoyaltyHistory;
export type LoyaltyTier = LoyaltyLevel;

export const ALLERGEN_OPTIONS = [
  'Gluten', 'Lácteos', 'Frutos secos', 'Mariscos', 'Soja',
  'Huevos', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos',
  'Cacahuetes', 'Moluscos', 'Crustáceos', 'Altramuces'
];

export interface StoreConfig {
  site_nombre: string;
  telefono_soporte: string;
  direccion_fisica: string;
  logo_url?: string;
  coordenadas_tienda: {
    lat: number;
    lng: number;
  };
  correo_interno?: string;
  banners: string[];
  banners_mobile?: string[];
  zelle_enabled: boolean;
  zelle_data: string;
  zelle_discount_percent: number;
  pagomovil_enabled: boolean;
  pagomovil_data: string;
  pagomovil_discount_percent: number;
  efectivo_enabled: boolean;
  efectivo_data: string;
  efectivo_discount_percent: number;
  transferencia_enabled: boolean;
  transferencia_data: string;
  transferencia_discount_percent: number;
  tasa_cambio: number;
  theme_color?: string;
  secondary_color?: string;
  accent_color?: string;
  theme_mode?: 'light' | 'dark' | 'system';
  delivery_gratis?: boolean;
  delivery_gratis_threshold?: number;
  costo_delivery_km?: number;
  recogida_en_local?: boolean;
  entrega_por_zonas?: boolean;
  delivery_zonas?: DeliveryZone[];
  favicon_url?: string;
  pwa_icon_url?: string;
  splash_logo_url?: string;
  banner_texts?: string[];
  banner_titles?: string[];
  banner_descriptions?: string[];
  banner_cta_texts?: string[];
  banner_cta_urls?: string[];
  categories?: string[];
  subcategories?: Record<string, string[]>;
  categories_images?: Record<string, string>;
  mensaje_bienvenida?: string;
  push_webhook_url?: string;
  push_webhook_secret?: string;
  sedes?: Sede[];
  sede_activa_id?: string;
  multi_sucursal_enabled?: boolean;
  esta_abierta?: boolean;
  tiene_mesas?: boolean;
  total_mesas?: number;
  secondary_logo_url?: string;
  stock_alert_threshold?: number;
  envio_nacional?: boolean;
  costo_envio_nacional?: number;
  categories_colors?: Record<string, { primary: string; light: string; textColor: string }>;
  combos?: ProductCombo[];
  faq_items?: FAQItem[];
  loyalty?: LoyaltyConfig;
  seo_home_title?: string;
  seo_home_description?: string;
  seo_home_keywords?: string;
  seo_catalog_title?: string;
  seo_catalog_description?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_cta_text?: string;
  hero_cta_url?: string;
  hero_effect?: 'fade' | 'slide' | 'typewriter' | 'none';
  hero_height?: 'auto' | 'full' | '60vh' | '70vh';
  hero_overlay_opacity?: number;
  section_promos_title?: string;
  section_new_title?: string;
  section_bestseller_title?: string;
  section_rewards_title?: string;
  section_rewards_description?: string;
  section_categories_title?: string;
  section_highlights_title?: string;
  rewards_step1_title?: string;
  rewards_step1_desc?: string;
  rewards_step2_title?: string;
  rewards_step2_desc?: string;
  rewards_step3_title?: string;
  rewards_step3_desc?: string;
  footer_text?: string;
  footer_copyright?: string;
  footer_about_title?: string;
  footer_about_text?: string;
  instagram_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
  site_url?: string;
  font_display?: string;
  jsonld_type?: string;
  jsonld_priceRange?: string;
  jsonld_servesCuisine?: string[];
  brand_stat1_value?: string;
  brand_stat1_label?: string;
  brand_stat2_value?: string;
  brand_stat2_label?: string;
  brand_users_count?: string;
  brand_section_title?: string;
  brand_section_subtitle?: string;
}

// ============================================================================
// MARKETING AUTOMATION TYPES
// ============================================================================

export interface CustomerSegment {
  id: string;
  user_id: string;
  segment_key: string;
  segment_label: string;
  computed_at: string;
  metadata: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
  trigger_type: 'order_status_change' | 'time_based' | 'event_based' | 'segment_entry';
  trigger_config: Record<string, unknown>;
  action_type: 'push' | 'coupon_generate' | 'points_bonus';
  action_config: Record<string, unknown>;
  cooldown_hours: number;
  max_sends_per_user: number;
  last_run_at?: string;
  total_fired: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  rule_slug: string;
  user_id?: string;
  trigger_event: Record<string, unknown>;
  action_taken: string;
  notification_id?: string;
  status: 'sent' | 'rate_limited' | 'cooldown' | 'no_subscription' | 'error';
  error_message: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  channel: 'push' | 'in_app' | 'both';
  segment_filter: string;
  title: string;
  body: string;
  image_url: string;
  link_url: string;
  schedule_at?: string;
  sent_at?: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_rate_limited: number;
  created_by: string;
  created_at: string;
}

export interface PushEvent {
  id: string;
  notification_id: string;
  campaign_id?: string;
  user_id?: string;
  anonymous_id: string;
  event_type: 'sent' | 'delivered' | 'clicked' | 'dismissed';
  metadata: Record<string, unknown>;
  created_at: string;
}
