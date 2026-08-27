import { create } from 'zustand';

type AdminSection =
  // Reportes
  | 'dashboard' | 'sales-report' | 'products-report' | 'app-report' | 'analytics'
  // Pedidos
  | 'orders' | 'mesa-orders' | 'order-history' | 'delivery-map'
  // Marketing
  | 'customers' | 'messages' | 'promos' | 'coupons' | 'loyalty' | 'segments' | 'automations' | 'push-analytics' | 'push-center'
  // Tienda
  | 'store-general' | 'products' | 'store-promos' | 'store-combos' | 'delivery' | 'payments' | 'banners' | 'categories' | 'tables'
  // Configuración
  | 'branding' | 'pwa-config' | 'seo' | 'branches' | 'roles' | 'system' | 'extras' | 'faq';

interface AdminState {
  activeSection: AdminSection;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  orderFilter: string;
  crudSearch: string;
  isEditorOpen: boolean;
  
  setActiveSection: (section: AdminSection) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setOrderFilter: (filter: string) => void;
  setCrudSearch: (search: string) => void;
  setEditorOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  activeSection: 'dashboard',
  sidebarOpen: false,
  sidebarCollapsed: false,
  orderFilter: 'all',
  crudSearch: '',
  isEditorOpen: false,

  setActiveSection: (section) => set({ activeSection: section }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setOrderFilter: (filter) => set({ orderFilter: filter }),
  setCrudSearch: (search) => set({ crudSearch: search }),
  setEditorOpen: (open) => set({ isEditorOpen: open }),
}));
