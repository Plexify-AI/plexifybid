import React from 'react';
import './IntegrationsPage.css';

interface Integration {
  id: string;
  name: string;
  category: string;
  logo: string;
  description: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'sharepoint',
    name: 'SharePoint',
    category: 'Document Management',
    logo: '/integrations/sharepoint.svg',
    description: 'Document storage and collaboration',
  },
  {
    id: 'power-automate',
    name: 'Power Automate',
    category: 'Workflow',
    logo: '/integrations/power-automate.svg',
    description: 'Workflow automation',
  },
  {
    id: 'power-bi',
    name: 'Power BI',
    category: 'Analytics',
    logo: '/integrations/power-bi.svg',
    description: 'Business intelligence and reporting',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    logo: '/integrations/slack.svg',
    description: 'Team communication',
  },
  {
    id: 'business-central',
    name: 'Business Central',
    category: 'ERP/Finance',
    logo: '/integrations/business-central.svg',
    description: 'Financial management and ERP',
  },
  {
    id: 'tracktik',
    name: 'TrackTik',
    category: 'Field Management',
    logo: '/integrations/tracktik.svg',
    description: 'Field operations and workforce management',
  },
];

export function IntegrationsPage() {
  const handleIntegrationClick = (integration: Integration) => {
    alert(`${integration.name} integration coming soon!`);
  };

  return (
    <div className="integrations-page">
      <div className="integrations-page__header">
        <h1>Integrations</h1>
        <p>Connect PlexifyBID with your existing tools and data sources</p>
      </div>

      <div className="integrations-grid">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.id}
            className="integration-card"
            onClick={() => handleIntegrationClick(integration)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleIntegrationClick(integration);
              }
            }}
            aria-label={`${integration.name}: ${integration.description}`}
          >
            <div className="integration-card__logo">
              <img src={integration.logo} alt={integration.name} />
            </div>
            <div className="integration-card__info">
              <h3 className="integration-card__name">{integration.name}</h3>
              <span className="integration-card__category">
                {integration.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntegrationsPage;
