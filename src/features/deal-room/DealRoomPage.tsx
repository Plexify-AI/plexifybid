import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDealRoom } from './hooks/useDealRoom';
import { useDealRoomSources } from './hooks/useDealRoomSources';
import { useDealRoomChat } from './hooks/useDealRoomChat';
import DealRoomHeader from './DealRoomHeader';
import DealRoomTabs from './DealRoomTabs';
import DealRoomLayout from './DealRoomLayout';
import SourcesPanel from './panels/SourcesPanel';
import EditorPanel from './panels/EditorPanel';
import AssistantPanel from './panels/AssistantPanel';
import StrategySection from '../../components/StrategySection';
import { useSandbox } from '../../contexts/SandboxContext';
import type { DealRoomMessage, DealRoomTab, DealRoomArtifact } from '../../types/dealRoom';
import { GOLDEN_TRIANGLE_ROOM_ID, DEAL_ROOM_TABS } from '../../types/dealRoom';

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

interface LinkedOpportunity {
  contact_name?: string;
  account_name?: string;
  contact_email?: string;
}

const DealRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useSandbox();
  const [messages, setMessages] = useState<DealRoomMessage[]>([]);
  const [linkedOpportunity, setLinkedOpportunity] = useState<LinkedOpportunity | null>(null);
  const [generatingSkill, setGeneratingSkill] = useState<string | null>(null);
  const [insufficientDataMsg, setInsufficientDataMsg] = useState<{ tab: DealRoomTab; message: string } | null>(null);
  // For non-tab artifacts (infographic, etc.) — shown in Artifacts sub-tab when set
  const [viewingArtifact, setViewingArtifact] = useState<DealRoomArtifact | null>(null);

  const {
    room,
    sources,
    messages: initialMessages,
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
    refetch,
    addArtifact,
  } = useDealRoom(id);

  // URL deep-linking: read ?tab= on mount (FR-015)
  const [searchParams] = useSearchParams();
  const urlTabApplied = React.useRef(false);
  useEffect(() => {
    if (urlTabApplied.current || loading) return;
    const tabParam = searchParams.get('tab') as DealRoomTab | null;
    if (tabParam && DEAL_ROOM_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
    urlTabApplied.current = true;
  }, [loading, searchParams, setActiveTab]);

  // Fetch linked opportunity data if room has opportunity_id
  useEffect(() => {
    const roomAny = room as any;
    if (!roomAny?.opportunity_id || !token) return;
    fetch(`/api/opportunities/${roomAny.opportunity_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.opportunity) {
          setLinkedOpportunity({
            contact_name: data.opportunity.contact_name,
            account_name: data.opportunity.account_name,
            contact_email: data.opportunity.contact_email,
          });
        }
      })
      .catch(() => {}); // Non-fatal
  }, [room, token]);

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

  // Handle tab change — update URL with replaceState (don't pollute history) + switch tab
  const handleTabChange = useCallback((tab: DealRoomTab) => {
    setActiveTab(tab);
    setViewingArtifact(null); // Clear non-tab artifact view when switching tabs
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  }, [setActiveTab]);

  // Handle editor content change (debounced save)
  const handleContentChange = useCallback((tab: DealRoomTab, content: string) => {
    saveTabContent(tab, content);
  }, [saveTabContent]);

  // Handle chat send
  const handleSendMessage = useCallback(async (message: string, actionChip?: string) => {
    return sendMessage(message, actionChip);
  }, [sendMessage]);

  // Copy AI response content to the active tab's editor (appends to existing)
  const handleCopyToEditor = useCallback((markdownContent: string) => {
    // Convert markdown to simple HTML for TipTap
    const html = markdownContent
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    const wrapped = `<p>${html}</p>`.replace(/<p><h([123])>/g, '<h$1>').replace(/<\/h([123])><\/p>/g, '</h$1>');

    // Append to existing editor content (build document from multiple chats)
    const existing = (room?.tab_content as Record<string, string>)?.[activeTab] || '';
    const separator = existing ? '<hr/>' : '';
    const combined = existing + separator + wrapped;
    saveTabContent(activeTab, combined);
  }, [saveTabContent, activeTab, room?.tab_content]);

  // Handle skill-based artifact generation from agent chips
  const handleGenerateSkill = useCallback(async (skillKey: string, label: string) => {
    if (!id || !token) return;

    setGeneratingSkill(skillKey);
    setInsufficientDataMsg(null); // Clear any previous info message

    // Add user message to chat
    const userMsg: DealRoomMessage = {
      id: `skill-user-${Date.now()}`,
      deal_room_id: id,
      tenant_id: '',
      role: 'user',
      content: label,
      citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Golden Triangle demo: use pre-built responses via chat path
      if (id === GOLDEN_TRIANGLE_ROOM_ID) {
        await sendMessage(label, label);
        return;
      }

      // Board Deck uses a dedicated endpoint that returns binary PPTX
      if (skillKey === 'board_deck') {
        const deckRes = await fetch(`/api/deal-rooms/${id}/generate-deck`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ skillKey: 'board_deck' }),
        });

        // Check for JSON error or insufficient data response
        const contentType = deckRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const jsonResult = await deckRes.json();
          if (jsonResult.success === false && jsonResult.reason === 'insufficient_data') {
            const aiMsg: DealRoomMessage = {
              id: `skill-info-${Date.now()}`,
              deal_room_id: id,
              tenant_id: '',
              role: 'assistant',
              content: jsonResult.message || 'Not enough source data to generate a Board Deck.',
              citations: [],
              created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMsg]);
            return;
          }
          if (jsonResult.error) {
            throw new Error(jsonResult.error);
          }
        }

        if (!deckRes.ok) throw new Error('Deck generation failed');

        // Download the PPTX blob
        const blob = await deckRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${room?.name || 'Board-Deck'}_Board-Deck.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const aiMsg: DealRoomMessage = {
          id: `skill-ai-${Date.now()}`,
          deal_room_id: id,
          tenant_id: '',
          role: 'assistant',
          content: '**Board Deck generated!** Your branded .pptx file has been downloaded. Open it in PowerPoint or Google Slides.',
          citations: [],
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);

        // Refresh artifacts list to pick up the new record
        refetch();
        return;
      }

      // Real rooms: call the skill generation endpoint
      const res = await fetch(`/api/deal-rooms/${id}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skillKey }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }));
        const aiMsg: DealRoomMessage = {
          id: `skill-err-${Date.now()}`,
          deal_room_id: id,
          tenant_id: '',
          role: 'assistant',
          content: `Failed to generate ${label}: ${err.error || 'Unknown error'}`,
          citations: [],
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
        return;
      }

      const result = await res.json();

      // Handle insufficient data — sources too thin to generate
      if (result.success === false && result.reason === 'insufficient_data') {
        const aiMsg: DealRoomMessage = {
          id: `skill-info-${Date.now()}`,
          deal_room_id: id,
          tenant_id: '',
          role: 'assistant',
          content: result.message || `Not enough source data to generate ${label}.`,
          citations: [],
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
        // Show teal info in the editor panel
        if (DEAL_ROOM_TABS.includes(skillKey as DealRoomTab)) {
          setInsufficientDataMsg({ tab: skillKey as DealRoomTab, message: result.message });
          handleTabChange(skillKey as DealRoomTab);
        }
        return;
      }

      // Normal artifact response
      const output = result.content?.output;

      // Build a summary message for the chat panel
      let summary = output?.title
        ? `**${output.title}**\n\nGenerated successfully. View the full ${label} in the Report Editor tab.`
        : `${label} generated successfully. View it in the Report Editor tab.`;

      // Append thin-data note if quality is low
      if (result.data_quality === 'thin' && result.data_message) {
        summary += `\n\n*Note: ${result.data_message}*`;
      }

      const aiMsg: DealRoomMessage = {
        id: `skill-ai-${Date.now()}`,
        deal_room_id: id,
        tenant_id: '',
        role: 'assistant',
        content: summary,
        citations: [],
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Add artifact to local state (no full refetch = no loading flash)
      addArtifact(result);

      // Show thin-data hint in editor if quality is low
      if (result.data_quality === 'thin' && result.data_message && DEAL_ROOM_TABS.includes(skillKey as DealRoomTab)) {
        setInsufficientDataMsg({ tab: skillKey as DealRoomTab, message: result.data_message });
      }

      // Switch to the generated skill's tab so the user sees the result
      if (DEAL_ROOM_TABS.includes(skillKey as DealRoomTab)) {
        handleTabChange(skillKey as DealRoomTab);
      } else {
        // Non-tab artifact (infographic, etc.) — show in Artifacts sub-tab
        setViewingArtifact(result);
      }
    } catch (err: any) {
      console.error('[DealRoomPage] Skill generation error:', err);
      const aiMsg: DealRoomMessage = {
        id: `skill-err-${Date.now()}`,
        deal_room_id: id,
        tenant_id: '',
        role: 'assistant',
        content: `Failed to generate ${label}: ${err.message || 'Network error'}`,
        citations: [],
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setGeneratingSkill(null);
    }
  }, [id, token, sendMessage, addArtifact, handleTabChange]);

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
    <div className="flex flex-col h-screen overflow-hidden bg-[#0B1120]">
      <DealRoomHeader
        room={room}
        activeTab={activeTab}
        editorContent={currentContent}
        activeArtifactId={(viewingArtifact || artifactsByType.get(activeTab))?.id || null}
      />
      <DealRoomTabs activeTab={activeTab} onTabChange={handleTabChange} tabConfig={tabConfig} />
      {/* Sprint E / E2 — Strategy skills (prospect-backed, no sources required) */}
      <StrategySection
        dealRoomId={id || ''}
        defaultOpportunityId={(room as any)?.opportunity_id || null}
        onArtifactCreated={(a) => addArtifact(a)}
      />
      <DealRoomLayout
        leftPanel={
          <SourcesPanel
            sources={sources}
            artifacts={displayArtifacts}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onUploadFile={uploadFile}
            onDeleteSource={deleteSource}
            onArtifactClick={(artifactType) => {
              if (DEAL_ROOM_TABS.includes(artifactType as any)) {
                // Tab-based artifact — switch tab
                setViewingArtifact(null);
                handleTabChange(artifactType as DealRoomTab);
              } else {
                // Non-tab artifact (infographic, etc.) — show in Artifacts sub-tab
                const art = artifacts.find(a => a.artifact_type === artifactType);
                if (art) setViewingArtifact(art);
              }
            }}
            onGenerateSkill={handleGenerateSkill}
            generatingSkill={generatingSkill}
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
            activeArtifact={viewingArtifact || artifactsByType.get(activeTab) || null}
            generatingSkill={generatingSkill}
            onGenerateSkill={handleGenerateSkill}
            insufficientDataMessage={
              insufficientDataMsg?.tab === activeTab ? insufficientDataMsg.message : undefined
            }
            showArtifactsView={!!viewingArtifact}
          />
        }
        rightPanel={
          <AssistantPanel
            messages={messages}
            sending={sending}
            generatingSkill={generatingSkill}
            onSendMessage={handleSendMessage}
            onGenerateSkill={handleGenerateSkill}
            onCopyToEditor={handleCopyToEditor}
            opportunity={linkedOpportunity}
          />
        }
      />
    </div>
  );
};

export default DealRoomPage;
