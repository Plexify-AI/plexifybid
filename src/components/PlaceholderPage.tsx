import React from 'react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ 
  title, 
  description = "This feature will be available in the next release." 
}) => {
  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <div className="placeholder-icon">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
            <img 
              src="/assets/logos/Plexify purple no background.png" 
              alt="Plexify" 
              className="w-8 h-8 object-contain"
            />
          </div>
        </div>
        
        <h1 className="placeholder-title">{title}</h1>
        <p className="coming-soon">Coming Soon</p>
        <p className="description">{description}</p>
        
        <div className="mt-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Development in progress...</p>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;