import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDealRoom } from './hooks/useDealRoom';
import { useDealRoomSources } from './hooks/useDealRoomSources';
import { useDealRoomChat } from './hooks/useDealRoomChat';
import DealRoomHeader from './DealRoomHeader';
import DealRoomTabs from './DealRoomTabs';
import DealRoomLayout from './DealRoomLayout';
import SourcesPanel from './panels/SourcesPanel';
import EditorPanel from './panels/EditorPanel';
import AssistantPanel from './panels/AssistantPanel';
import type { DealRoomMessage, DealRoomTab, DealRoomArtifact } from '../../types/dealRoom';
import { GOLDEN_TRIANGLE_ROOM_ID } from '../../types/dealRoom';

// Pre-loaded conversation for Golden Triangle demo (shows AI already working)
const GOLDEN_TRIANGLE_SEED_MESSAGES: DealRoomMessage[] = [
  {
    id: 'seed-1',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    role: 'user',
    content: 'What are the key risks for this deal?',
    citations: [],
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'seed-2',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    role: 'assistant',
    content: `Based on the source documents, the three primary risks are:

1) **Revenue sustainability risk** — without rate increases, cashflow projections show a negative fund balance exceeding $5M by FY2028. The Golden Triangle is a mature district with no room for square footage growth.
[Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 9]

2) **Post-COVID office recovery** — 34M sqft commercial base is heavily dependent on office tenancy. Return-to-office trends remain uncertain and could impact assessment revenue.
[Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 4]

3) **Innovation District execution risk** — Penn West initiative depends on government partnerships with unpredictable timelines. $3M+ stimulus secured but implementation is complex.
[Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 14]`,
    citations: [
      { source_id: 'src-001', chunk_index: 9, text: 'negative fund balance exceeding $5 million', source_name: 'GoldenTriangleBID_BusinessPlanFY2428.pdf' },
      { source_id: 'src-001', chunk_index: 4, text: 'post-COVID district', source_name: 'GoldenTriangleBID_BusinessPlanFY2428.pdf' },
      { source_id: 'src-001', chunk_index: 14, text: 'Penn West Innovation District', source_name: 'GoldenTriangleBID_BusinessPlanFY2428.pdf' },
    ],
    created_at: new Date(Date.now() - 290000).toISOString(),
  },
  {
    id: 'seed-3',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    role: 'user',
    content: 'Draft the competitive analysis section',
    citations: [],
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'seed-4',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    role: 'assistant',
    content: `## Competitive Landscape

**DowntownDC BID** — Larger footprint, established 1997. Higher assessment base but less innovation focus. Their scale is an advantage for basic services but they lack the Golden Triangle's LEED Platinum differentiation.

**Capitol Riverfront BID** — Fastest-growing DC district with strong residential pipeline. Competing for mixed-use investment dollars but different demographic target.

**Georgetown BID** — Historic district, strong retail/tourism. Not a direct competitor for office tenancy but competes for city resources and developer attention.

**Golden Triangle Differentiators:**
- World's first LEED Platinum BID (97/100 score)
- Unmatched Metro access (4 lines)
- White House adjacency / institutional proximity
- Penn West Innovation District — no other DC BID has this`,
    citations: [
      { source_id: 'src-001', chunk_index: 6, text: 'LEED Platinum certification', source_name: 'GoldenTriangleBID_BusinessPlanFY2428.pdf' },
    ],
    created_at: new Date(Date.now() - 170000).toISOString(),
  },
];

// Additional demo artifacts for Golden Triangle (supplements DB artifacts to reach 6)
const GOLDEN_TRIANGLE_EXTRA_ARTIFACTS: DealRoomArtifact[] = [
  {
    id: 'demo-art-podcast',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'podcast',
    title: 'Deep Dive Podcast',
    subtitle: 'Cassidy & Mark',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-art-knowledge',
    deal_room_id: GOLDEN_TRIANGLE_ROOM_ID,
    tenant_id: '',
    artifact_type: 'knowledge_graph',
    title: 'Knowledge Graph',
    subtitle: 'Entity Map',
    content: null,
    thumbnail_url: null,
    status: 'ready',
    created_at: new Date(Date.now() - 2400000).toISOString(),
    updated_at: new Date(Date.now() - 2400000).toISOString(),
  },
];

