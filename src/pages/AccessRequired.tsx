/**
 * AccessRequired — shown when user hits a protected route without auth
 */

import React from 'react';

const AccessRequired: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-md mx-auto text-center p-8">
        <img
          src="/assets/logos/plexify-mark-gray.png"
          alt="PlexifySOLO"
          className="w-16 h-16 mx-auto mb-6 filter brightness-0 invert"
        />
        <h1 className="text-2xl font-bold text-white mb-4">
          Please Use Your Sandbox Link
        </h1>
        <p className="text-gray-300 mb-6">
          PlexifySOLO requires a valid sandbox link to access. Please use the
          URL provided to you.
        </p>
        <p className="text-gray-400 text-sm">
          Need access?{' '}
          <a
            href="mailto:ken@plexifyai.com"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Contact ken@plexifyai.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default AccessRequired;
