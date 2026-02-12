/**
 * SandboxEntry — /sandbox route
 *
 * Reads ?token= from URL, validates against the API,
 * and redirects to /home on success.
 */

import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSandbox } from '../contexts/SandboxContext';

const SandboxEntry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { validateToken, isLoading, error, isAuthenticated } = useSandbox();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      return; // Will show "no token" UI below
    }

    // Don't re-validate if already authenticated
    if (isAuthenticated) {
      navigate('/home', { replace: true });
      return;
    }

    validateToken(token).then((valid) => {
      if (valid) {
        navigate('/home', { replace: true });
      }
    });
  }, [searchParams, validateToken, navigate, isAuthenticated]);

  const token = searchParams.get('token');

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="max-w-md mx-auto text-center p-8">
          <img
            src="/assets/logos/Gray Plexify P-only no bkgrd.png"
            alt="PlexifySOLO"
            className="w-16 h-16 mx-auto mb-6 filter brightness-0 invert"
          />
          <h1 className="text-2xl font-bold text-white mb-4">
            Sandbox Access Required
          </h1>
          <p className="text-gray-300 mb-6">
            Please use the sandbox link provided to you to access PlexifySOLO.
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
  }

  // Validating...
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="max-w-md mx-auto text-center p-8">
          <img
            src="/assets/logos/Gray Plexify P-only no bkgrd.png"
            alt="PlexifySOLO"
            className="w-16 h-16 mx-auto mb-6 filter brightness-0 invert animate-pulse"
          />
          <h1 className="text-xl font-bold text-white mb-3">
            Verifying access...
          </h1>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Validation failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="max-w-md mx-auto text-center p-8">
          <img
            src="/assets/logos/Gray Plexify P-only no bkgrd.png"
            alt="PlexifySOLO"
            className="w-16 h-16 mx-auto mb-6 filter brightness-0 invert opacity-50"
          />
          <h1 className="text-2xl font-bold text-white mb-4">
            Access Unavailable
          </h1>
          <p className="text-gray-300 mb-6">
            Your trial access has expired or the link is invalid.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Contact{' '}
            <a
              href="mailto:ken@plexifyai.com"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ken@plexifyai.com
            </a>{' '}
            to request access.
          </p>
          <div className="text-xs text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  // Default loading state (brief flash before useEffect fires)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="w-16 h-16 mx-auto filter brightness-0 invert animate-pulse">
        <img src="/assets/logos/Gray Plexify P-only no bkgrd.png" alt="" className="w-full h-full" />
      </div>
    </div>
  );
};

export default SandboxEntry;
