import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Checkout } from './pages/Checkout';
import Admin from './pages/admin/index';
import { UserProfile } from './pages/UserProfile';
import { NotFound } from './pages/NotFound';
import { Navigation } from './components/Navigation';
import { BottomNav } from './components/BottomNav';
import { FoodItem } from './types/store';
import { PushNotificationModal } from './components/PushNotificationModal';
import { X } from 'lucide-react';
import { SEOHead } from './components/SEOHead';
import { OfflineBanner } from './components/OfflineBanner';
import { FreeDeliveryBar } from './components/FreeDeliveryBar';
import { ProductModal } from './components/ProductModal';
import { SplashScreen } from './components/SplashScreen';

import { ToastProvider, useToast } from './components/Toast';

import { SkeletonHome, SkeletonCatalog, SkeletonCheckout, SkeletonProfile } from './components/Skeletons';

interface BeforeInstallPromptEvent {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

interface ManifestIcon {
  src: string;
}

interface ManifestShortcut {
  url?: string;
  icons?: ManifestIcon[];
}

interface WebAppManifest {
  icons: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
  start_url?: string;
  scope?: string;
  id?: string;
  theme_color?: string;
  background_color?: string;
  name?: string;
  short_name?: string;
}

function AppContent() {
  const { cart, config, addToCart, authenticateAdmin, isGlobalLoading, isAdminAuthenticated, currentUser, markUserAsPwaInstalled, isDarkMode } = useApp();
  const { showToast } = useToast();

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSplash, setShowSplash] = useState(true);


  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      localStorage.setItem('foodapp_pwa_installed', 'true');
      if (currentUser) {
        markUserAsPwaInstalled(currentUser.id);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Detectar si ya está instalada como PWA (display-mode: standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true) {
      localStorage.setItem('foodapp_pwa_installed', 'true');
      if (currentUser && !currentUser.is_pwa_installed) {
        markUserAsPwaInstalled(currentUser.id);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [currentUser, markUserAsPwaInstalled]);

  // Aplicar font_display y theme_color dinámicamente al CSS
  useEffect(() => {
    const fontName = config.font_display || 'Fredoka';
    document.documentElement.style.setProperty('--font-display', `"${fontName}", sans-serif`);
  }, [config.font_display]);

  useEffect(() => {
    if (config.theme_color) {
      document.documentElement.style.setProperty('--pop-orange', config.theme_color);
      document.documentElement.style.setProperty('--theme-color', config.theme_color);
      document.documentElement.style.setProperty('--primary-container', config.theme_color);
    }
    if (config.secondary_color) {
      document.documentElement.style.setProperty('--secondary-color', config.secondary_color);
    }
    if (config.accent_color) {
      document.documentElement.style.setProperty('--accent-color', config.accent_color);
    }
  }, [config.theme_color, config.secondary_color, config.accent_color]);

  // Actualizar manifest, meta tags e iconos dinamicamente cuando el admin cambia config
  useEffect(() => {
    if (!config.theme_color && !config.pwa_icon_url && !config.site_nombre) return;

    // Update theme-color meta
    if (config.theme_color) {
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', config.theme_color);
      document.body.style.backgroundColor = config.theme_color;
    }

    // Update apple-touch-icon
    const appleTouchUrl = config.pwa_icon_url || config.logo_url || config.favicon_url || '/icon.png';
    const appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (appleLink) appleLink.setAttribute('href', appleTouchUrl);

    // Rebuild manifest blob URL with current config
    const manifestLink = document.getElementById('pwa-manifest') as HTMLLinkElement | null;
    if (manifestLink && config.pwa_icon_url) {
      const isOnAdmin = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/admin');
      const baseManifestUrl = isOnAdmin ? './manifest-admin.json' : './manifest.json';
      const origin = window.location.origin;
      fetch(baseManifestUrl).then(r => r.json()).then((baseManifest: WebAppManifest) => {
        baseManifest.icons = baseManifest.icons.map((icon: ManifestIcon) => ({
          ...icon,
          src: config.pwa_icon_url,
        } as ManifestIcon));
        if (baseManifest.start_url && !baseManifest.start_url.startsWith('http')) {
          baseManifest.start_url = origin + baseManifest.start_url;
        }
        if (baseManifest.scope && !baseManifest.scope.startsWith('http')) {
          baseManifest.scope = origin + baseManifest.scope;
        }
        if (baseManifest.id && !baseManifest.id.startsWith('http')) {
          baseManifest.id = origin + baseManifest.id;
        }
        if (baseManifest.shortcuts) {
          baseManifest.shortcuts = baseManifest.shortcuts.map((s: ManifestShortcut) => ({
            ...s,
            url: s.url && !s.url.startsWith('http') ? origin + s.url : s.url,
            icons: s.icons ? s.icons.map((ic: ManifestIcon) => ({
              ...ic,
              src: ic.src && !ic.src.startsWith('http') && !ic.src.startsWith('data:') ? origin + ic.src : ic.src,
            })) : s.icons,
          }));
        }
        if (config.theme_color) {
          baseManifest.theme_color = config.theme_color;
          baseManifest.background_color = config.theme_color;
        }
        if (config.site_nombre) {
          baseManifest.name = config.site_nombre;
          baseManifest.short_name = config.site_nombre.substring(0, 12);
        }
        const blob = new Blob([JSON.stringify(baseManifest)], { type: 'application/json' });
        manifestLink.href = URL.createObjectURL(blob);
      }).catch(() => {});
    }

    // Clear image caches so new logo displays immediately
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('images') || name.includes('supabase') || name.includes('manifest')) {
            caches.delete(name);
          }
        });
      });
    }
  }, [config.theme_color, config.pwa_icon_url, config.splash_logo_url, config.site_nombre, config.logo_url, config.favicon_url]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Route/Tab controllers - si es admin/operador autenticado O si la URL es /admin, abrir directo en su panel
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isAdminUrl = pathname.startsWith('/admin') || pathname.startsWith('/admin');
  const isHome = pathname === '/' || pathname === '/coffe' || pathname === '/' || pathname === '';
  const is404Url = !isHome && !isAdminUrl;
  const [tab, setTab] = useState<'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout'>((isAdminAuthenticated || isAdminUrl) ? 'admin' : 'home');
  const [is404, setIs404] = useState(is404Url);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Custom Overlays & Modals
  const [selectedProductDetails, setSelectedProductDetails] = useState<FoodItem | null>(null);

  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminUserInput, setAdminUserInput] = useState('');

  const resetAllFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setGlobalSearch('');
  };

  // Sync URL with tab state
  useEffect(() => {
    const currentPath = window.location.pathname;
    const targetPath = tab === 'admin' ? '/admin' : '/';
    if (currentPath !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [tab]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const isNowAdmin = path.startsWith('/admin') || path.startsWith('/admin');
      const isNowHome = path === '/' || path === '/coffe' || path === '/' || path === '';
      if (isNowAdmin) {
        setTab('admin');
        setIs404(false);
      } else if (!isNowHome) {
        setIs404(true);
      } else {
        setTab('home');
        setIs404(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Helper: si ya está autenticado, ir directo al admin; si no, abrir modal
  const handleAdminAccess = () => {
    if (isAdminAuthenticated) {
      setTab('admin');
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  // Authentication trigger helper - admin o operador
  const handleAdminVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await authenticateAdmin(adminUserInput, adminPasswordInput);
    if (success) {
      setTab('admin');
      setIsAdminLoginOpen(false);
      setAdminPasswordInput('');
      setAdminUserInput('');
    } else {
      showToast('error', 'Credenciales incorrectas o sin permisos de administracion');
    }
  };

  // Header / Navigation helpers
  const navigateToCatalog = (filters?: { category?: string }) => {
    if (filters?.category !== undefined) setSelectedCategory(filters.category);
    setTab('catalog');
  };

  if (isGlobalLoading) {
    const skeletonMap: Record<string, React.ReactNode> = {
      home: <SkeletonHome />,
      catalog: <SkeletonCatalog />,
      checkout: <SkeletonCheckout />,
      profile: <SkeletonProfile />,
      admin: <SkeletonHome />,
    };
    return (
      <div className={`min-h-screen w-full flex justify-center ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: isDarkMode ? '#0f0f1a' : '#f9f9fb', color: isDarkMode ? '#e8e8f0' : '#1a1c1d' }}>
        <div className="w-full">
          {skeletonMap[tab] || <SkeletonHome />}
        </div>
      </div>
    );
  }

    return (
      <div className={`min-h-screen w-full flex justify-center transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: isDarkMode ? '#0f0f1a' : '#f9f9fb', color: isDarkMode ? '#e8e8f0' : '#1a1c1d' }}>
        {showSplash && <SplashScreen config={config} onComplete={() => setShowSplash(false)} />}
        <SEOHead />
        <OfflineBanner />
        <PushNotificationModal />

        <div className="w-full flex flex-col min-h-screen relative" style={{ backgroundColor: isDarkMode ? '#0f0f1a' : '#f9f9fb' }}>

        {/* ═══ HEADER DE TIENDA - oculto en panel admin ═══ */}
        {tab !== 'admin' && (
          <>
            <Navigation
              currentTab={tab}
              setTab={setTab}
              drawerOpen={drawerOpen}
              setDrawerOpen={setDrawerOpen}
              navigateToCatalog={navigateToCatalog}
            />
            <div className={tab === 'catalog' ? 'lg:h-16' : 'h-14 lg:h-16'} />
            <FreeDeliveryBar currentTotal={cart.reduce((sum, item) => sum + item.item.precio_usd * item.quantity, 0)} threshold={config.delivery_gratis_threshold || 0} themeColor={config.theme_color || '#FF2D95'} />
          </>
        )}

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <main className="flex-1 overflow-y-auto w-full pb-14 lg:pb-0">
          {tab === 'home' && (
            <Home
              setTab={setTab}
              setSelectedCategory={setSelectedCategory}
              setSelectedSubcategory={setSelectedSubcategory}
              onViewProductDetails={setSelectedProductDetails}
              globalSearch={globalSearch}
              setGlobalSearch={setGlobalSearch}
              navigateToCatalog={navigateToCatalog}
              deferredPrompt={deferredPrompt}
              onInstallClick={handleInstallClick}
              onAdminClick={handleAdminAccess}
              isAdminAuthenticated={isAdminAuthenticated}
            />
          )}

          {tab === 'catalog' && (
            <Catalog
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedSubcategory={selectedSubcategory}
              setSelectedSubcategory={setSelectedSubcategory}
              onViewProductDetails={setSelectedProductDetails}
              passedSearchTerm={globalSearch}
              clearPassedSearchTerm={() => setGlobalSearch('')}
              resetGlobalFilters={resetAllFilters}
              setTab={setTab}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
          )}

          {tab === 'checkout' && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center lg:p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTab('home')} />
              <div className="relative w-full max-w-lg bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl max-h-[92vh] lg:max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-center pt-3 pb-1 lg:hidden"><div className="w-10 h-1 rounded-full bg-zinc-300" /></div>
                <button type="button" onClick={() => setTab('home')} className="absolute top-3 right-3 z-20 w-8 h-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center cursor-pointer"><X size={14} className="text-zinc-500" /></button>
                <Checkout setTab={setTab} onClose={() => setTab('home')} />
              </div>
            </div>
          )}

          {tab === 'admin' && (
            <Admin setTab={setTab} />
          )}

          {tab === 'profile' && (
            <UserProfile setTab={setTab} deferredPrompt={deferredPrompt} onInstallClick={handleInstallClick} />
          )}

          {is404 && (
            <NotFound onGoHome={() => { window.history.pushState({}, '', '/'); setTab('home'); setIs404(false); }} />
          )}
        </main>

        {/* ═══ MOBILE BOTTOM NAV - oculto en panel admin ═══ */}
        {tab !== 'admin' && <BottomNav currentTab={tab} setTab={setTab} />}

        {/* ═══ PRODUCT MODAL ═══ */}
        <ProductModal
          product={selectedProductDetails}
          isOpen={!!selectedProductDetails}
          onClose={() => { setSelectedProductDetails(null); }}
          onAddToCart={(item, qty, opts, total, removed) => {
            addToCart(item, qty || 1, opts || [], total || 0, removed || []);
            setSelectedProductDetails(null);
          }}
          onGoToCheckout={() => { setSelectedProductDetails(null); setTab('checkout'); }}
        />

        {/* ═══ ADMIN LOGIN MODAL ═══ */}
        {isAdminLoginOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-lg p-5 relative shadow-2xl flex flex-col gap-4 text-zinc-900">
              <button
                type="button"
                onClick={() => setIsAdminLoginOpen(false)}
                className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 p-1 rounded-lg"
              >
                <X size={14} />
              </button>

              <div className="text-center flex flex-col items-center">
                <span className="text-2xl p-2 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-2xl mb-2">🔑</span>
                <h4 className="text-sm font-bold font-display text-zinc-800 uppercase tracking-wider">Acceso al Panel</h4>
                <p className="text-[10px] text-zinc-500 mt-1 leading-normal max-w-[240px]">Ingresa las credenciales de administrador u operador para acceder al panel.</p>
              </div>

              <form onSubmit={handleAdminVerifySubmit} className="flex flex-col gap-3.5 text-xs text-zinc-900">
                <div className="flex flex-col gap-1.5">
                  <span>Correo Electrónico *</span>
                  <input
                    type="email"
                    required
                    value={adminUserInput}
                    onChange={(e) => setAdminUserInput(e.target.value)}
                    placeholder="Ingrese correo electrónico..."
                    className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-center text-sm tracking-wider font-mono text-blue-600 font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span>Contraseña *</span>
                  <input
                    type="password"
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Ingrese clave..."
                    className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-center text-sm tracking-wider font-mono text-blue-600 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminLoginOpen(false)}
                    className="bg-zinc-100 hover:bg-zinc-200 py-2 rounded-lg text-zinc-800 border border-zinc-200 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold font-display tracking-wide uppercase cursor-pointer"
                  >
                    INGRESAR
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppProvider>
  );
}
