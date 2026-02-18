/**
 * Deal Room Artifact Types
 *
 * Three structured document types that Claude generates from uploaded sources.
 * Uses a shared ArtifactEnvelope<T> pattern for consistency.
 */

// ---------------------------------------------------------------------------
// Shared Envelope
// ---------------------------------------------------------------------------

export type ArtifactType = 'deal_summary' | 'competitive_analysis' | 'meeting_prep';

export interface ArtifactSourceRef {
  id: string;
  file_name: string;
}

export interface ArtifactEnvelope<T> {
  artifact_type: ArtifactType;
  schema_version: '1.0';
  generated_at: string; // ISO timestamp
  deal_room_id: string;
  sources_used: ArtifactSourceRef[];
  output: T;
}

// ---------------------------------------------------------------------------
// Deal Summary
// ---------------------------------------------------------------------------

export interface DealSummaryMetric {
  label: string;
  value: string;
}

export interface DealSummaryPlayer {
  name: string;
  role: string;
  organization?: string;
}

export interface DealSummaryRisk {
  description: string;
  severity: 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface DealSummaryOutput {
  title: string;
  executive_summary: string[];
  key_metrics: DealSummaryMetric[];
  key_players: DealSummaryPlayer[];
  timeline: string[];
  risks: DealSummaryRisk[];
  next_steps: string[];
}

export type DealSummaryArtifact = ArtifactEnvelope<DealSummaryOutput>;

// ---------------------------------------------------------------------------
// Competitive Analysis
// ---------------------------------------------------------------------------

export interface CompetitorEntry {
  name: string;
  strengths: string[];
  weaknesses: string[];
  differentiator: string;
  threat_level: 'high' | 'medium' | 'low';
}

export interface CompetitiveAnalysisOutput {
  title: string;
  competitors: CompetitorEntry[];
  market_position: string;
  strategy_recommendations: string[];
}

export type CompetitiveAnalysisArtifact = ArtifactEnvelope<CompetitiveAnalysisOutput>;

// ---------------------------------------------------------------------------
// Meeting Prep Brief
// ---------------------------------------------------------------------------

export interface AgendaItem {
  topic: string;
  duration_minutes: number;
  owner?: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface MeetingPrepOutput {
  title: string;
  meeting_context: string;
  agenda: AgendaItem[];
  talking_points: string[];
  objection_handlers: ObjectionHandler[];
  key_questions: string[];
  background_context: string;
}

export type MeetingPrepArtifact = ArtifactEnvelope<MeetingPrepOutput>;

// ---------------------------------------------------------------------------
// Union + DB Record
// ---------------------------------------------------------------------------

export type ArtifactOutput = DealSummaryOutput | CompetitiveAnalysisOutput | MeetingPrepOutput;
export type ArtifactContent = DealSummaryArtifact | CompetitiveAnalysisArtifact | MeetingPrepArtifact;

/** Shape returned from the database / API */
export interface DealRoomArtifactRecord {
  id: string;
  tenant_id: string;
  deal_room_id: string;
  artifact_type: ArtifactType;
  title: string;
  content: ArtifactContent | null;
  status: 'generating' | 'ready' | 'error';
  sources_used: ArtifactSourceRef[];
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Chip config (for the UI)
// ---------------------------------------------------------------------------

export const ARTIFACT_CHIPS: {
  type: ArtifactType;
  label: string;
  description: string;
}[] = [
  {
    type: 'deal_summary',
    label: 'Deal Summary',
    description: 'Executive overview with metrics, players, risks & next steps',
  },
  {
    type: 'competitive_analysis',
    label: 'Competitive Analysis',
    description: 'Competitor breakdown with strengths, weaknesses & threat levels',
  },
  {
    type: 'meeting_prep',
    label: 'Meeting Prep',
    description: 'Agenda, talking points, objection handlers & key questions',
  },
];
