import React, { Suspense, lazy, useState, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { useAdminStore } from '../../store/stores/adminStore';
import { useOrders } from './hooks/useOrders';
import { Order, FoodItem } from '../../types/store';
import {
  BarChart3, ShoppingBag, Utensils, User, Ticket, Settings,
  X, MessageSquare, Megaphone, Package, Award,
  LayoutGrid, ChevronLeft, MapPin, Shield, Store,
  TrendingUp, Smartphone, Activity, Clock, Users, Zap, Tag,
  Truck, CreditCard, Image, Grid, Search, Building2, HelpCircle,
  Sliders, Palette, FileText, Send
} from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import ProductoFormSection from './sections/tienda/ProductoFormSection';
import SidebarNav from './components/SidebarNav';

// ── Lazy Imports: Reportes ──
const ResumenGeneralSection = lazy(() => import('./sections/reports/ResumenGeneralSection'));
const VentasReportSection = lazy(() => import('./sections/reports/VentasReportSection'));
const ProductosReportSection = lazy(() => import('./sections/reports/ProductosReportSection'));
const AppReportSection = lazy(() => import('./sections/reports/AppReportSection'));
const EstadisticasSection = lazy(() => import('./sections/reports/EstadisticasSection'));

// ── Lazy Imports: Pedidos ──
const ComandasSection = lazy(() => import('./sections/pedidos/ComandasSection'));
const HistorialPedidosSection = lazy(() => import('./sections/pedidos/HistorialPedidosSection'));
const MapaDeliverySection = lazy(() => import('./sections/pedidos/MapaDeliverySection'));

// ── Lazy Imports: Marketing ──
const ClientesSection = lazy(() => import('./sections/marketing/ClientesSection'));
const MensajesSection = lazy(() => import('./sections/marketing/MensajesSection'));
const PromocionesSection = lazy(() => import('./sections/marketing/PromocionesSection'));
const CuponesSection = lazy(() => import('./sections/marketing/CuponesSection'));
const FidelizacionSection = lazy(() => import('./sections/marketing/FidelizacionSection'));
const SegmentacionSection = lazy(() => import('./sections/marketing/SegmentacionSection'));
const AutomatizacionSection = lazy(() => import('./sections/marketing/AutomatizacionSection'));
const AnalyticsPushSection = lazy(() => import('./sections/marketing/AnalyticsPushSection'));

// ── Lazy Imports: Tienda ──
const StoreGeneralSection = lazy(() => import('./sections/tienda/StoreGeneralSection'));
const ProductosSection = lazy(() => import('./sections/tienda/ProductosSection'));
const OfertasSection = lazy(() => import('./sections/tienda/OfertasSection'));
const TiendaCombosSection = lazy(() => import('./sections/tienda/CombosSection'));
const DeliverySection = lazy(() => import('./sections/tienda/DeliverySection'));
const PaymentsSection = lazy(() => import('./sections/tienda/PaymentsSection'));
const BannersSection = lazy(() => import('./sections/tienda/BannersSection'));
const CategoriasSection = lazy(() => import('./sections/tienda/CategoriasSection'));

// ── Lazy Imports: Configuración ──
const PersonalizacionSection = lazy(() => import('./sections/config/PersonalizacionSection'));
const PWASection = lazy(() => import('./sections/config/PWASection'));
const SEOSection = lazy(() => import('./sections/config/SEOSection'));
const SucursalesSection = lazy(() => import('./sections/config/SucursalesSection'));
const RolesSection = lazy(() => import('./sections/config/RolesSection'));
const SistemaSection = lazy(() => import('./sections/config/SistemaSection'));
const ExtrasGlobalesSection = lazy(() => import('./sections/config/ExtrasGlobalesSection'));
const FAQSection = lazy(() => import('./sections/config/FAQSection'));

const SectionLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ios-border)', borderTopColor: 'transparent' }} />
      <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>Cargando...</p>
    </div>
  </div>
);

interface AdminIndexProps {
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout') => void;
}

