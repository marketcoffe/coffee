import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../store/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import {
  UtensilsCrossed, User, Hash, MessageSquare, CheckCircle, ArrowRight, ArrowLeft,
  Plus, Trash2, Copy, Check, ShoppingCart
} from 'lucide-react';
import { CartUpsell } from '../CartUpsell';
import { FoodItem, Mesa, Order } from '../../types/store';

interface MesaCheckoutProps {
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' | 'mesa_checkout') => void;
  onOrderCreated: (order: Order) => void;
}

export const MesaCheckout: React.FC<MesaCheckoutProps> = ({ setTab, onOrderCreated }) => {
  const {
    cart, config, mesas, fetchMesas, addToCart, updateCartQuantity,
    removeFromCart, currentUser, coupons
  } = useApp();

  const themeColor = config.theme_color || '#A4D045';
  const mesaColor = '#e67e22';

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [clientName, setClientName] = useState(() => {
    if (currentUser?.nombre) return currentUser.nombre;
    try { return localStorage.getItem('trv_guest_name') || ''; } catch { return ''; }
  });
  const [clientPhone, setClientPhone] = useState(() => {
    if (currentUser?.telefono) return currentUser.telefono;
    try { return localStorage.getItem('trv_guest_phone') || ''; } catch { return ''; }
  });
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (mesas.length === 0) fetchMesas();
  }, [mesas.length, fetchMesas]);

  useEffect(() => {
    if (currentUser) setClientName(currentUser.nombre);
  }, [currentUser]);

  // Save guest name/phone to localStorage
  useEffect(() => {
    if (clientName.trim()) {
      try { localStorage.setItem('trv_guest_name', clientName.trim()); } catch {}
    }
  }, [clientName]);
  useEffect(() => {
    if (clientPhone.trim()) {
      try { localStorage.setItem('trv_guest_phone', clientPhone.trim()); } catch {}
    }
  }, [clientPhone]);

  // beforeunload confirmation
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cart.length > 0 && !isProcessing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cart.length, isProcessing]);

  const availableMesas = useMemo(() =>
    mesas.filter(m => m.estado !== 'Inactiva').sort((a, b) => a.numero_mesa - b.numero_mesa),
    [mesas]
  );

  const subtotalUsd = cart.reduce((acc, ci) => {
    const extrasTotal = ci.selected_options?.reduce((e, opt) => e + opt.precio_usd, 0) || 0;
    return acc + ((ci.item.precio_usd + extrasTotal) * ci.quantity);
  }, 0);

  let discountFromCoupon = 0;
  if (appliedCoupon) {
    const couponType = appliedCoupon.coupon_type || 'percentage';
    if (couponType === 'fixed') {
      discountFromCoupon = Math.min(appliedCoupon.discount_amount || 0, subtotalUsd);
    } else if (couponType !== 'free_shipping') {
      discountFromCoupon = subtotalUsd * (appliedCoupon.discount_percent / 100);
    }
  }

  const totalUsd = subtotalUsd - discountFromCoupon;
  const totalBs = totalUsd * config.tasa_cambio;

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

  const CopyBtn: React.FC<{ text: string; id: string }> = ({ text, id }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleCopy(text, id); }}
      className="shrink-0 p-1 rounded hover:bg-[#e2e2e4] transition-colors cursor-pointer"
    >
      {copiedField === id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-[#8f7065]" />}
    </button>
  );

  const handleApplyCoupon = () => {
    setCouponError('');
    const code = couponInput.toUpperCase().trim();
    const found = coupons.find(c => c.code === code);
    if (!found) { setCouponError('Cupón no válido'); return; }
    if (!found.active) { setCouponError('Este cupón ya no está activo'); return; }
    if (found.usage_limit && found.usage_count >= found.usage_limit) { setCouponError('Cupón agotado'); return; }
    if (found.min_purchase && subtotalUsd < found.min_purchase) { setCouponError(`Compra mínima: $${found.min_purchase.toFixed(2)}`); return; }
    setAppliedCoupon(found);
    setCouponInput('');
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!clientName.trim()) {
        setValidationError('Ingresa tu nombre para el pedido.');
        return;
      }
      if (!selectedMesa) {
        setValidationError('Selecciona una mesa.');
        return;
      }
      setValidationError('');
      setCurrentStep(2);
    }
  };

  const handleSendToKitchen = async () => {
    if (!clientName.trim() || !selectedMesa) return;
    setIsProcessing(true);
    setValidationError('');

    try {
      const items = cart.map(ci => ({
        food_id: ci.item.id,
        nombre: ci.item.nombre,
        precio_usd: ci.item.precio_usd,
        cantidad: ci.quantity,
        selected_options: ci.selected_options,
        options_total_usd: ci.options_total_usd,
        ingredientes_removidos: ci.ingredientes_removidos || []
      }));

      const { data, error } = await supabase.rpc('crear_pedido_mesa', {
        p_cliente_nombre: clientName.trim(),
        p_numero_mesa: selectedMesa,
        p_items: items,
        p_subtotal_usd: subtotalUsd,
        p_total_usd: totalUsd,
        p_total_bs: totalBs,
        p_notas_admin: orderNotes,
        p_sede_id: '',
        p_usuario_id: currentUser?.id || '',
        p_cliente_telefono: clientPhone.trim() || currentUser?.telefono || '',
        p_cliente_email: currentUser?.email || '',
        p_lat: config.coordenadas_tienda.lat,
        p_lng: config.coordenadas_tienda.lng,
        p_descuento_cupon_usd: discountFromCoupon,
        p_cupon_codigo: appliedCoupon?.code || ''
      });

      if (error) {
        console.error('Error creating mesa order:', error);
        setValidationError('Error al enviar el pedido. Intenta de nuevo.');
        setIsProcessing(false);
        return;
      }

      const orderData = data as any;

      const newOrder: Order = {
        id: orderData.id,
        cliente_nombre: clientName.trim(),
        cliente_telefono: clientPhone.trim() || currentUser?.telefono || '',
        cliente_email: currentUser?.email || '',
        usuario_id: currentUser?.id,
        items,
        subtotal_usd: subtotalUsd,
        costo_envio_usd: 0,
        descuento_cupon_usd: discountFromCoupon,
        cupon_codigo: appliedCoupon?.code,
        total_usd: totalUsd,
        total_bs: totalBs,
        metodo_pago: 'Pago Móvil',
        tipo_entrega: 'mesa',
        tipo_pedido: 'mesa',
        numero_mesa: selectedMesa,
        nombre_cliente: clientName.trim(),
        lat: config.coordenadas_tienda.lat,
        lng: config.coordenadas_tienda.lng,
        direccion_envio: `Mesa #${selectedMesa}`,
        distancia_km: 0,
        status: 'enviado_cocina' as any,
        notas_admin: orderNotes,
        fecha: new Date().toISOString(),
        sede_id: '',
        ticket_code: orderData.ticket_code
      };

      // Broadcast the new order
      try {
        const broadcastChannel = supabase.channel('marketo_realtime_system');
        await new Promise<void>((resolve) => {
          broadcastChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
          });
        });
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'new_order_broadcast',
          payload: newOrder
        });
        supabase.removeChannel(broadcastChannel);
      } catch (e) {
        console.warn('Broadcast failed:', e);
      }

      localStorage.setItem('trv_active_order_id', newOrder.id);
      onOrderCreated(newOrder);
    } catch (err) {
      console.error('Unexpected error:', err);
      setValidationError('Error inesperado. Intenta de nuevo.');
    }
    setIsProcessing(false);
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center p-6" style={{ backgroundColor: '#f9f9fb' }}>
        <ShoppingCart size={40} className="text-[#8f7065] mb-3" />
        <p className="text-sm font-bold text-[#1a1c1d]">Tu carrito está vacío</p>
        <p className="text-xs text-[#8f7065] mt-1">Agrega productos antes de hacer un pedido en mesa.</p>
        <button onClick={() => setTab('catalog')} className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: themeColor }}>
          Explorar Menú
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: '#f9f9fb' }}>
      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md">
          <div className="w-14 h-14 border-4 rounded-full" style={{ borderColor: `${mesaColor}20` }} />
          <div className="absolute w-14 h-14 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${mesaColor} transparent` }} />
          <p className="mt-6 text-sm font-bold uppercase tracking-wide" style={{ color: mesaColor }}>Enviando a cocina...</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20" style={{ backgroundColor: 'rgba(249,249,251,0.8)', backdropFilter: 'blur(20px)', borderColor: '#e4beb1/10' }}>
        <button onClick={() => {
          if (cart.length > 0 && !isProcessing) {
            setShowExitModal(true);
          } else if (currentStep === 2) {
            setCurrentStep(1);
          } else {
            setTab('cart');
          }
        }} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#eeeef0] transition-colors cursor-pointer" style={{ backgroundColor: '#eeeef0' }}>
          <ArrowLeft size={18} className="text-[#1a1c1d]" />
        </button>
        <div className="flex-1">
          <h1 className="text-[16px] font-bold text-[#1a1c1d]">Pedido en Mesa</h1>
          <p className="text-[11px] text-[#8f7065]">Paso {currentStep} de 2</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: mesaColor }}>
          <UtensilsCrossed size={18} />
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b px-4 py-3" style={{ backgroundColor: '#ffffff', borderColor: '#e4beb1/10' }}>
        <div className="flex items-center justify-between max-w-xs mx-auto">
          {[
            { step: 1, label: 'Datos', icon: <User size={14} /> },
            { step: 2, label: 'Resumen', icon: <CheckCircle size={14} /> },
          ].map(({ step, label, icon }, idx, arr) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: step < currentStep ? '#2e7d32' : step === currentStep ? mesaColor : '#eeeef0',
                    color: step <= currentStep ? '#ffffff' : '#8f7065'
                  }}
                >
                  {step < currentStep ? <Check size={14} /> : icon}
                </div>
                <span className="text-[11px] font-bold" style={{ color: step === currentStep ? '#1a1c1d' : '#8f7065' }}>{label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 rounded-full mt-[-12px]" style={{ backgroundColor: step < currentStep ? '#2e7d32' : '#e2e2e4' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4 space-y-4">
              {/* Nombre del cliente */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Tu Nombre</h3>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre para el pedido"
                  className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors"
                />
              </div>

              {/* Teléfono (opcional, para notificaciones) */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-1">Teléfono (opcional)</h3>
                <p className="text-[10px] text-[#8f7065] mb-3">Te notificaremos cuando tu pedido esté listo</p>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="0412-1234567"
                  className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-color,#FF6B35)] transition-colors"
                />
              </div>

              {/* Selección de Mesa */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Selecciona tu Mesa</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableMesas.length === 0 && (
                    <p className="col-span-full text-xs text-[#8f7065] text-center py-4">No hay mesas disponibles</p>
                  )}
                  {availableMesas.map(mesa => {
                    const isSelected = selectedMesa === mesa.numero_mesa;
                    const isOcupada = mesa.estado === 'Ocupada';
                    return (
                      <button
                        key={mesa.id}
                        onClick={() => !isOcupada && setSelectedMesa(mesa.numero_mesa)}
                        disabled={isOcupada}
                        className={`relative p-3 rounded-xl text-center transition-all cursor-pointer border-2 ${
                          isOcupada ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50' :
                          isSelected ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 hover:bg-[#eeeef0]'
                        }`}
                        style={isSelected ? { backgroundColor: mesaColor, borderColor: mesaColor } : {}}
                      >
                        <UtensilsCrossed size={18} className={`mx-auto mb-1 ${isSelected ? 'text-white' : 'text-[#8f7065]'}`} />
                        <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#1a1c1d]'}`}>Mesa {mesa.numero_mesa}</p>
                        {mesa.nombre_personalizado && (
                          <p className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#8f7065]'}`}>{mesa.nombre_personalizado}</p>
                        )}
                        {isOcupada && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.5 rounded-full bg-amber-500 text-white">Ocupada</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedMesa && (
                  <div className="mt-3 p-2 rounded-lg text-center" style={{ backgroundColor: `${mesaColor}10` }}>
                    <span className="text-xs font-bold" style={{ color: mesaColor }}>Mesa #{selectedMesa} seleccionada</span>
                  </div>
                )}
              </div>

              {/* Carrito */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d]">Tu Carrito ({cart.reduce((s, ci) => s + ci.quantity, 0)} items)</h3>
                  <button onClick={() => setTab('catalog')} className="text-[11px] font-bold underline" style={{ color: mesaColor }}>Agregar más</button>
                </div>
                <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#eeeef0] border border-[#e4beb1]/10 shrink-0">
                        <img src={item.item.imagen_urls?.[0] || ''} alt={item.item.nombre} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#1a1c1d] truncate">{item.item.nombre}</h4>
                        {item.selected_options && item.selected_options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.selected_options.map((opt, idx) => (
                              <span key={idx} className="text-[9px] px-1 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold border border-violet-100">
                                {opt.option_name}
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
                  ))}
                </div>
              </div>

              <CartUpsell onAddToCart={(item: FoodItem) => addToCart(item)} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4 space-y-4">
              {/* Resumen */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed size={14} style={{ color: mesaColor }} />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d]">Mesa #{selectedMesa} — {clientName}</h3>
                </div>
                <div className="space-y-2 mb-3">
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
                <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                  <div className="text-right">
                    <span className="font-black text-lg" style={{ color: mesaColor }}>${totalUsd.toFixed(2)}</span>
                    <span className="text-[10px] text-[#8f7065] ml-2">{totalBs.toFixed(2)} Bs.</span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
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

              {/* Cupón */}
              <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
                <label className="text-[11px] font-bold uppercase text-[#8f7065] mb-2 block">Cupón</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="CÓDIGO"
                    className="flex-1 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 text-xs outline-none font-bold uppercase"
                  />
                  <button onClick={handleApplyCoupon} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: mesaColor }}>Aplicar</button>
                </div>
                {couponError && <span className="text-[11px] text-red-500 mt-1 block">{couponError}</span>}
                {appliedCoupon && (
                  <p className="text-xs font-bold mt-2" style={{ color: mesaColor }}>
                    ✓ "{appliedCoupon.code}" aplicado: -{appliedCoupon.coupon_type === 'fixed' ? `$${appliedCoupon.discount_amount}` : `${appliedCoupon.discount_percent}%`}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4beb1]/10 p-4 z-20">
          {validationError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 text-center">
              {validationError}
            </div>
          )}
          {currentStep === 1 ? (
            <button
              onClick={handleNextStep}
              disabled={!clientName.trim() || !selectedMesa}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                clientName.trim() && selectedMesa
                  ? 'text-white'
                  : 'text-white/60 cursor-not-allowed'
              }`}
              style={{ backgroundColor: clientName.trim() && selectedMesa ? mesaColor : `${mesaColor}60` }}
            >
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSendToKitchen} disabled={isProcessing} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
              {isProcessing ? 'Enviando...' : '✓ Confirmar y Enviar a Cocina'}
            </button>
          )}
        </div>
      )}

      {/* Exit confirmation modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-bold text-[#1a1c1d] mb-2">¿Salir del pedido?</h3>
            <p className="text-sm text-[#8f7065] mb-5">Si sales ahora, se perderá el contenido de tu carrito para este pedido en mesa.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#eeeef0] text-[#5b4137] transition-all active:scale-[0.98] cursor-pointer">
                Quedarme
              </button>
              <button onClick={() => { setShowExitModal(false); setTab('cart'); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] cursor-pointer" style={{ backgroundColor: '#ef4444' }}>
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
