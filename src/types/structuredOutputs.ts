export type NotebookBDAgentId =
  | 'board-brief'
  | 'assessment-trends'
  | 'ozrf-section';

export interface StructuredOutputSourceRef {
  id: string;
  label: string;
}

export interface StructuredOutputEnvelope<TOutput> {
  agentId: NotebookBDAgentId;
  schemaVersion: '1.0';
  generatedAt: string; // ISO timestamp
  projectId: string;
  sourcesUsed: StructuredOutputSourceRef[];
  output: TOutput;
}

export interface BoardBriefMetric {
  label: string;
  value: string;
}

export interface BoardBriefOutput {
  title: string;
  districtName?: string;
  reportingPeriod?: string;
  executiveSummary: string[];
  keyMetrics: BoardBriefMetric[];
  highlights: string[];
  risks: string[];
  recommendations: string[];
}

export type BoardBriefEnvelope = StructuredOutputEnvelope<BoardBriefOutput>;

export interface AssessmentTrendDatum {
  label: string;
  value: string;
  note?: string;
}

export interface AssessmentTrendsOutput {
  title: string;
  summary: string[];
  trends: AssessmentTrendDatum[];
  risks: string[];
  recommendedActions: string[];
}

export type AssessmentTrendsEnvelope = StructuredOutputEnvelope<AssessmentTrendsOutput>;

export interface OZRFSectionOutput {
  title: string;
  narrative: string[];
  complianceChecklist: string[];
  openItems: string[];
}

export type OZRFSectionEnvelope = StructuredOutputEnvelope<OZRFSectionOutput>;

export type NotebookBDStructuredOutput =
  | BoardBriefEnvelope
  | AssessmentTrendsEnvelope
  | OZRFSectionEnvelope;
