/**
 * Pipeline Data Source — Abstraction layer for pipeline summary data.
 *
 * Currently fetches from Supabase via /api/pipeline-summary.
 * Designed for future CRM integration (Procore, HubSpot, etc.) —
 * swap the fetch target without changing downstream consumers.
 */

import type { PipelineSummary } from '../types/powerflowPrompts';

/**
 * Fetch a lightweight pipeline summary for the authenticated tenant.
 * Used by Level 1 capsule to interpolate template variables.
 */
export async function getPipelineSummary(token: string): Promise<PipelineSummary> {
  const res = await fetch('/api/pipeline-summary', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error('[pipelineDataSource] Failed to fetch pipeline summary:', res.status);
    return { activeOpportunityCount: 0, topOpportunityName: null, topWarmthScore: 0 };
  }

  return res.json();
}

/**
 * Interpolate {{template_variables}} in a prompt string with pipeline data.
 * Only used for Level 1 — Levels 2-6 send their userPrompt as-is.
 */
export function interpolatePrompt(template: string, data: PipelineSummary): string {
  return template
    .replace(/\{\{activeOpportunityCount\}\}/g, String(data.activeOpportunityCount))
    .replace(/\{\{topOpportunityName\}\}/g, data.topOpportunityName || 'N/A')
    .replace(/\{\{topWarmthScore\}\}/g, String(data.topWarmthScore));
}
