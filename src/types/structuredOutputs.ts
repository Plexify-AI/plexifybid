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

export interface StructuredCitation {
  number: number;
  sourceId: string;
  sourceName: string;
  quote: string;
}

export interface AssessmentTrendsOutput {
  title: string;
  metadata: {
    period: string;
    preparedDate: string;
  };
  sections: {
    collectionSummary: {
      rows: Array<{
        propertyType: string;
        billed: string;
        collected: string;
        rate: string;
        citation?: StructuredCitation;
      }>;
      total: {
        billed: string;
        collected: string;
        rate: string;
        citation?: StructuredCitation;
      };
    };
    delinquencyAging: Array<{
      bucket: string;
      amount: string;
      propertyCount: number;
      citation?: StructuredCitation;
    }>;
    topDelinquent: Array<{
      address: string;
      amount: string;
      daysOverdue: number;
      citation?: StructuredCitation;
    }>;
    recommendations: Array<{
      content: string;
    }>;
  };
}

export type AssessmentTrendsEnvelope = StructuredOutputEnvelope<AssessmentTrendsOutput>;

export interface OZRFSectionOutput {
  title: string;
  metadata: {
    reportingPeriod: string;
    preparedDate: string;
  };
  sections: {
    communityImpact: {
      jobsCreated: { value: number; citation?: StructuredCitation };
      jobsRetained: { value: number; citation?: StructuredCitation };
      localHiringRate: { value: string; citation?: StructuredCitation };
    };
    investmentFacilitation: {
      totalInvestment: { value: string; citation?: StructuredCitation };
      qofInvestments: { value: number; citation?: StructuredCitation };
      businessRelocations: { value: number; citation?: StructuredCitation };
    };
    environmentalSocial: Array<{
      metric: string;
      value: string;
      citation?: StructuredCitation;
    }>;
    disclosureStatement: string;
  };
}

export type OZRFSectionEnvelope = StructuredOutputEnvelope<OZRFSectionOutput>;

export type NotebookBDStructuredOutput =
  | BoardBriefEnvelope
  | AssessmentTrendsEnvelope
  | OZRFSectionEnvelope;