// ── Section Registry (new structure) ──
const ALL_SECTIONS = [
  // REPORTES
  { id: 'dashboard',       label: 'Resumen',           icon: BarChart3,       group: 'reportes', groupLabel: 'Reportes' },
  { id: 'sales-report',    label: 'Ventas',            icon: TrendingUp,      group: 'reportes' },
  { id: 'products-report', label: 'Productos Report',  icon: Package,         group: 'reportes' },
  { id: 'app-report',      label: 'App',               icon: Smartphone,      group: 'reportes' },
  { id: 'analytics',       label: 'Estadísticas',      icon: Activity,        group: 'reportes' },

  // PEDIDOS
  { id: 'orders',          label: 'Comandas',          icon: ShoppingBag,     group: 'pedidos', groupLabel: 'Pedidos' },
  { id: 'order-history',   label: 'Historial',         icon: Clock,           group: 'pedidos' },
  { id: 'delivery-map',    label: 'Mapa Delivery',     icon: MapPin,          group: 'pedidos' },

  // MARKETING
  { id: 'customers',       label: 'Clientes',          icon: Users,           group: 'marketing', groupLabel: 'Marketing' },
  { id: 'messages',        label: 'Mensajes',          icon: MessageSquare,   group: 'marketing' },
  { id: 'promos',          label: 'Promociones',       icon: Megaphone,       group: 'marketing' },
  { id: 'coupons',         label: 'Cupones',           icon: Ticket,          group: 'marketing' },
  { id: 'loyalty',         label: 'Fidelización',      icon: Award,           group: 'marketing' },
  { id: 'segments',        label: 'Segmentación',      icon: Users,           group: 'marketing' },
  { id: 'automations',     label: 'Automatización',    icon: Zap,             group: 'marketing' },
  { id: 'push-analytics',  label: 'Analytics Push',    icon: BarChart3,       group: 'marketing' },

  // TIENDA
  { id: 'store-general',   label: 'General',           icon: Store,           group: 'tienda', groupLabel: 'Tienda' },
  { id: 'products',        label: 'Productos',         icon: Package,         group: 'tienda' },
  { id: 'store-promos',    label: 'Ofertas',           icon: Tag,             group: 'tienda' },
  { id: 'store-combos',    label: 'Combos',            icon: Package,         group: 'tienda' },
  { id: 'delivery',        label: 'Delivery',          icon: Truck,           group: 'tienda' },
  { id: 'payments',        label: 'Pagos',             icon: CreditCard,      group: 'tienda' },
  { id: 'banners',         label: 'Banners',           icon: Image,           group: 'tienda' },
  { id: 'categories',      label: 'Categorías',        icon: Grid,            group: 'tienda' },

  // CONFIGURACIÓN (solo admin)
  { id: 'branding',        label: 'Personalización',   icon: Palette,         group: 'config', groupLabel: 'Configuración', adminOnly: true },
  { id: 'pwa-config',      label: 'PWA',               icon: Smartphone,      group: 'config', adminOnly: true },
  { id: 'seo',             label: 'SEO',               icon: Search,          group: 'config', adminOnly: true },
  { id: 'branches',        label: 'Sucursales',        icon: Building2,       group: 'config', adminOnly: true },
  { id: 'roles',           label: 'Roles',             icon: Shield,          group: 'config', adminOnly: true },
  { id: 'system',          label: 'Sistema',           icon: Settings,        group: 'config', adminOnly: true },
  { id: 'extras',          label: 'Extras Productos',  icon: Sliders,         group: 'config', adminOnly: true },
  { id: 'faq',             label: 'FAQ',               icon: HelpCircle,      group: 'config', adminOnly: true },
];

const BOTTOM_TABS = [
  { id: 'dashboard', label: 'Reportes', icon: BarChart3 },
  { id: 'orders',    label: 'Pedidos',  icon: ShoppingBag },
  { id: 'products',  label: 'Tienda',   icon: Store },
  { id: '__more',    label: 'Más',      icon: LayoutGrid },
];

