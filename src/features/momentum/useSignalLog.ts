/**
 * useSignalLog — Hook for logging signals to the API.
 */

import { useState, useCallback } from 'react';
import { useSandbox } from '../../contexts/SandboxContext';

interface SignalResult {
  event: any;
  warmth: {
    scoreBefore: number;
    scoreAfter: number;
    delta: number;
    promoted: boolean;
    ejected: boolean;
    explanation: string;
  };
}

interface UseSignalLogReturn {
  logSignal: (opportunityId: string, eventType: string, payload?: any) => Promise<SignalResult | null>;
  logging: boolean;
  lastResult: SignalResult | null;
}

export function useSignalLog(): UseSignalLogReturn {
  const { token } = useSandbox();
  const [logging, setLogging] = useState(false);
  const [lastResult, setLastResult] = useState<SignalResult | null>(null);

  const logSignal = useCallback(async (
    opportunityId: string,
    eventType: string,
    payload?: any
  ): Promise<SignalResult | null> => {
    if (!token) return null;

    setLogging(true);
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          event_type: eventType,
          payload,
          source: 'manual',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setLastResult(data);
      return data;
    } catch (err: any) {
      console.error('[useSignalLog] Error:', err.message);
      return null;
    } finally {
      setLogging(false);
    }
  }, [token]);

  return { logSignal, logging, lastResult };
}
