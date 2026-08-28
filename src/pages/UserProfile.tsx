import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { motion } from 'motion/react';
import { supabase } from '../store/supabaseClient';
import {
  User, Lock, Phone, UserPlus, LogIn, LogOut, Bell, Package, Mail,
  CheckCircle, Edit2, AlertCircle, Eye, EyeOff, Tag,
  Copy, Check, X, Smartphone, MessageSquare, Send, ExternalLink, Trash2, Star, Gift
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { useToast } from '../components/Toast';
import { OrderTracker } from '../components/OrderTracker';
import { LoyaltyWidget } from '../components/LoyaltyWidget';
import { InAppNotification } from '../types/store';
import ClientePanelPedidos from '../components/ClientePanelPedidos';

interface BeforeInstallPromptEvent {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

interface CredentialsReminder {
  nombre: string;
  email?: string;
  telefono: string;
  contrasena: string;
  is_update?: boolean;
}

interface UserProfileProps {
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' | 'mesa_checkout') => void;
  deferredPrompt?: BeforeInstallPromptEvent | null;
  onInstallClick?: () => void;
  deepLinkOrderId?: string | null;
  deepLinkAction?: string | null;
}

export const UserProfile: React.FC<UserProfileProps> = ({ setTab, deferredPrompt, onInstallClick, deepLinkOrderId, deepLinkAction }) => {
  const { showToast } = useToast();
  const { 
    currentUser, 
    orders, 
    notifications, 
    config, 
    registerUser, 
    loginUser, 
    logoutUser, 
    updateUser,
    sendPasswordResetEmail,
    markNotificationAsRead,
    registerNotificationClick,
    syncPushSubscription,
    addNotification,
    requestPart,
    deleteNotification,
    clearAllNotifications,
    getUserLoyaltyPoints,
    promotions,
    coupons: allCoupons,
  } = useApp();

  const themeColor = config.theme_color || '#A4D045';

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'orders' | 'notifications' | 'rewards' | 'promos' | 'coupons'>('orders');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Derived data for tabs
  const activePromos = promotions.filter(p => p.status === 'active' && new Date(p.end_date) > new Date());
  const availableCoupons = allCoupons.filter(c => c.active && (!c.valid_until || new Date(c.valid_until) > new Date()));

  // ── Lógica de Popup Automático de Instalación (PWA) ────────────────────────
  const [showAutoPopup, setShowAutoPopup] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasSeenThisSession = sessionStorage.getItem('marketo_install_popup_shown');

    if (deferredPrompt && !isStandalone && !hasSeenThisSession) {
      const timer = setTimeout(() => {
        setShowAutoPopup(true);
        sessionStorage.setItem('marketo_install_popup_shown', 'true');
      }, 3000); // Aparece 3 segundos después de cargar para mejor UX
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt]);

  // ── Delivery Timeline Modal (disparado al finalizar el checkout) ─────────────────
  const [activeOrderModalId, setActiveOrderModalId] = useState<string | null>(null);
  const [showOrderTimelineModal, setShowOrderTimelineModal] = useState(false);

  // ── Deep linking desde notificaciones push ───────────────────────────────
  useEffect(() => {
    if (!deepLinkAction) return;
    if (deepLinkAction === 'OPEN_ORDER_TRACKER' && deepLinkOrderId) {
      setActiveSubTab('orders');
      setActiveOrderModalId(deepLinkOrderId);
      setShowOrderTimelineModal(true);
    } else if (deepLinkAction === 'OPEN_REWARDS' || deepLinkAction === 'loyalty') {
      setActiveSubTab('rewards');
    } else if (deepLinkAction === 'OPEN_COUPONS' || deepLinkAction === 'coupons') {
      setActiveSubTab('coupons');
    }
  }, [deepLinkAction, deepLinkOrderId]);

  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as 'default' | 'granted' | 'denied';
  });

  // Sync state if user enables it somewhere else
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const handleFocus = () => {
        setNotificationPermission(Notification.permission);
      };
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

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

  const requestNotificationPermission = async () => {
    console.log('[UserProfile] requestNotificationPermission llamado');
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[UserProfile] Notification API no soportada');
      addNotification('Error', 'Tu navegador no soporta notificaciones push.', 'admin');
      return;
    }

    // Validar que la VAPID key esté configurada
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error('[UserProfile] VITE_VAPID_PUBLIC_KEY no configurada');
      addNotification('⚠️ Error de Configuración', 'VITE_VAPID_PUBLIC_KEY no está configurada. Contacta al administrador.', 'admin');
      return;
    }
    console.log('[UserProfile] VAPID key presente:', vapidKey.substring(0, 10) + '...');

    try {
      console.log('[UserProfile] Solicitando permiso de notificación...');
      const res = await Notification.requestPermission();
      console.log('[UserProfile] Permiso resultado:', res);
      setNotificationPermission(res);
      if (res === 'granted') {
        console.log('[UserProfile] Permiso concedido — suscribiendo a push...');
        // Re-suscripción con llaves VAPID
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        console.log('[UserProfile] Push subscription creada:', subscription.endpoint.substring(0, 50));

        const syncResult = await syncPushSubscription();
        console.log('[UserProfile] syncPushSubscription resultado:', syncResult);
        if (!syncResult.success) {
          addNotification('⚠️ Error Sincronizando Push', syncResult.error!, 'admin');
        }

        navigator.serviceWorker.ready.then(reg => {
          console.log('[UserProfile] Mostrando notificación de bienvenida');
          reg.showNotification('¡Notificaciones Habilitadas! 🔔', {
            body: '¡Excelente! Ahora recibirás actualizaciones rápidas de tus pedidos y promociones de ' + (config.site_nombre || 'nuestra tienda') + '.',
            icon: config.logo_url || '/icon.png',
            badge: '/icon.png',
            vibrate: [200, 100, 200],
            tag: 'welcome-trv'
          } as NotificationOptions);
        });
      } else if (res === 'denied') {
        console.warn('[UserProfile] Permiso de notificación denegado por el usuario');
        addNotification('Notificaciones Bloqueadas', `${currentUser?.nombre || 'Usuario'} ha bloqueado las notificaciones.`, 'admin');
      }
    } catch (error) {
      console.error('[UserProfile] Error requestNotificationPermission:', error);
      addNotification('Error Activando Notificaciones', (error as Error).message || String(error), 'admin');
    }
  };

  // Input states
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  const [forgotEmail, setForgotEmail] = useState('');
  const [logPhone, setLogPhone] = useState('');
  const [logPassword, setLogPassword] = useState('');

  const [editName, setEditName] = useState(currentUser?.nombre || '');
  const [editEmail, setEditEmail] = useState(currentUser?.email || '');
  const [editPhone, setEditPhone] = useState(currentUser?.telefono || '');
  const [editPassword, setEditPassword] = useState(currentUser?.contrasena || '');

  // Errors & Modals
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showReminderModal, setShowReminderModal] = useState<CredentialsReminder | null>(null); // holds registered info to remind them
  const [, setUpdateSuccess] = useState(false);
  const [showEditFields, setShowEditFields] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // States to animate custom copying success feedback for each credential element
  const [copiedName, setCopiedName] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showReminderPassword, setShowReminderPassword] = useState(false);

  const [directMsg, setDirectMsg] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<InAppNotification | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteSingleConfirm, setDeleteSingleConfirm] = useState<string | null>(null);

  const handleCopyText = (text: string, type: 'name' | 'phone' | 'password' | 'all') => {
    navigator.clipboard.writeText(text);
    if (type === 'name') {
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 2000);
    } else if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === 'password') {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } else if (type === 'all') {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword.trim()) {
      setAuthError('Todos los campos son obligatorios.');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(regUsername.trim())) {
      setAuthError('El usuario debe tener 3-20 caracteres (letras, números, guión bajo).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setAuthError('Correo electrónico inválido. Debe tener un formato válido (ej: usuario@dominio.com).');
      return;
    }

    const phoneRegex = /^\+?[0-9]{7,15}$/;
    const cleanedPhone = regPhone.replace(/[\s\-()]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      setAuthError('Número de teléfono inválido (debe tener de 7 a 15 dígitos).');
      return;
    }

    // Check if username is already taken
    const { data: existingUsername } = await supabase
      .from('usuarios_clientes')
      .select('id')
      .eq('username', regUsername.trim())
      .limit(1);

    if (existingUsername && existingUsername.length > 0) {
      setAuthError('Este nombre de usuario ya está en uso.');
      return;
    }

    // Check if phone matches any registered user database-wide
    const { data: existingUser } = await supabase
      .from('usuarios_clientes')
      .select('id')
      .eq('telefono', regPhone.trim())
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      setAuthError('Este número de teléfono ya está registrado.');
      return;
    }

    setAuthError('');
    const userCreated = await registerUser(regName.trim(), regUsername.trim(), regEmail.trim(), regPhone.trim(), regPassword.trim());
    
    // Set Edit states
    setEditName(userCreated.nombre);
    setEditPhone(userCreated.telefono);
    setEditPassword(userCreated.contrasena);

    // Show credentials reminder modal
    setShowReminderModal({
      nombre: userCreated.nombre,
      email: userCreated.email,
      telefono: userCreated.telefono,
      contrasena: userCreated.contrasena
    });

    // Clear register fields
    setRegName('');
    setRegPhone('');
    setRegPassword('');
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setAuthError('Por favor ingrese su correo electrónico.');
      return;
    }
    const res = await sendPasswordResetEmail(forgotEmail);
    if (res.success) {
      setResetSent(true);
      setAuthError('');
    } else {
      setAuthError(res.error || 'Ocurrió un error al enviar el correo.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logPhone.trim() || !logPassword.trim()) {
      setAuthError('Por favor complete todos los campos.');
      return;
    }

    const loggedUser = await loginUser(logPhone, logPassword);
    if (loggedUser) {
      setAuthError('');
      setLogPhone('');
      setLogPassword('');
      setEditName(loggedUser.nombre);
      setEditPhone(loggedUser.telefono);
      setEditPassword(loggedUser.contrasena);
      setActiveSubTab('orders');
    } else {
      setAuthError('Credenciales incorrectas. Verifique el usuario y contraseña.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim() || !editPhone.trim() || !editPassword.trim()) {
      setAuthError('No se permiten campos vacíos.');
      return;
    }

    updateUser({
      nombre: editName.trim(),
      email: editEmail.trim(),
      telefono: editPhone.trim(),
      contrasena: editPassword.trim()
    });

    // Forzar sincronización de la suscripción Push con el nuevo teléfono
    const syncResult = await syncPushSubscription();
    if (!syncResult.success) {
      addNotification('⚠️ Error Sincronizando Push', syncResult.error!, 'admin');
    }

    setUpdateSuccess(true);
    setShowEditFields(false);
    
    // Show credentials reminder modal for updating too
    setShowReminderModal({
      nombre: editName.trim(),
      email: editEmail.trim(),
      telefono: editPhone.trim(),
      contrasena: editPassword.trim(),
      is_update: true
    });

    setTimeout(() => {
      setUpdateSuccess(false);
    }, 4000);
  };

  // Filter orders related to currently logged user
  const userOrders = currentUser 
    ? orders.filter(o => o.usuario_id === currentUser.id || o.cliente_telefono.trim() === currentUser.telefono.trim()) 
    : [];

  const modalOrder = activeOrderModalId
    ? userOrders.find(o => o.id === activeOrderModalId) || null
    : null;

  // Filter notifications (broadcasts + personales + requests del usuario)
  const userNotifications = currentUser
    ? notifications.filter(n =>
        n.tipo === 'todos' ||
        (n.tipo === 'personal' && n.destinatario_telefono?.trim() === currentUser.telefono.trim()) ||
        (n.tipo === 'request' && n.destinatario_telefono?.trim() === currentUser.telefono.trim())
      )
    : [];

  // Unread notification count
  const unreadCount = userNotifications.filter(n => !n.leida).length;

  // Disparar modal si existe un pedido reciente creado en Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tryOpenModal = () => {
      const storedId = localStorage.getItem('trv_active_order_id');
      if (!storedId) return;

      // Buscar tanto en userOrders (DB) como en orders (Estado global local)
      const exists = orders.find(o => o.id === storedId);
      if (!exists) return;

      setActiveOrderModalId(storedId);
      setShowOrderTimelineModal(true);
    };

    tryOpenModal();

    // si llegan órdenes luego de refrescar, reintentar
  }, [orders]); // Depender del estado global para mayor velocidad

  return (
    <div className="flex flex-col lg:flex-row gap-5 pb-20 lg:pb-6 text-[#1a1c1d] bg-[#f9f9fb] min-h-screen overflow-x-hidden max-w-full mx-auto px-0 lg:px-8 lg:pt-6">
      <SEOHead title={currentUser ? `Mi Cuenta - ${currentUser.nombre}` : "Mi Cuenta"} />

      {/* Pop-up de Instalación Automática (PWA) */}
      {showAutoPopup && deferredPrompt && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-[340px] bg-white rounded-[32px] shadow-2xl border border-[#e4beb1]/10 overflow-hidden mb-16 sm:mb-0"
          >
            <div className="relative h-44 bg-[#eeeef0] overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800" 
                alt={`${config.site_nombre || 'App'} Screenshot`} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/20" />
              <button 
                onClick={() => setShowAutoPopup(false)} 
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer z-20"
              >
                <X size={16} />
              </button>
              <div className="absolute bottom-4 left-6 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg" style={{ backgroundColor: themeColor, color: '#fff' }}>
                App Oficial
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: themeColor, color: '#fff' }}>
                  <Smartphone size={22} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-[15px] font-black text-[#1a1c1d] uppercase tracking-tight">Lleva {config.site_nombre || 'la tienda'} en tu celular</h4>
                  <p className="text-[12px] text-[#8f7065] font-medium leading-tight">Seguimiento en mapa, alertas de pedidos y compras más rápidas.</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-1">
                <button
                  onClick={() => {
                    if (onInstallClick) onInstallClick();
                    setShowAutoPopup(false);
                  }}
                  className="w-full hover:opacity-90 font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 cursor-pointer"
                  style={{ backgroundColor: themeColor, color: '#fff' }}
                >
                  Instalar Ahora
                </button>
                <button
                  onClick={() => setShowAutoPopup(false)}
                  className="w-full bg-transparent text-[#8f7065] hover:text-[#5b4137] font-bold py-1 rounded-xl text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Quizás luego
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delivery Timeline Modal */}
      {showOrderTimelineModal && modalOrder && (
        <OrderTracker
          order={modalOrder}
          onClose={() => {
            if (modalOrder.status !== 'Entregado') {
              // Keep tracking persistent - don't remove from localStorage until delivered
            } else {
              localStorage.removeItem('trv_active_order_id');
            }
            setActiveOrderModalId(null);
            setShowOrderTimelineModal(false);
          }}
          onContinueShopping={() => {
            if (modalOrder.status === 'Entregado') {
              localStorage.removeItem('trv_active_order_id');
            }
            setActiveOrderModalId(null);
            setShowOrderTimelineModal(false);
            setTab('catalog');
          }}
        />
      )}

      {/* Title */}
      <div className="px-4">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider" style={{ color: themeColor }}>{config.site_nombre || 'Mi Cuenta'}</span>
        <h2 className="text-xl font-bold font-display text-[#1a1c1d]">{currentUser ? `Hola, ${currentUser.nombre.split(' ')[0]}` : 'Bienvenido'}</h2>
      </div>

      {/* NOT LOGGED IN ZONE */}
      {!currentUser ? (
        <div className="w-full flex flex-col border border-[#e4beb1]/10 rounded-2xl overflow-hidden shadow-sm mx-4">
          {/* Tabs header */}
          <div className="flex border-b border-[#e4beb1]/10">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); }}
              className={`flex-1 py-3 text-sm font-bold uppercase font-display tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none ${authMode === 'login' || authMode === 'forgot' ? 'text-white font-black' : 'bg-[#f9f9fb] text-[#5b4137] hover:bg-[#eeeef0]'}`}
              style={authMode === 'login' || authMode === 'forgot' ? { backgroundColor: themeColor } : {}}
            >
              <LogIn size={14} /> Entrar
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); setResetSent(false); }}
              className={`flex-1 py-3 text-sm font-bold uppercase font-display tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none ${authMode === 'register' ? 'text-white font-black' : 'bg-[#f9f9fb] text-[#5b4137] hover:bg-[#eeeef0]'}`}
              style={authMode === 'register' ? { backgroundColor: themeColor } : {}}
            >
              <UserPlus size={14} /> Registrarse
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="text-center">
              <p className="text-[12px] text-[#8f7065] leading-relaxed">
                {authMode === 'login' && 'Inicia sesión para ver el estado de tus pedidos y acumular puntos.'}
                {authMode === 'register' && 'Crea tu cuenta para recibir ofertas y seguir tus pedidos.'}
                {authMode === 'forgot' && 'Ingresa tu correo para recuperar tu contraseña.'}
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl text-sm font-semibold text-red-650 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0 text-red-600" />
                <span>{authError}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'login' && !resetSent && (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5 text-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[10px] tracking-wider">
                    <User size={11} style={{ color: themeColor }} /> Email o Usuario
                  </label>
                  <input
                    type="text"
                    required
                    value={logPhone}
                    onChange={(e) => setLogPhone(e.target.value)}
                    placeholder="tu@correo.com o nombre de usuario"
                    className="bg-[#f9f9fb] px-3 py-2.5 border border-[#e4beb1]/10 rounded-xl outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5 relative">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[10px] tracking-wider">
                    <Lock size={11} style={{ color: themeColor }} /> Contraseña
                  </label>
                  <div className="relative w-full">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={logPassword}
                      onChange={(e) => setLogPassword(e.target.value)}
                      placeholder="Tu contraseña..."
                      className="bg-[#f9f9fb] pl-3 pr-10 py-2.5 border border-[#e4beb1]/10 rounded-xl outline-none focus:border-[var(--theme-color,#FF6B35)] w-full text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f7065] hover:text-[#5b4137] transition"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="hover:opacity-90 font-bold font-display uppercase tracking-wider py-3 rounded-xl text-sm mt-2 transition-transform cursor-pointer"
                  style={{ backgroundColor: themeColor, color: '#fff' }}
                >
                  Entrar
                </button>
                
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  className="text-[11px] text-[#8f7065] hover:underline transition-colors font-medium mt-1 text-center"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authMode === 'forgot' && !resetSent && (
              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3.5 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <User size={11} style={{ color: themeColor }} /> Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-[#f9f9fb] px-3 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="hover:opacity-90 font-bold font-display uppercase tracking-wider py-3 rounded-xl text-sm mt-2 transition-transform cursor-pointer" style={{ backgroundColor: themeColor, color: '#fff' }}
                >
                  Enviar Enlace de Recuperación
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[11px] text-[#8f7065] hover:underline transition-colors font-medium mt-1 text-center"
                >
                  Volver al Inicio de Sesión
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <User size={11} style={{ color: themeColor }} /> Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej. Carlos Perez"
                    className="bg-[#f9f9fb] px-3 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <User size={11} style={{ color: themeColor }} /> Usuario (para ingresar)
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Ej. carlos123"
                    className="bg-[#f9f9fb] px-3 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                  <p className="text-[10px] text-[#8f7065] italic">3-20 caracteres: letras, números o guión bajo.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <Mail size={11} style={{ color: themeColor }} /> Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-[#f9f9fb] px-3 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <Phone size={11} style={{ color: themeColor }} /> Telefono (El mismo que usas en el checkout)
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Ej. +584124976451"
                    className="bg-[#f9f9fb] px-3 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm"
                  />
                  <p className="text-[10px] text-[#8f7065] italic">Es muy importante usar el mismo telefono para que tus pedidos se sincronicen automaticamente.</p>
                </div>

                <div className="flex flex-col gap-1.5 relative">
                  <label className="font-bold text-[#5b4137] flex items-center gap-1.5 uppercase font-mono text-[9px] tracking-wider">
                    <Lock size={11} style={{ color: themeColor }} /> Crear Contrasena Secreta
                  </label>
                  <div className="relative w-full">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Crea una contrasena..."
                      className="bg-[#f9f9fb] pl-3 pr-10 py-2 border border-[#e4beb1]/10 rounded-lg outline-none focus:border-[var(--theme-color,#FF6B35)] w-full text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f7065] hover:text-[#5b4137] transition"
                      title={showPassword ? "Ocultar Contrasena" : "Mostrar Contrasena"}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="hover:opacity-90 font-bold font-display uppercase tracking-wider py-3 rounded-xl text-sm mt-2 transition-transform cursor-pointer" style={{ backgroundColor: themeColor, color: '#fff' }}
                >
                  Registrar e Ingresar
                </button>
              </form>
            )}

            {/* Easy credentials reminder banner */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-2.5 text-[10px] sm:text-xs leading-relaxed text-[#5b4137] font-mono">
              <div>
                Tu <strong>Usuario</strong> y tu <strong>Contrasena</strong> seran tus credenciales para seguir tus pedidos en Valencia.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LOGGED IN VIEW */
        <div className="flex flex-col lg:flex-row gap-5 px-4 lg:px-0 w-full">
          {/* LEFT SIDEBAR (Desktop) / TOP CARD (Mobile) */}
          <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-5">
            {/* USER CHROME HEADER AND QUICK STATS */}
            <div className="p-5 border border-[#e4beb1]/10 rounded-2xl bg-white shadow-sm divide-y divide-zinc-200/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full font-bold flex items-center justify-center text-lg shadow-inner" style={{ backgroundColor: themeColor, color: '#fff' }}>
                    {currentUser.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1a1c1d] leading-tight text-sm">
                      {currentUser.nombre}
                    </h3>
                    <p className="text-[12px] text-[#8f7065] font-mono flex items-center gap-1 mt-0.5">
                      <Mail size={11} className="text-[#8f7065]" /> {currentUser.email || currentUser.telefono}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    setTab('home');
                  }}
                  className="bg-white hover:bg-red-50 text-red-500 hover:text-red-700 hover:border-red-300 transition-all border border-[#e4beb1]/10 text-[11px] font-bold uppercase tracking-wider py-1.5 px-2.5 rounded-xl cursor-pointer flex items-center gap-1"
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={11} /> Salir
                </button>
              </div>

              {/* PWA Install Badge */}
              {currentUser.is_pwa_installed && (
                <div className="flex items-center gap-2 text-[11px] font-bold rounded-xl px-3 py-2" style={{ backgroundColor: themeColor + '12', color: themeColor }}>
                  <Smartphone size={13} /> App Instalada — Bonus x1.5 en puntos
                </div>
              )}

              {/* SUB-TABS — Horizontal on mobile, vertical sidebar on desktop */}
              <div className="pt-4 flex lg:flex-col gap-1.5 bg-transparent overflow-x-auto no-scrollbar lg:overflow-x-visible">
                {[
                  { id: 'orders' as const, label: 'Pedidos', icon: Package, count: userOrders.length },
                  { id: 'notifications' as const, label: 'Mensajes', icon: MessageSquare, count: unreadCount },
                  { id: 'promos' as const, label: 'Ofertas', icon: Tag, count: activePromos.length },
                  { id: 'coupons' as const, label: 'Cupones', icon: Gift, count: availableCoupons.length },
                  { id: 'rewards' as const, label: 'Puntos', icon: Star, count: getUserLoyaltyPoints(currentUser.id) },
                  { id: 'profile' as const, label: 'Cuenta', icon: Edit2 },
                ].map(tabItem => (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => { setActiveSubTab(tabItem.id); setShowEditFields(tabItem.id === 'profile'); }}
                    className={`flex-shrink-0 lg:flex-shrink py-2.5 px-3 lg:px-4 rounded-xl text-[11px] font-bold font-display tracking-wider text-left flex items-center justify-start gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      activeSubTab === tabItem.id
                        ? 'text-white shadow-md focus:ring-white/50'
                        : 'text-[#8f7065] bg-white border border-[#e4beb1]/10 hover:bg-[#f9f9fb] focus:ring-zinc-300'
                    }`}
                    style={activeSubTab === tabItem.id ? { backgroundColor: themeColor } : {}}
                  >
                    <tabItem.icon size={14} />
                    <span className="flex-1">{tabItem.label}</span>
                    {tabItem.count !== undefined && tabItem.count > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 text-white" style={{ backgroundColor: (activeSubTab === tabItem.id ? 'rgba(255,255,255,0.3)' : themeColor + 'CC') }}>
                        {tabItem.count > 99 ? '99+' : tabItem.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT AREA */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* EDIT PROFILE FIELDS CONTAINER */}
          {activeSubTab === 'profile' && showEditFields && (
            <div className="p-5 border border-[#e4beb1]/10 rounded-2xl bg-white flex flex-col gap-4 text-sm">
              <h3 className="text-sm font-bold font-display text-[#1a1c1d] border-b border-[#e4beb1]/10 pb-3">Editar Datos de Perfil</h3>
              
              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-[#5b4137] text-[12px]">Nombre Completo</span>
                  <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-[#5b4137] text-[12px]">Correo Electrónico</span>
                  <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-[#5b4137] text-[12px]">Teléfono</span>
                  <input type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl px-3 py-2.5 outline-none focus:border-[var(--theme-color,#FF6B35)] text-sm" />
                </div>
                <div className="flex flex-col gap-1.5 relative">
                  <span className="font-semibold text-[#5b4137] text-[12px]">Contraseña</span>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl pl-3 pr-10 py-2.5 outline-none focus:border-[var(--theme-color,#FF6B35)] w-full text-sm" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f7065] hover:text-[#5b4137]">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="hover:opacity-90 font-bold py-3 rounded-xl text-sm tracking-wider transition-all uppercase font-display cursor-pointer active:scale-[0.98]" style={{ backgroundColor: themeColor, color: '#fff' }}>
                  Guardar Cambios
                </button>
              </form>
            </div>
          )}

          {/* ACTIVE TAB CONTENT Area: ORDERS */}
          {activeSubTab === 'orders' && (
            <ClientePanelPedidos />
          )}
          {/* ═══ NOTIFICACIONES / MENSAJES ═══ */}
          {activeSubTab === 'notifications' && (
            <div className="flex flex-col gap-4 text-sm px-0">
              {/* Push Notifications Settings */}
              <div className="p-4 border rounded-2xl relative overflow-hidden flex flex-col gap-3" style={{ borderColor: themeColor + '30', backgroundColor: themeColor + '08' }}>
                <div className="flex gap-2.5 items-start">
                  <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                    <Bell size={16} />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <h4 className="font-bold text-zinc-950 text-sm">Avisos en tu celular</h4>
                    <p className="text-[12px] text-[#5b4137] leading-relaxed">
                      Recibe avisos de pedidos y ofertas directamente en tu pantalla.
                    </p>
                  </div>
                </div>
                {notificationPermission === 'default' && (
                  <button onClick={requestNotificationPermission} className="w-full font-bold py-2.5 px-3 rounded-xl text-[12px] uppercase tracking-wider transition-all cursor-pointer active:scale-[0.98]" style={{ backgroundColor: themeColor, color: '#fff' }}>
                    Activar Notificaciones
                  </button>
                )}
                {notificationPermission === 'granted' && (
                  <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: themeColor }}>
                    <CheckCircle size={12} /> Notificaciones activas
                  </div>
                )}
              </div>

              {/* Chat-style message list */}
              <div className="flex flex-col gap-0.5">
                {userNotifications.length === 0 ? (
                  <div className="text-center py-12 mx-4 bg-white border border-[#e4beb1]/10 rounded-2xl flex flex-col items-center gap-2">
                    <MessageSquare size={32} className="text-zinc-300" />
                    <p className="font-semibold text-[#5b4137] text-sm">Sin mensajes nuevos</p>
                    <p className="text-[12px] text-[#8f7065] max-w-[240px] leading-relaxed">
                      Aquí verás avisos de tus pedidos y ofertas de {config.site_nombre}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end px-4 mb-1">
                      <button onClick={() => setDeleteAllConfirm(true)} className="flex items-center gap-1 text-[11px] text-red-500 font-bold">
                        <Trash2 size={11} /> Borrar todo
                      </button>
                    </div>
                    {deleteAllConfirm && (
                      <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2">
                        <span className="text-xs text-red-700">Borrar todos los mensajes?</span>
                        <div className="flex gap-1">
                          <button onClick={() => { clearAllNotifications(); setDeleteAllConfirm(false); }} className="text-[10px] font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg">Si</button>
                          <button onClick={() => setDeleteAllConfirm(false)} className="text-[10px] font-bold text-red-500 bg-red-100 px-3 py-1.5 rounded-lg">No</button>
                        </div>
                      </div>
                    )}
                    {userNotifications.map((notif) => {
                      const isFromStore = notif.tipo === 'todos' || notif.tipo === 'personal';
                      return (
                        <div key={notif.id} className={`flex ${isFromStore ? 'justify-start' : 'justify-end'} px-4 py-1`}>
                          <div
                            onClick={() => { registerNotificationClick(notif.id); setSelectedNotification(notif); }}
                            className={`max-w-[85%] p-3 rounded-2xl relative cursor-pointer transition-all ${
                              isFromStore
                                ? 'bg-white border border-[#e4beb1]/10 rounded-tl-sm shadow-xs'
                                : 'text-white rounded-tr-sm shadow-md'
                            }`}
                            style={!isFromStore ? { backgroundColor: themeColor } : {}}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold" style={{ color: isFromStore ? themeColor : 'rgba(255,255,255,0.8)' }}>
                                {notif.tipo === 'todos' ? config.site_nombre : notif.tipo === 'request' ? 'Tú' : config.site_nombre}
                              </span>
                              {!notif.leida && isFromStore && (
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
                              )}
                            </div>
                            {notif.titulo && <p className={`font-bold text-[13px] mb-0.5 ${isFromStore ? 'text-[#1a1c1d]' : 'text-white'}`}>{notif.titulo}</p>}
                            <p className={`text-[13px] leading-relaxed ${isFromStore ? 'text-[#5b4137]' : 'text-white/90'}`}>{notif.mensaje}</p>
                            <p className={`text-[10px] mt-1 font-mono ${isFromStore ? 'text-[#8f7065]' : 'text-white/60'}`}>{notif.fecha}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Chat input - Send message to business */}
              <div className="p-4 border border-[#e4beb1]/10 bg-white rounded-2xl flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                    <Send size={14} />
                  </div>
                  <h4 className="font-bold text-[#1a1c1d] text-sm">Escribir a {config.site_nombre}</h4>
                </div>
                <div className="flex gap-2">
                  <input
                    value={directMsg}
                    onChange={(e) => setDirectMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && directMsg.trim()) {
                        requestPart(currentUser?.nombre || '', currentUser?.telefono || '', directMsg.trim()).then(ok => { if (ok) setDirectMsg(''); });
                      }
                    }}
                    className="flex-1 text-[13px] p-3 border border-[#e4beb1]/10 rounded-xl bg-[#f9f9fb] focus:outline-none focus:border-zinc-400"
                    placeholder="Escribe tu mensaje..."
                  />
                  <button
                    onClick={async () => {
                      if (directMsg.trim()) {
                        const ok = await requestPart(currentUser?.nombre || '', currentUser?.telefono || '', directMsg.trim());
                        if (ok) setDirectMsg('');
                      }
                    }}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 transition-transform active:scale-95"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Send size={16} />
                  </button>
            </div>
          </div>
        </div>
      )}
        </div>

          {/* ═══ PROMOCIONES / OFERTAS ═══ */}
          {activeSubTab === 'promos' && (
            <div className="flex flex-col gap-4 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1c1d] text-sm">Ofertas Activas</h3>
                  <p className="text-[11px] text-[#8f7065]">{activePromos.length} oferta{activePromos.length !== 1 ? 's' : ''} disponible{activePromos.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {activePromos.length === 0 ? (
                <div className="text-center py-12 bg-white border border-[#e4beb1]/10 rounded-2xl flex flex-col items-center gap-2">
                  <Tag size={32} className="text-zinc-300" />
                  <p className="font-semibold text-[#5b4137] text-sm">No hay ofertas ahora</p>
                  <p className="text-[12px] text-[#8f7065]">Vuelve pronto para ver nuevas promociones.</p>
                </div>
              ) : (
                activePromos.map(promo => (
                  <div key={promo.id} className="bg-white border border-[#e4beb1]/10 rounded-2xl overflow-hidden shadow-sm">
                    {promo.image_url && (
                      <div className="h-32 bg-[#eeeef0] overflow-hidden">
                        <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-[#1a1c1d] text-sm">{promo.title}</h4>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg text-white shrink-0" style={{ backgroundColor: themeColor }}>
                          {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : promo.discount_type === '2x1' ? '2x1' : promo.discount_type === 'fixed' ? `$${promo.discount_value} OFF` : promo.discount_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#5b4137] leading-relaxed mb-3">{promo.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#8f7065] font-mono">Válido hasta {new Date(promo.end_date).toLocaleDateString('es-VE')}</span>
                        {promo.coupon_code && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(promo.coupon_code!); showToast('success', 'Coupon copiado: ' + promo.coupon_code); }}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95"
                            style={{ borderColor: themeColor, color: themeColor }}
                          >
                            <Copy size={11} /> {promo.coupon_code}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ CUPONES DISPONIBLES ═══ */}
          {activeSubTab === 'coupons' && (
            <div className="flex flex-col gap-4 px-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                  <Gift size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1c1d] text-sm">Mis Cupones</h3>
                  <p className="text-[11px] text-[#8f7065]">{availableCoupons.length} cupón{availableCoupons.length !== 1 ? 'es' : ''} disponible{availableCoupons.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {availableCoupons.length === 0 ? (
                <div className="text-center py-12 bg-white border border-[#e4beb1]/10 rounded-2xl flex flex-col items-center gap-2">
                  <Gift size={32} className="text-zinc-300" />
                  <p className="font-semibold text-[#5b4137] text-sm">No hay cupones disponibles</p>
                  <p className="text-[12px] text-[#8f7065]">Sigue pidiendo para recibir cupones de descuento.</p>
                </div>
              ) : (
                availableCoupons.map(coupon => (
                  <div key={coupon.id} className="bg-white border-2 border-dashed rounded-2xl p-4 relative overflow-hidden" style={{ borderColor: themeColor + '60' }}>
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: themeColor + '10' }} />
                    <div className="flex flex-col items-center text-center gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: themeColor }}>Cupón de Descuento</p>
                      <p className="text-3xl font-black" style={{ color: themeColor }}>{coupon.discount_percent}%</p>
                      <p className="text-[11px] text-[#8f7065] font-bold">de descuento</p>
                      <div className="bg-[#eeeef0] border border-[#e4beb1]/10 rounded-xl px-4 py-2 font-mono text-lg font-black tracking-wider text-[#1a1c1d]">
                        {coupon.code}
                      </div>
                      {coupon.description && <p className="text-[12px] text-[#8f7065]">{coupon.description}</p>}
                      {coupon.valid_until && (
                        <p className="text-[10px] text-[#8f7065] font-mono">Válido hasta {new Date(coupon.valid_until).toLocaleDateString('es-VE')}</p>
                      )}
                      <button
                        onClick={() => { navigator.clipboard.writeText(coupon.code); showToast('success', 'Coupon copiado: ' + coupon.code); }}
                        className="w-full font-bold py-2.5 rounded-xl text-[12px] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: themeColor, color: '#fff' }}
                      >
                        <Copy size={12} /> Copiar Código
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ MIS PUNTOS / RECOMPENSAS ═══ */}
          {activeSubTab === 'rewards' && currentUser && (
            <div className="px-4">
              <LoyaltyWidget themeColor={themeColor} />
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATION DETAIL MODAL */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-md bg-white border border-[#e4beb1]/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-5 text-white flex items-start justify-between gap-3" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}DD)` }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Mail size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    {selectedNotification.titulo}
                  </h3>
                  <p className="text-[11px] text-white/80 mt-0.5 font-mono">
                    {selectedNotification.fecha}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="text-white/90 hover:text-white transition cursor-pointer rounded-lg p-1.5 bg-white/10 border border-white/15"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs text-[#1a1c1d]">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                {selectedNotification.tipo === 'personal' && (
                  <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded font-mono font-bold tracking-tight uppercase">Personal</span>
                )}
                {selectedNotification.tipo === 'todos' && (
                  <span className="text-[10px] bg-violet-50 border border-violet-200 text-violet-600 px-2 py-0.5 rounded font-mono font-bold tracking-tight uppercase">Promo</span>
                )}
                {selectedNotification.tipo === 'request' && (
                  <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded font-mono font-bold tracking-tight uppercase">Solicitud</span>
                )}
                {selectedNotification.leida ? (
                  <span className="text-[10px] bg-green-50 border border-green-200 text-green-600 px-2 py-0.5 rounded font-mono font-bold">Leída</span>
                ) : (
                  <span className="text-[10px] bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded font-mono font-bold">No leída</span>
                )}
              </div>

              {/* Full message content */}
              <div className="p-4 bg-[#f9f9fb]/60 border border-[#e4beb1]/10 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f7065] font-mono block mb-2">
                  Mensaje completo
                </span>
                <p className="text-[12px] text-[#5b4137] leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedNotification.mensaje}
                </p>
              </div>

              {/* Link */}
              {selectedNotification.link_url && (
                <a
                  href={selectedNotification.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-violet-700 text-[11px] font-bold hover:bg-violet-100 transition-colors"
                >
                  <ExternalLink size={14} /> Ver enlace adjunto
                </a>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!selectedNotification.leida && (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationAsRead(selectedNotification.id);
                      setSelectedNotification({ ...selectedNotification, leida: true });
                    }}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-3 rounded-lg text-[11px] transition-colors cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={14} /> Marcar leída
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteSingleConfirm(selectedNotification.id)}
                  className="flex-1 bg-white hover:bg-[#f9f9fb] border border-[#e4beb1]/10 text-rose-600 font-bold py-2.5 px-3 rounded-lg text-[11px] transition-colors cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Borrar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {deleteSingleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-md animate-fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
            <p className="text-sm text-[#4a3728] font-semibold mb-4">Borrar este mensaje?</p>
            <div className="flex gap-2">
              <button onClick={() => { deleteNotification(deleteSingleConfirm); setSelectedNotification(null); setDeleteSingleConfirm(null); }} className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs">Si, borrar</button>
              <button onClick={() => setDeleteSingleConfirm(null)} className="flex-1 bg-gray-100 text-[#4a3728] font-bold py-2.5 rounded-xl text-xs">Cancelar</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CREDENTIALS REMINDER DIALOG (MANDATORY REQUIREMENT) */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-[#e4beb1]/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-[#1a1c1d] border-t-4 border-t-violet-600 scale-100 transition-all">
            
            {/* Header section with modern background */}
            <div className="p-5 text-center flex flex-col items-center bg-[#f9f9fb] border-b border-[#e4beb1]/10">
              <div className="w-12 h-12 bg-violet-500/10 text-violet-600 border border-violet-500/20 rounded-full flex items-center justify-center mb-3 text-2xl shrink-0 animate-bounce">
              </div>
              <h4 className="text-sm font-black font-display uppercase tracking-wider text-violet-950 leading-tight">
                {showReminderModal.is_update ? '¡Perfil Actualizado!' : '¡Registro Completado con Éxito!'}
              </h4>
              <p className="text-[11px] text-[#8f7065] mt-2 leading-relaxed">
                {showReminderModal.is_update 
                  ? 'Has modificado tus datos de acceso. Guarda o anota tus nuevas credenciales para evitar inconvenientes en tus inicios de sesión futuros:'
                  : 'Para asegurar la seguridad de tu cuenta y el rastreo de tus pedidos, toma nota y guarda tus credenciales ahora.'}
              </p>
            </div>

            {/* Credential display grid and copy elements */}
            <div className="p-5 flex flex-col gap-3.5 bg-white">
              
              {/* BRAND / HEADER */}
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] font-extrabold text-violet-600 bg-violet-50/50 py-1 px-2.5 rounded-md border border-violet-100/30 text-center">
                Club de Clientes de {config.site_nombre || 'la tienda'}
              </div>

              {/* 1. NAME CREDENTIAL */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#f9f9fb] border border-[#e4beb1]/10 transition-all hover:bg-[#eeeef0]/50">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase font-mono tracking-wider text-[#8f7065]">
                  <span className="flex items-center gap-1">Nombre / Usuario</span>
                  {copiedName && <span className="text-violet-600 font-extrabold flex items-center gap-0.5 animate-pulse">¡Copiado!</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-[#1a1c1d] truncate leading-none">
                    {showReminderModal.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(showReminderModal.nombre, 'name')}
                    className="p-1.5 rounded-lg text-[#8f7065] hover:text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-90"
                    title="Copiar nombre"
                  >
                    {copiedName ? <Check size={13} className="text-violet-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* 2. PHONE CREDENTIAL */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#f9f9fb] border border-[#e4beb1]/10 transition-all hover:bg-[#eeeef0]/50">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase font-mono tracking-wider text-[#8f7065]">
                  <span className="flex items-center gap-1">Telefono de Acceso</span>
                  {copiedPhone && <span className="text-violet-600 font-extrabold flex items-center gap-0.5 animate-pulse">¡Copiado!</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-[#1a1c1d] truncate leading-none">
                    {showReminderModal.telefono}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(showReminderModal.telefono, 'phone')}
                    className="p-1.5 rounded-lg text-[#8f7065] hover:text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-90"
                    title="Copiar teléfono"
                  >
                    {copiedPhone ? <Check size={13} className="text-violet-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* 2b. EMAIL CREDENTIAL */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#f9f9fb] border border-[#e4beb1]/10 transition-all hover:bg-[#eeeef0]/50">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase font-mono tracking-wider text-[#8f7065]">
                  <span className="flex items-center gap-1">Correo Electrónico</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-[#1a1c1d] truncate leading-none">
                    {showReminderModal.email || 'Sin correo'}
                  </span>
                </div>
              </div>

              {/* 3. PASSWORD CREDENTIAL */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#f9f9fb] border border-[#e4beb1]/10 transition-all hover:bg-[#eeeef0]/50">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase font-mono tracking-wider text-[#8f7065]">
                  <span className="flex items-center gap-1">Clave Secreta</span>
                  <div className="flex items-center gap-2">
                    {copiedPassword && <span className="text-violet-600 font-extrabold flex items-center gap-0.5 animate-pulse">¡Copiado!</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-violet-600 truncate leading-none">
                    {showReminderPassword ? showReminderModal.contrasena : '••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowReminderPassword(!showReminderPassword)}
                      className="p-1.5 rounded-lg text-[#8f7065] hover:text-zinc-850 hover:bg-[#e2e2e4]/60 border border-transparent transition-all cursor-pointer flex items-center justify-center active:scale-90"
                      title={showReminderPassword ? "Ocultar Contrasena" : "Mostrar Contrasena"}
                    >
                      {showReminderPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(showReminderModal.contrasena, 'password')}
                      className="p-1.5 rounded-lg text-[#8f7065] hover:text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-all cursor-pointer flex items-center justify-center active:scale-90"
                      title="Copiar contraseña"
                    >
                      {copiedPassword ? <Check size={13} className="text-violet-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. EXPORT ALL BUTTON */}
              <button
                type="button"
                onClick={() => handleCopyText(
`MIS CREDENCIALES DE MARKETO:
======================================
Cliente/Usuario: ${showReminderModal.nombre}
Correo Electrónico: ${showReminderModal.email || 'Sin correo'}
Teléfono Móvil: ${showReminderModal.telefono}
Contraseña/Clave: ${showReminderModal.contrasena}
======================================
*Nota: Nunca compartas estos datos con extraños.`, 'all')}
                className={`w-full py-2 px-3 rounded-xl border border-dashed text-xs font-bold font-mono text-center flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                  copiedAll 
                    ? 'bg-violet-50 text-violet-700 border-violet-300' 
                    : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200 hover:border-violet-400'
                }`}
              >
                {copiedAll ? (
                  <>
                    <Check size={14} className="text-violet-600" />
                    <span>¡Todas las credenciales copiadas!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar todas mis credenciales</span>
                  </>
                )}
              </button>

              {/* SECURITY NOTICE METRIC */}
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-[10px] leading-relaxed text-[#5b4137] font-medium">
                <div>
                  <strong>Aviso de Privacidad:</strong> Estas credenciales se guardan localmente para tu comodidad. Escríbelas en una libreta segura. Tu teléfono registrado es fundamental para vincular tus pedidos automáticamente.
                </div>
              </div>

            </div>

            {/* BUTTON MAIN ACCENT DISMISS */}
            <div className="p-5 bg-[#f9f9fb] border-t border-[#e4beb1]/10 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowReminderModal(null);
                  setShowReminderPassword(false);
                }}
                className="w-full bg-[#1a1c1d] hover:bg-[#2a2c2d] text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer text-center hover:scale-[1.01] active:scale-95 shadow-md"
              >
                Comprendido, He Seguro Anotado los Datos
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
