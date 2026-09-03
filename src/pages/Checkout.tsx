import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { ListOrdered, Trash2, MapPin, Phone, CheckCircle, X, Copy, Check, ArrowRight, ArrowLeft, Store, Truck, Navigation, Search, LocateFixed, ChevronDown, FileText, Clock, UtensilsCrossed, Plus, Minus, MessageSquare, Star, Gift, TruckIcon, Percent, DollarSign } from 'lucide-react';
import { LeafletMap } from '../components/LeafletMap';
import { SEOHead } from '../components/SEOHead';
import { CartUpsell } from '../components/CartUpsell';
import { OrderTracker } from '../components/OrderTracker';
import { OrderSuccessStep } from '../components/mesa/OrderSuccessStep';
import { OrderTypeModal } from '../components/OrderTypeModal';
import { PointsEarnedModal } from '../components/PointsEarnedModal';
import { useToast } from '../components/Toast';
import { FoodItem, Coupon, Order, StoreConfig, DeliveryZone } from '../types/store';
import { haversineKm, findNearestSede } from '../utils/geo';
import { getWhatsAppPhone } from '../utils/phone';
import { supabase } from '../store/supabaseClient';

interface CheckoutProps {
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' | 'mesa_checkout') => void;
  onClose?: () => void;
}

