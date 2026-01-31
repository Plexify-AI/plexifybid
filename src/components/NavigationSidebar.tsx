import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Home, Upload, Folder, Grid, Settings,
  BarChart, Bell, Activity, ChevronLeft, Menu, Table, FileText, Link2, Map
} from 'lucide-react';

const NavigationSidebar: React.FC = () => {
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
      title: 'AI REPORTS',
      items: [
        { path: '/home', label: 'Home', icon: Home },
        { path: '/ecosystem', label: 'Place Graph', icon: Map },
        { path: '/assessments', label: 'Assessments', icon: Table },
        { path: '/board-reports', label: 'Board Reports', icon: FileText },
        { 
          path: '/ask-plexi', 
          label: 'Ask Plexi', 
          icon: 'custom-p-logo', // Use custom gray P logo
          isNew: true 
        },
        { path: '/upload', label: 'Upload', icon: Upload },
        { path: '/library', label: 'Library', icon: Folder },
        { path: '/resources', label: 'Resources', icon: Grid },
        { path: '/settings', label: 'Settings', icon: Settings },
        { path: '/integrations', label: 'Integrations', icon: Link2 }
      ]
    },
    {
      title: 'INITIATIVES',
      items: [
        { path: '/analytics', label: 'Analytics', icon: BarChart },
        { path: '/alerts', label: 'Alerts', icon: Bell },
        { path: '/scorecards', label: 'Scorecards', icon: Activity }
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
          {/* Logo Section - Using complete attached logo */}
          <div className="logo-section">
            <div className="logo-container">
              <img 
                src="/assets/logos/Plexify white no background.png"
                alt="Plexify Complete Logo" 
                className="w-48 h-auto object-contain"
              />
            </div>
          </div>

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