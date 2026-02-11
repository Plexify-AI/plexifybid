// ─── Data Model Types (match JSON data files exactly) ────────────────────────

export interface WarmthFactor {
  factor: string;
  weight: number;
  positive: boolean;
  detail: string;
  explanation?: string;
}

export type ProjectStage = 'planning' | 'design' | 'bid' | 'award' | 'construction' | 'closeout';

export type BuildingTypeCode = 'OFF-A' | 'OFF-B' | 'MXD' | 'RES-H' | 'HLT' | 'TRN' | 'EDU';

export interface DodgeProject {
  id: string;
  dodgeNumber: string;

  // Basic Info
  name: string;
  type: string;
  buildingTypeCode: BuildingTypeCode;

  // Size & Value
  squareFeet: number;
  squareFeetDisplay: string;
  floors: number;
  value: number;
  valueDisplay: string;

  // Stage
  stage: ProjectStage;
  stageDetail: string;
  constructionStart?: string;
  estimatedCompletion?: string;

  // Location
  address: string;
  city: string;
  borough: string;
  neighborhood: string;
  state: string;
  zip: string;

  // Key Players
  owner: string;
  gc: string;
  gcSlug: string;
  architect: string;

  // Multivista Opportunity
  painPoints: string[];
  primaryPainPoint: string;
  painPointDetail: string;
  suggestedService: string;
  suggestedServiceReason: string;
  relevantCaseStudyId: string;

  // Contact
  primaryContactId: string;

  // Warmth Scoring
  warmthScore: number;
  warmthFactors: WarmthFactor[];
}

export type EngagementType = 'whitepaper' | 'webinar' | 'meeting' | 'email' | 'event';

export interface Engagement {
  type: EngagementType;
  date: string;
  description: string;
  count?: number;
}

export interface ProjectContact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string;

  // LinkedIn
  linkedInConnected: boolean;
  linkedInDegree?: 1 | 2 | 3;
  linkedInMutualName?: string;
  linkedInMutualCompany?: string;

  // Role
  decisionMaker: boolean;
  budgetAuthority: boolean;

  // Engagement History
  engagements: Engagement[];
}

export type RelationshipStrength = 'strong' | 'medium' | 'weak';

export interface MutualConnection {
  id: string;
  name: string;
  title: string;
  company: string;
  relationshipStrength: RelationshipStrength;
  dealsClosedVia: number;
  closeRateViaThisPerson: number;
  canIntroTo: string[];
}

export interface CaseStudy {
  id: string;
  clientName: string;
  projectName: string;
  gc: string;
  service: string;
  roiAmount: number;
  roiDisplay: string;
  roiType: string;
  roiExplanation: string;
  relevantTags: string[];
}

export interface ICPGeography {
  city: string;
  boroughs: string[];
  includeWestchester: boolean;
}

export interface ICPFilters {
  minValue: number;
  maxValue: number | null;
  stages: ProjectStage[];
  constructionMonthMax: number;
  buildingTypes: BuildingTypeCode[];
  geography: ICPGeography;
  targetGCs: string[];
}

export interface WarmthWeights {
  warmIntroAvailable: number;
  similarPastWin: number;
  optimalTiming: number;
  decisionMakerIdentified: number;
  engagementHistory: number;
  linkedInConnection: number;
  gcRelationship: number;
}

export interface ICPConfig {
  name: string;
  filters: ICPFilters;
  services: string[];
  warmthWeights: WarmthWeights;
}

// ─── Enriched Types (resolved references for display) ────────────────────────

export interface EnrichedProspect {
  project: DodgeProject;
  contact: ProjectContact;
  connection: MutualConnection | null;
  caseStudy: CaseStudy;
}

// ─── Demo Response Types ─────────────────────────────────────────────────────

export interface ProspectQueryResponse {
  totalMatches: number;
  topProspects: EnrichedProspect[];
}

export interface EmailStats {
  wordCount: number;
  readingTime: string;
  personalizationScore: number;
}

export interface OutreachEmail {
  to: string;
  subject: string;
  preheader: string;
  body: string;
  signature: string;
}

export interface OutreachResponse {
  prospect: EnrichedProspect;
  email: OutreachEmail;
  stats: EmailStats;
}

export interface WinFactor {
  label: string;
  impact: string;
  explanation: string;
  positive: boolean;
}

export interface WinRecommendation {
  summary: string;
  nextSteps: string[];
  timeline: string;
}

export interface WinProbabilityResponse {
  prospect: EnrichedProspect;
  probability: number;
  positiveFactors: WinFactor[];
  riskFactors: WinFactor[];
  recommendation: WinRecommendation;
}

// ─── Demo Chat Types ─────────────────────────────────────────────────────────

export type DemoAgent = 'place-graph' | 'ask-plexi' | 'notebook-bd';

export type MessageRole = 'user' | 'assistant';

export type MessageContentType =
  | 'text'
  | 'prospect-query'
  | 'outreach'
  | 'win-probability';

export interface DemoMessage {
  id: string;
  role: MessageRole;
  contentType: MessageContentType;
  text?: string;
  agent?: DemoAgent;
  prospectQueryResponse?: ProspectQueryResponse;
  outreachResponse?: OutreachResponse;
  winProbabilityResponse?: WinProbabilityResponse;
  timestamp: number;
}

export type DemoStep = 'idle' | 'prospect-query' | 'outreach' | 'win-probability' | 'complete';

export interface DemoState {
  step: DemoStep;
  messages: DemoMessage[];
  isLoading: boolean;
  activeAgent: DemoAgent | null;
  selectedProspectIndex: number | null;
}
