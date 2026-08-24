import React, { Suspense, lazy, useState, useCallback, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { useAdminStore } from '../../store/stores/adminStore';
import { useOrders } from './hooks/useOrders';
import { Order, FoodItem } from '../../types/store';
import {
  BarChart3, ShoppingBag, X, MessageSquare, Megaphone, Package, Award,
  LayoutGrid, ChevronLeft, ChevronRight, MapPin, Shield, Store,
  TrendingUp, Smartphone, Activity, Clock, Users, Zap, Tag,
  Truck, CreditCard, Image, Grid, Search, Building2, HelpCircle,
  Sliders, Palette, Ticket, Settings, Menu, Armchair, UtensilsCrossed
} from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import AdminOrderAlert from '../../components/AdminOrderAlert';
import ProductoFormSection from './sections/tienda/ProductoFormSection';
import SidebarNav from './components/SidebarNav';
import BottomSheet from './components/BottomSheet';
import { Tooltip } from './components/Tooltip';

// Lazy Imports: Reportes
const ResumenGeneralSection = lazy(() => import('./sections/reports/ResumenGeneralSection'));
const VentasReportSection = lazy(() => import('./sections/reports/VentasReportSection'));
const ProductosReportSection = lazy(() => import('./sections/reports/ProductosReportSection'));
const AppReportSection = lazy(() => import('./sections/reports/AppReportSection'));
const EstadisticasSection = lazy(() => import('./sections/reports/EstadisticasSection'));

// Lazy Imports: Pedidos
const ComandasSection = lazy(() => import('./sections/pedidos/ComandasSection'));
const HistorialPedidosSection = lazy(() => import('./sections/pedidos/HistorialPedidosSection'));
const MapaDeliverySection = lazy(() => import('./sections/pedidos/MapaDeliverySection'));
const PedidosMesaSection = lazy(() => import('./sections/pedidos/PedidosMesaSection'));

// Lazy Imports: Marketing
const ClientesSection = lazy(() => import('./sections/marketing/ClientesSection'));
const MensajesSection = lazy(() => import('./sections/marketing/MensajesSection'));
const PromocionesSection = lazy(() => import('./sections/marketing/PromocionesSection'));
const CuponesSection = lazy(() => import('./sections/marketing/CuponesSection'));
const FidelizacionSection = lazy(() => import('./sections/marketing/FidelizacionSection'));
const SegmentacionSection = lazy(() => import('./sections/marketing/SegmentacionSection'));
const AutomatizacionSection = lazy(() => import('./sections/marketing/AutomatizacionSection'));
const AnalyticsPushSection = lazy(() => import('./sections/marketing/AnalyticsPushSection'));

// Lazy Imports: Tienda
const StoreGeneralSection = lazy(() => import('./sections/tienda/StoreGeneralSection'));
const ProductosSection = lazy(() => import('./sections/tienda/ProductosSection'));
const OfertasSection = lazy(() => import('./sections/tienda/OfertasSection'));
const TiendaCombosSection = lazy(() => import('./sections/tienda/CombosSection'));
const DeliverySection = lazy(() => import('./sections/tienda/DeliverySection'));
const PaymentsSection = lazy(() => import('./sections/tienda/PaymentsSection'));
const BannersSection = lazy(() => import('./sections/tienda/BannersSection'));
const CategoriasSection = lazy(() => import('./sections/tienda/CategoriasSection'));
const MesasSection = lazy(() => import('./sections/tienda/MesasSection'));

// Lazy Imports: Configuracion
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

const ALL_SECTIONS = [
  { id: 'dashboard',       label: 'Resumen',           icon: BarChart3,       group: 'reportes', groupLabel: 'Reportes' },
  { id: 'sales-report',    label: 'Ventas',            icon: TrendingUp,      group: 'reportes' },
  { id: 'products-report', label: 'Productos Report',  icon: Package,         group: 'reportes' },
  { id: 'app-report',      label: 'App',               icon: Smartphone,      group: 'reportes' },
  { id: 'analytics',       label: 'Estadisticas',      icon: Activity,        group: 'reportes' },

  { id: 'orders',          label: 'Comandas',          icon: ShoppingBag,     group: 'pedidos', groupLabel: 'Pedidos' },
  { id: 'mesa-orders',     label: 'Pedidos Mesa',      icon: UtensilsCrossed, group: 'pedidos' },
  { id: 'order-history',   label: 'Historial',         icon: Clock,           group: 'pedidos' },
  { id: 'delivery-map',    label: 'Mapa Delivery',     icon: MapPin,          group: 'pedidos' },

  { id: 'customers',       label: 'Clientes',          icon: Users,           group: 'marketing', groupLabel: 'Marketing' },
  { id: 'messages',        label: 'Mensajes',          icon: MessageSquare,   group: 'marketing' },
  { id: 'promos',          label: 'Promociones',       icon: Megaphone,       group: 'marketing' },
  { id: 'coupons',         label: 'Cupones',           icon: Ticket,          group: 'marketing' },
  { id: 'loyalty',         label: 'Fidelizacion',      icon: Award,           group: 'marketing' },
  { id: 'segments',        label: 'Segmentacion',      icon: Users,           group: 'marketing' },
  { id: 'automations',     label: 'Automatizacion',    icon: Zap,             group: 'marketing' },
  { id: 'push-analytics',  label: 'Analytics Push',    icon: BarChart3,       group: 'marketing' },

  { id: 'store-general',   label: 'General',           icon: Store,           group: 'tienda', groupLabel: 'Tienda' },
  { id: 'products',        label: 'Productos',         icon: Package,         group: 'tienda' },
  { id: 'store-promos',    label: 'Ofertas',           icon: Tag,             group: 'tienda' },
  { id: 'store-combos',    label: 'Combos',            icon: Package,         group: 'tienda' },
  { id: 'delivery',        label: 'Delivery',          icon: Truck,           group: 'tienda' },
  { id: 'payments',        label: 'Pagos',             icon: CreditCard,      group: 'tienda' },
  { id: 'banners',         label: 'Banners',           icon: Image,           group: 'tienda' },
  { id: 'categories',      label: 'Categorias',        icon: Grid,            group: 'tienda' },
  { id: 'tables',          label: 'Mesas',             icon: Armchair,        group: 'tienda' },

  { id: 'branding',        label: 'Personalizacion',   icon: Palette,         group: 'config', groupLabel: 'Configuracion', adminOnly: true },
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
  { id: 'orders',    label: 'Pedidos',  icon: ShoppingBag, hasBadge: true },
  { id: 'products',  label: 'Tienda',   icon: Store },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: '__more',    label: 'Mas',      icon: LayoutGrid },
];

