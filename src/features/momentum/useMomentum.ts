/**
 * useMomentum — Hook for loading and filtering opportunities with warmth data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSandbox } from '../../contexts/SandboxContext';

export type MomentumFilter = 'all' | 'hot' | 'warm' | 'cold' | 'promoted';

interface UseMomentumReturn {
  opportunities: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  filter: MomentumFilter;
  setFilter: (f: MomentumFilter) => void;
}

export function useMomentum(): UseMomentumReturn {
  const { token } = useSandbox();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MomentumFilter>('all');

  const fetchOpportunities = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/opportunities?filter=${filter}&sort=warmth_desc`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (err: any) {
      console.error('[useMomentum] Error:', err.message);
      setError(err.message);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  return {
    opportunities,
    loading,
    error,
    refetch: fetchOpportunities,
    filter,
    setFilter,
  };
}
