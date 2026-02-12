/**
 * SandboxContext — manages sandbox authentication state
 *
 * Stores token + tenant info in React state only (not localStorage,
 * not cookies). Token is lost on page refresh — user re-enters
 * via their sandbox URL.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface TenantInfo {
  name: string;
  company: string;
  slug: string;
  features: string[];
}

interface SandboxState {
  token: string | null;
  tenant: TenantInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  showWelcome: boolean;
}

interface SandboxContextValue extends SandboxState {
  validateToken: (token: string) => Promise<boolean>;
  logout: () => void;
  dismissWelcome: () => void;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SandboxState>({
    token: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    showWelcome: false,
  });

  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid && data.tenant) {
        setState({
          token,
          tenant: data.tenant,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          showWelcome: true,
        });
        return true;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: data.error || 'Invalid token',
        isAuthenticated: false,
      }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Unable to validate access. Please try again.',
        isAuthenticated: false,
      }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      token: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      showWelcome: false,
    });
  }, []);

  const dismissWelcome = useCallback(() => {
    setState((prev) => ({ ...prev, showWelcome: false }));
  }, []);

  return (
    <SandboxContext.Provider
      value={{
        ...state,
        validateToken,
        logout,
        dismissWelcome,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
}

export function useSandbox(): SandboxContextValue {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error('useSandbox must be used within a SandboxProvider');
  }
  return context;
}
