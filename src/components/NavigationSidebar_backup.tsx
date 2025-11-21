import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Home, MessageSquare, Upload, Folder, Grid, Settings,
  BarChart, Bell, Activity, ChevronLeft, Menu
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
        { path: '/ask-plexi', label: 'Ask Plexi', icon: MessageSquare, isNew: true },
        { path: '/upload', label: 'Upload', icon: Upload },
        { path: '/library', label: 'Library', icon: Folder },
        { path: '/resources', label: 'Resources', icon: Grid },
        { path: '/settings', label: 'Settings', icon: Settings }
      ]
    },
    {
      title: 'PROJECTS',
      items: [
        { path: '/analytics', label: 'Analytics', icon: BarChart },
        { path: '/alerts', label: 'Alerts', icon: Bell },
        { path: '/scorecards', label: 'Scorecards', icon: Activity }
      ]
    }
  ];

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

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
              <div className="logo-placeholder">
                <img 
                  src="/assets/logos/Plexify purple no background.png" 
                  alt="Plexify" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              {!isCollapsed && (
                <span className="logo-text">Plexify</span>
              )}
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
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <Icon size={20} className="nav-icon" />
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