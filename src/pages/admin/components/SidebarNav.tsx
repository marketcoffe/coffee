import React, { useState } from 'react';
import { LucideIcon, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface SectionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  groupLabel?: string;
  adminOnly?: boolean;
}

interface SidebarNavProps {
  groupedSections: { group: string; groupLabel: string; sections: SectionItem[] }[];
  activeSection: string;
  themeColor: string;
  onSectionChange: (sectionId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
  groupedSections,
  activeSection,
  themeColor,
  onSectionChange,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <nav className="flex-1 overflow-y-auto py-2">
      {groupedSections.map(({ group, groupLabel, sections }) => (
        <div key={group} className="mb-1">
          {!collapsed && (
            <p className="erp-sidebar-group-label">{groupLabel}</p>
          )}
          {collapsed && <div className="my-2 mx-3 border-t border-gray-100" />}
          {sections.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => onSectionChange(section.id)}
                  onMouseEnter={() => setHoveredItem(section.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="erp-sidebar-item"
                  style={{
                    ...(isActive && {
                      background: `${themeColor}12`,
                      color: themeColor,
                      borderLeftColor: themeColor,
                    }),
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
                  {!collapsed && <span className="truncate">{section.label}</span>}
                </button>
                {collapsed && hoveredItem === section.id && (
                  <div
                    className="erp-sidebar-tooltip"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                  >
                    {section.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {onToggleCollapse && (
        <div className="mt-auto px-2 pt-3 border-t border-gray-100">
          <button
            onClick={onToggleCollapse}
            className="erp-sidebar-item justify-center"
            style={{ color: 'var(--ios-text-secondary)' }}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && <span className="text-xs">Colapsar</span>}
          </button>
        </div>
      )}
    </nav>
  );
};

export default SidebarNav;
