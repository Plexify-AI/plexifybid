/**
 * PlexiCoS Agents — Agent registry page
 *
 * Shows the orchestration visual, 6 agent cards, and recent activity feed.
 * "Ambient But Not Autonomous" — agents suggest, Mel approves.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Mail, BarChart3, BookOpen, MapPin, Users,
  Brain, ArrowRight, Activity, Clock, Zap, Shield, Mic
} from 'lucide-react';
import AgentCard, { type AgentDef } from '../components/AgentCard';
import { useSandbox } from '../contexts/SandboxContext';

// ---------------------------------------------------------------------------
// Agent registry data
// ---------------------------------------------------------------------------

const AGENTS: AgentDef[] = [
  {
    id: 'ask-plexi',
    name: 'Ask Plexi',
    role: 'Conversational Intelligence',
    description:
      'Your primary AI interface. Ask questions about your pipeline, prospects, and market in natural language. Plexi routes complex queries to specialist agents automatically.',
    icon: MessageSquare,
    status: 'active',
    capabilities: ['Pipeline Search', 'Outreach Drafting', 'Pipeline Analysis'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Open Ask Plexi',
    actionPath: '/ask-plexi',
  },
  {
    id: 'outreach-specialist',
    name: 'Outreach Specialist',
    role: 'Personalized Communications',
    description:
      'Generates prospect-specific outreach emails using pain points, warm intro paths, and case study data. Adapts tone from formal board-level to casual follow-up.',
    icon: Mail,
    status: 'active',
    capabilities: ['Email Drafting', 'Tone Adjustment', 'Follow-up Sequences'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Draft Outreach',
    actionQuery: 'Draft outreach for my top prospect',
  },
  {
    id: 'pipeline-analyst',
    name: 'Pipeline Analyst',
    role: 'Pipeline Intelligence',
    description:
      'Analyzes your prospect pipeline for patterns, risks, and opportunities. Identifies stalled deals, warmth trends, and recommends next actions.',
    icon: BarChart3,
    status: 'active',
    capabilities: ['Warmth Analysis', 'Phase Tracking', 'Risk Detection', 'Action Recommendations'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Analyze Pipeline',
    actionQuery: "How's my pipeline looking?",
  },
  {
    id: 'plexivoice',
    name: 'PlexiVoice',
    role: 'Voice DNA Intelligence',
    description:
      'Captures your unique writing voice and ensures every AI-generated message sounds authentically like you. Analyzes writing patterns, vocabulary, and tone to create a Voice DNA profile.',
    icon: Mic,
    status: 'active',
    capabilities: ['Voice Analysis', 'Style Matching', 'Tone Enforcement', 'Profile Creation'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Create Voice Profile',
    actionQuery: 'I want to create my Voice DNA profile',
  },
  {
    id: 'linkedingraph',
    name: 'LinkedIn Agent',
    role: 'Network Intelligence',
    description:
      'Import and classify your LinkedIn network into warmth-scored BD opportunities. Extracts signals from messages, endorsements, recommendations, and invitations to prioritize outreach.',
    icon: Users,
    status: 'active',
    capabilities: ['LinkedIn Import', 'Vertical Classification', 'Warmth Scoring', 'Priority Queue', 'Opportunity Import'],
    model: 'Claude Haiku 4.5',
    actionLabel: 'Import LinkedIn',
    actionQuery: 'I want to import my LinkedIn connections',
  },
  {
    id: 'notebookbd',
    name: 'NotebookBD',
    role: 'Document Intelligence',
    description:
      'Upload proposals, meeting minutes, RFPs, and market reports. NotebookBD extracts key intelligence, builds a searchable knowledge base, and generates audio briefings for on-the-go review.',
    icon: BookOpen,
    status: 'coming_soon',
    capabilities: ['Document RAG', 'Audio Briefings', 'Podcast Generation', 'DOCX Export'],
    model: 'Claude Sonnet 4 + ElevenLabs TTS',
    actionLabel: 'Coming Soon',
  },
  {
    id: 'place-graph',
    name: 'Place Graph Analyst',
    role: 'Ecosystem Mapping',
    description:
      'Maps the relationships between BID districts, Opportunity Zones, development sites, and stakeholders. Visualizes who controls what, where capital is flowing, and which connections unlock deals.',
    icon: MapPin,
    status: 'coming_soon',
    capabilities: ['Spatial Analysis', 'BID Boundaries', 'OZ Tract Overlay', 'Stakeholder Mapping'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Coming Soon',
  },
  {
    id: 'relationship-network',
    name: 'Relationship Network',
    role: 'Stakeholder Intelligence',
    description:
      'Maps your professional network against prospect decision-makers. Finds warm introduction paths, tracks relationship strength over time, and recommends who to connect with next.',
    icon: Users,
    status: 'coming_soon',
    capabilities: ['Connection Mapping', 'Warm Intro Discovery', 'Relationship Scoring', 'Network Gap Analysis'],
    model: 'Claude Sonnet 4',
    actionLabel: 'Coming Soon',
  },
];

// ---------------------------------------------------------------------------
// Event type → friendly label for activity feed
// ---------------------------------------------------------------------------

function formatEventType(eventType: string, eventData: any): string {
  switch (eventType) {
    case 'ask_plexi_chat': {
      const tools = eventData?.tool_calls;
      if (Array.isArray(tools) && tools.length > 0) {
        const toolLabels: Record<string, string> = {
          search_prospects: 'searched prospects',
          draft_outreach: 'drafted outreach email',
          analyze_pipeline: 'analyzed pipeline',
        };
        const label = toolLabels[tools[0]] || tools[0];
        return `Ask Plexi ${label}`;
      }
      return 'Ask Plexi processed a query';
    }
    case 'sandbox_auth_success':
      return 'Sandbox session started';
    case 'sandbox_auth_failure':
      return 'Authentication attempt failed';
    default:
      return eventType.replace(/_/g, ' ');
  }
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'ask_plexi_chat':
      return <MessageSquare size={13} className="text-blue-400" />;
    case 'sandbox_auth_success':
      return <Shield size={13} className="text-green-400" />;
    case 'sandbox_auth_failure':
      return <Shield size={13} className="text-red-400" />;
    default:
      return <Activity size={13} className="text-gray-400" />;
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PlexiCosAgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useSandbox();
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [voiceProfile, setVoiceProfile] = useState<{ status: string; owner_name?: string; confidence_score?: number } | null>(null);
  const [linkedinStats, setLinkedinStats] = useState<{ count: number; avgWarmth: number } | null>(null);

  // Fetch recent usage events + voice profile status
  useEffect(() => {
    if (!token) return;

    fetch('/api/usage-events?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch((err) => {
        console.error('[PlexiCoS] Failed to load activity:', err);
      })
      .finally(() => setEventsLoading(false));

    // Fetch voice DNA profile status for PlexiVoice card
    fetch('/api/voice-dna/profiles/active', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setVoiceProfile({
            status: data.profile.status,
            owner_name: data.profile.owner_name,
            confidence_score: data.profile.confidence_score,
          });
        }
      })
      .catch(() => {
        // No profile or endpoint error — leave as null
      });

    // Fetch LinkedIn Graph import stats
    fetch('/api/opportunities?source=linkedingraph', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const opps = data.opportunities || [];
        if (opps.length > 0) {
          const totalWarmth = opps.reduce((sum: number, o: any) => sum + (o.enrichment_data?.warmth_composite || o.warmth_score || 0), 0);
          setLinkedinStats({ count: opps.length, avgWarmth: Math.round(totalWarmth / opps.length) });
        }
      })
      .catch(() => {
        // No data or endpoint error — leave as null
      });
  }, [token]);

  // Build agent defs with dynamic status
  const getAgentWithDynamicStatus = (agent: AgentDef): AgentDef => {
    if (agent.id === 'plexivoice') {
      if (voiceProfile?.status === 'active') {
        return { ...agent, actionLabel: 'View Profile', actionQuery: 'Show my Voice DNA profile' };
      }
      if (voiceProfile?.status === 'pending_approval') {
        return { ...agent, actionLabel: 'Review Profile', actionQuery: 'Show my Voice DNA profile for review' };
      }
      return agent;
    }
    if (agent.id === 'linkedingraph') {
      if (linkedinStats) {
        return { ...agent, actionLabel: 'View Imports', actionQuery: 'Show my LinkedIn import results' };
      }
      return agent;
    }
    return agent;
  };

  // Handle agent card action
  const handleAgentAction = (agent: AgentDef) => {
    if (agent.actionPath) {
      navigate(agent.actionPath);
    } else if (agent.actionQuery) {
      navigate(`/ask-plexi?q=${encodeURIComponent(agent.actionQuery)}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Brain size={22} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">PlexiCoS Agents</h1>
              <p className="text-sm text-blue-300/70">Your AI Chief of Staff — orchestrating specialized agents to accelerate your BD workflow</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 max-w-2xl">
            Each agent is a specialist. PlexiCoS coordinates them so you get the right intelligence at the right time.
          </p>
        </div>

        {/* Orchestration Visual */}
        <div className="mb-8 bg-gray-800/40 border border-gray-700/40 rounded-xl p-6">
          <div className="flex items-center justify-center gap-0 flex-wrap">
            {/* Step 1: You Ask */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-1.5">
                  <Users size={20} className="text-white" />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">You ask</p>
              </div>
              <ArrowRight size={16} className="text-gray-600 shrink-0 mx-1" />
            </div>

            {/* Step 2: PlexiCoS Routes */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-blue-500/15 border-2 border-blue-500/40 flex items-center justify-center mx-auto mb-1.5 shadow-lg shadow-blue-500/10">
                  <Brain size={24} className="text-blue-400" />
                </div>
                <p className="text-[10px] text-blue-300 font-semibold">PlexiCoS routes</p>
              </div>
              <ArrowRight size={16} className="text-gray-600 shrink-0 mx-1" />
            </div>

            {/* Step 3: Specialist Delivers */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-1.5">
                  <Zap size={20} className="text-green-400" />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Specialist delivers</p>
              </div>
              <ArrowRight size={16} className="text-gray-600 shrink-0 mx-1" />
            </div>

            {/* Step 4: You Decide */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-1.5">
                <Shield size={20} className="text-amber-400" />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">You decide</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-500 mt-4">
            Ambient But Not Autonomous — agents surface insights, you make the calls.
          </p>
        </div>

        {/* Agent Cards Grid */}
        <div className="mb-10">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Agent Registry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((agent) => {
              const displayAgent = getAgentWithDynamicStatus(agent);
              return (
                <div key={agent.id} className="relative">
                  <AgentCard agent={displayAgent} onAction={handleAgentAction} />
                  {agent.id === 'plexivoice' && (
                    <div className="absolute top-3 right-3">
                      {voiceProfile?.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                          Voice DNA Active &middot; {Math.round((voiceProfile.confidence_score ?? 0) * 100)}%
                        </span>
                      ) : voiceProfile?.status === 'pending_approval' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          Profile ready for review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">
                          No voice profile yet
                        </span>
                      )}
                    </div>
                  )}
                  {agent.id === 'linkedingraph' && (
                    <div className="absolute top-3 right-3 max-w-[140px]">
                      {linkedinStats ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium leading-tight rounded-lg bg-green-500/15 text-green-300 border border-green-500/25 text-center">
                          {linkedinStats.count} imported<br />Avg warmth: {linkedinStats.avgWarmth}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium leading-tight rounded-lg bg-gray-700/50 text-gray-400 border border-gray-600/30 text-center">
                          No LinkedIn data yet
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Agent Activity */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Recent Agent Activity</h2>
          </div>

          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl overflow-hidden">
            {eventsLoading ? (
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  <span className="ml-2">Loading activity...</span>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">No agent activity yet.</p>
                <p className="text-xs text-gray-600 mt-1">Start by asking Plexi about your pipeline.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/30">
                {events.map((event, i) => (
                  <div key={event.id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/15 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gray-700/30 flex items-center justify-center shrink-0">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">
                        {formatEventType(event.event_type, event.event_data)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
                      <Clock size={10} />
                      <span>{timeAgo(event.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlexiCosAgentsPage;
