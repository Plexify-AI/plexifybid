/**
 * PowerflowPrompt — Types for the left pyramid capsule button prompts
 *
 * Each level maps a Maslow need to a Bloom cognitive level and a sales stage.
 * The systemPrompt is stored server-side; the client only references the level number.
 */

export interface PowerflowPrompt {
  level: number;
  label: string;
  maslow: string;
  bloom: string;
  salesStage: string;
  userPrompt: string;
  emptyPipelineFallback?: string; // Only Level 1 has this
}

export interface PipelineSummary {
  activeOpportunityCount: number;
  topOpportunityName: string | null;
  topWarmthScore: number;
}

export interface PowerflowSuccessQuote {
  level: number;
  capsuleLabel: string;
  bloom: string;
  maslow: string;
  activatedLabel: string;
  encouragementQuote: string;
  quoteAttribution: string;
}
