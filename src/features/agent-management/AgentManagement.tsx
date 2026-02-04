import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bot, FileText, Clock } from 'lucide-react';

interface TabConfig {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: 'registry',
    label: 'Registry',
    path: '/agents',
    icon: <Bot size={18} />,
  },
  {
    id: 'templates',
    label: 'Templates',
    path: '/agents/templates',
    icon: <FileText size={18} />,
  },
  {
    id: 'sessions',
    label: 'Sessions',
    path: '/agents/sessions',
    icon: <Clock size={18} />,
  },
];

export function AgentManagement() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current path
  const getActiveTab = (): string => {
    const path = location.pathname;
    if (path.startsWith('/agents/templates')) return 'templates';
    if (path.startsWith('/agents/sessions')) return 'sessions';
    return 'registry';
  };

  const activeTab = getActiveTab();

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Bot size={24} className="text-primary-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ask PlexiCoS</h1>
              <p className="text-sm text-gray-600">
                Agent registry, prompt templates, and session tracking
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="mt-6 -mb-px flex gap-6" aria-label="Tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    group inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm
                    transition-colors
                    ${isActive
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </div>
    </div>
  );
}

export default AgentManagement;
