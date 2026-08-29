import React, { useState } from 'react';
import {
  Home, ShoppingCart, Menu, X, MapPin, User, MessageCircle,
  LogOut, ChevronRight, UtensilsCrossed, Sun, Moon,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getWhatsAppPhone, waLink } from '../utils/phone';
import { CATEGORY_ICON_MAP, DEFAULT_CATEGORY_ICON } from '../utils/categoryIcons';

interface NavigationProps {
  currentTab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' | 'mesa_checkout';
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout' | 'mesa_checkout') => void;
  drawerOpen: boolean;
  setDrawerOpen: (value: boolean) => void;
  navigateToCatalog?: (filters?: { category?: string }) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  setTab,
  drawerOpen,
  setDrawerOpen,
  navigateToCatalog,
}) => {
  const { cart, config, currentUser, logoutUser, isDarkMode, toggleDarkMode } = useApp();
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const themeColor = config.theme_color || '#A4D045';
  const categories = config.categories || [];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hideMobileHeader = currentTab === 'catalog';

  const handleCategoryClick = (cat: string) => {
    if (navigateToCatalog) {
      navigateToCatalog({ category: cat });
    } else {
      setTab('catalog');
    }
    setSidebarOpen(false);
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          DESKTOP HEADER — Luminous Electric glassmorphic
          ═══════════════════════════════════════════════════════════ */}
      <header
        className="hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 items-center transition-all duration-300"
        style={{
          background: isDarkMode 
            ? `${themeColor}E6`
            : `${themeColor}CC`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-8 h-full">

          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer active:scale-95"
              aria-label="Abrir menú de categorías"
              style={{ color: '#fff' }}
            >
              <Menu size={22} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => setTab('home')}
              className="flex items-center gap-3 shrink-0 cursor-pointer group"
            >
              {config.logo_url ? (
                <img src={config.logo_url} alt={config.site_nombre || 'Market Coffee Sweet'} className="h-[85px] w-auto max-w-[200px] object-contain" />
              ) : (
                <h1
                  className="text-xl font-extrabold tracking-tighter"
                  style={{ color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {config.site_nombre || 'Market Coffee Sweet'}
                </h1>
              )}
            </button>
          </div>

          {/* Right: Dark Mode Toggle + Sign In + Cart */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer"
              aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDarkMode ? <Sun size={20} className="text-amber-300" /> : <Moon size={20} className="text-white" style={{ color: '#ffffff' }} />}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('profile')}
                  className="text-[13px] font-semibold tracking-wide text-white/80 hover:text-white transition-colors cursor-pointer rounded-full px-3 py-1.5"
                >
                  HOLA, {currentUser.nombre.split(' ')[0].toUpperCase()}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTab('profile')}
                className="text-[13px] font-semibold tracking-wide text-white/80 hover:text-white transition-colors cursor-pointer rounded-full px-3 py-1.5"
              >
                INICIAR SESIÓN
              </button>
            )}

            <button
              type="button"
              onClick={() => setTab('checkout')}
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer"
              aria-label={`Carrito de compras, ${cartCount} artículos`}
            >
              <ShoppingCart size={22} style={{ color: '#fff' }} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 leading-none"
                  style={{ backgroundColor: themeColor, color: '#fff' }}
                  aria-hidden="true"
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP SIDEBAR — Categories panel
          ═══════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-[60] hidden lg:block transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de categorías"
      >
        <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />

        <aside
          className={`absolute top-0 bottom-0 left-0 w-[320px] shadow-2xl flex flex-col transition-transform duration-300 ease-out z-10 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff' }}
        >
          {/* Sidebar Header */}
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
            <div className="flex items-center gap-3">
              {config.logo_url ? (
                <img src={config.logo_url} alt={config.site_nombre || 'Logo'} className="h-[50px] w-auto max-w-[180px] object-contain" />
              ) : (
                <h1
                  className="text-lg font-extrabold tracking-tighter"
                  style={{ color: themeColor }}
                >
                  {config.site_nombre || 'Market Coffee Sweet'}
                </h1>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e4beb1]/20 text-[#5b4137] transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4 px-4 no-scrollbar">
            {/* Main nav */}
            <div className="flex flex-col gap-1 mb-6">
              {[
                { label: 'Inicio', tab: 'home' as const, icon: Home },
                { label: 'Nuestro Menú', tab: 'catalog' as const, icon: UtensilsCrossed },
                { label: 'Mi Pedido', tab: 'checkout' as const, icon: ShoppingCart },
                { label: 'Mi Cuenta', tab: 'profile' as const, icon: User },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setTab(item.tab); setSidebarOpen(false); }}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                    currentTab === item.tab
                      ? 'font-semibold'
                      : 'hover:opacity-80'
                  }`}
                  style={currentTab === item.tab ? { backgroundColor: `${themeColor}12`, color: themeColor } : { color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
                >
                  <item.icon size={18} strokeWidth={2} /> {item.label}
                </button>
              ))}
            </div>

            {/* Categories */}
            <div className="border-t pt-4" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3" style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}>Categorías del Menú</p>
              <div className="flex flex-col gap-1">
                {categories.map((cat) => {
                  const IconComponent = CATEGORY_ICON_MAP[cat.toLowerCase()] || DEFAULT_CATEGORY_ICON;
                  return (
                    <div key={cat}>
                      <button
                        type="button"
                        onClick={() => {
                          handleCategoryClick(cat);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-xl font-medium hover:opacity-80 transition-all cursor-pointer group"
                        style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:scale-105"
                          style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
                        >
                          <IconComponent size={18} strokeWidth={2} />
                        </div>
                        <span className="flex-1 text-left">{cat}</span>
                        <ChevronRight size={14} className="text-[#e4beb1] group-hover:text-[#5b4137] transition-colors" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="border-t mt-4 pt-4" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
              <a
                href={waLink(getWhatsAppPhone(config))}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-green-50 hover:text-green-600 rounded-xl font-medium transition-all"
                style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
              >
                <MessageCircle size={18} className="text-green-500" /> WhatsApp Directo
              </a>
            </div>

            {/* Store address */}
            <div className="mt-4 px-2 flex gap-2 text-xs leading-relaxed" style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}>
              <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: isDarkMode ? '#6a6a8a' : '#8f7065' }} />
              <p>{config.direccion_fisica}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
            {currentUser && (
              <button
                type="button"
                onClick={() => { logoutUser(); setTab('home'); setSidebarOpen(false); }}
                className="flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 rounded-xl px-3 py-2 font-medium transition-all cursor-pointer"
              >
                <LogOut size={16} /> Cerrar Sesión
              </button>
            )}
            <div className="text-[9px] text-[#e4beb1] font-mono">
              {config.site_nombre || 'Market Coffee Sweet'} v2.0.0
            </div>
          </div>
        </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE HEADER — Luminous Electric glassmorphic
          ═══════════════════════════════════════════════════════════ */}
      {!hideMobileHeader && (
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 transition-all duration-300"
        style={{
          background: isDarkMode 
            ? `${themeColor}E6`
            : `${themeColor}CC`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer active:scale-95"
            aria-label="Abrir menú"
            style={{ color: '#fff' }}
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={() => setTab('home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            {config.logo_url ? (
                <img src={config.logo_url} alt={config.site_nombre || 'Market Coffee Sweet'} className="h-[70px] w-auto max-w-[170px] object-contain" />
              ) : (
                <h1
                  className="text-lg font-extrabold tracking-tighter"
                  style={{ color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {config.site_nombre || 'Market Coffee Sweet'}
                </h1>
              )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-black/10 transition-colors cursor-pointer"
            aria-label={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-white" style={{ color: '#ffffff' }} />}
          </button>
          <button
            type="button"
            onClick={() => setTab('checkout')}
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer"
            aria-label={`Carrito de compras, ${cartCount} artículos`}
          >
            <ShoppingCart size={22} style={{ color: isDarkMode ? '#fff' : '#fff' }} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 leading-none"
                style={{ backgroundColor: themeColor, color: '#fff' }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MOBILE DRAWER PANEL
          ═══════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 lg:hidden ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />

        <aside
          className={`absolute top-0 bottom-0 left-0 w-[280px] shadow-2xl flex flex-col transition-transform duration-300 ease-out z-10 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff' }}
        >
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
            <div className="flex items-center gap-3">
              <h1
                className="text-lg font-extrabold tracking-tighter"
                style={{ color: themeColor }}
              >
                {config.site_nombre || 'Market Coffee Sweet'}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e4beb1]/20 transition-colors"
              style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 px-3 no-scrollbar">
            <div className="flex flex-col gap-0.5">
              {[
                { label: 'Inicio', tab: 'home' as const, icon: Home },
                { label: 'Nuestro Menú', tab: 'catalog' as const, icon: UtensilsCrossed },
                { label: 'Mi Pedido', tab: 'checkout' as const, icon: ShoppingCart },
                { label: 'Mi Cuenta', tab: 'profile' as const, icon: User },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setTab(item.tab); setDrawerOpen(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                    currentTab === item.tab ? 'font-semibold' : 'hover:opacity-80'
                  }`}
                  style={currentTab === item.tab 
                    ? { backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f3f5', color: isDarkMode ? '#e8e8f0' : '#1a1c1d' }
                    : { color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
                >
                  <item.icon size={18} /> {item.label}
                </button>
              ))}
            </div>

            {/* Categorías */}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2" style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}>Categorías</p>
              <div className="flex flex-col gap-0.5">
                {categories.map((cat) => {
                  const IconComponent = CATEGORY_ICON_MAP[cat.toLowerCase()] || DEFAULT_CATEGORY_ICON;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryClick(cat)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl font-medium hover:opacity-80 transition-all cursor-pointer group"
                      style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:scale-105"
                        style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
                      >
                        <IconComponent size={16} strokeWidth={2} />
                      </div>
                      <span className="flex-1 text-left">{cat}</span>
                      <ChevronRight size={14} className="text-[#e4beb1] group-hover:text-[#5b4137] transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-4 pt-3 border-t flex flex-col gap-0.5" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
              <a
                href={waLink(getWhatsAppPhone(config))}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-green-50 hover:text-green-600 rounded-xl font-medium transition-all"
                style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}
              >
                <MessageCircle size={16} className="text-green-500" /> WhatsApp Directo
              </a>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => { logoutUser(); setTab('home'); setDrawerOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl font-medium transition-all cursor-pointer"
                >
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
              <div className="flex gap-2 px-3 text-xs leading-relaxed" style={{ color: isDarkMode ? '#a0a0b8' : '#5b4137' }}>
                <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: isDarkMode ? '#6a6a8a' : '#8f7065' }} />
                <p>{config.direccion_fisica}</p>
              </div>
            </div>
          </div>

          <div className="p-3 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(228,190,177,0.2)' }}>
            <div className="text-[9px] text-[#e4beb1] font-mono text-center">
              {config.site_nombre || 'Market Coffee Sweet'} v2.0.0
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};
