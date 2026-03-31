import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSandbox } from '../../../contexts/SandboxContext';
import type { DealRoom, DealRoomTab, DealRoomSource, DealRoomArtifact, DealRoomMessage } from '../../../types/dealRoom';
import { GOLDEN_TRIANGLE_ROOM_ID, EMPTY_TAB_CONTENT, DEAL_ROOM_TABS } from '../../../types/dealRoom';

export interface TabConfigEntry {
  skill_key: string;
  tab_label: string;
  sort_order: number;
}

interface DealRoomData {
  room: DealRoom | null;
  sources: DealRoomSource[];
  messages: DealRoomMessage[];
  artifacts: DealRoomArtifact[];
  /** Latest ready artifact per type — zero network calls on tab switch */
  artifactsByType: Map<string, DealRoomArtifact>;
  /** Tenant-specific tab config (null = use default BID tabs) */
  tabConfig: TabConfigEntry[] | null;
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

// Fallback demo room + sources for Golden Triangle when DB record doesn't exist
const GOLDEN_TRIANGLE_DEMO_ROOM: DealRoom = {
  id: GOLDEN_TRIANGLE_ROOM_ID,
  tenant_id: '',
  opportunity_id: 'project-golden-triangle',
  project_id: null,
  prospect_id: null,
  name: 'Golden Triangle BID — DC Innovation District',
  description: 'District Intelligence',
  room_type: 'bid',
  status: 'active',
  warmth_score: 85,
  source_count: 3,
  message_count: 6,
  word_count: 123,
  active_tab: 'board_brief',
  tab_content: EMPTY_TAB_CONTENT,
  created_at: '2026-03-06T00:00:00.000Z',
  updated_at: '2026-03-06T00:00:00.000Z',
};

const GOLDEN_TRIANGLE_DEMO_SOURCES: DealRoomSource[] = [
  {
    id: 'demo-src-1',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    file_name: 'GoldenTriangleBID_BusinessPlanFY2428.pdf',
    file_type: 'pdf',
    file_size: 2700000,
    storage_path: null,
    processing_status: 'ready',
    summary: null,
    chunk_count: 24,
    sort_order: 0,
    is_selected: true,
    uploaded_at: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'demo-src-2',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    file_name: 'GoldenTriangle2024NeighborhoodProfile.pdf',
    file_type: 'pdf',
    file_size: 1400000,
    storage_path: null,
    processing_status: 'ready',
    summary: null,
    chunk_count: 12,
    sort_order: 1,
    is_selected: true,
    uploaded_at: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'demo-src-3',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    file_name: 'GT_Assessment_Collection_Summary.csv',
    file_type: 'csv',
    file_size: 8200,
    storage_path: null,
    processing_status: 'ready',
    summary: null,
    chunk_count: 3,
    sort_order: 2,
    is_selected: true,
    uploaded_at: '2026-03-06T00:00:00.000Z',
  },
];

const GOLDEN_TRIANGLE_DEMO_ARTIFACTS: DealRoomArtifact[] = [
  {
    id: 'demo-art-board-brief',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'board_brief',
    title: 'Board Brief',
    subtitle: 'Q1 2026 Summary',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: '2026-03-06T00:00:00.000Z',
    updated_at: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'demo-art-comp',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'competitive_analysis',
    title: 'Competitive Analysis',
    subtitle: 'DC Metro BID Lands...',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: '2026-03-06T00:00:00.000Z',
    updated_at: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'demo-art-meeting',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'meeting_prep',
    title: 'Meeting Prep',
    subtitle: 'Board Meeting Q1',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: '2026-03-06T00:00:00.000Z',
    updated_at: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'demo-art-deal-summary',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'deal_summary',
    title: 'Deal Summary',
    subtitle: 'Golden Triangle Ove...',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: '2026-03-06T00:00:00.000Z',
    updated_at: '2026-03-06T00:00:00.000Z',
  },
];

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
  const [tabConfig, setTabConfig] = useState<TabConfigEntry[] | null>(null);
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
      const [roomRes, artifactsRes, tabConfigRes] = await Promise.all([
        fetch(`/api/deal-rooms/${dealRoomId}`, { headers }),
        fetch(`/api/deal-rooms/${dealRoomId}/artifacts`, { headers }),
        fetch('/api/tab-config', { headers }),
      ]);

      if (!roomRes.ok) {
        // Fallback to demo data for Golden Triangle room
        if (dealRoomId === GOLDEN_TRIANGLE_ROOM_ID) {
          setRoom(GOLDEN_TRIANGLE_DEMO_ROOM);
          setSources(GOLDEN_TRIANGLE_DEMO_SOURCES);
          setMessages([]);
          setArtifacts(GOLDEN_TRIANGLE_DEMO_ARTIFACTS);
          setActiveTabState('board_brief');
          setLoading(false);
          return;
        }
        throw new Error('Failed to load deal room');
      }
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

      if (tabConfigRes.ok) {
        const tcData = await tabConfigRes.json();
        setTabConfig(tcData.tabs || null);
      }
    } catch (err: any) {
      // Fallback to demo data for Golden Triangle room
      if (dealRoomId === GOLDEN_TRIANGLE_ROOM_ID) {
        setRoom(GOLDEN_TRIANGLE_DEMO_ROOM);
        setSources(GOLDEN_TRIANGLE_DEMO_SOURCES);
        setMessages([]);
        setArtifacts(GOLDEN_TRIANGLE_DEMO_ARTIFACTS);
        setActiveTabState('board_brief');
        setLoading(false);
        return;
      }
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

  // Build artifactsByType map — latest version per type, status = 'ready' only
  const artifactsByType = useMemo(() => {
    const map = new Map<string, DealRoomArtifact>();
    // Artifacts come from the API sorted by created_at desc, so first match per type is latest
    for (const art of artifacts) {
      if (art.status === 'ready' && !map.has(art.artifact_type)) {
        map.set(art.artifact_type, art);
      }
    }
    return map;
  }, [artifacts]);

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
    artifactsByType,
    tabConfig,
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
