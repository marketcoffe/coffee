import React from 'react';
import { Home, UtensilsCrossed, Search, ShoppingCart, User } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface BottomNavProps {
  currentTab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout';
  setTab: (tab: 'home' | 'catalog' | 'cart' | 'admin' | 'profile' | 'checkout') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setTab }) => {
  const { cart, config, isDarkMode } = useApp();
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const themeColor = config.theme_color || '#A4D045';

  const tabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'catalog' as const, label: 'Menu', icon: UtensilsCrossed },
    { id: 'catalog' as const, label: 'Search', icon: Search, isSearch: true },
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'checkout' as const, label: 'Cart', icon: ShoppingCart, badge: cartCount },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom" style={{
      background: isDarkMode ? 'rgba(10, 10, 20, 0.85)' : 'rgba(249, 249, 251, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(228, 190, 177, 0.1)',
      borderRadius: '1.25rem 1.25rem 0 0',
    }}>
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {tabs.map((tabItem, idx) => {
          const isActive = tabItem.isSearch
            ? false
            : tabItem.id === 'checkout'
              ? currentTab === 'cart' || currentTab === 'checkout'
              : currentTab === tabItem.id;

          const handleTabClick = () => {
            if (tabItem.isSearch) {
              setTab('catalog');
            } else {
              setTab(tabItem.id);
            }
          };

          return (
            <button
              key={`${tabItem.id}-${idx}`}
              type="button"
              onClick={handleTabClick}
              className="flex flex-col items-center justify-center gap-0.5 w-14 h-full cursor-pointer relative transition-transform duration-200 active:scale-90"
              style={{
                color: isActive ? '#000000' : (isDarkMode ? 'rgba(160, 160, 184, 0.6)' : 'rgba(91, 65, 55, 0.6)'),
              }}
            >
              <div className="relative">
                <tabItem.icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.5}
                  className="transition-all duration-200"
                  style={{
                    color: isActive ? '#000000' : (isDarkMode ? 'rgba(160, 160, 184, 0.6)' : 'rgba(91, 65, 55, 0.6)'),
                  }}
                  fill={isActive ? themeColor : 'none'}
                />
                {tabItem.badge !== undefined && tabItem.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 leading-none"
                    style={{ backgroundColor: themeColor, color: '#ffffff' }}
                  >
                    {tabItem.badge > 99 ? '99+' : tabItem.badge}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] mt-0.5 transition-colors duration-200"
                style={{
                  color: isActive ? '#000000' : (isDarkMode ? 'rgba(160, 160, 184, 0.6)' : 'rgba(91, 65, 55, 0.6)'),
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tabItem.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
