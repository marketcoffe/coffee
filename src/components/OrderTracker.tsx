import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Clock, Truck, Package, ChefHat, MapPin, MessageSquare, X, ShoppingBag, Zap, Heart, Bell } from 'lucide-react';
import { Order } from '../types/store';
import { useApp } from '../store/AppContext';
import { getWhatsAppPhone as resolveBusinessPhone } from '../utils/phone';
import { supabase } from '../store/supabaseClient';

interface OrderTrackerProps {
  order: Order;
  onClose: () => void;
  onContinueShopping: () => void;
  onStatusUpdate?: (newStatus: string) => void;
}

function getStatusSteps(orderType?: string) {
  if (orderType === 'mesa' || orderType === 'pickup') {
    return [
      { key: 'Pendiente', label: 'Recibido', icon: CheckCircle, description: 'Tu pedido fue recibido', notification: 'Tu pedido fue recibido correctamente' },
      { key: 'En preparación', label: 'En Preparación', icon: ChefHat, description: 'Estamos preparando tu comida', notification: 'Tu pedido está siendo preparado con amor' },
      { key: 'Entregado', label: 'Entregado', icon: CheckCircle, description: '¡Pedido completado!', notification: '¡Tu pedido está listo!' },
    ];
  }
  return [
    { key: 'Pendiente', label: 'Aceptado', icon: CheckCircle, description: 'Tu pedido fue recibido', notification: 'Tu pedido fue recibido correctamente' },
    { key: 'En preparación', label: 'En Preparación', icon: ChefHat, description: 'Estamos preparando tu comida', notification: 'Tu pedido está siendo preparado' },
    { key: 'En camino', label: 'En Camino', icon: Truck, description: 'Tu pedido va en camino', notification: '¡Tu pedido va en camino!' },
    { key: 'Entregado', label: 'Entregado', icon: MapPin, description: '¡Pedido entregado!', notification: '¡Tu pedido fue entregado!' },
  ];
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'Pendiente': 'Aceptado',
    'Procesando': 'En Preparación',
    'enviado_cocina': 'En Cocina',
    'En preparación': 'En Preparación',
    'En preparacion': 'En Preparación',
    'en_preparacion': 'En Preparación',
    'Listo': 'Listo',
    'En camino': 'En Camino',
    'Entregado': 'Entregado',
    'Cancelado': 'Cancelado',
    'completado': 'Completado',
    'cancelado': 'Cancelado',
    'pago_enviado': 'Pago Enviado',
    'pendiente_pago': 'Pendiente Pago',
    'pendiente_verificacion': 'Verificando',
    'pago_en_verificacion': 'Verificando Pago',
  };
  return labels[status] || status;
}

const MOTIVATIONAL_MESSAGES = [
  '¡Tu comida está siendo preparada con amor! 🍳',
  '¡Ya casi es tuyo! Unos minutos más... 😋',
  '¡Nuestros chefs están en acción! 👨‍🍳',
  '¡La anticipación hace que todo sepa mejor! 😍',
  '¡Tu pedido viaja bien protegido! 📦',
  '¡Pronto disfrutarás de tu favorito! 🔥',
  '¡No te preocupes, llegó rápido! 🚀',
  '¡Tu paciencia será recompensada! ✨',
];

const AD_INTERVAL = 6000;