export default function AdminIndex({ setTab }: AdminIndexProps) {
  const { config, updateFoodItem, addFoodItem, userRole, adminScopeSedeId } = useApp();
  const { activeSection, setActiveSection } = useAdminStore();
  const { advanceStatus } = useOrders();
  const themeColor = config.theme_color || '#A4D045';
  const isAdmin = userRole === 'admin';
  const scopeSedeId = isAdmin ? '' : (adminScopeSedeId || '');

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openEditor, setOpenEditor] = useState<FoodItem | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const handleStatusAdvance = useCallback((order: Order) => {
    advanceStatus(order);
  }, [advanceStatus]);

  const visibleSections = ALL_SECTIONS
    .filter(s => isAdmin || !s.adminOnly);
  const sectionLabel = visibleSections.find(s => s.id === activeSection)?.label || 'Panel';

  const moreSections = visibleSections.filter(s =>
    !BOTTOM_TABS.some(t => t.id === s.id)
  );

  // Group sections for sidebar with group headers
  const groupedSections = visibleSections.reduce((acc, section) => {
    const group = section.group;
    if (!acc.find(g => g.group === group)) {
      acc.push({ group, groupLabel: section.groupLabel || group, sections: [] });
    }
    acc.find(g => g.group === group)!.sections.push(section);
    return acc;
  }, [] as { group: string; groupLabel: string; sections: typeof visibleSections }[]);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId as Parameters<typeof setActiveSection>[0]);
    setShowMoreSheet(false);
    setSidebarOpen(false);
  };

  const renderSection = () => {
    // Admin-only redirect
    if (!isAdmin && ALL_SECTIONS.find(s => s.id === activeSection)?.adminOnly) {
      return <ComandasSection scopeSedeId={scopeSedeId} />;
    }

    switch (activeSection) {
      // REPORTES
      case 'dashboard':       return <ResumenGeneralSection />;
      case 'sales-report':    return <VentasReportSection />;
      case 'products-report': return <ProductosReportSection />;
      case 'app-report':      return <AppReportSection />;
      case 'analytics':       return <EstadisticasSection />;

      // PEDIDOS
      case 'orders':          return <ComandasSection scopeSedeId={scopeSedeId} />;
      case 'order-history':   return <HistorialPedidosSection scopeSedeId={scopeSedeId} />;
      case 'delivery-map':    return <MapaDeliverySection scopeSedeId={scopeSedeId} />;

      // MARKETING
      case 'customers':       return <ClientesSection />;
      case 'messages':        return <MensajesSection />;
      case 'promos':          return <PromocionesSection />;
      case 'coupons':         return <CuponesSection />;
      case 'loyalty':         return <FidelizacionSection />;
      case 'segments':        return <SegmentacionSection />;
      case 'automations':     return <AutomatizacionSection />;
      case 'push-analytics':  return <AnalyticsPushSection />;

      // TIENDA
      case 'store-general':   return <StoreGeneralSection />;
      case 'products':        return <ProductosSection onEdit={(p) => setOpenEditor(p)} onCreate={() => setShowProductForm(true)} config={config} />;
      case 'store-promos':    return <OfertasSection />;
      case 'store-combos':    return <TiendaCombosSection />;
      case 'delivery':        return <DeliverySection />;
      case 'payments':        return <PaymentsSection />;
      case 'banners':         return <BannersSection />;
      case 'categories':      return <CategoriasSection />;

      // CONFIGURACIÓN
      case 'branding':        return <PersonalizacionSection />;
      case 'pwa-config':      return <PWASection />;
      case 'seo':             return <SEOSection />;
      case 'branches':        return <SucursalesSection />;
      case 'roles':           return <RolesSection />;
      case 'system':          return <SistemaSection />;
      case 'extras':          return <ExtrasGlobalesSection />;
      case 'faq':             return <FAQSection />;

      default: return <ResumenGeneralSection />;
    }
  };


  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ios-bg)' }}>
      <SEOHead title={`Admin - ${config.site_nombre || 'Panel'}`} type="admin" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0" style={{ background: 'var(--ios-card)', borderRight: '1px solid var(--ios-border)' }}>
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--ios-border)' }}>
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.site_nombre || 'Logo'} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: themeColor }}>
                {config.site_nombre?.[0] || 'A'}
              </div>
              <span className="font-bold text-base truncate" style={{ color: 'var(--ios-text)' }}>{config.site_nombre || 'Admin'}</span>
            </>
          )}
        </div>
        <SidebarNav groupedSections={groupedSections} activeSection={activeSection} themeColor={themeColor} onSectionChange={handleSectionChange} />
        <div className="p-3" style={{ borderTop: '1px solid var(--ios-border)' }}>
          <button onClick={() => setTab('home')} className="w-full text-sm py-3 transition-colors cursor-pointer flex items-center justify-center gap-2" style={{ color: 'var(--ios-text-secondary)' }}>
            <ChevronLeft size={16} /> Volver a la tienda
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Header */}
        <header className="admin-header shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-xl cursor-pointer" style={{ color: 'var(--ios-text)' }}>
            <BarChart3 size={22} />
          </button>
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.site_nombre || 'Logo'} className="h-7 w-auto max-w-[100px] object-contain ml-2" />
          ) : (
            <h1 className="admin-section-title ml-2">{sectionLabel}</h1>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          <Suspense fallback={<SectionLoader />}>
            {renderSection()}
          </Suspense>
        </main>

        {/* Mobile Bottom Tabs */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 admin-bottom-tabs">
          {BOTTOM_TABS.map(tab => {
            const Icon = tab.icon;
            const isMore = tab.id === '__more';
            const isActive = isMore ? showMoreSheet : activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isMore) setShowMoreSheet(true);
                  else handleSectionChange(tab.id);
                }}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 cursor-pointer touch-target"
                style={{ color: isActive ? themeColor : 'var(--ios-text-secondary)' }}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit Product Modal */}
      {openEditor && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <ProductoFormSection
            product={openEditor}
            onSave={async (updated: Partial<FoodItem>) => { updateFoodItem(updated.id!, updated); }}
            onClose={() => setOpenEditor(null)}
          />
        </div>
      )}

      {/* New Product Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <ProductoFormSection
            product={null}
            onSave={async (newProduct: Partial<FoodItem>) => {
              addFoodItem(newProduct as any);
            }}
            onClose={() => setShowProductForm(false)}
          />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 flex flex-col" style={{ background: 'var(--ios-card)' }}>
            <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--ios-border)' }}>
              {config.logo_url ? (
                <img src={config.logo_url} alt={config.site_nombre || 'Logo'} className="h-8 w-auto max-w-[120px] object-contain" />
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: themeColor }}>
                    {config.site_nombre?.[0] || 'A'}
                  </div>
                  <span className="font-bold text-base truncate" style={{ color: 'var(--ios-text)' }}>{config.site_nombre || 'Admin'}</span>
                </>
              )}
              <button onClick={() => setSidebarOpen(false)} className="ml-auto p-2 rounded-xl" style={{ color: 'var(--ios-text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <SidebarNav groupedSections={groupedSections} activeSection={activeSection} themeColor={themeColor} onSectionChange={handleSectionChange} />
            <div className="p-3" style={{ borderTop: '1px solid var(--ios-border)' }}>
              <button onClick={() => setTab('home')} className="w-full text-sm py-3 flex items-center justify-center gap-2" style={{ color: 'var(--ios-text-secondary)' }}>
                <ChevronLeft size={16} /> Volver a la tienda
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* More Sections Bottom Sheet */}
      {showMoreSheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowMoreSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bottom-sheet" style={{ background: 'var(--ios-card)' }}>
            <div className="bottom-sheet-handle" />
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--ios-text)' }}>Más opciones</h3>
              {(() => {
                const moreGrouped = moreSections.reduce((acc, section) => {
                  const group = section.group;
                  if (!acc.find(g => g.group === group)) {
                    acc.push({ group, groupLabel: section.groupLabel || group, sections: [] });
                  }
                  acc.find(g => g.group === group)!.sections.push(section);
                  return acc;
                }, [] as { group: string; groupLabel: string; sections: typeof moreSections }[]);
                return moreGrouped.map(({ group, groupLabel, sections }) => (
                  <div key={group} className="mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest px-2 mb-1 text-slate-400">{groupLabel}</p>
                    {sections.map(section => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSectionChange(section.id)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer touch-target"
                          style={{
                            background: isActive ? `${themeColor}15` : 'transparent',
                            color: isActive ? themeColor : 'var(--ios-text)',
                          }}
                        >
                          <Icon size={20} />
                          {section.label}
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
              <button
                onClick={() => { setTab('home'); setShowMoreSheet(false); }}
                className="w-full mt-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer touch-target"
                style={{ color: 'var(--ios-text-secondary)', borderTop: '1px solid var(--ios-border)' }}
              >
                ← Volver a la tienda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
