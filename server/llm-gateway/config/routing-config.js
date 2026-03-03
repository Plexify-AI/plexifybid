/**
 * PlexifyAEC — LLM Routing Rules
 *
 * Maps request attributes (clientTier, taskType) to ordered provider chains.
 * First matching rule wins. Default chain is anthropic -> openai.
 */

import { CLIENT_TIERS } from '../types.js';

export const rules = [
  // RULE 1: Government clients — never use Anthropic
  {
    match: { clientTier: CLIENT_TIERS.GOVERNMENT },
    providers: ['openai'],
    reason: 'Federal supply chain compliance',
  },

  // RULE 2: Writing-heavy tasks — Claude first (best long-form + domain)
  {
    match: { taskType: 'outreach_generation' },
    providers: ['anthropic', 'openai'],
    strategy: 'quality_first',
  },
  {
    match: { taskType: 'deal_room_artifact' },
    providers: ['anthropic', 'openai'],
    strategy: 'quality_first',
  },
  {
    match: { taskType: 'evidence_bundle' },
    providers: ['anthropic', 'openai'],
    strategy: 'quality_first',
  },

  // RULE 3: Research/enrichment — GPT-4o first when available
  {
    match: { taskType: 'enrichment' },
    providers: ['openai', 'anthropic'],
    strategy: 'quality_first',
  },

  // RULE 4: Document summarization — cost-optimized
  {
    match: { taskType: 'document_summary' },
    providers: ['anthropic', 'openai'],
    strategy: 'cost_optimized',
  },
];

// Default: Claude -> GPT-4o
export const defaultChain = ['anthropic', 'openai'];

export const failoverRetries = 2;

export const healthCheckInterval = 30000;
