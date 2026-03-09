/**
 * useNavigateToDealRoom — Check for existing deal room by opportunity, or open create dialog.
 *
 * Calls GET /api/deal-rooms/by-opportunity/:opportunityId.
 * If room exists → navigate to it. If not → caller opens CreateDealRoomDialog.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSandbox } from '../../../contexts/SandboxContext';

interface UseNavigateToDealRoomReturn {
  navigateOrCreate: (opportunityId: string) => Promise<'navigated' | 'create'>;
  loadingOppId: string | null;
}

export function useNavigateToDealRoom(): UseNavigateToDealRoomReturn {
  const navigate = useNavigate();
  const { token } = useSandbox();
  const [loadingOppId, setLoadingOppId] = useState<string | null>(null);

  const navigateOrCreate = useCallback(async (opportunityId: string): Promise<'navigated' | 'create'> => {
    if (!token) return 'create';

    setLoadingOppId(opportunityId);

    try {
      const res = await fetch(`/api/deal-rooms/by-opportunity/${opportunityId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return 'create';
      }

      const data = await res.json();

      if (data.room) {
        navigate(`/deal-rooms/${data.room.id}`);
        return 'navigated';
      }

      return 'create';
    } catch (err) {
      console.error('[useNavigateToDealRoom] Error:', err);
      return 'create';
    } finally {
      setLoadingOppId(null);
    }
  }, [token, navigate]);

  return { navigateOrCreate, loadingOppId };
}