export const Checkout: React.FC<CheckoutProps> = ({ setTab, onClose }) => {
  const { cart, config, addToCart, updateCartQuantity, removeFromCart, createOrder, registerGuestUser, currentUser, coupons, updateCoupon, orders, earnLoyaltyPoints, redeemLoyaltyPoints, clearCart, mesas, fetchMesas } = useApp();
  const { showToast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);

  // Canje de puntos — recompensas del catálogo
  const [availableRewards, setAvailableRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [rewardDiscount, setRewardDiscount] = useState(0);

  // Modal de puntos ganados
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [earnedPointsBalance, setEarnedPointsBalance] = useState(0);

  const hasFreeDeliveryItem = cart.some(item => item.item.delivery_gratis);

  const [clientName, setClientName] = useState(currentUser?.nombre || '');
  const [clientPhone, setClientPhone] = useState(currentUser?.telefono || '');
  const [clientEmail, setClientEmail] = useState(currentUser?.email || '');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'Pago Móvil' | 'Efectivo' | 'Punto'>('Pago Móvil');
  const [validationError, setValidationError] = useState('');
  const [customPaymentNote, setCustomPaymentNote] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [shippingLat, setShippingLat] = useState<number>(config.coordenadas_tienda.lat);
  const [shippingLng, setShippingLng] = useState<number>(config.coordenadas_tienda.lng);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [shippingDistance, setShippingDistance] = useState<number>(0);
  const [shippingZone, setShippingZone] = useState<string>('Retiro en Tienda');

  const [shippingMethod, setShippingMethod] = useState<'mapa' | 'recogida' | 'zonas'>('mapa');
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);

  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [cashBills, setCashBills] = useState('');
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  // Pedido activo recuperado tras un remount del componente: el auto-registro de
  // invitados dispara el loading global (AppContext.initData), que desmonta la app
  // y pierde el estado local de processedOrder. Sin esta recuperación, tras pagar
  // se mostraba la página de carrito vacío en vez del seguimiento.
  const [recoveredOrderId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('trv_active_order_id') : null
  );
  // Estados del flujo de checkout también se guardan/restauran para sobrevivir remounts
  const [recoveredWaitingForAdmin] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('trv_waiting_for_admin') === 'true'
  );
  const [recoveredOrderType] = useState<'delivery' | 'pickup' | 'mesa' | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem('trv_checkout_order_type');
    return v === 'delivery' || v === 'pickup' || v === 'mesa' ? v : null;
  });

  const activeSedes = useMemo(() => (config.sedes || []).filter(s => s.activa), [config.sedes]);
  // Multi-sucursal: se activa automáticamente con 2+ sedes activas (el flag
  // multi_sucursal_enabled nunca se persistía en la DB y bloqueaba el selector).
  const hasMultipleSedes = activeSedes.length > 1;
  const [selectedSedeId, setSelectedSedeId] = useState<string>(() => {
    // Respeta la tienda elegida en Home (multi-sucursal) para que Checkout use la
    // misma sede y finalice en su WhatsApp.
    try {
      const saved = localStorage.getItem('trv_selected_sede');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id && activeSedes.some(s => s.id === parsed.id)) return parsed.id;
      }
    } catch {
      // JSON inválido o localStorage no disponible: se usa la sede por defecto.
    }
    return activeSedes.find(s => s.es_principal)?.id || (activeSedes[0]?.id || '');
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [showLocationModal, setShowLocationModal] = useState(false);

  // Estado para pedidos en mesa
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'mesa'>(() => recoveredOrderType || 'delivery');
  const [mesaNumber, setMesaNumber] = useState<number>(() => {
    // Intentar obtener la primera mesa disponible
    const availableMesas = mesas.filter(m => m.estado === 'Disponible');
    return availableMesas.length > 0 ? availableMesas[0].numero_mesa : 1;
  });
  const [orderTypeSelected, setOrderTypeSelected] = useState(false);
  const [mesaOrderConfirmed, setMesaOrderConfirmed] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [waitingForAdmin, setWaitingForAdmin] = useState<boolean>(() =>
    !!recoveredOrderId && recoveredWaitingForAdmin
  );
  const [adminAccepted, setAdminAccepted] = useState(false);
  const [paymentConfirmedByAdmin, setPaymentConfirmedByAdmin] = useState(false);
  // Fase de pago para pedidos de mesa
  const [mesaPaymentPhase, setMesaPaymentPhase] = useState(false);
  const [mesaPaymentMethod, setMesaPaymentMethod] = useState<'Pago Móvil' | 'Efectivo' | 'Punto'>('Pago Móvil');
  const [mesaPaymentSent, setMesaPaymentSent] = useState(false);

  // Cargar mesas disponibles cuando el usuario selecciona "mesa"
  useEffect(() => {
    if (mesas.length === 0) {
      fetchMesas();
    }
  }, [mesas.length, fetchMesas]);

  useEffect(() => {
    if (processedOrder) {
      clearCart();
    }
  }, [processedOrder, clearCart]);

  // Listener de realtime para detectar aceptación del admin
  useEffect(() => {
    if (!waitingForAdmin || !processedOrder || adminAccepted) return;

    const channel = supabase.channel(`checkout-order-${processedOrder.id}`);
    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${processedOrder.id}` }, (payload: Record<string, unknown>) => {
        const updated = payload.new as Order;
        if (updated.status === 'En preparación' || updated.status === 'en_preparacion' || updated.status === 'Procesando') {
          setAdminAccepted(true);
          setProcessedOrder(updated);
        } else if (updated.status === 'Cancelado' || updated.status === 'cancelado') {
          setWaitingForAdmin(false);
          setProcessedOrder(null);
          localStorage.removeItem('trv_active_order_id');
          localStorage.removeItem('trv_waiting_for_admin');
          localStorage.removeItem('trv_checkout_order_type');
          setValidationError('Tu pedido fue rechazado. Intenta de nuevo.');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [waitingForAdmin, processedOrder, adminAccepted]);

  // Listener de realtime para detectar confirmación de pago del admin (mesa)
  useEffect(() => {
    if (!mesaPaymentSent || !processedOrder || paymentConfirmedByAdmin) return;

    const channel = supabase.channel(`checkout-mesa-payment-${processedOrder.id}`);
    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${processedOrder.id}` }, (payload: Record<string, unknown>) => {
        const updated = payload.new as Order;
        if (updated.status === 'completado') {
          setPaymentConfirmedByAdmin(true);
          setProcessedOrder(updated);
        } else if (updated.status === 'Cancelado' || updated.status === 'cancelado') {
          setMesaPaymentSent(false);
          setMesaPaymentPhase(false);
          setProcessedOrder(null);
          localStorage.removeItem('trv_active_order_id');
          localStorage.removeItem('trv_waiting_for_admin');
          localStorage.removeItem('trv_checkout_order_type');
          setValidationError('Tu pedido fue cancelado.');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mesaPaymentSent, processedOrder, paymentConfirmedByAdmin]);

  const detectNearestSede = useCallback((userLat: number, userLng: number) => {
    const nearest = findNearestSede(activeSedes, { lat: userLat, lng: userLng });
    if (!nearest) return;
    setSelectedSedeId(nearest.id);
    if (nearest.delivery_mode === 'km' || (!nearest.delivery_mode && !config.entrega_por_zonas)) {
      setShippingMethod('mapa');
    } else if (nearest.delivery_mode === 'zonas' || (nearest.delivery_mode === 'both' && config.entrega_por_zonas)) {
      setShippingMethod('zonas');
    }
  }, [activeSedes, config.entrega_por_zonas]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización');
      return;
    }
    setIsDetectingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setShippingLat(latitude);
        setShippingLng(longitude);
        localStorage.setItem('trv_user_location', JSON.stringify({ lat: latitude, lng: longitude }));
        if (hasMultipleSedes) detectNearestSede(latitude, longitude);
        setIsDetectingLocation(false);
        setShowLocationModal(false);
        const dist = haversineKm(latitude, longitude, config.coordenadas_tienda.lat, config.coordenadas_tienda.lng);
        setShippingDistance(Math.round(dist * 10) / 10);
        const zones = activeSedes.find(s => s.id === selectedSedeId)?.delivery_zonas || config.delivery_zonas || [];
        const matchedZone = zones.find(z => dist >= z.minKm && dist <= z.maxKm);
        if (matchedZone) {
          setShippingZone(matchedZone.name);
          setShippingCost(matchedZone.cost);
        } else {
          setShippingZone(`${dist.toFixed(1)} km`);
          setShippingCost(dist * (activeSedes.find(s => s.id === selectedSedeId)?.costo_delivery_km || config.costo_delivery_km || 1.5));
        }
      },
      () => {
        setLocationError('No se pudo obtener tu ubicación. Intenta de nuevo o introduce la dirección manualmente.');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [hasMultipleSedes, detectNearestSede, config, activeSedes, selectedSedeId]);

  useEffect(() => {
    if (currentUser) {
      setClientName(currentUser.nombre);
      setClientPhone(currentUser.telefono);
      setClientEmail(currentUser.email || '');
    }
    const savedContact = localStorage.getItem('trv_checkout_contact');
    if (savedContact && !currentUser) {
      try {
        const parsed = JSON.parse(savedContact);
        if (parsed.nombre) setClientName(parsed.nombre);
        if (parsed.telefono) setClientPhone(parsed.telefono);
        if (parsed.email) setClientEmail(parsed.email);
      } catch {}
    }
    const savedLocation = localStorage.getItem('trv_user_location');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        if (parsed.lat && parsed.lng) {
          setShippingLat(parsed.lat);
          setShippingLng(parsed.lng);
          if (hasMultipleSedes) detectNearestSede(parsed.lat, parsed.lng);
        }
      } catch {}
    }

    const savedSedeSelection = localStorage.getItem('trv_selected_sede');
    if (savedSedeSelection && hasMultipleSedes) {
      try {
        const parsed = JSON.parse(savedSedeSelection);
        if (parsed.id && activeSedes.some(s => s.id === parsed.id)) {
          setSelectedSedeId(parsed.id);
        }
      } catch {}
    }
  }, [currentUser, activeSedes, detectNearestSede, hasMultipleSedes]);

  useEffect(() => {
    if (currentUser) {
      const savedMethod = localStorage.getItem('trv_checkout_method') as 'mapa' | 'recogida' | 'zonas' | null;
      if (savedMethod) setShippingMethod(savedMethod);

      const savedDelivery = localStorage.getItem('trv_last_delivery');
      if (savedDelivery) {
        try {
          const parsed = JSON.parse(savedDelivery);
          if (parsed.lat) setShippingLat(parsed.lat);
          if (parsed.lng) setShippingLng(parsed.lng);
          if (parsed.method) setShippingMethod(parsed.method);
          if (parsed.zone) setShippingZone(parsed.zone);
          if (parsed.distance !== undefined) setShippingDistance(parsed.distance);
          if (parsed.cost !== undefined) setShippingCost(parsed.cost);
          if (parsed.zoneIndex !== undefined && parsed.zoneIndex !== null) setSelectedZoneIndex(parsed.zoneIndex);
          if (parsed.sedeId) setSelectedSedeId(parsed.sedeId);
        } catch {}
      } else if (orders.length > 0) {
        const lastOrder = orders.find(o =>
          o.usuario_id === currentUser.id || o.cliente_telefono === currentUser.telefono
        );
        if (lastOrder) {
          if (lastOrder.lat) setShippingLat(lastOrder.lat);
          if (lastOrder.lng) setShippingLng(lastOrder.lng);
          if (lastOrder.tipo_entrega === 'pickup') {
            setShippingMethod('recogida');
          } else if (config.entrega_por_zonas) {
            setShippingMethod('zonas');
          } else {
            setShippingMethod('mapa');
          }
          if (lastOrder.direccion_envio) {
            const zoneMatch = lastOrder.direccion_envio.match(/^(.+?)\s*\(Distancia:/);
            if (zoneMatch) setShippingZone(zoneMatch[1]);
          }
          if (lastOrder.distancia_km) setShippingDistance(lastOrder.distancia_km);
          if (lastOrder.costo_envio_usd) setShippingCost(lastOrder.costo_envio_usd);
        }
      }
    }
  }, [currentUser, orders, config.entrega_por_zonas]);

  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton: React.FC<{ text: string; fieldId: string }> = ({ text, fieldId }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleCopy(text, fieldId); }}
      className="shrink-0 p-1 rounded hover:bg-[#e2e2e4] transition-colors cursor-pointer"
      title="Copiar"
    >
      {copiedField === fieldId
        ? <Check size={14} className="text-emerald-500" />
        : <Copy size={14} className="text-[#8f7065] hover:text-[#5b4137]" />
      }
    </button>
  );

  const checkoutWhatsAppPhone = (): string => {
    let selectedSede: typeof activeSedes[number] | undefined;
    if (selectedSedeId) selectedSede = activeSedes.find(s => s.id === selectedSedeId);
    return getWhatsAppPhone(config, { sede: selectedSede });
  };

  const subtotalUsd = cart.reduce((acc, ci) => {
    const extrasTotal = ci.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
    return acc + ((ci.item.precio_usd + extrasTotal) * ci.quantity);
  }, 0);
  const effectiveShippingCost = hasFreeDeliveryItem ? 0 : shippingCost;
  let discountFromCoupon = 0;
  if (appliedCoupon) {
    const couponType = appliedCoupon.coupon_type || 'percentage';
    if (couponType === 'fixed') {
      discountFromCoupon = Math.min(appliedCoupon.discount_amount || 0, subtotalUsd);
    } else if (couponType === 'free_shipping') {
      discountFromCoupon = 0;
    } else {
      discountFromCoupon = subtotalUsd * (appliedCoupon.discount_percent / 100);
    }
  }
  const effectiveShippingAfterCoupon = (appliedCoupon?.coupon_type === 'free_shipping') ? 0 : effectiveShippingCost;

  // Canje de puntos: recompensas del catálogo
  const loyaltyConfig = config.loyalty;
  const userPoints = currentUser?.puntos_fidelidad || currentUser?.loyalty_points || 0;

  // Cargar recompensas activas del catálogo
  useEffect(() => {
    if (!loyaltyConfig?.enabled) return;
    const loadRewards = async () => {
      const { data } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('active', true)
        .order('points_cost', { ascending: true });
      if (data) setAvailableRewards(data);
    };
    loadRewards();
  }, [loyaltyConfig?.enabled]);

  // Calcular descuento según el tipo de recompensa seleccionada
  const effectiveRewardDiscount = useMemo(() => {
    if (!selectedReward) return 0;
    const base = subtotalUsd - discountFromCoupon;
    switch (selectedReward.reward_type) {
      case 'discount_percent':
        return Math.min(base * (selectedReward.reward_value / 100), base);
      case 'discount_fixed':
        return Math.min(selectedReward.reward_value, base);
      case 'free_shipping':
        return effectiveShippingAfterCoupon;
      case 'free_product': {
        const freeItem = cart.find(ci => ci.item.id === selectedReward.product_id);
        if (!freeItem) return 0;
        const extras = freeItem.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
        return (freeItem.item.precio_usd + extras) * freeItem.quantity;
      }
      default:
        return 0;
    }
  }, [selectedReward, subtotalUsd, discountFromCoupon, effectiveShippingAfterCoupon, cart]);

  const totalUsd = subtotalUsd - discountFromCoupon - effectiveRewardDiscount + effectiveShippingAfterCoupon;
  const totalBs = totalUsd * config.tasa_cambio;

  // Puntos estimados a ganar con este pedido
  const estimatedPointsToEarn = loyaltyConfig?.enabled && currentUser && totalUsd >= (loyaltyConfig?.min_order_for_points || 0)
    ? Math.floor(totalUsd * (loyaltyConfig?.points_per_dollar || 1))
    : 0;

  const handleShippingMethodChange = (method: 'mapa' | 'recogida' | 'zonas') => {
    setShippingMethod(method);
    setSelectedZoneIndex(null);
    const sede = activeSedes.find(s => s.id === selectedSedeId);
    const sedeCoords = sede?.coordenadas || config.coordenadas_tienda;
    if (method === 'recogida') {
      setShippingLat(sedeCoords.lat);
      setShippingLng(sedeCoords.lng);
      setShippingCost(0);
      setShippingDistance(0);
      setShippingZone('Retiro en Tienda');
    } else if (method === 'zonas') {
      // Auto-detect GPS for zone-based delivery
      setShippingLat(sedeCoords.lat);
      setShippingLng(sedeCoords.lng);
      setShippingCost(0);
      setShippingDistance(0);
      setShippingZone('Detectando ubicación...');
      // Request GPS automatically
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setShippingLat(latitude);
            setShippingLng(longitude);
            localStorage.setItem('trv_user_location', JSON.stringify({ lat: latitude, lng: longitude }));
            const dist = haversineKm(latitude, longitude, sedeCoords.lat, sedeCoords.lng);
            setShippingDistance(Math.round(dist * 10) / 10);
            const zones = sede?.delivery_zonas || config.delivery_zonas || [];
            const matchedZone = zones.find(z => dist >= z.minKm && dist <= z.maxKm);
            if (matchedZone) {
              const idx = zones.indexOf(matchedZone);
              setSelectedZoneIndex(idx);
              setShippingZone(matchedZone.name);
              setShippingCost((sede?.delivery_gratis ?? config.delivery_gratis) ? 0 : matchedZone.cost);
            } else {
              setShippingZone('Zona no cubierta');
              setShippingCost(dist * (sede?.costo_delivery_km || config.costo_delivery_km || 1.5));
            }
          },
          () => {
            // GPS denied - show zones without location
            setShippingZone('Selecciona una zona');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
      }
    } else if (method === 'mapa') {
      const savedLocation = localStorage.getItem('trv_user_location');
      if (savedLocation) {
        try {
          const parsed = JSON.parse(savedLocation);
          if (parsed.lat && parsed.lng) {
            setShippingLat(parsed.lat);
            setShippingLng(parsed.lng);
            const dist = haversineKm(parsed.lat, parsed.lng, sedeCoords.lat, sedeCoords.lng);
            setShippingDistance(Math.round(dist * 10) / 10);
          }
        } catch {}
      }
    }
  };

  const handleZoneSelect = (index: number) => {
    const zones = activeSedes.find(s => s.id === selectedSedeId)?.delivery_zonas || config.delivery_zonas || [];
    if (index >= zones.length) return;
    setSelectedZoneIndex(index);
    const selected = zones[index];
    const sede = activeSedes.find(s => s.id === selectedSedeId);
    setShippingCost((sede?.delivery_gratis ?? config.delivery_gratis) ? 0 : selected.cost);
    setShippingDistance((selected.minKm + selected.maxKm) / 2);
    setShippingZone(selected.name);
  };

  const handleApplyCoupon = () => {
    setCouponError('');
    const found = coupons.find(c => c.code === couponInput.toUpperCase().trim());
    if (!found) { setCouponError('Cupon no valido'); return; }
    if (!found.active) { setCouponError('Este cupon ya no esta activo'); return; }
    if (found.usage_limit && found.usage_count >= found.usage_limit) { setCouponError('Este cupon ha agotado sus usos'); return; }
    if (found.min_purchase && subtotalUsd < found.min_purchase) { setCouponError(`Compra minima: $${found.min_purchase.toFixed(2)}`); return; }
    setAppliedCoupon(found);
    setCouponInput('');
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
    const discountLabel = found.coupon_type === 'fixed'
      ? `$${found.discount_amount || 0} de descuento`
      : found.coupon_type === 'free_shipping'
      ? 'Envío gratis'
      : `${found.discount_percent}% de descuento`;
    showToast('success', `Cupón aplicado: ${discountLabel}`);
  };

  const handleSelectReward = (reward: any) => {
    if (selectedReward?.id === reward.id) {
      setSelectedReward(null);
      setRewardDiscount(0);
    } else {
      setSelectedReward(reward);
      const base = subtotalUsd - discountFromCoupon;
      let discount = 0;
      switch (reward.reward_type) {
        case 'discount_percent':
          discount = Math.min(base * (reward.reward_value / 100), base);
          break;
        case 'discount_fixed':
          discount = Math.min(reward.reward_value, base);
          break;
        case 'free_shipping':
          discount = effectiveShippingAfterCoupon;
          break;
        case 'free_product': {
          const freeItem = cart.find(ci => ci.item.id === reward.product_id);
          if (freeItem) {
            const extras = freeItem.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
            discount = (freeItem.item.precio_usd + extras) * freeItem.quantity;
          }
          break;
        }
      }
      setRewardDiscount(discount);
    }
  };

  const validateStep1 = (): boolean => {
    if (shippingMethod === 'zonas' && selectedZoneIndex === null) {
      setValidationError('Selecciona una zona de entrega.');
      return false;
    }
    if (shippingMethod === 'zonas' && shippingLat === config.coordenadas_tienda.lat && shippingLng === config.coordenadas_tienda.lng) {
      setValidationError('Se requiere tu ubicación GPS para el delivery. Permite el acceso a tu ubicación.');
      return false;
    }
    if (shippingMethod === 'mapa' && shippingLat === config.coordenadas_tienda.lat && shippingLng === config.coordenadas_tienda.lng) {
      setValidationError('Selecciona tu dirección de entrega.');
      return false;
    }
    setValidationError('');
    return true;
  };

  const validateGuestContact = (): boolean => {
    const cleanedPhone = clientPhone.replace(/[\s\-()]/g, '');
    if (!clientName.trim()) {
      setValidationError('Ingresa tu nombre.');
      return false;
    }
    if (!cleanedPhone) {
      setValidationError('Ingresa tu número de teléfono.');
      return false;
    }
    if (!/^\+?[0-9]{7,15}$/.test(cleanedPhone)) {
      setValidationError('El número de teléfono no es válido.');
      return false;
    }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      setValidationError('El correo electrónico no es válido.');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !orderTypeSelected) {
      setShowTypeModal(true);
      return;
    }
    if (orderType === 'mesa') {
      if (currentStep === 1) {
        if (!clientName.trim()) {
          setValidationError('Ingresa tu nombre para el pedido en mesa.');
          return;
        }
        setValidationError('');
        setCurrentStep(2);
      } else if (currentStep === 2) {
        setValidationError('');
        setCurrentStep(3);
      }
      return;
    }
    if (currentStep === 1 && !validateStep1()) return;
    setValidationError('');
    setCurrentStep(prev => (prev < 3 ? (prev + 1) as 1 | 2 | 3 : prev));
  };

  const handlePrevStep = () => {
    setValidationError('');
    setCurrentStep(prev => (prev > 1 ? (prev - 1) as 1 | 2 | 3 : prev));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFakeEmail = currentUser?.email?.includes('@guest.foodapp.local');
    if (orderType === 'mesa') {
      // Validación simplificada para mesa - solo nombre, el pago se maneja después
      if (!clientName.trim()) {
        setValidationError('Ingresa tu nombre.');
        return;
      }
    } else {
      if ((!currentUser || isFakeEmail) && !validateGuestContact()) return;
      if (!paymentConfirmed) {
        setValidationError('Confirma el método de pago para continuar.');
        return;
      }
    }
    setIsProcessing(true);

    const cleanedPhone = clientPhone.replace(/[\s\-()]/g, '');

    const finalClientName = orderType === 'mesa' ? clientName : (currentUser?.nombre || clientName);

    const preOrderId = `ORD-${String(Math.floor(10000 + Math.random() * 90000)).padStart(6, '0')}`;

    const created = await createOrder({
      cliente_nombre: finalClientName || 'Cliente sin nombre',
      cliente_telefono: cleanedPhone || '00000000',
      cliente_email: clientEmail || '',
      usuario_id: currentUser?.id || null,
      items: cart.map(ci => ({
        food_id: ci.item.id,
        nombre: ci.item.nombre,
        precio_usd: ci.item.precio_usd,
        cantidad: ci.quantity,
        selected_options: ci.selected_options,
        options_total_usd: ci.options_total_usd,
        ingredientes_removidos: ci.ingredientes_removidos || []
      })),
      tipo_entrega: orderType === 'mesa' ? 'mesa' : (shippingMethod === 'recogida' ? 'pickup' : 'delivery'),
      tipo_pedido: orderType === 'mesa' ? 'mesa' : undefined,
      numero_mesa: orderType === 'mesa' ? mesaNumber : undefined,
      nombre_cliente: orderType === 'mesa' ? clientName : undefined,
      referencia_pago: undefined,
      banco_origen: undefined,
      costo_envio_usd: orderType === 'mesa' ? 0 : selectedReward?.reward_type === 'free_shipping' ? 0 : effectiveShippingAfterCoupon,
      descuento_cupon_usd: discountFromCoupon,
      cupon_codigo: appliedCoupon?.code,
      descuento_puntos_usd: effectiveRewardDiscount > 0 ? effectiveRewardDiscount : undefined,
      puntos_canjeados: selectedReward ? selectedReward.points_cost : undefined,
      recompensa_tipo: selectedReward ? selectedReward.reward_type : undefined,
      metodo_pago: orderType === 'mesa' ? mesaPaymentMethod : selectedPayment,
      lat: orderType === 'mesa' ? config?.coordenadas_tienda?.lat : shippingLat,
      lng: orderType === 'mesa' ? config?.coordenadas_tienda?.lng : shippingLng,
      direccion_envio: orderType === 'mesa' ? `Mesa #${mesaNumber}` : `${shippingZone} (Distancia: ${shippingDistance}km)`,
      distancia_km: orderType === 'mesa' ? 0 : shippingDistance,
      notas_admin: orderNotes,
      sede_id: selectedSedeId || undefined,
      guest_phone: !currentUser ? cleanedPhone : undefined,
      status_override: orderType === 'mesa' ? 'enviado_cocina' : undefined,
    } as any, preOrderId);

    if (created) {
      console.log('[Checkout] Order created', { orderId: created.id, total: created.total_usd, rewardDiscount: effectiveRewardDiscount, selectedReward: selectedReward?.name });
      if (orderType === 'mesa') {
        setMesaOrderConfirmed(true);
        setMesaPaymentPhase(true);
      }
      setProcessedOrder(created);

      if (orderType === 'delivery') {
        setWaitingForAdmin(true);
        localStorage.setItem('trv_waiting_for_admin', 'true');
      }
      localStorage.setItem('trv_checkout_order_type', orderType);
      if (appliedCoupon) {
        updateCoupon(appliedCoupon.id, { usage_count: (appliedCoupon.usage_count || 0) + 1 });
      }
      localStorage.setItem('trv_active_order_id', created.id);
      if (orderType !== 'mesa') {
        localStorage.setItem('trv_checkout_contact', JSON.stringify({ nombre: clientName, telefono: clientPhone, email: clientEmail }));
        localStorage.setItem('trv_checkout_method', shippingMethod);
        localStorage.setItem('trv_last_delivery', JSON.stringify({
          lat: shippingLat,
          lng: shippingLng,
          method: shippingMethod,
          zone: shippingZone,
          distance: shippingDistance,
          cost: shippingCost,
          zoneIndex: selectedZoneIndex,
          sedeId: selectedSedeId
        }));
      }

      // Auto-registro de invitado DESPUÉS de crear el pedido para evitar
      // que setCurrentUser dispare initData y desmonte el componente.
      let finalUserId = currentUser?.id || null;
      if (orderType !== 'mesa' && (!currentUser || isFakeEmail) && (clientEmail || cleanedPhone)) {
        try {
          const userId = await registerGuestUser({
            cliente_nombre: clientName || 'Cliente sin nombre',
            cliente_telefono: cleanedPhone || '00000000',
            cliente_email: clientEmail || ''
          });
          if (userId) {
            finalUserId = userId;
            if (userId !== currentUser?.id) {
              await supabase.from('orders').update({ usuario_id: userId, cliente_uid: userId }).eq('id', created.id);
              setProcessedOrder(prev => prev ? { ...prev, usuario_id: userId } : prev);
            }
          }
        } catch (err) {
          console.warn('[Checkout] Guest registration failed:', err);
        }
      }

      // SEGURIDAD: Los puntos por compra se acreditan via trigger de DB
      if (finalUserId) {
        earnLoyaltyPoints(finalUserId, created.id, created.total_usd, selectedSedeId || undefined);
        const pointsPerDollar = config.loyalty?.points_per_dollar || 10;
        const estimatedPts = Math.floor(created.total_usd * pointsPerDollar);
        const currentBalance = currentUser?.puntos_fidelidad || currentUser?.loyalty_points || 0;
        setEarnedPoints(estimatedPts);
        setEarnedPointsBalance(currentBalance + estimatedPts);
        setShowPointsModal(true);
      }

      if (finalUserId && selectedReward && selectedReward.points_cost > 0) {
        const redeemResult = await redeemLoyaltyPoints(finalUserId, selectedReward.points_cost, created.id);
        console.log('[Checkout] redeemLoyaltyPoints — result', redeemResult);
      }

      // WhatsApp: se abre DESPUÉS de confirmar que el pedido se creó
      if (orderType !== 'mesa') {
        const deliveryLabel = shippingMethod === 'recogida'
          ? 'Recogida en Tienda'
          : shippingMethod === 'zonas'
            ? `Entrega por Zonas (${shippingZone})`
            : effectiveShippingCost === 0
              ? 'Retiro en Tienda'
              : `Delivery por Mapa (${shippingDistance} KM)`;

        let productosDetailText = '';
        cart.forEach(ci => {
          const extrasTotal = ci.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
          const itemTotal = (ci.item.precio_usd + extrasTotal) * ci.quantity;
          productosDetailText += `- ${ci.quantity}x ${ci.item.nombre} - $${itemTotal.toFixed(2)}\n`;
          if (ci.selected_options && ci.selected_options.length > 0) {
            ci.selected_options.forEach(opt => {
              productosDetailText += opt.precio_usd > 0
                ? `   + ${opt.option_name} (+$${opt.precio_usd.toFixed(2)})\n`
                : `   + ${opt.option_name}\n`;
            });
          }
        });

        const sedeInfo = hasMultipleSedes && selectedSedeId
          ? `\n*Sede Destino:* ${activeSedes.find(s => s.id === selectedSedeId)?.nombre || 'N/A'}`
          : '';

        const whatsappMessage =
`*Nuevo Pedido en ${config.site_nombre || 'Market Coffee Sweet'}*${sedeInfo}
----------------------------------
*Pedido ID:* ${created.id}
*Cliente:* ${finalClientName || 'Cliente sin nombre'}
*Telefono:* ${cleanedPhone}
*Direccion de Entrega:* ${shippingZone}
*Ubicacion Mapa:* https://www.google.com/maps?q=${shippingLat},${shippingLng}
*Metodo Despacho:* ${deliveryLabel} - Costo: $${effectiveShippingAfterCoupon.toFixed(2)}

*Detalle del Carrito:*
${productosDetailText}
*Total Neto a Pagar:* $${totalUsd.toFixed(2)} / ${totalBs.toFixed(2)} Bs.
*Metodo de Pago:* ${selectedPayment}${selectedPayment === 'Efectivo' && cashBills ? `\n*Billetes:* ${cashBills}` : ''}
${orderNotes ? `\n*Notas del Pedido:* ${orderNotes}\n` : ''}
----------------------------------`;

        let cleanPhone = checkoutWhatsAppPhone().replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '58' + cleanPhone.substring(1);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      setValidationError('Error: No se pudo registrar el pedido. Verifique su conexión.');
    }
    setIsProcessing(false);
  };

  const handleSendMesaPayment = async () => {
    if (!processedOrder) return;
    setValidationError('');
    setIsProcessing(true);

    const updates: any = { metodo_pago: mesaPaymentMethod, status: 'pago_enviado' };

    if (!processedOrder?.id) {
      setValidationError('Error: pedido no encontrado.');
      setIsProcessing(false);
      return;
    }

    const { error } = await supabase.rpc('actualizar_pedido_cliente', {
      p_order_id: processedOrder.id,
      p_updates: updates
    });
    if (error) {
      setValidationError('Error al enviar los datos de pago.');
      setIsProcessing(false);
      return;
    }

    setProcessedOrder(prev => prev ? { ...prev, ...updates } : prev);
    setMesaPaymentSent(true);
    setIsProcessing(false);
  };

  const handleMesaPayAtRegister = async () => {
    if (!processedOrder) return;
    setIsProcessing(true);
    const { error } = await supabase.rpc('actualizar_pedido_cliente', {
      p_order_id: processedOrder.id,
      p_updates: { status: 'pendiente_pago' }
    });
    if (!error) {
      setProcessedOrder(prev => prev ? { ...prev, status: 'pendiente_pago' } : prev);
    }
    setIsProcessing(false);
    setMesaPaymentSent(true);
  };

  const displayOrder = processedOrder || (recoveredOrderId ? orders.find(o => o.id === recoveredOrderId) : undefined);

  // Derived colors — must be before early returns that reference them
  const themeColor = config.theme_color || '#A4D045';
  const orderTypeColor = orderType === 'mesa' ? '#e67e22' : orderType === 'pickup' ? '#8b5cf6' : '#3b82f6';

  // Si estamos esperando al admin o en flujo de pago, los screens especiales se encargan
  const inWaitingFlow = waitingForAdmin || adminAccepted || paymentConfirmedByAdmin || (mesaOrderConfirmed && mesaPaymentSent);

  if (displayOrder) {
    if (mesaOrderConfirmed && displayOrder.tipo_pedido === 'mesa' && !mesaPaymentSent) {
      return (
        <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: '#f9f9fb' }}>
          <SEOHead title="Pedido en Mesa" />
          <div className="border-b px-4 py-3 sticky top-0 z-20" style={{ backgroundColor: 'rgba(249,249,251,0.8)', backdropFilter: 'blur(20px)', borderColor: '#e4beb1/10' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => { setMesaOrderConfirmed(false); setMesaPaymentSent(false); setProcessedOrder(null); localStorage.removeItem('trv_active_order_id'); localStorage.removeItem('trv_waiting_for_admin'); localStorage.removeItem('trv_checkout_order_type'); if (onClose) onClose(); else setTab('home'); }} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#eeeef0] transition-colors cursor-pointer" style={{ backgroundColor: '#eeeef0' }}>
                <X size={18} className="text-[#1a1c1d]" />
              </button>
              <div>
                <h1 className="text-[16px] font-bold text-[#1a1c1d]">Pedido Enviado</h1>
                <p className="text-[11px] text-[#8f7065]">Seleccione su método de pago</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-28">
            {/* Mensaje de confirmación */}
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-5 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10b98115' }}>
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-base font-bold text-[#1a1c1d] mb-1">¡Pedido Enviado a Cocina!</h2>
              <p className="text-xs text-[#8f7065] mb-3">Tu pedido se está preparando. Ahora selecciona cómo vas a pagar.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${orderTypeColor}15` }}>
                <UtensilsCrossed size={12} style={{ color: orderTypeColor }} />
                <span className="text-xs font-bold" style={{ color: orderTypeColor }}>Mesa #{displayOrder.numero_mesa || '?'}</span>
              </div>
            </div>

            {/* Resumen del pedido */}
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-3">Detalle del Pedido</h3>
              <div className="space-y-2 mb-3">
                {displayOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-[#5b4137]">
                      <span className="font-bold">{item.cantidad}x</span> {item.nombre}
                      {item.selected_options && item.selected_options.length > 0 && (
                        <span className="text-[#8f7065] ml-1">({item.selected_options.map(o => o.option_name).join(', ')})</span>
                      )}
                    </span>
                    <span className="font-bold text-[#1a1c1d]">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#1a1c1d]">Total a Pagar:</span>
                <div className="text-right">
                  <span className="font-black text-lg" style={{ color: themeColor }}>${displayOrder.total_usd?.toFixed(2)}</span>
                  <span className="text-[10px] text-[#8f7065] ml-1">{displayOrder.total_bs?.toFixed(2)} Bs.</span>
                </div>
              </div>
            </div>

            {/* Selección de método de pago */}
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Método de Pago</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'Pago Móvil', label: 'Pago Móvil', icon: 'Bs' },
                  { key: 'Efectivo', label: 'Efectivo', icon: '$' },
                  { key: 'Punto', label: 'Punto de Venta', icon: 'Pt' },
                ].map(pm => (
                  <button key={pm.key} onClick={() => setMesaPaymentMethod(pm.key as typeof mesaPaymentMethod)} className={`p-3 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer border-2 text-xs ${
                    mesaPaymentMethod === pm.key ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                  }`} style={mesaPaymentMethod === pm.key ? { backgroundColor: orderTypeColor, borderColor: orderTypeColor } : {}}>
                    <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 shrink-0">{pm.icon}</span>
                    <span className="font-bold">{pm.label}</span>
                  </button>
                ))}
              </div>

              {/* Datos de pago según método seleccionado */}
              <div className="mt-3 p-3 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl">
                {mesaPaymentMethod === 'Pago Móvil' && (
                  <div className="flex flex-col gap-2">
                    {/* Datos hardcoded Banesco */}
                    <div className="p-2 rounded-lg border border-[#e67e22]/30 bg-[#e67e22]/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase" style={{ color: orderTypeColor }}>Banesco (0134)</span>
                        <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: orderTypeColor }}>Principal</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#8f7065]">Teléfono</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[#1a1c1d] font-bold text-[11px]">04123758879</span>
                            <CopyButton text="04123758879" fieldId="pm-phone-checkout" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[#1a1c1d] font-bold text-[11px]">V-33112679</span>
                            <CopyButton text="V-33112679" fieldId="pm-ci-checkout" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-center font-black py-1 rounded text-sm" style={{ color: themeColor }}>Monto: {displayOrder.total_bs?.toFixed(2)} Bs.</p>
                    <div className="mt-2 pt-2 border-t border-[#e4beb1]/10 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                      <p className="text-[14px] text-center font-bold" style={{ color: themeColor }}>Muestre el comprobante de pago en caja para validar su pago</p>
                    </div>
                  </div>
                )}ºº
                {mesaPaymentMethod === 'Efectivo' && (
                  <div className="text-center py-2">
                    <p className="text-[14px]  text-[#5b4137] mb-2">Paga en caja al recibir tu pedido</p>
                    <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${displayOrder.total_usd?.toFixed(2)}</p>
                  </div>
                )}
                {mesaPaymentMethod === 'Punto' && (
                  <div className="text-center py-2">
                    <p className="text- text-[#5b4137] mb-2">Paga con tu punto de venta en caja</p>
                    <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${displayOrder.total_usd?.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Número de pedido */}
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-[#8f7065] mb-1">Tu número de pedido</p>
              <p className="text-lg font-black text-[#1a1c1d] font-mono">{displayOrder.id}</p>
            </div>
          </div>

          {/* Botón fijo inferior */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4beb1]/10 p-4 z-20">
            {validationError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 text-center">
                {validationError}
              </div>
            )}
            {(mesaPaymentMethod === 'Efectivo' || mesaPaymentMethod === 'Punto') ? (
              <button onClick={handleMesaPayAtRegister} disabled={isProcessing} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
                {isProcessing ? 'Procesando...' : 'Pagar en Caja'}
              </button>
            ) : (
              <button onClick={handleSendMesaPayment} disabled={isProcessing} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
                {isProcessing ? 'Procesando...' : 'Enviar Pago'}
              </button>
            )}
          </div>
        </div>
      );
    }

    // For mesa/pickup orders, show OrderSuccessStep instead of OrderTracker
    const isMesaOrPickup = displayOrder.tipo_entrega === 'mesa' || displayOrder.tipo_entrega === 'pickup' || displayOrder.tipo_pedido === 'mesa';
    if (isMesaOrPickup) {
      return (
        <OrderSuccessStep
          order={displayOrder}
          onContinueShopping={() => {
            localStorage.removeItem('trv_active_order_id');
            localStorage.removeItem('trv_waiting_for_admin');
            localStorage.removeItem('trv_checkout_order_type');
            setProcessedOrder(null);
            setTab('catalog');
          }}
          onClose={() => {
            localStorage.removeItem('trv_active_order_id');
            localStorage.removeItem('trv_waiting_for_admin');
            localStorage.removeItem('trv_checkout_order_type');
            setProcessedOrder(null);
            if (onClose) onClose(); else setTab('home');
          }}
        />
      );
    }

    return (
      <OrderTracker
        order={displayOrder}
        onClose={() => {
          if (displayOrder.status === 'Entregado') localStorage.removeItem('trv_active_order_id');
          localStorage.removeItem('trv_waiting_for_admin');
          localStorage.removeItem('trv_checkout_order_type');
          setProcessedOrder(null);
          if (onClose) onClose(); else setTab('home');
        }}
        onContinueShopping={() => {
          if (displayOrder.status === 'Entregado') localStorage.removeItem('trv_active_order_id');
          localStorage.removeItem('trv_waiting_for_admin');
          localStorage.removeItem('trv_checkout_order_type');
          setProcessedOrder(null);
          setTab('catalog');
        }}
      />
    );
  }

  const stepCompleted = (s: number) => s < currentStep;
  const stepActive = (s: number) => s === currentStep;
  const selectedSede = activeSedes.find(s => s.id === selectedSedeId) || activeSedes[0];
  const isLocationSet = !(shippingLat === config.coordenadas_tienda.lat && shippingLng === config.coordenadas_tienda.lng);

  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: '#f9f9fb', color: '#1a1c1d' }}>
      <SEOHead title="Checkout" />

      <AnimatePresence>
        {showCelebration && (
          <div className="fixed inset-0 pointer-events-none z-[300] flex items-center justify-center">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0, y: 100 }}
                animate={{ opacity: [1, 1, 0], scale: [0, 1.5, 0.5], x: (Math.random() - 0.5) * 600, y: -(Math.random() * 500 + 200) }}
                transition={{ duration: 2.5, delay: Math.random() * 0.15 }}
                className="absolute"
              >
                <div className={`w-2 h-3 rounded-sm ${['bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][i % 4]}`} />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {isProcessing && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md">
          <div className="w-14 h-14 border-4 rounded-full" style={{ borderColor: `${themeColor}20` }} />
          <div className="absolute w-14 h-14 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${themeColor} transparent` }} />
          <p className="mt-6 text-sm font-bold uppercase tracking-wide" style={{ color: themeColor }}>Procesando pedido...</p>
        </div>
      )}

      <div className="border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20" style={{ backgroundColor: 'rgba(249,249,251,0.8)', backdropFilter: 'blur(20px)', borderColor: '#e4beb1/10' }}>
        <button onClick={() => {
          if (currentStep === 1 && orderTypeSelected) {
            setOrderTypeSelected(false);
          } else if (currentStep === 1) {
            setTab('home');
          } else {
            handlePrevStep();
          }
        }} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#eeeef0] transition-colors cursor-pointer" style={{ backgroundColor: '#eeeef0' }}>
          <ArrowLeft size={18} className="text-[#1a1c1d]" />
        </button>
        <div className="flex-1">
          <h1 className="text-[16px] font-bold text-[#1a1c1d]" style={{ fontFamily: 'var(--font-display)' }}>
            {orderTypeSelected ? 'Checkout' : 'Tu Carrito'}
          </h1>
          <p className="text-[11px] text-[#8f7065]">Paso {currentStep} de 3</p>
        </div>
      </div>

      <div className="border-b px-4 py-3" style={{ backgroundColor: '#ffffff', borderColor: '#e4beb1/10' }}>
        <div className="flex items-center justify-between max-w-sm mx-auto">
          {(!orderTypeSelected
            ? [
                { step: 1, label: 'Carrito', icon: <ListOrdered size={14} /> },
                { step: 2, label: 'Entrega', icon: <MapPin size={14} /> },
                { step: 3, label: 'Pago', icon: <CheckCircle size={14} /> },
              ]
            : orderType === 'mesa'
              ? [
                  { step: 1, label: 'Pedido', icon: <UtensilsCrossed size={14} /> },
                  { step: 2, label: 'Resumen', icon: <FileText size={14} /> },
                  { step: 3, label: 'Pago', icon: <CheckCircle size={14} /> },
                ]
              : [
                  { step: 1, label: 'Delivery', icon: <MapPin size={14} /> },
                  { step: 2, label: 'Resumen', icon: <FileText size={14} /> },
                  { step: 3, label: 'Pago', icon: <CheckCircle size={14} /> },
                ]
          ).map(({ step, label, icon }, idx, arr) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: stepCompleted(step) ? '#2e7d32' : stepActive(step) ? orderTypeColor : '#eeeef0',
                    color: stepCompleted(step) || stepActive(step) ? '#ffffff' : '#8f7065'
                  }}
                >
                  {stepCompleted(step) ? <Check size={14} /> : icon}
                </div>
                <span className="text-[11px] font-bold" style={{ color: stepActive(step) ? '#1a1c1d' : '#8f7065' }}>{label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 rounded-full mt-[-12px]" style={{ backgroundColor: stepCompleted(step + 1) ? '#2e7d32' : stepActive(step + 1) ? themeColor : '#e2e2e4' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ListOrdered size={36} className="text-[#8f7065] mb-2 mx-auto" />
                  <p className="text-sm font-bold text-[#1a1c1d]">Tu carrito está vacío</p>
                  <p className="text-xs text-[#8f7065] mt-1">Agrega productos para continuar.</p>
                  <button onClick={() => setTab('catalog')} className="mt-4 text-xs font-bold px-5 py-2.5 rounded-xl" style={{ backgroundColor: themeColor, color: '#fff' }}>
                    Explorar Menú
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tipo de Pedido Seleccionado */}
                  {orderTypeSelected && (
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: orderTypeColor }}>
                        {orderType === 'mesa' ? <UtensilsCrossed size={18} /> : orderType === 'pickup' ? <Store size={18} /> : <Truck size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1a1c1d]">
                          {orderType === 'mesa' ? 'En Mesa' : orderType === 'pickup' ? 'Recoger en Tienda' : 'Delivery'}
                        </p>
                        <p className="text-[11px] text-[#8f7065]">
                          {orderType === 'mesa' ? 'Disfruta aquí en el local' : orderType === 'pickup' ? 'Pasa a buscar tu pedido' : 'Te lo llevamos a tu ubicación'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowTypeModal(true)} className="text-[11px] font-bold underline cursor-pointer" style={{ color: orderTypeColor }}>Cambiar</button>
                  </div>
                  )}

                  {/* Selector de Mesa (solo si orderType === 'mesa' y ya seleccionado) */}
                  {orderTypeSelected && orderType === 'mesa' && (
                    <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Datos en Mesa</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-1 block">Tu Nombre *</label>
                          <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="Nombre para el pedido"
                            className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-1 block">Número de Mesa *</label>
                          <select
                            value={mesaNumber}
                            onChange={(e) => setMesaNumber(parseInt(e.target.value))}
                            className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors appearance-none cursor-pointer"
                          >
                            {mesas.length > 0
                              ? mesas
                                  .filter(m => m.estado !== 'Inactiva')
                                  .sort((a, b) => a.numero_mesa - b.numero_mesa)
                                  .map(m => (
                                    <option key={m.id} value={m.numero_mesa}>
                                      Mesa {m.numero_mesa}{m.nombre_personalizado ? ` — ${m.nombre_personalizado}` : ''}{m.estado === 'Ocupada' ? ' (Ocupada)' : ''}
                                    </option>
                                  ))
                              : Array.from({ length: config.total_mesas || 10 }, (_, i) => i + 1).map(n => (
                                  <option key={n} value={n}>Mesa {n}</option>
                                ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d]">Tu Carrito ({cart.reduce((s, ci) => s + ci.quantity, 0)} items)</h3>
                      <button onClick={() => setTab('catalog')} className="text-[11px] font-bold underline" style={{ color: themeColor }}>Editar</button>
                    </div>
                    <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
                      {cart.map(item => {
                        return (
                          <div key={item.item.id} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#eeeef0] border border-[#e4beb1]/10 shrink-0">
                              <img src={item.item.imagen_urls[0]} alt={item.item.nombre} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-[#1a1c1d] truncate">{item.item.nombre}</h4>
                              {item.selected_options && item.selected_options.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {item.selected_options.map((opt, idx) => (
                                    <span key={idx} className="text-[9px] px-1 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold border border-violet-100">
                                      {opt.option_name}{opt.precio_usd > 0 ? ` +$${opt.precio_usd.toFixed(2)}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-[#e4beb1]/10 rounded-lg bg-white h-8">
                                <button onClick={() => updateCartQuantity(item.item.id, item.quantity - 1)} className="w-7 h-full flex items-center justify-center text-[#8f7065] hover:text-[#1a1c1d] text-xs transition-all cursor-pointer">-</button>
                                <span className="text-xs px-1.5 text-[#1a1c1d] font-bold">{item.quantity}</span>
                                <button onClick={() => updateCartQuantity(item.item.id, item.quantity + 1)} className="w-7 h-full flex items-center justify-center text-[#8f7065] hover:text-[#1a1c1d] text-xs transition-all cursor-pointer">+</button>
                              </div>
                              <button onClick={() => removeFromCart(item.item.id)} className="text-[#8f7065] hover:text-red-500 p-1 rounded transition-all cursor-pointer">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {orderTypeSelected && orderType !== 'mesa' && (
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Método de Entrega</h3>
                    <div className="flex gap-2 mb-4">
                      {(() => {
                        const sede = activeSedes.find(s => s.id === selectedSedeId) || activeSedes[0];
                        const allowsPickup = sede?.permite_pickup ?? config.recogida_en_local;
                        const deliveryMode = sede?.delivery_mode || (config.entrega_por_zonas ? 'zonas' : 'km');
                        const showZonas = deliveryMode === 'zonas' || deliveryMode === 'both';
                        const showMapa = deliveryMode === 'km' || deliveryMode === 'both';
                        return (
                          <>
                            {allowsPickup && (
                              <button onClick={() => handleShippingMethodChange('recogida')} className={`flex-1 p-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer border-2 ${
                                shippingMethod === 'recogida' ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                              }`} style={shippingMethod === 'recogida' ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                                <Store size={16} className="mx-auto mb-1" />
                                Recoger en Tienda
                              </button>
                            )}
                            {showZonas && (
                              <button onClick={() => handleShippingMethodChange('zonas')} className={`flex-1 p-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer border-2 ${
                                shippingMethod === 'zonas' ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                              }`} style={shippingMethod === 'zonas' ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                                <Truck size={16} className="mx-auto mb-1" />
                                Delivery por Zonas
                              </button>
                            )}
                            {showMapa && (
                              <button onClick={() => handleShippingMethodChange('mapa')} className={`flex-1 p-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer border-2 ${
                                shippingMethod === 'mapa' ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                              }`} style={shippingMethod === 'mapa' ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                                <MapPin size={16} className="mx-auto mb-1" />
                                Delivery por Mapa
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {shippingMethod === 'recogida' && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Store size={16} className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-800">Retiro en Tienda</span>
                        </div>
                        {selectedSede ? (
                          <>
                            <p className="text-xs font-bold text-emerald-800">{selectedSede.nombre}</p>
                            <p className="text-xs text-emerald-700 font-medium">{selectedSede.direccion || config.direccion_fisica}</p>
                            <p className="text-[10px] text-emerald-600 mt-1">{selectedSede.horario || '10:00 AM - 10:00 PM'}</p>
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-700 font-mono bg-emerald-100 rounded-lg px-2 py-1.5">
                              <MapPin size={10} />
                              <span>Lat: {selectedSede.coordenadas.lat}, Lng: {selectedSede.coordenadas.lng}</span>
                              <CopyButton text={`${selectedSede.coordenadas.lat}, ${selectedSede.coordenadas.lng}`} fieldId="sede-coords" />
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${selectedSede.coordenadas.lat},${selectedSede.coordenadas.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 w-full flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                            >
                              <Navigation size={12} /> Cómo llegar en Google Maps
                            </a>
                            <div className="mt-3 rounded-xl overflow-hidden border border-emerald-200 h-40">
                              <LeafletMap shopCoords={selectedSede.coordenadas} onLocationSelected={() => {}} config={config} />
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}

                    {shippingMethod === 'mapa' && (
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowLocationModal(true)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed text-left transition-all cursor-pointer hover:shadow-md"
                          style={{ borderColor: isLocationSet ? themeColor : '#d4d4d8', backgroundColor: isLocationSet ? `${themeColor}08` : 'white' }}
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: isLocationSet ? themeColor : '#f4f4f5' }}>
                            <LocateFixed size={18} className={isLocationSet ? 'text-white' : 'text-[#8f7065]'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold" style={{ color: isLocationSet ? themeColor : '#52525b' }}>
                              {isLocationSet ? 'Ubicación seleccionada' : 'Seleccionar dirección de entrega'}
                            </p>
                            {isLocationSet ? (
                              <p className="text-[10px] text-[#8f7065] truncate mt-0.5">
                                {shippingZone} · {shippingDistance.toFixed(1)} km · ${effectiveShippingAfterCoupon.toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-[10px] text-[#8f7065] mt-0.5">Toca para abrir el mapa y elegir tu dirección</p>
                            )}
                          </div>
                          <ChevronDown size={16} className="text-[#8f7065] shrink-0" />
                        </button>
                        {isLocationSet && (
                          <button
                            onClick={() => setShowLocationModal(true)}
                            className="w-full text-[11px] font-bold underline text-center py-1"
                            style={{ color: themeColor }}
                          >
                            Cambiar dirección
                          </button>
                        )}
                      </div>
                    )}

                    {shippingMethod === 'zonas' && (
                      <div className="space-y-2">
                        {(selectedSede?.delivery_zonas || config.delivery_zonas || []).map((z, i) => (
                          <button key={z.id} onClick={() => handleZoneSelect(i)} className={`w-full p-3 rounded-xl text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer border-2 ${
                            selectedZoneIndex === i ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                          }`} style={selectedZoneIndex === i ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                            <span>{z.name}</span>
                            <span className="font-mono">{(selectedSede?.delivery_gratis ?? config.delivery_gratis) ? 'Gratis' : `$${z.cost.toFixed(2)}`}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {hasMultipleSedes && (
                      <div className="mt-4">
                        <span className="text-[11px] font-bold text-[#8f7065] uppercase tracking-wider mb-2 block">Enviar pedido a:</span>
                        <div className="flex flex-wrap gap-2">
                          {activeSedes.map(sede => (
                            <button key={sede.id} onClick={() => { setSelectedSedeId(sede.id); localStorage.setItem('trv_selected_sede', JSON.stringify({ id: sede.id })); }} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                              selectedSedeId === sede.id ? 'text-white shadow-md' : 'bg-white border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#f9f9fb]'
                            }`} style={selectedSedeId === sede.id ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                              {sede.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSede && (
                      <div className="mt-3 rounded-xl border border-[#e4beb1]/20 bg-[#fff9f7] p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Store size={15} style={{ color: themeColor }} />
                          <span className="font-bold text-sm text-[#5b4137]">{selectedSede.nombre}</span>
                          {selectedSede.es_principal && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Principal</span>
                          )}
                        </div>
                        {selectedSede.direccion && (
                          <p className="flex items-start gap-1.5 text-xs text-[#8f7065] mb-1">
                            <MapPin size={13} className="mt-0.5 shrink-0" /> {selectedSede.direccion}
                          </p>
                        )}
                        {selectedSede.horario && (
                          <p className="flex items-center gap-1.5 text-xs text-[#8f7065] mb-1">
                            <Clock size={13} className="shrink-0" /> {selectedSede.horario}
                          </p>
                        )}
                        {(selectedSede.whatsapp_numero || selectedSede.telefono) && (
                          <p className="flex items-center gap-1.5 text-xs text-[#8f7065]">
                            <Phone size={13} className="shrink-0" /> {selectedSede.whatsapp_numero || selectedSede.telefono}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex justify-between items-center pt-3 border-t border-[#e4beb1]/10">
                      <span className="text-xs text-[#8f7065]">Envío:</span>
                      <span className="text-xs font-bold" style={{ color: themeColor }}>
                        {hasFreeDeliveryItem ? 'GRATIS' : appliedCoupon?.coupon_type === 'free_shipping' ? 'GRATIS (Cupon)' : effectiveShippingAfterCoupon === 0 ? 'Retiro / Gratis' : `$${effectiveShippingAfterCoupon.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  )}

                  {orderTypeSelected && orderType !== 'mesa' && currentUser && shippingMethod !== 'recogida' && !isLocationSet && (() => {
                    const lastDelivery = orders.find(o =>
                      (o.usuario_id === currentUser.id || o.cliente_telefono === currentUser.telefono) &&
                      o.tipo_entrega === 'delivery' && o.lat && o.lng
                    );
                    if (!lastDelivery) return null;
                    return (
                      <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                        <button
                          onClick={() => {
                            setShippingLat(lastDelivery.lat);
                            setShippingLng(lastDelivery.lng);
                            if (lastDelivery.sede_id) setSelectedSedeId(lastDelivery.sede_id);
                            if (lastDelivery.distancia_km) setShippingDistance(lastDelivery.distancia_km);
                            if (lastDelivery.costo_envio_usd) setShippingCost(lastDelivery.costo_envio_usd);
                            if (lastDelivery.direccion_envio) {
                              const zoneMatch = lastDelivery.direccion_envio.match(/^(.+?)\s*\(Distancia:/);
                              if (zoneMatch) setShippingZone(zoneMatch[1]);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-xs font-bold transition-all cursor-pointer"
                          style={{ borderColor: `${themeColor}40`, color: themeColor }}
                        >
                          <MapPin size={14} />
                          Usar mi última dirección
                        </button>
                        <p className="text-[10px] text-[#8f7065] mt-1.5 text-center">
                          {lastDelivery.direccion_envio?.split(' (Distancia:')[0] || 'Última dirección guardada'}
                        </p>
                      </div>
                    );
                  })()}

                  <CartUpsell onAddToCart={(item: FoodItem) => addToCart(item)} />

                  {/* Canje de Puntos — Catálogo de Recompensas */}
                  {loyaltyConfig?.enabled && currentUser && userPoints > 0 && availableRewards.length > 0 && (
                    <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-bold uppercase text-[#8f7065] flex items-center gap-1.5">
                          ⭐ Canjear Puntos
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Tienes {userPoints} pts
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8f7065] mb-3">
                        Selecciona una recompensa para canjear con tus puntos:
                      </p>
                      <div className="flex flex-col gap-2">
                        {availableRewards.map((reward) => {
                          const canAfford = userPoints >= reward.points_cost;
                          const isSelected = selectedReward?.id === reward.id;
                          const isFreeProduct = reward.reward_type === 'free_product' && reward.product_id && !cart.some(ci => ci.item.id === reward.product_id);
                          const disabled = !canAfford || isFreeProduct;
                          return (
                            <button
                              key={reward.id}
                              onClick={() => !disabled && handleSelectReward(reward)}
                              disabled={disabled}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                disabled
                                  ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
                                    : 'bg-white border-[#e4beb1]/10 hover:border-amber-200 cursor-pointer'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? '#FEF3C7' : '#f9f9fb' }}>
                                {reward.reward_type === 'free_shipping' && <TruckIcon size={18} className={isSelected ? 'text-amber-600' : 'text-[#8f7065]'} />}
                                {reward.reward_type === 'discount_percent' && <Percent size={18} className={isSelected ? 'text-amber-600' : 'text-[#8f7065]'} />}
                                {reward.reward_type === 'discount_fixed' && <DollarSign size={18} className={isSelected ? 'text-amber-600' : 'text-[#8f7065]'} />}
                                {reward.reward_type === 'free_product' && <Gift size={18} className={isSelected ? 'text-amber-600' : 'text-[#8f7065]'} />}
                                {!['free_shipping', 'discount_percent', 'discount_fixed', 'free_product'].includes(reward.reward_type) && <Star size={18} className={isSelected ? 'text-amber-600' : 'text-[#8f7065]'} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#1a1c1d] truncate">{reward.name}</p>
                                <p className="text-[10px] text-[#8f7065]">
                                  {reward.reward_type === 'free_shipping' && 'Envio gratis'}
                                  {reward.reward_type === 'discount_percent' && `${reward.reward_value}% de descuento`}
                                  {reward.reward_type === 'discount_fixed' && `$${reward.reward_value} de descuento`}
                                  {reward.reward_type === 'free_product' && 'Producto gratis'}
                                  {!['free_shipping', 'discount_percent', 'discount_fixed', 'free_product'].includes(reward.reward_type) && reward.description}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-bold text-amber-600">{reward.points_cost} pts</p>
                                {!canAfford && (
                                  <p className="text-[9px] text-red-400">Faltan {reward.points_cost - userPoints}</p>
                                )}
                                {isFreeProduct && (
                                  <p className="text-[9px] text-red-400">No en carrito</p>
                                )}
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                                  <Check size={12} className="text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedReward && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                          <p className="text-[10px] text-amber-700 text-center font-bold">
                            ✓ {selectedReward.name} — -${rewardDiscount.toFixed(2)} ({selectedReward.points_cost} pts)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                    <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-2 block">Cupón</label>
                    <div className="flex gap-2">
                      <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="CÓDIGO" className="flex-1 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] font-bold uppercase" />
                      <button onClick={handleApplyCoupon} className="px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-colors" style={{ backgroundColor: themeColor, color: '#fff' }}>Aplicar</button>
                    </div>
                    {couponError && <span className="text-[11px] text-red-500 mt-1 block">{couponError}</span>}
                    {appliedCoupon && (
                      <p className="text-xs font-bold mt-2" style={{ color: themeColor }}>
                        ✓ "{appliedCoupon.code}" aplicado: {appliedCoupon.coupon_type === 'fixed' ? `-$${appliedCoupon.discount_amount}` : appliedCoupon.coupon_type === 'free_shipping' ? 'Envio Gratis' : `-${appliedCoupon.discount_percent}%`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4">
              {orderType === 'mesa' ? (
                <>
                  {/* Resumen del pedido en mesa */}
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed size={14} style={{ color: orderTypeColor }} />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d]">Mesa #{mesaNumber} — {clientName}</h3>
                      </div>
                      <button onClick={() => setTab('catalog')} className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ backgroundColor: `${orderTypeColor}15`, color: orderTypeColor }}>
                        <Plus size={12} /> Agregar más
                      </button>
                    </div>
                    <div className="space-y-3 mb-3">
                      {cart.map(item => {
                        const extrasTotal = item.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
                        const subTotalItem = (item.item.precio_usd + extrasTotal) * item.quantity;
                        return (
                          <div key={item.item.id} className="flex items-center gap-3 py-2 border-b border-[#e4beb1]/10 last:border-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#eeeef0] border border-[#e4beb1]/10 shrink-0">
                              <img src={item.item.imagen_urls[0]} alt={item.item.nombre} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-[#1a1c1d] truncate">{item.item.nombre}</h4>
                              {item.selected_options && item.selected_options.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {item.selected_options.map((opt, idx) => (
                                    <span key={idx} className="text-[9px] px-1 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold border border-violet-100">
                                      {opt.option_name}{opt.precio_usd > 0 ? ` +$${opt.precio_usd.toFixed(2)}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-[#e4beb1]/10 rounded-lg bg-white h-8">
                                <button onClick={() => updateCartQuantity(item.item.id, item.quantity - 1)} className="w-7 h-full flex items-center justify-center text-[#8f7065] hover:text-[#1a1c1d] text-xs transition-all cursor-pointer">-</button>
                                <span className="text-xs px-1.5 text-[#1a1c1d] font-bold">{item.quantity}</span>
                                <button onClick={() => updateCartQuantity(item.item.id, item.quantity + 1)} className="w-7 h-full flex items-center justify-center text-[#8f7065] hover:text-[#1a1c1d] text-xs transition-all cursor-pointer">+</button>
                              </div>
                              <span className="text-xs font-bold text-[#1a1c1d] w-14 text-right">${subTotalItem.toFixed(2)}</span>
                              <button onClick={() => removeFromCart(item.item.id)} className="text-[#8f7065] hover:text-red-500 p-1 rounded transition-all cursor-pointer">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                      <div className="text-right">
                        <span className="font-black text-lg" style={{ color: orderTypeColor }}>${totalUsd.toFixed(2)}</span>
                        <span className="text-[10px] text-[#8f7065] ml-2">{totalBs.toFixed(2)} Bs.</span>
                      </div>
                    </div>
                  </div>

                  <CartUpsell onAddToCart={(item: FoodItem) => addToCart(item)} />

                  {/* Notas del pedido */}
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                    <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-2 flex items-center gap-1.5 block">
                      <MessageSquare size={12} /> Notas del pedido (opcional)
                    </label>
                    <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Ej: Sin cebolla, extra salsa, bien cocido..." className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] resize-none" rows={2} />
                  </div>

                  {/* Cupón */}
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                    <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-2 block">Cupón</label>
                    <div className="flex gap-2">
                      <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="CÓDIGO" className="flex-1 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] font-bold uppercase" />
                      <button onClick={handleApplyCoupon} className="px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-colors" style={{ backgroundColor: orderTypeColor, color: '#fff' }}>Aplicar</button>
                    </div>
                    {couponError && <span className="text-[11px] text-red-500 mt-1 block">{couponError}</span>}
                    {appliedCoupon && (
                      <p className="text-xs font-bold mt-2" style={{ color: orderTypeColor }}>
                        ✓ "{appliedCoupon.code}" aplicado: {appliedCoupon.coupon_type === 'fixed' ? `-$${appliedCoupon.discount_amount}` : appliedCoupon.coupon_type === 'free_shipping' ? 'Envio Gratis' : `-${appliedCoupon.discount_percent}%`}
                      </p>
                    )}
                  </div> 

                </>
              ) : (
                <>
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Tu Pedido</h3>
                    <div className="space-y-2">
                      {cart.map(item => {
                        const extrasTotal = item.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
                        const subTotalItem = (item.item.precio_usd + extrasTotal) * item.quantity;
                        return (
                          <div key={item.item.id} className="flex justify-between items-center text-xs">
                            <span className="text-[#5b4137]">{item.quantity}x {item.item.nombre}</span>
                            <span className="font-bold text-[#1a1c1d]">${subTotalItem.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Detalle de Costos</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8f7065]">Subtotal:</span>
                        <span className="font-bold">${subtotalUsd.toFixed(2)}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex justify-between text-xs" style={{ color: themeColor }}>
                          <span>Descuento ({appliedCoupon.coupon_type === 'fixed' ? `-$${appliedCoupon.discount_amount}` : appliedCoupon.coupon_type === 'free_shipping' ? 'Envio Gratis' : `-${appliedCoupon.discount_percent}%`}):</span>
                          <span className="font-bold">{appliedCoupon.coupon_type === 'free_shipping' ? 'Envio Gratis' : `-$${discountFromCoupon.toFixed(2)}`}</span>
                        </div>
                      )}
                      {effectiveRewardDiscount > 0 && selectedReward && (
                        <div className="flex justify-between text-xs text-amber-700">
                          <span>⭐ {selectedReward.name} ({selectedReward.points_cost} pts):</span>
                          <span className="font-bold">-${effectiveRewardDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8f7065]">Envío ({shippingMethod === 'recogida' ? 'Recogida' : shippingZone}):</span>
                        <span className="font-bold">{appliedCoupon?.coupon_type === 'free_shipping' ? 'Gratis (Cupon)' : selectedReward?.reward_type === 'free_shipping' ? 'Gratis (Recompensa)' : effectiveShippingAfterCoupon === 0 ? 'Gratis' : `$${effectiveShippingAfterCoupon.toFixed(2)}`}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-[#e4beb1]/10">
                        <span className="font-bold text-[#1a1c1d]">Total:</span>
                        <div className="text-right">
                          <span className="font-black text-lg" style={{ color: themeColor }}>${totalUsd.toFixed(2)}</span>
                          <span className="text-[10px] text-[#8f7065] ml-2">{totalBs.toFixed(2)} Bs.</span>
                        </div>
                      </div>
                      {estimatedPointsToEarn > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#e4beb1]/10">
                          <span className="text-amber-500 text-xs">⭐</span>
                          <span className="text-[11px] text-amber-700 font-semibold">
                            Ganarás <span className="font-black">{estimatedPointsToEarn}</span> puntos con este pedido
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {shippingMethod !== 'recogida' && (
                    <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-2">Dirección de Entrega</h3>
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-[#8f7065] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-[#1a1c1d]">{shippingZone}</p>
                          <p className="text-[11px] text-[#8f7065]">{shippingDistance > 0 ? `${shippingDistance.toFixed(1)} km de distancia` : ''}</p>
                          <a
                            href={`https://www.google.com/maps?q=${shippingLat},${shippingLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold underline mt-1 inline-block"
                            style={{ color: themeColor }}
                          >Ver en mapa</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {shippingMethod === 'recogida' && selectedSede && (
                    <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-2">Retiro en Tienda</h3>
                      <div className="flex items-start gap-2">
                        <Store size={14} className="text-[#8f7065] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-[#1a1c1d]">{selectedSede.nombre}</p>
                          <p className="text-[11px] text-[#8f7065]">{selectedSede.direccion || config.direccion_fisica}</p>
                          <p className="text-[10px] text-[#8f7065] font-mono mt-1">
                            Coordenadas: {selectedSede.coordenadas.lat}, {selectedSede.coordenadas.lng}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${selectedSede.coordenadas.lat},${selectedSede.coordenadas.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold underline mt-1 inline-block"
                            style={{ color: themeColor }}
                          >Cómo llegar</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notas del pedido */}
                  <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                    <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-2 flex items-center gap-1.5 block">
                      <MessageSquare size={12} /> Notas del pedido (opcional)
                    </label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ej: Sin cebolla, extra salsa, bien cocido..."
                      className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4">
              {orderType !== 'mesa' && (!currentUser || currentUser.email?.includes('@guest.foodapp.local')) && (
                <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Tus Datos</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-1 block">Correo *</label>
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="tu@email.com" className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors" required />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-1 block">Nombre *</label>
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Tu nombre" className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors" required />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-1 block">Teléfono *</label>
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+58412..." className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors" required />
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: `${themeColor}08`, borderColor: `${themeColor}20` }}>
                    <p className="text-[11px] text-[#5b4137] leading-relaxed">
                      <span className="font-bold" style={{ color: themeColor }}>Se crea tu cuenta automáticamente.</span>{' '}
                      Tu contraseña es tu número de teléfono. Podrás cambiarla desde tu panel de cliente.
                    </p>
                  </div>
                </div>
              )}

              {orderType !== 'mesa' && currentUser && !currentUser.email?.includes('@guest.foodapp.local') && (
                <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 text-white rounded-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: themeColor }}>{currentUser.nombre[0]}</div>
                    <div>
                      <p className="text-xs font-bold text-[#1a1c1d]">{currentUser.nombre}</p>
                      <p className="text-[11px] text-[#8f7065]">{currentUser.email || currentUser.telefono}</p>
                    </div>
                  </div>
                </div>
              )}

              {orderType === 'mesa' && (
                <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: orderTypeColor }}>
                      <UtensilsCrossed size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1a1c1d]">Mesa #{mesaNumber} — {clientName}</p>
                      <p className="text-[11px] text-[#8f7065]">{cart.reduce((s, ci) => s + ci.quantity, 0)} producto{cart.reduce((s, ci) => s + ci.quantity, 0) !== 1 ? 's' : ''} · ${totalUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {orderType !== 'mesa' && (
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Método de Pago</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'Pago Móvil', label: 'Pago Móvil', icon: 'Bs' },
                    { key: 'Efectivo', label: 'Efectivo', icon: '$' },
                    { key: 'Punto', label: 'Punto de Venta', icon: 'Pt' },
                  ].map(pm => (
                    <button key={pm.key} onClick={() => setSelectedPayment(pm.key as typeof selectedPayment)} className={`p-3 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer border-2 text-xs ${
                      selectedPayment === pm.key ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                    }`} style={selectedPayment === pm.key ? { backgroundColor: orderTypeColor, borderColor: orderTypeColor } : {}}>
                      <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 shrink-0">{pm.icon}</span>
                      <span className="font-bold">{pm.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-3 p-3 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl text-[11px] text-[#5b4137] leading-relaxed font-mono">
                  {selectedPayment === 'Pago Móvil' && (
                    <div className="flex flex-col gap-2">
                      {/* Datos hardcoded Banesco */}
                      <div className="p-2 rounded-lg border border-[#e67e22]/30 bg-[#e67e22]/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase" style={{ color: orderTypeColor }}>Banesco (0134)</span>
                          <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: orderTypeColor }}>Principal</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#8f7065]">Teléfono</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#1a1c1d] font-bold text-[11px]">04123758879</span>
                              <CopyButton text="04123758879" fieldId="pm-phone-delivery" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#1a1c1d] font-bold text-[11px]">V-33112679</span>
                              <CopyButton text="V-33112679" fieldId="pm-ci-delivery" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-center font-black py-1 rounded" style={{ color: themeColor }}>Calcular: {totalBs.toFixed(2)} Bs.</p>
                      <div className="mt-2 pt-2 border-t border-[#e4beb1]/10 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                        <p className="text-[10px] text-center font-bold" style={{ color: themeColor }}>Por favor adjuntar el capture del pago al WhatsApp</p>
                      </div>
                    </div>
                  )}
                  {selectedPayment === 'Efectivo' && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[#1a1c1d] font-bold text-center">{config.efectivo_data || 'Paga al motorizado en efectivo (USD/Bs) al recibir tu delivery'}</p>
                      <p className="text-center font-black py-1 rounded" style={{ color: themeColor }}>Total: ${totalUsd.toFixed(2)} / {totalBs.toFixed(2)} Bs.</p>
                    </div>
                  )}
                  {selectedPayment === 'Punto' && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[#1a1c1d] font-bold text-center">Paga con tu punto de venta en tienda al recoger</p>
                      <p className="text-center font-black py-1 rounded" style={{ color: themeColor }}>Total: ${totalUsd.toFixed(2)} / {totalBs.toFixed(2)} Bs.</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {orderType !== 'mesa' && (
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4">
                {selectedPayment === 'Pago Móvil' && (
                  <div className="mb-3 p-3 rounded-xl border" style={{ backgroundColor: `${themeColor}08`, borderColor: `${themeColor}20` }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: themeColor }}>Importante</p>
                    <p className="text-xs text-[#5b4137] leading-relaxed">
                      Adjunta el capture del pago en el chat de WhatsApp al enviar el pedido para que podamos procesarlo más rápido.
                    </p>
                  </div>
                )}
                {selectedPayment === 'Efectivo' && (
                  <div className="mb-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-1.5 block">
                      Con qué billetes vas a cancelar ${totalUsd.toFixed(2)} USD
                    </label>
                    <textarea
                      value={cashBills}
                      onChange={(e) => setCashBills(e.target.value)}
                      placeholder="Ej: 1 billete de $20, 2 billetes de $10..."
                      className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] resize-none"
                      rows={2}
                    />
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentConfirmed}
                    onChange={(e) => setPaymentConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-current cursor-pointer"
                    style={{ color: themeColor }}
                  />
                  <span className="text-xs text-[#5b4137] leading-relaxed">
                    {selectedPayment === 'Efectivo'
                      ? 'Confirmo los billetes indicados para gestionar el cambio.'
                      : 'Confirmo que enviaré el capture del pago por WhatsApp.'}
                  </span>
                </label>
              </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4beb1]/10 p-4 z-20">
          {validationError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 text-center">
              {validationError}
            </div>
          )}

          {currentStep === 3 ? (
            <button onClick={handleFormSubmit} disabled={isProcessing || (orderType === 'mesa' && mesaOrderConfirmed)} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981', color: '#fff' }}>
              {isProcessing ? 'Procesando...' : orderType === 'mesa' ? 'Confirmar Pedido en Mesa' : 'Confirmar Pedido'}
            </button>
          ) : (
            <button onClick={handleNextStep} className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer" style={{ backgroundColor: orderTypeColor, color: '#fff' }}>
              Continuar <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showLocationModal && (
          <LocationModal
            themeColor={themeColor}
            shopCoords={selectedSede?.coordenadas || config.coordenadas_tienda}
            initialLat={isLocationSet ? shippingLat : null}
            initialLng={isLocationSet ? shippingLng : null}
            config={config}
            onDetectLocation={requestLocation}
            isDetecting={isDetectingLocation}
            locationError={locationError}
            onConfirm={(lat, lng, distance, cost, zone) => {
              setShippingLat(lat);
              setShippingLng(lng);
              setShippingDistance(distance);
              setShippingCost(cost);
              setShippingZone(zone);
              setShowLocationModal(false);
            }}
            onClose={() => setShowLocationModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de selección de tipo de pedido */}
      <OrderTypeModal
        isOpen={showTypeModal && !orderTypeSelected}
        onClose={() => { if (orderTypeSelected) setShowTypeModal(false); else setTab('cart'); }}
        onSelect={(type) => {
          if (type === 'mesa') {
            setTab('mesa_checkout');
            return;
          }
          setOrderType(type);
          setOrderTypeSelected(true);
          setShowTypeModal(false);
        }}
        themeColor={themeColor}
        cartTotal={totalUsd}
        cartItems={cart.reduce((s, ci) => s + ci.quantity, 0)}
      />

      {/* Pantalla de espera - Pago enviado, esperando confirmación del admin */}
      <AnimatePresence>
        {mesaPaymentSent && processedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: '#f9f9fb' }}
          >
            <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10b98115' }}>
              <div className="absolute w-20 h-20 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#10b981 transparent' }} />
              <Clock size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-[#1a1c1d] mb-2 text-center">Esperando Confirmación de Pago</h2>
            <p className="text-sm text-[#8f7065] text-center mb-4">El personal está verificando tu pago</p>
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: orderTypeColor }}>
                  <UtensilsCrossed size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1a1c1d]">Mesa #{(processedOrder as any)?.numero_mesa}</p>
                  <p className="text-[11px] text-[#8f7065]">{(processedOrder as any)?.id}</p>
                </div>
              </div>
              <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                <span className="font-black" style={{ color: orderTypeColor }}>${(processedOrder as any)?.total_usd?.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#e4beb1]/10 pt-2 mt-2">
                <span className="text-[10px] text-[#8f7065]">Método: {(processedOrder as any)?.metodo_pago}</span>
              </div>
            </div>
            <p className="text-[10px] text-[#8f7065] mt-4 text-center">No cierres esta página hasta que tu pago sea confirmado</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pantalla de espera - Procesando pedido */}
      <AnimatePresence>
        {waitingForAdmin && !adminAccepted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: '#f9f9fb' }}
          >
            <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${orderTypeColor}15` }}>
              <div className="absolute w-20 h-20 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${orderTypeColor} transparent` }} />
              <Clock size={28} style={{ color: orderTypeColor }} />
            </div>
            <h2 className="text-lg font-bold text-[#1a1c1d] mb-2 text-center">Procesando tu pedido...</h2>
            <p className="text-sm text-[#8f7065] text-center mb-4">Tu pedido está siendo revisado por el equipo</p>
            <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: orderTypeColor }}>
                  {orderType === 'mesa' ? <UtensilsCrossed size={18} /> : orderType === 'pickup' ? <Store size={18} /> : <Truck size={18} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1a1c1d]">
                    {orderType === 'mesa' ? `Mesa #${mesaNumber}` : orderType === 'pickup' ? 'Recoger en Tienda' : 'Delivery'}
                  </p>
                  <p className="text-[11px] text-[#8f7065]">{(processedOrder as any)?.id}</p>
                </div>
              </div>
              <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                <span className="font-black" style={{ color: orderTypeColor }}>${(processedOrder as any)?.total_usd?.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[10px] text-[#8f7065] mt-4 text-center">No cierres esta página hasta que tu pedido sea confirmado</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pantalla de confirmación de pago post-admin */}
      <AnimatePresence>
        {adminAccepted && !paymentConfirmedByAdmin && processedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ backgroundColor: '#f9f9fb' }}
          >
            <div className="border-b px-4 py-3 sticky top-0 z-20 bg-white" style={{ borderColor: '#e4beb1/10' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-[16px] font-bold text-[#1a1c1d]">Pedido Aceptado</h1>
                  <p className="text-[11px] text-[#8f7065]">Proceda con el pago</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-28">
              {/* Resumen del pedido */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-3">Tu Pedido</h3>
                <div className="space-y-2 mb-3">
                   {(processedOrder as Order).items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-[#5b4137]">
                        <span className="font-bold">{item.cantidad}x</span> {item.nombre}
                      </span>
                      <span className="font-bold text-[#1a1c1d]">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                  <div className="text-right">
                    <span className="font-black text-lg" style={{ color: themeColor }}>${(processedOrder as Order).total_usd?.toFixed(2)}</span>
                    <span className="text-[10px] text-[#8f7065] ml-1">{(processedOrder as Order).total_bs?.toFixed(2)} Bs.</span>
                  </div>
                </div>
              </div>

              {/* Método de pago y datos */}
              {(processedOrder as Order).metodo_pago === 'Efectivo' ? (
                <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-5 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center bg-emerald-100">
                    <CheckCircle size={28} className="text-emerald-600" />
                  </div>
                  <h3 className="text-base font-bold text-[#1a1c1d] mb-1">Pago en Efectivo</h3>
                  <p className="text-xs text-[#8f7065] mb-3">Dirígete a caja para cancelar tu pedido</p>
                  <p className="font-black text-xl" style={{ color: themeColor }}>${(processedOrder as Order).total_usd?.toFixed(2)}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-3">Realiza tu pago</h3>
                  <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: `${themeColor}10` }}>
                    <p className="text-sm font-bold text-[#1a1c1d]">{(processedOrder as Order).metodo_pago}</p>
                  </div>
               {(processedOrder as Order).metodo_pago === 'Pago Móvil' && (
                    <div className="space-y-2">
                      {/* Datos hardcoded Banesco */}
                      <div className="p-2 rounded-lg border border-[#e67e22]/30 bg-[#e67e22]/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase" style={{ color: themeColor }}>Banesco (0134)</span>
                          <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: themeColor }}>Principal</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#8f7065]">Teléfono</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#1a1c1d] font-bold text-[11px]">04123758879</span>
                              <CopyButton text="04123758879" fieldId="pm-phone-final" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#1a1c1d] font-bold text-[11px]">V-33112679</span>
                              <CopyButton text="V-33112679" fieldId="pm-ci-final" />
                            </div>
                          </div>
                        </div>
                      </div>
                       <p className="text-center font-black py-1 rounded text-sm" style={{ color: themeColor }}>Monto: {(processedOrder as Order).total_bs?.toFixed(2)} Bs.</p>
                      <div className="mt-2 pt-2 border-t border-[#e4beb1]/10 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                        <p className="text-[10px] text-center font-bold" style={{ color: themeColor }}>Por favor adjuntar el capture del pago al WhatsApp</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botón fijo - Confirmar pago */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4beb1]/10 p-4 z-20">
              <button
                onClick={async () => {
                  setPaymentConfirmedByAdmin(true);
                }}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer`}
                style={{ backgroundColor: '#10b981' }}
              >
                <CheckCircle size={16} />
                {(processedOrder as Order).metodo_pago === 'Efectivo' ? 'Confirmo que pagué en caja' : 'Confirmar Pago'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pantalla de pago confirmado */}
      <AnimatePresence>
        {paymentConfirmedByAdmin && processedOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[250] flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: '#f9f9fb' }}
          >
            <div className="w-20 h-20 mb-4 rounded-full flex items-center justify-center bg-emerald-100">
              <CheckCircle size={40} className="text-emerald-600" />
            </div>
             <h2 className="text-lg font-bold text-[#1a1c1d] mb-1 text-center">
              {(processedOrder as Order).tipo_pedido === 'mesa' ? '¡Pago Exitoso!' : '¡Pago Confirmado!'}
            </h2>
            <p className="text-sm text-[#8f7065] text-center mb-2">
              {(processedOrder as Order).tipo_pedido === 'mesa' ? 'Buen provecho' : `Tu pedido ${(processedOrder as Order).id} está siendo preparado`}
            </p>
            {(processedOrder as Order).tipo_pedido === 'mesa' && (
              <p className="text-xs text-[#8f7065] text-center mb-6">Mesa #{(processedOrder as Order).numero_mesa} — Tu pedido está listo</p>
            )}
            {(processedOrder as Order).tipo_pedido !== 'mesa' && (
              <p className="text-xs text-[#8f7065] text-center mb-6">{(processedOrder as Order).id}</p>
            )}
              <button onClick={() => { setPaymentConfirmedByAdmin(false); setProcessedOrder(null); setMesaOrderConfirmed(false); setMesaPaymentPhase(false); setMesaPaymentSent(false); setWaitingForAdmin(false); setAdminAccepted(false); localStorage.removeItem('trv_active_order_id'); localStorage.removeItem('trv_waiting_for_admin'); localStorage.removeItem('trv_checkout_order_type'); if (onClose) onClose(); else setTab('home'); }} className="w-full max-w-sm py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] cursor-pointer" style={{ backgroundColor: '#10b981' }}>
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de puntos ganados */}
      <PointsEarnedModal
        isOpen={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        points={earnedPoints}
        newBalance={earnedPointsBalance}
        reason={`por tu compra de $${totalUsd.toFixed(2)}`}
        themeColor={themeColor}
      />
    </div>
  );
};

interface LocationModalProps {
  themeColor: string;
  shopCoords: { lat: number; lng: number };
  initialLat: number | null;
  initialLng: number | null;
  config: StoreConfig;
  onDetectLocation: () => void;
  isDetecting: boolean;
  locationError: string;
  onConfirm: (lat: number, lng: number, distance: number, cost: number, zone: string) => void;
  onClose: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({
  themeColor, shopCoords, initialLat, initialLng, config,
  onDetectLocation, isDetecting, locationError,
  onConfirm, onClose
}) => {
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [pickedLat, setPickedLat] = useState<number | null>(initialLat);
  const [pickedLng, setPickedLng] = useState<number | null>(initialLng);
  const [pickedDistance, setPickedDistance] = useState<number>(0);
  const [pickedCost, setPickedCost] = useState<number>(0);
  const [pickedZone, setPickedZone] = useState<string>('');

  const calcDistance = useCallback((lat: number, lng: number) => {
    const R = 6371;
    const dLat = (lat - shopCoords.lat) * Math.PI / 180;
    const dLng = (lng - shopCoords.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(shopCoords.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(dist * 10) / 10;
  }, [shopCoords]);

  const calcCost = useCallback((dist: number) => {
    const zones = config.delivery_zonas || [];
    const matched = zones.find((z: DeliveryZone) => dist >= z.minKm && dist <= z.maxKm);
    if (matched) return { cost: matched.cost, zone: matched.name };
    return { cost: dist * (config.costo_delivery_km || 1.5), zone: `${dist} km` };
  }, [config]);

  const handleLocationPicked = useCallback((lat: number, lng: number, distance: number, cost: number, zoneName: string) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setPickedDistance(distance);
    setPickedCost(cost);
    setPickedZone(zoneName);
  }, []);

  const handleUseCurrentLocation = () => {
    onDetectLocation();
  };

  useEffect(() => {
    if (!isDetecting && initialLat === null) {
      const saved = localStorage.getItem('trv_user_location');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.lat && parsed.lng) {
            setPickedLat(parsed.lat);
            setPickedLng(parsed.lng);
            const d = calcDistance(parsed.lat, parsed.lng);
            setPickedDistance(d);
            const c = calcCost(d);
            setPickedCost(c.cost);
            setPickedZone(c.zone);
          }
        } catch {}
      }
    }
  }, [isDetecting, initialLat, calcCost, calcDistance]);

  const handleConfirm = () => {
    if (pickedLat && pickedLng) {
      onConfirm(pickedLat, pickedLng, pickedDistance, pickedCost, pickedZone);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex flex-col bg-white"
    >
      <div className="flex items-center justify-between p-4 border-b border-[#e4beb1]/10 shrink-0">
        <h3 className="text-sm font-bold text-[#1a1c1d]">Ubicación de entrega</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eeeef0] cursor-pointer">
          <X size={18} className="text-[#8f7065]" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <LeafletMap
            shopCoords={shopCoords}
            onLocationSelected={handleLocationPicked}
            config={config}
            initialUserCoords={pickedLat && pickedLng ? { lat: pickedLat, lng: pickedLng } : null}
          />
        </div>

        <div className="absolute top-3 left-3 right-3 z-[1000]">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-lg border border-[#e4beb1]/10 text-xs"
          >
            <Search size={14} className="text-[#8f7065] shrink-0" />
            <span className="text-[#8f7065] truncate">
              {showManualInput ? 'Escribe tu dirección...' : 'Buscar dirección o escribir referencia'}
            </span>
          </button>
          {showManualInput && (
            <div className="mt-2 bg-white rounded-xl shadow-lg border border-[#e4beb1]/10 p-3">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Ej: Calle 5, Edif. 3, aparto 2, Valencia"
                className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--theme-color,#FF6B35)] mb-2"
              />
              <p className="text-[10px] text-[#8f7065]">
                Arrastra el mapa para ajustar la ubicación exacta. Esta referencia se enviará con tu pedido.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#e4beb1]/10 bg-white p-4 space-y-3">
        <button
          onClick={handleUseCurrentLocation}
          disabled={isDetecting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          style={{ borderColor: themeColor, color: themeColor }}
        >
          <LocateFixed size={14} className={isDetecting ? 'animate-spin' : ''} />
          {isDetecting ? 'Detectando ubicación...' : 'Usar mi ubicación actual'}
        </button>
        {locationError && <p className="text-[11px] text-amber-600 text-center">{locationError}</p>}

        {pickedLat && pickedLng && (
          <div className="p-3 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl">
            <div className="flex items-center gap-2 text-[10px] text-[#8f7065] font-mono">
              <MapPin size={10} />
              <span>{pickedLat.toFixed(6)}, {pickedLng.toFixed(6)} · {pickedDistance} km · ${pickedCost.toFixed(2)}</span>
            </div>
            {pickedZone && <p className="text-[10px] text-[#8f7065] mt-1">Zona: {pickedZone}</p>}
            {manualAddress && <p className="text-[10px] text-[#5b4137] mt-1 font-medium">Ref: {manualAddress}</p>}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!pickedLat || !pickedLng}
          className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: pickedLat && pickedLng ? themeColor : '#9ca3af' }}
        >
          Confirmar Ubicación
        </button>
      </div>
    </motion.div>
  );
};