export const OrderTracker: React.FC<OrderTrackerProps> = ({ order, onClose, onContinueShopping, onStatusUpdate }) => {
  const { config, foodItems } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [currentMsgIdx, setCurrentMsgIdx] = useState(0);
  const [adIdx, setAdIdx] = useState(0);
  const [liveStatus, setLiveStatus] = useState(order.status);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const orderType = order.tipo_entrega || order.tipo_pedido || 'delivery';
  const STATUS_STEPS = useMemo(() => getStatusSteps(orderType), [orderType]);
  const statusOrder = STATUS_STEPS.map(s => s.key);
  const normalizeStatus = (s: string) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedLive = normalizeStatus(liveStatus);
  const normalizedKeys = statusOrder.map(normalizeStatus);
  const currentStepIdx = Math.max(0, normalizedKeys.indexOf(normalizedLive));

  const adProducts = useMemo(() => {
    return foodItems
      .filter(p => p.activo !== false && p.stock > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);
  }, [foodItems]);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 4000);
  }, []);

  const playUpdateSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPHeTnJVqO0Bvkp2XbEVCdZCdlWlEQ3aPnJZpQ0N2j5yVaUN');
        audioRef.current.volume = 0.3;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setCurrentMsgIdx(prev => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 4000);
    const adTimer = setInterval(() => {
      setAdIdx(prev => (prev + 1) % Math.max(1, adProducts.length));
    }, AD_INTERVAL);
    return () => { clearInterval(msgTimer); clearInterval(adTimer); };
  }, [adProducts.length]);

  useEffect(() => {
    setLiveStatus(order.status);
  }, [order.status]);

  useEffect(() => {
    if (!order.id) return;

    const handleStatusChange = (newStatus: string) => {
      if (newStatus && newStatus !== liveStatus) {
        setLiveStatus(newStatus as Order['status']);
        setLastUpdate(new Date());
        onStatusUpdate?.(newStatus);

        const step = STATUS_STEPS.find(s => s.key === newStatus);
        if (step) {
          showToast(step.notification);
          playUpdateSound();
        }
      }
    };

    // Canal dual: CDC (respaldo) + Broadcast (instantáneo)
    const channel = supabase
      .channel(`order-tracker-${order.id}`)
      // CDC listener (respaldo, ~200-500ms)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          const newStatus = payload.new?.status;
          handleStatusChange(newStatus);
        }
      )
      // Broadcast listener (instantáneo, <100ms)
      .on('broadcast', { event: 'order_status_broadcast' }, (payload: { payload: Order }) => {
        const updated = payload.payload;
        if (updated?.id === order.id) {
          handleStatusChange(updated.status);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[OrderTracker] Realtime connected for order', order.id);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [order.id, liveStatus, onStatusUpdate, showToast, playUpdateSound, STATUS_STEPS]);

  const getWhatsAppPhone = (): string => {
    const sede = order.sede_id
      ? config.sedes?.find(s => s.id === order.sede_id)
      : undefined;
    return resolveBusinessPhone(config, { sede }).replace(/\D/g, '').replace(/^0/, '58');
  };

  const handleSendMessage = () => {
    const msg = `Hola! Quiero saber sobre mi pedido *${order.id}*\nEstado actual: ${getStatusLabel(liveStatus)}`;
    window.open(`https://wa.me/${getWhatsAppPhone()}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const isDelivered = liveStatus === 'Entregado';
  const isFinal = liveStatus === 'Entregado' || liveStatus === 'Cancelado';

  return (
    <div className="fixed inset-0 z-[120] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={isDelivered ? onClose : undefined} />

      {/* Toast notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-6 left-1/2 z-[130] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl border"
            style={{ backgroundColor: themeColor, borderColor: `${themeColor}40`, maxWidth: '90vw' }}
          >
            <Bell size={16} className="text-white shrink-0" />
            <span className="text-xs font-bold text-white">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full lg:max-w-lg max-h-[90vh] bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Seguimiento</h3>
              <p className="text-[10px] text-white/60 font-mono">#{order.id}</p>
            </div>
          </div>
          {isDelivered && (
            <button onClick={onClose} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Status Badge */}
          <div className="px-5 pt-5 pb-3">
            <motion.div
              key={liveStatus}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2"
              style={{
                borderColor: isDelivered ? '#10B981' : themeColor,
                backgroundColor: isDelivered ? '#10B98110' : `${themeColor}10`,
              }}
            >
              <motion.div
                animate={isFinal ? {} : { scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {isDelivered ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} style={{ color: themeColor }} className="animate-spin" />
                )}
              </motion.div>
              <span className="text-xs font-black" style={{ color: isDelivered ? '#10B981' : themeColor }}>
                {getStatusLabel(liveStatus)}
              </span>
            </motion.div>
          </div>

          {/* Animated Timeline */}
          <div className="px-5 pb-4">
            <div className="relative">
              {STATUS_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                const StepIcon = step.icon;

                return (
                  <div key={step.key} className="flex gap-3 relative">
                    {/* Vertical line */}
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className="absolute left-4 top-8 w-[2px] h-full">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5, delay: idx * 0.15 }}
                          className="w-full rounded-full"
                          style={{ backgroundColor: isCompleted ? themeColor : '#e4e4e7' }}
                        />
                      </div>
                    )}

                    {/* Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15, delay: idx * 0.1 }}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCurrent ? 'ring-4' : ''
                      }`}
                      style={{
                        backgroundColor: isCompleted ? themeColor : '#f4f4f5',
                        ...(isCurrent ? { boxShadow: `0 0 0 4px ${themeColor}30` } : {}),
                      }}
                    >
                      {isCompleted ? (
                        isCurrent ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                          >
                            <StepIcon size={14} className="text-white" />
                          </motion.div>
                        ) : (
                          <CheckCircle size={14} className="text-white" />
                        )
                      ) : (
                        <StepIcon size={14} className="text-zinc-400" />
                      )}
                    </motion.div>

                    {/* Content */}
                    <div className="pb-6 pt-1">
                      <p className={`text-xs font-bold ${isCompleted ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {step.label}
                      </p>
                      <p className={`text-[10px] ${isCompleted ? 'text-zinc-500' : 'text-zinc-300'}`}>
                        {step.description}
                      </p>
                      {isCurrent && !isDelivered && (
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[9px] font-bold mt-1"
                          style={{ color: themeColor }}
                        >
                          ← Estado actual
                        </motion.p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motivational Message (while waiting) */}
          {!isDelivered && (
            <div className="px-5 pb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMsgIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 rounded-xl border border-dashed text-center"
                  style={{ borderColor: `${themeColor}40`, backgroundColor: `${themeColor}05` }}
                >
                  <p className="text-xs font-semibold" style={{ color: themeColor }}>
                    {MOTIVATIONAL_MESSAGES[currentMsgIdx]}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Estimated Time */}
          {!isDelivered && order.tiempo_estimado_entrega && (
            <div className="px-5 pb-4">
              <div className="p-3 bg-zinc-50 rounded-xl flex items-center justify-between border border-zinc-100">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Tiempo estimado</span>
                <span className="text-xs font-black" style={{ color: themeColor }}>{order.tiempo_estimado_entrega}</span>
              </div>
            </div>
          )}

          {/* Product Ads while waiting */}
          {!isDelivered && adProducts.length > 0 && (
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} style={{ color: themeColor }} />
                <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Mientras esperas... ¡Próxima compra!</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={adIdx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3 overflow-x-auto pb-2 no-scrollbar"
                >
                  {adProducts.slice(adIdx, adIdx + 3).concat(adProducts.slice(0, Math.max(0, adIdx + 3 - adProducts.length))).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { onClose(); onContinueShopping(); }}
                      className="shrink-0 w-[130px] bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100 hover:border-zinc-200 transition-all cursor-pointer"
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img src={p.imagen_urls?.[0] || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-bold text-zinc-900 truncate">{p.nombre}</p>
                        <p className="text-[10px] font-black mt-0.5" style={{ color: themeColor }}>${p.precio_usd.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Delivered celebration */}
          {isDelivered && (
            <div className="px-5 pb-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <Heart size={32} className="text-emerald-500 mx-auto mb-2" fill="currentColor" />
                </motion.div>
                <p className="text-sm font-bold text-emerald-800">¡Tu pedido fue entregado!</p>
                <p className="text-[10px] text-emerald-600 mt-1">Esperamos que lo disfrutes. ¡Buen provecho!</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-100 bg-white shrink-0 flex flex-col gap-2">
          {!isDelivered && (
            <button
              onClick={handleSendMessage}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-all"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageSquare size={14} /> Enviar Mensaje
            </button>
          )}
          {isDelivered ? (
            <button
              onClick={() => { onClose(); onContinueShopping(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-all"
              style={{ backgroundColor: themeColor }}
            >
              <ShoppingBag size={14} /> Seguir Comprando
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors"
            >
              Seguir Navegando
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