// Fallback tab content for Golden Triangle demo (includes blockquote callouts)
const GOLDEN_TRIANGLE_TAB_CONTENT: Partial<Record<DealRoomTab, string>> = {
  deal_summary: `<h1>Suffolk Construction — 5 Hudson Yards BD Opportunity</h1>
<p>Suffolk Construction is at Takeover Ready status (100/100) following three confirmed meetings and a submitted proposal. The Hudson Yards Commercial Center Project (HYCCP) represents a $250M+ scan-to-BIM opportunity targeting Q4 2028 completion...</p>
<blockquote><strong>Key Risk:</strong> NYCIDA approval pending. Recommend accelerating stakeholder outreach to facilities team at 70 Hudson Yards before RFP window closes March 15.</blockquote>`,
  board_brief: `<h1>Board Brief — Q1 2026</h1>
<h2>Financial Health</h2>
<p>Assessment collections on track. Semi-annual billing cycle proceeding normally. Rate increase implementation for FY2024 complete — commercial at $0.19/sqft, hotels at $0.16/sqft, residential at $163/unit.</p>
<h2>Operations Highlights</h2>
<p>Clean and safe operations maintaining Gold Standard levels. Public space activation events scheduled for spring season. 19th Street Rain Gardens maintenance complete.</p>
<h2>Strategic Initiatives</h2>
<p>Penn West Innovation District: Grant funding secured, action plan in implementation phase. Office retention efforts continuing with focus on broadening tenant mix. Market information distribution expanding — BID positioning as go-to source for Golden Triangle data.</p>
<h2>Recommendations</h2>
<ol><li>Approve spring event calendar and associated budget allocation</li><li>Review Innovation District partnership agreements for board vote</li><li>Authorize boundary expansion feasibility study (deferred from prior term)</li></ol>`,
};

const DealRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<DealRoomMessage[]>([]);

  const {
    room,
    sources,
    messages: initialMessages,
    artifacts,
    loading,
    error,
    saving,
    lastSaved,
    activeTab,
    setActiveTab,
    saveTabContent,
    refetch,
  } = useDealRoom(id);

  // Sync initial messages once — seed demo messages for Golden Triangle if API returns none
  React.useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    } else if (initialMessages.length === 0 && messages.length === 0 && id === GOLDEN_TRIANGLE_ROOM_ID) {
      setMessages(GOLDEN_TRIANGLE_SEED_MESSAGES);
    }
  }, [initialMessages, id]);

  // Chat hook with new message callback
  const handleNewMessages = useCallback((userMsg: DealRoomMessage, aiMsg: DealRoomMessage) => {
    setMessages(prev => [...prev, userMsg, aiMsg]);
  }, []);

  const { sending, sendMessage } = useDealRoomChat(id, handleNewMessages);

  // Source management
  const { uploading, uploadProgress, uploadFile, deleteSource } = useDealRoomSources(id, refetch);

  // Merge demo artifacts for Golden Triangle (supplement DB artifacts to reach 6)
  const displayArtifacts = useMemo(() => {
    if (id !== GOLDEN_TRIANGLE_ROOM_ID) return artifacts;
    const existingTypes = new Set(artifacts.map(a => a.artifact_type));
    const extras = GOLDEN_TRIANGLE_EXTRA_ARTIFACTS.filter(a => !existingTypes.has(a.artifact_type));
    return [...artifacts, ...extras];
  }, [artifacts, id]);

  // Current tab content from room data (with demo fallback for Golden Triangle)
  const currentContent = useMemo(() => {
    if (!room?.tab_content) return '';
    const dbContent = (room.tab_content as Record<string, string>)[activeTab] || '';
    if (dbContent) return dbContent;
    // Fallback to demo content for Golden Triangle room
    if (id === GOLDEN_TRIANGLE_ROOM_ID) {
      return GOLDEN_TRIANGLE_TAB_CONTENT[activeTab] || '';
    }
    return '';
  }, [room?.tab_content, activeTab, id]);

  // Handle tab change — saves current content then switches
  const handleTabChange = useCallback((tab: DealRoomTab) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  // Handle editor content change (debounced save)
  const handleContentChange = useCallback((tab: DealRoomTab, content: string) => {
    saveTabContent(tab, content);
  }, [saveTabContent]);

  // Handle chat send
  const handleSendMessage = useCallback(async (message: string, actionChip?: string) => {
    return sendMessage(message, actionChip);
  }, [sendMessage]);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <img src="/assets/logos/flat_P_logo.png" alt="P" className="w-7 h-7" />
          </div>
          <p className="text-white/40 text-sm">Loading Deal Room...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error || 'Deal Room not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="text-sm text-white/60 hover:text-white underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0B1120]">
      <DealRoomHeader room={room} />
      <DealRoomTabs activeTab={activeTab} onTabChange={handleTabChange} />
      <DealRoomLayout
        leftPanel={
          <SourcesPanel
            sources={sources}
            artifacts={displayArtifacts}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onUploadFile={uploadFile}
            onDeleteSource={deleteSource}
          />
        }
        centerPanel={
          <EditorPanel
            content={currentContent}
            activeTab={activeTab}
            wordCount={room.word_count || 0}
            saving={saving}
            lastSaved={lastSaved}
            onContentChange={handleContentChange}
          />
        }
        rightPanel={
          <AssistantPanel
            messages={messages}
            sending={sending}
            onSendMessage={handleSendMessage}
          />
        }
      />
    </div>
  );
};

export default DealRoomPage;
