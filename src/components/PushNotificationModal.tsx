import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store/AppContext';
import { Bell, X } from 'lucide-react';

// Función auxiliar para convertir la llave VAPID de Base64 a Uint8Array
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const PushNotificationModal: React.FC = () => {
  const { addNotification, config, currentUser } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [, setPermissionType] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      setPermissionType('unsupported');
      return;
    }

    const currentPermission = Notification.permission as 'default' | 'granted' | 'denied';
    setPermissionType(currentPermission);

    // If permission has already been decided or user previously dismissed the custom modal
    const dismissed = localStorage.getItem('trv_push_dismissed') === 'true';

    if (currentPermission === 'default' && !dismissed) {
      // Show the beautifully animated modal after a small delay (e.g. 1.2 seconds) to let page content load
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const res = await Notification.requestPermission();
      setPermissionType(res);
      setIsOpen(false);

      if (res === 'granted') {
        // Suscribirse al Push Manager con VAPID keys
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        console.warn('VAPID key exists:', !!vapidKey, 'serviceWorker exists:', !!navigator.serviceWorker);
        if (vapidKey && navigator.serviceWorker) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const pushSubscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });

            // Enviar suscripción al endpoint para guardarla en la base de datos
            const anonymousId = localStorage.getItem('trv_anonymous_id') || crypto.randomUUID();
            localStorage.setItem('trv_anonymous_id', anonymousId);

            try {
              const response = await fetch('/api/register-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscription: pushSubscription.toJSON(),
                  anonymous_id: anonymousId,
                  phone: currentUser?.telefono || '',
                  user_id: currentUser?.id || null
                })
              });
              const result = await response.json();
              console.warn('Push subscription registration result:', result);
              if (!response.ok || result.error) {
                console.error('Failed to register subscription:', result);
              }
            } catch (subErr) {
              console.error('Error sending subscription to server:', subErr);
            }
          } catch (subErr) {
            console.error('Error subscribing to push manager:', subErr);
          }
        }

        // Trigger a gorgeous, helpful native welcoming notification
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('¡Notificaciones Activas! 🔔', {
            body: '¡Genial! Ahora recibirás alertas en tiempo real sobre tus pedidos y ofertas frescas de ' + (config.site_nombre || 'nuestra tienda') + '.',
            icon: '/icon.png',
            badge: '/icon.png',
            vibrate: [200, 100, 200],
            tag: 'welcome-trv'
          } as NotificationOptions);
        });

        // Also add it inside the app database notifications (notify admin that user enabled push)
        if (currentUser) {
          addNotification(
            'Notificaciones Habilitadas',
            `${currentUser.nombre} ha activado las notificaciones push.`,
            'admin'
          );
        }
      } else if (res === 'denied') {
        // No notificar a todos - cada usuario gestiona sus propios permisos
      }
    } catch (err) {
      console.error('Error requesting push permission:', err);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    // Persist user dismissal so we don't annoy them on every hot reload or next click
    localStorage.setItem('trv_push_dismissed', 'true');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="push-gate-overlay"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.45 }}
          className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4 text-zinc-900"
        >
          {/* Decorative Glow Ring / Top Icon */}
          <div className="relative mx-auto mt-2 select-none">
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl scale-125 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner relative z-10 animate-bounce">
              <Bell size={20} className="fill-emerald-500/10" />
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-zinc-650 bg-zinc-50 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X size={14} />
          </button>

          {/* Text Descriptions */}
          <div className="text-center flex flex-col gap-1.5">
            <h3 className="text-sm font-black font-display text-zinc-950 uppercase tracking-wide leading-tight">
              ¡Entérate de tus pedidos! 🛵
            </h3>
            <p className="text-[11px] text-zinc-500 leading-normal font-sans">
              Para brindarte nuestro servicio express en <strong>Valencia</strong>, requerimos permiso para enviarte alertas instantáneas directamente a tu pantalla.
            </p>
          </div>

          {/* Core Feature Highlights Visual Layout */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-150">
            {/* Feature 1 */}
            <div className="flex gap-2 text-left items-start">
              <div className="p-1 px-1.5 bg-emerald-100 rounded text-emerald-700 font-bold shrink-0 text-[10px] mt-0.5">
                📦
              </div>
              <div className="flex flex-col leading-snug">
                <span className="text-[10px] font-extrabold text-zinc-900">Estado de Compras en Vivo</span>
                <span className="text-[9px] text-zinc-400 leading-normal">
                  Recibe avisos rápidos al cambiar tu pedido a "Preaparación", "En camino" o "Entregado".
                </span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-2 text-left items-start border-t border-zinc-200/50 pt-2">
              <div className="p-1 px-1.5 bg-emerald-100 rounded text-emerald-700 font-bold shrink-0 text-[10px] mt-0.5">
                🛵
              </div>
              <div className="flex flex-col leading-snug">
                <span className="text-[10px] font-extrabold text-zinc-900">Alertas de Delivery Rápido</span>
                <span className="text-[9px] text-zinc-400 leading-normal">
                  Sabrás exactamente el momento en que nuestro motorizado parta a tu dirección.
                </span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-2 text-left items-start border-t border-zinc-200/50 pt-2">
              <div className="p-1 px-1.5 bg-amber-100 rounded text-amber-700 font-bold shrink-0 text-[10px] mt-0.5">
                ⚡
              </div>
              <div className="flex flex-col leading-snug">
                <span className="text-[10px] font-extrabold text-zinc-900">Promociones Relámpago</span>
                <span className="text-[9px] text-zinc-400 leading-normal">
                  Descuentos exclusivos en embutidos, quesos madurados y víveres frescos antes de agotarse.
                </span>
              </div>
            </div>
          </div>

          {/* Regulatory Safe-trust note */}
          <p className="text-[9px] text-zinc-400 font-mono leading-normal text-center select-none">
            🔒 Comprometidos con tu privacidad. Sin spam. Puedes cancelar o reestructurar permisos desde tu perfil cuando quieras.
          </p>

          {/* CTA Button Layout Controls */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2.5 rounded-xl text-zinc-650 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 bg-white font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center active:scale-95 shrink-0"
            >
              Más Tarde
            </button>
            <button
              type="button"
              onClick={handleRequestPermission}
              className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/20 text-center flex items-center justify-center gap-1 active:scale-95 shrink-0 font-display"
            >
              Activar 🚀
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