export default function AdminIndex({ setTab }: AdminIndexProps) {
  const { config, orders, updateFoodItem, addFoodItem, userRole, adminScopeSedeId } = useApp();
  const { activeSection, setActiveSection, sidebarCollapsed, toggleSidebarCollapsed } = useAdminStore();
  const themeColor = config.theme_color || '#A4D045';
  const isAdmin = userRole === 'admin';
  const scopeSedeId = isAdmin ? '' : (adminScopeSedeId || '');

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openEditor, setOpenEditor] = useState<FoodItem | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const visibleSections = ALL_SECTIONS.filter(s => isAdmin || !s.adminOnly);
  const currentSection = visibleSections.find(s => s.id === activeSection);
  const sectionLabel = currentSection?.label || 'Panel';
  const sectionGroup = currentSection?.groupLabel || currentSection?.group || '';
  const SectionIcon = currentSection?.icon;

  const pendingOrdersCount = useMemo(() =>
    orders.filter(o => o.status === 'Pendiente' || o.status === 'Procesando').length,
    [orders]
  );

  const moreSections = visibleSections.filter(s =>
    !BOTTOM_TABS.some(t => t.id === s.id)
  );

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
    if (!isAdmin && ALL_SECTIONS.find(s => s.id === activeSection)?.adminOnly) {
      return <ComandasSection scopeSedeId={scopeSedeId} />;
    }

    switch (activeSection) {
      case 'dashboard':       return <ResumenGeneralSection />;
      case 'sales-report':    return <VentasReportSection />;
      case 'products-report': return <ProductosReportSection />;
      case 'app-report':      return <AppReportSection />;
      case 'analytics':       return <EstadisticasSection />;

      case 'orders':          return <ComandasSection scopeSedeId={scopeSedeId} />;
      case 'mesa-orders':     return <PedidosMesaSection scopeSedeId={scopeSedeId} />;
      case 'order-history':   return <HistorialPedidosSection scopeSedeId={scopeSedeId} />;
      case 'delivery-map':    return <MapaDeliverySection scopeSedeId={scopeSedeId} />;

      case 'customers':       return <ClientesSection />;
      case 'messages':        return <MensajesSection />;
      case 'promos':          return <PromocionesSection />;
      case 'coupons':         return <CuponesSection />;
      case 'loyalty':         return <FidelizacionSection />;
      case 'segments':        return <SegmentacionSection />;
      case 'automations':     return <AutomatizacionSection />;
      case 'push-analytics':  return <AnalyticsPushSection />;

      case 'store-general':   return <StoreGeneralSection />;
      case 'products':        return <ProductosSection onEdit={(p) => setOpenEditor(p)} onCreate={() => setShowProductForm(true)} config={config} />;
      case 'store-promos':    return <OfertasSection />;
      case 'store-combos':    return <TiendaCombosSection />;
      case 'delivery':        return <DeliverySection />;
      case 'payments':        return <PaymentsSection />;
      case 'banners':         return <BannersSection />;
      case 'categories':      return <CategoriasSection />;
      case 'tables':          return <MesasSection />;

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
    <div className="h-screen" style={{ background: 'var(--erp-content-bg)' }}>
      <SEOHead title={`Admin - ${config.site_nombre || 'Panel'}`} type="admin" />
      <AdminOrderAlert />

      {/* Desktop sidebar - only visible lg+ */}
      <aside className={`erp-sidebar hidden lg:flex fixed inset-y-0 left-0 z-30 ${sidebarCollapsed ? 'collapsed' : ''}`} style={{ width: sidebarCollapsed ? 'var(--erp-sidebar-collapsed)' : 'var(--erp-sidebar-width)' }}>
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--erp-card-border)', minHeight: 52 }}>
          <span className="font-bold text-sm truncate" style={{ color: 'var(--ios-text)' }}>{sidebarCollapsed ? 'PA' : 'Panel Administrativo'}</span>
        </div>
        <SidebarNav
          groupedSections={groupedSections}
          activeSection={activeSection}
          themeColor={themeColor}
          onSectionChange={handleSectionChange}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
        <div className="px-2 py-2 shrink-0" style={{ borderTop: '1px solid var(--erp-card-border)' }}>
          <button onClick={() => setTab('home')} className="erp-sidebar-item justify-center" style={{ color: 'var(--ios-text-secondary)' }}>
            <ChevronLeft size={16} />
            {!sidebarCollapsed && <span className="text-xs">Volver a la tienda</span>}
          </button>
        </div>
      </aside>

      <div className="erp-main-content flex-1 flex flex-col min-h-0 relative" data-collapsed={sidebarCollapsed}>
        {/* Desktop Header */}
        <header className="erp-header shrink-0 hidden lg:flex">
          <Tooltip content="Abrir menu de navegacion" position="bottom">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg cursor-pointer" style={{ color: 'var(--ios-text)' }}>
              <Menu size={20} />
            </button>
          </Tooltip>
          <div className="erp-breadcrumb">
            <span className="erp-breadcrumb-sep">/</span>
            <span>{sectionGroup}</span>
            <span className="erp-breadcrumb-sep">/</span>
            <span className="erp-breadcrumb-current flex items-center gap-1.5">
              {SectionIcon && <SectionIcon size={14} />}
              {sectionLabel}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {pendingOrdersCount > 0 && (
              <Tooltip content={`${pendingOrdersCount} pedidos esperando ser procesados`} position="bottom">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer"
                  style={{ background: `${themeColor}15`, color: themeColor }}
                  onClick={() => handleSectionChange('orders')}
                >
                  <ShoppingBag size={13} />
                  <span>{pendingOrdersCount}</span>
                  <span className="hidden sm:inline">pendientes</span>
                </div>
              </Tooltip>
            )}
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden shrink-0 flex items-center justify-between px-3 gap-2" style={{ height: 'var(--erp-mobile-header-height, 56px)', background: 'var(--erp-header-bg)', borderBottom: '1px solid var(--erp-card-border)' }}>
          <Tooltip content="Abrir menu de navegacion" position="bottom">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ color: 'var(--ios-text)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Menu size={22} />
            </button>
          </Tooltip>
          <div className="flex-1 flex items-center gap-2 min-w-0 px-1">
            {SectionIcon && <SectionIcon size={16} style={{ color: themeColor }} className="shrink-0" />}
            <span className="text-sm font-bold truncate" style={{ color: 'var(--ios-text)' }}>{sectionLabel}</span>
          </div>
          {pendingOrdersCount > 0 && (
            <Tooltip content={`${pendingOrdersCount} pedidos pendientes`} position="bottom">
              <button
                onClick={() => handleSectionChange('orders')}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer active:scale-95 transition-transform"
                style={{ background: `${themeColor}15`, color: themeColor, minHeight: 40 }}
              >
                <ShoppingBag size={14} />
                <span>{pendingOrdersCount}</span>
              </button>
            </Tooltip>
          )}
        </header>

        <main className="erp-content" style={{ padding: 16 }}>
          <Suspense fallback={<SectionLoader />}>
            {renderSection()}
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Nav - Native App Style - OUTSIDE flex container */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 w-full" style={{ background: 'var(--erp-header-bg)', borderTop: '1px solid var(--erp-card-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch" style={{ height: 'var(--erp-mobile-bottom-nav-height, 64px)' }}>
          {BOTTOM_TABS.map(tab => {
            const Icon = tab.icon;
            const isMore = tab.id === '__more';
            const isActive = isMore ? showMoreSheet : activeSection === tab.id;
            const showBadge = tab.hasBadge && pendingOrdersCount > 0;
            return (
              <Tooltip key={tab.id} content={
                tab.id === 'dashboard' ? 'Ver reportes y estadisticas del negocio' :
                tab.id === 'orders' ? 'Gestionar comandas y pedidos activos' :
                tab.id === 'products' ? 'Administrar productos y tienda' :
                tab.id === 'customers' ? 'Ver clientes y mensajeria' :
                'Mas secciones y configuracion'
              } position="top">
                <button
                  onClick={() => {
                    if (isMore) setShowMoreSheet(true);
                    else handleSectionChange(tab.id);
                  }}
                  className="relative flex flex-col items-center justify-center gap-0.5 flex-1 cursor-pointer active:scale-95 transition-all"
                  style={{ color: isActive ? themeColor : 'var(--ios-text-secondary)', WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="relative" style={{ marginTop: 4 }}>
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 1.6} />
                    {showBadge && <span className="erp-nav-badge">{pendingOrdersCount}</span>}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ marginBottom: 2 }}>{tab.label}</span>
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full" style={{ background: themeColor }} />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {openEditor && (
        <BottomSheet open={true} onClose={() => setOpenEditor(null)} title="Editar Producto">
          <ProductoFormSection
            product={openEditor}
            onSave={async (updated: Partial<FoodItem>) => { try { await updateFoodItem(updated.id!, updated); } catch { /* el formulario ya mostró el error */ } }}
            onClose={() => setOpenEditor(null)}
          />
        </BottomSheet>
      )}

      {showProductForm && (
        <BottomSheet open={true} onClose={() => setShowProductForm(false)} title="Crear Producto">
          <ProductoFormSection
            product={null}
            onSave={async (newProduct: Partial<FoodItem>) => { try { await addFoodItem(newProduct as any); } catch { /* el formulario ya mostró el error */ } }}
            onClose={() => setShowProductForm(false)}
          />
        </BottomSheet>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] erp-sidebar flex flex-col shadow-2xl" style={{ background: 'var(--erp-sidebar-bg)', animation: 'slideInLeft 0.25s ease-out' }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--erp-card-border)', minHeight: 56 }}>
              <span className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>Panel Administrativo</span>
              <Tooltip content="Cerrar menu" position="right">
                <button onClick={() => setSidebarOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all" style={{ color: 'var(--ios-text-secondary)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </button>
              </Tooltip>
            </div>
            <SidebarNav
              groupedSections={groupedSections}
              activeSection={activeSection}
              themeColor={themeColor}
              onSectionChange={handleSectionChange}
            />
            <div className="px-2 py-2 shrink-0" style={{ borderTop: '1px solid var(--erp-card-border)' }}>
              <Tooltip content="Volver a la tienda principal" position="top">
                <button onClick={() => setTab('home')} className="erp-sidebar-item justify-center" style={{ color: 'var(--ios-text-secondary)', minHeight: 44 }}>
                  <ChevronLeft size={16} />
                  <span className="text-xs">Volver a la tienda</span>
                </button>
              </Tooltip>
            </div>
          </aside>
        </div>
      )}

      {showMoreSheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoreSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bottom-sheet rounded-t-2xl shadow-2xl" style={{ background: 'var(--erp-sidebar-bg)', animation: 'slideUp 0.3s ease-out', maxHeight: '80vh' }}>
            <div className="bottom-sheet-handle" />
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 20px)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: 'var(--ios-text)' }}>Mas secciones</h3>
                <Tooltip content="Cerrar menu" position="left">
                  <button onClick={() => setShowMoreSheet(false)} className="p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all" style={{ color: 'var(--ios-text-secondary)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                </Tooltip>
              </div>
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
                  <div key={group} className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--ios-text-secondary)', opacity: 0.6 }}>{groupLabel}</p>
                    <div className="space-y-1">
                      {sections.map(section => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                          <Tooltip key={section.id} content={
                            section.id === 'order-history' ? 'Ver historial de pedidos completados y cancelados' :
                            section.id === 'delivery-map' ? 'Mapa en tiempo real de envios activos' :
                            section.id === 'messages' ? 'Enviar mensajes y broadcasts a clientes' :
                            section.id === 'promos' ? 'Crear y gestionar promociones activas' :
                            section.id === 'coupons' ? 'Administrar cupones de descuento' :
                            section.id === 'loyalty' ? 'Programa de fidelizacion y recompensas' :
                            section.id === 'segments' ? 'Segmentar clientes por comportamiento' :
                            section.id === 'automations' ? 'Automatizar mensajes y acciones' :
                            section.id === 'push-analytics' ? 'Estadisticas de notificaciones push' :
                            section.id === 'store-general' ? 'Configuracion general de la tienda' :
                            section.id === 'store-promos' ? 'Gestionar ofertas y descuentos' :
                            section.id === 'store-combos' ? 'Crear y editar combos de productos' :
                            section.id === 'delivery' ? 'Configurar zonas y tarifas de delivery' :
                            section.id === 'payments' ? 'Metodos de pago y pasarelas' :
                            section.id === 'banners' ? 'Gestionar banners promocionales' :
                            section.id === 'categories' ? 'Organizar categorias de productos' :
                            section.id === 'branding' ? 'Colores, logo y apariencia' :
                            section.id === 'pwa-config' ? 'Configurar app progresiva' :
                            section.id === 'seo' ? 'Optimizacion para buscadores' :
                            section.id === 'branches' ? 'Gestionar sucursales' :
                            section.id === 'roles' ? 'Permisos y roles de usuario' :
                            section.id === 'system' ? 'Configuracion del sistema' :
                            section.id === 'extras' ? 'Extras y complementos para productos' :
                            section.id === 'faq' ? 'Preguntas frecuentes de la tienda' :
                            ''
                          } position="top">
                            <button
                              onClick={() => handleSectionChange(section.id)}
                              className="erp-sidebar-item w-full"
                              style={{
                                background: isActive ? `${themeColor}12` : 'transparent',
                                color: isActive ? themeColor : 'var(--ios-text)',
                                borderLeftColor: isActive ? themeColor : 'transparent',
                                minHeight: 44,
                              }}
                            >
                              <Icon size={18} />
                              <span className="truncate">{section.label}</span>
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
              <Tooltip content="Volver a la tienda principal" position="top">
                <button
                  onClick={() => { setTab('home'); setShowMoreSheet(false); }}
                  className="erp-sidebar-item w-full justify-center mt-2"
                  style={{ color: 'var(--ios-text-secondary)', borderTop: '1px solid var(--erp-card-border)', paddingTop: 12, minHeight: 44 }}
                >
                  <ChevronLeft size={16} />
                  <span className="text-xs">Volver a la tienda</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
