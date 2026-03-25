// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Shield, CheckCircle, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

interface ConnectionStatus {
  connected: boolean;
  provider: string | null;
  email: string | null;
  displayName: string | null;
  status: string;
  lastError: string | null;
  lastUsedAt: string | null;
  accountId: string | null;
}

const EmailSettingsPage: React.FC = () => {
  const { token } = useSandbox();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Check for OAuth callback results in URL
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      setFlashMessage('Email connected successfully.');
    } else if (error) {
      setFlashMessage(`Connection failed: ${decodeURIComponent(error)}`);
    }

    // Clear flash after 5s
    if (connected || error) {
      const timer = setTimeout(() => setFlashMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Fetch connection status
  useEffect(() => {
    if (!token) return;
    fetchStatus();
  }, [token]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/email/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      console.error('[email-settings] Failed to fetch status:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to Microsoft OAuth — pass token in query for server to recover
    window.location.href = `/api/auth/email/microsoft/connect?token=${encodeURIComponent(token || '')}`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/auth/email/disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ connected: false, provider: null, email: null, displayName: null, status: 'disconnected', lastError: null, lastUsedAt: null, accountId: null });
      setShowDisconnectConfirm(false);
      setFlashMessage('Email disconnected.');
      setTimeout(() => setFlashMessage(null), 3000);
    } catch (err: any) {
      console.error('[email-settings] Disconnect failed:', err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const renderStatusBadge = (connectionStatus: string) => {
    switch (connectionStatus) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle size={12} />
            Connected
          </span>
        );
      case 'needs_reauth':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <AlertTriangle size={12} />
            Reconnection Needed
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle size={12} />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
            Not Connected
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Mail size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Integration</h1>
            <p className="text-sm text-gray-400">
              Connect your email so Ask Plexi can read, search, and send on your behalf
            </p>
          </div>
        </div>
      </div>

      {/* Flash message */}
      {flashMessage && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
          {flashMessage}
        </div>
      )}

      {/* Security note */}
      <div className="mb-6 px-4 py-3 rounded-lg bg-gray-800/40 border border-gray-700/40 flex items-start gap-3">
        <Shield size={18} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400">
          Your credentials are encrypted with AES-256 and stored securely. Plexi will never send an email without showing you a preview first.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {/* Microsoft Outlook */}
        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#0078d4]/20 border border-[#0078d4]/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M2 6.5L10 2v20l-8-4.5V6.5z" fill="#0078d4" />
                  <path d="M10 4.5h12v15H10" fill="#0078d4" opacity="0.6" />
                  <path d="M10 2l12 2.5v15L10 22V2z" fill="#0078d4" opacity="0.8" />
                  <ellipse cx="6" cy="12" rx="2.5" ry="3" fill="white" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Microsoft Outlook</h3>
                <p className="text-sm text-gray-400">
                  Connect your Outlook.com or Microsoft 365 account
                </p>
              </div>
            </div>
            {status?.status === 'active' && renderStatusBadge('active')}
            {status?.status === 'needs_reauth' && renderStatusBadge('needs_reauth')}
            {status?.status === 'error' && renderStatusBadge('error')}
            {(!status || status.status === 'disconnected') && renderStatusBadge('disconnected')}
          </div>

          {/* Connected state */}
          {status?.connected && (
            <div className="mt-4 pt-4 border-t border-gray-700/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{status.displayName || status.email}</p>
                  {status.displayName && (
                    <p className="text-xs text-gray-400">{status.email}</p>
                  )}
                  {status.lastUsedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Needs reauth state */}
          {status?.status === 'needs_reauth' && (
            <div className="mt-4 pt-4 border-t border-gray-700/40">
              <p className="text-sm text-yellow-400 mb-3">
                Your session has expired. Please reconnect to continue using email features.
              </p>
              {status.lastError && (
                <p className="text-xs text-gray-500 mb-3">{status.lastError}</p>
              )}
              <button
                onClick={handleConnect}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106ebe] rounded-lg transition-colors"
              >
                Reconnect Outlook
              </button>
            </div>
          )}

          {/* Error state */}
          {status?.status === 'error' && (
            <div className="mt-4 pt-4 border-t border-gray-700/40">
              <p className="text-sm text-red-400 mb-2">
                Something went wrong with your email connection.
              </p>
              {status.lastError && (
                <p className="text-xs text-gray-500 mb-3">{status.lastError}</p>
              )}
              <button
                onClick={handleConnect}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106ebe] rounded-lg transition-colors"
              >
                Reconnect Outlook
              </button>
            </div>
          )}

          {/* Disconnected state */}
          {(!status || status.status === 'disconnected') && (
            <div className="mt-4 pt-4 border-t border-gray-700/40">
              <button
                onClick={handleConnect}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106ebe] rounded-lg transition-colors flex items-center gap-2"
              >
                <ExternalLink size={14} />
                Connect Outlook
              </button>
            </div>
          )}
        </div>

        {/* Gmail — Coming Soon */}
        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6 opacity-60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M2 6l10 7 10-7v12H2V6z" fill="#EA4335" opacity="0.8" />
                  <path d="M22 6l-10 7L2 6" stroke="#EA4335" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Google Gmail</h3>
                <p className="text-sm text-gray-400">Connect your Gmail or Google Workspace account</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-600/30 text-gray-400 border border-gray-600/30">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* What you can do */}
      <div className="mt-8 rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">What Plexi Can Do With Your Email</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Read and search your inbox for relevant conversations
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Draft outreach emails based on prospect research
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Reply to threads with context-aware responses
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Every email requires your explicit approval before sending
          </li>
        </ul>
      </div>

      {/* Disconnect confirmation dialog */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Email?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Ask Plexi will no longer be able to read, search, or send emails on your behalf. You can reconnect anytime.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSettingsPage;
