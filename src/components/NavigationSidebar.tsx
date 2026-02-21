import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Home, Settings, ChevronLeft, Menu, Link2, Target, User, Brain, Briefcase
} from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';
import { useTenantVocab } from '../hooks/useTenantVocab';

const NavigationSidebar: React.FC = () => {
  const { tenant } = useSandbox();
  const { t } = useTenantVocab();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('nav-collapsed');
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  // Save state changes
  useEffect(() => {
    localStorage.setItem('nav-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const navSections = [
    {
      title: 'SALES INTELLIGENCE',
      items: [
        { path: '/home', label: 'Home', icon: Home },
        { path: '/demo/mel', label: 'My SalesPlex Flow', icon: Target },
        {
          path: '/ask-plexi',
          label: 'Ask Plexi',
          icon: 'custom-p-logo',
          isNew: true
        },
        {
          path: '/deal-rooms',
          label: t('deal_room'),
          icon: Briefcase,
          isNew: true
        },
        {
          path: '/agents',
          label: 'PlexiCoS Agents',
          icon: Brain,
          isNew: true
        },
        { path: '/settings', label: 'Settings', icon: Settings },
        { path: '/integrations', label: 'Integrations', icon: Link2 }
      ]
    }
  ];

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Render icon based on type
  const renderIcon = (item: any) => {
    if (item.icon === 'custom-p-logo') {
      return (
        <img 
          src="/assets/logos/Gray Plexify P-only no bkgrd.png"
          alt="Plexify P" 
          className="w-5 h-5 nav-icon"
        />
      );
    } else {
      const Icon = item.icon;
      return <Icon size={20} className="nav-icon" />;
    }
  };

  return (
    <>
      {/* Mobile Notice - Hidden on desktop, shown on mobile */}
      <div className="lg:hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-sm text-center">
          <h2 className="text-lg font-semibold mb-2">Desktop Required</h2>
          <p className="text-gray-600">Please use desktop for full experience</p>
        </div>
      </div>

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} hidden lg:flex`}>
        <div className="sidebar-content">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="logo-container">
              <img
                src="/assets/logos/Plexify white no background.png"
                alt="PlexifySOLO"
                className="w-48 h-auto object-contain"
              />
              {!isCollapsed && (
                <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-blue-200 bg-blue-500/20 border border-blue-400/30 rounded uppercase">SOLO</span>
              )}
            </div>
          </div>

          {/* Tenant Info */}
          {tenant && !isCollapsed && (
            <div className="px-4 pb-3 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <User size={14} className="text-white/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tenant.name}</p>
                  <p className="text-xs text-white/50 truncate">{tenant.company}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Sections */}
          <div className="flex-1">
            {navSections.map((section) => (
              <div key={section.title} className="nav-section">
                {!isCollapsed && (
                  <h3 className="section-header">{section.title}</h3>
                )}
                <ul className="nav-items">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                          title={isCollapsed ? item.label : undefined}
                        >
                          {renderIcon(item)}
                          {!isCollapsed && (
                            <>
                              <span className="nav-label">{item.label}</span>
                              {item.isNew && (
                                <span className="new-badge">NEW</span>
                              )}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          {!isCollapsed && (
            <div className="px-4 py-3 border-t border-white/10">
              <div className="flex items-center justify-center mb-2">
                <span className="px-2 py-0.5 text-[10px] font-medium text-amber-200 bg-amber-500/15 border border-amber-400/20 rounded-full">Sandbox Trial</span>
              </div>
              <p className="text-[10px] text-white/30 text-center">Plexify AI &mdash; Where Intelligence Flows</p>
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className="collapse-toggle"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>
    </>
  );
};

export default NavigationSidebar;