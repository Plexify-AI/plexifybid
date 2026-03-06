import { useState, useEffect, useCallback, useRef } from 'react';
import { useSandbox } from '../../../contexts/SandboxContext';
import type { DealRoom, DealRoomTab, DealRoomSource, DealRoomArtifact, DealRoomMessage } from '../../../types/dealRoom';

interface DealRoomData {
  room: DealRoom | null;
  sources: DealRoomSource[];
  messages: DealRoomMessage[];
  artifacts: DealRoomArtifact[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  lastSaved: Date | null;
  activeTab: DealRoomTab;
  setActiveTab: (tab: DealRoomTab) => void;
  saveTabContent: (tab: DealRoomTab, content: string) => Promise<void>;
  updateRoom: (updates: Partial<DealRoom>) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useDealRoom(dealRoomId: string | undefined): DealRoomData {
  const { token } = useSandbox();
  const [room, setRoom] = useState<DealRoom | null>(null);
  const [sources, setSources] = useState<DealRoomSource[]>([]);
  const [messages, setMessages] = useState<DealRoomMessage[]>([]);
  const [artifacts, setArtifacts] = useState<DealRoomArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTabState] = useState<DealRoomTab>('deal_summary');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchRoom = useCallback(async () => {
    if (!dealRoomId || !token) return;
    setLoading(true);
    setError(null);

    try {
      const [roomRes, artifactsRes] = await Promise.all([
        fetch(`/api/deal-rooms/${dealRoomId}`, { headers }),
        fetch(`/api/deal-rooms/${dealRoomId}/artifacts`, { headers }),
      ]);

      if (!roomRes.ok) throw new Error('Failed to load deal room');
      const roomData = await roomRes.json();
      setRoom(roomData.deal_room);
      setSources(roomData.sources || []);
      setMessages(roomData.messages || []);
      if (roomData.deal_room?.active_tab) {
        setActiveTabState(roomData.deal_room.active_tab);
      }

      if (artifactsRes.ok) {
        const artData = await artifactsRes.json();
        setArtifacts(artData.artifacts || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dealRoomId, token]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const setActiveTab = useCallback(async (tab: DealRoomTab) => {
    setActiveTabState(tab);
    if (!dealRoomId || !token) return;

    // Persist active_tab to server (fire and forget)
    fetch(`/api/deal-rooms/${dealRoomId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ active_tab: tab }),
    }).catch(() => {});
  }, [dealRoomId, token]);

  const saveTabContent = useCallback(async (tab: DealRoomTab, content: string) => {
    if (!dealRoomId || !token) return;

    // Optimistically update local tab_content immediately (so tab switching reads latest)
    setRoom(prev => {
      if (!prev) return prev;
      const updatedTabContent = { ...(prev.tab_content as Record<string, string>), [tab]: content };
      return { ...prev, tab_content: updatedTabContent };
    });

    setSaving(true);

    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/tab-content`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ tab, content }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setLastSaved(new Date());

      // Update word count from server response
      setRoom(prev => prev ? { ...prev, word_count: data.word_count, updated_at: data.updated_at } : prev);
    } catch (err: any) {
      console.error('[useDealRoom] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [dealRoomId, token]);

  const updateRoom = useCallback(async (updates: Partial<DealRoom>) => {
    if (!dealRoomId || !token) return;

    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      setRoom(data);
    } catch (err: any) {
      console.error('[useDealRoom] Update error:', err);
    }
  }, [dealRoomId, token]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    room,
    sources,
    messages,
    artifacts,
    loading,
    error,
    saving,
    lastSaved,
    activeTab,
    setActiveTab,
    saveTabContent,
    updateRoom,
    refetch: fetchRoom,
  };
}
