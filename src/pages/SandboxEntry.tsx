/**
 * SandboxEntry — /sandbox route
 *
 * Reads ?token= from URL, validates against the API,
 * and redirects to /home on success.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSandbox } from '../contexts/SandboxContext';

const SandboxEntry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { validateToken, isLoading, error, isAuthenticated } = useSandbox();
  const [timedOut, setTimedOut] = useState(false);

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

    // Timeout after 15 seconds
    const timer = setTimeout(() => setTimedOut(true), 15_000);

    validateToken(token).then((valid) => {
      clearTimeout(timer);
      if (valid) {
        navigate('/home', { replace: true });
      }
    });

    return () => clearTimeout(timer);
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
          <h1 className="text-2xl font-bold text-white mb-3">
            Please Use Your Sandbox Link
          </h1>
          <p className="text-gray-300 mb-2 text-sm">
            PlexifySOLO requires a unique access link. Check the email from Ken
            for your personalized sandbox URL.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            The link looks like: plexify...app/sandbox?token=pxs_...
          </p>
          <p className="text-gray-400 text-sm">
            Can't find it?{' '}
            <a
              href="mailto:ken@plexifyai.com?subject=PlexifySOLO%20Access"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Email ken@plexifyai.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Timed out
  if (timedOut && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="max-w-md mx-auto text-center p-8">
          <img
            src="/assets/logos/Gray Plexify P-only no bkgrd.png"
            alt="PlexifySOLO"
            className="w-16 h-16 mx-auto mb-6 filter brightness-0 invert opacity-50"
          />
          <h1 className="text-xl font-bold text-white mb-3">
            Taking longer than expected
          </h1>
          <p className="text-gray-300 text-sm mb-4">
            The server might be waking up. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Refresh Page
          </button>
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
            Verifying your access...
          </h1>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
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
          <h1 className="text-2xl font-bold text-white mb-3">
            Access Unavailable
          </h1>
          <p className="text-gray-300 mb-2 text-sm">
            Your trial access has expired or the link is invalid.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Contact{' '}
            <a
              href="mailto:ken@plexifyai.com?subject=PlexifySOLO%20Access%20Issue"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ken@plexifyai.com
            </a>{' '}
            to request access.
          </p>
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
