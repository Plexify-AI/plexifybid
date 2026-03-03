/**
 * useHomeOpportunities — Fetch hot + promoted opportunities for Home screen.
 *
 * Calls GET /api/opportunities?filter=home (warmth >= 40 OR promoted_to_home).
 * Returns top 5, sorted by promoted first then warmth DESC.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSandbox } from '../../contexts/SandboxContext';

interface UseHomeOpportunitiesReturn {
  opportunities: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHomeOpportunities(): UseHomeOpportunitiesReturn {
  const { token } = useSandbox();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/opportunities?filter=home', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (err: any) {
      console.error('[useHomeOpportunities] Error:', err.message);
      setError(err.message);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  return {
    opportunities,
    loading,
    error,
    refetch: fetchOpportunities,
  };
}
