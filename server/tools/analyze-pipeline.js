/**
 * Tool: analyze_pipeline
 *
 * Analyze the current prospect pipeline. Calculate aggregates,
 * identify top opportunities, and suggest next actions.
 */

import { getProspects, getContacts } from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// Claude tool definition
// ---------------------------------------------------------------------------

export const definition = {
  name: 'analyze_pipeline',
  description:
    'Analyze the current AEC prospect pipeline. Calculates win probabilities, ' +
    'breaks down by phase and sector, identifies stalled deals, and suggests next actions. ' +
    'Use this when the user asks about pipeline health, deal status, or overall performance.',
  input_schema: {
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        description:
          'Timeframe for analysis: "current", "this_quarter", "this_year". Default: "current"',
      },
      group_by: {
        type: 'string',
        description:
          'How to group results: "phase", "sector", "gc", "borough". Default: "phase"',
        enum: ['phase', 'sector', 'gc', 'borough'],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Executor — queries all prospects, computes aggregates
// ---------------------------------------------------------------------------

export async function execute(input, tenantId) {
  const { group_by = 'phase' } = input;

  // Fetch all prospects for this tenant
  const prospects = await getProspects(tenantId, { limit: 200 });
  const contacts = await getContacts(tenantId);

  // Build contact lookup
  const contactMap = {};
  for (const c of contacts) contactMap[c.ref_id] = c;

  // ---- Aggregate by group_by field ----
  const groups = {};
  for (const p of prospects) {
    const key = p[group_by] || 'Unknown';
    if (!groups[key]) groups[key] = { count: 0, total_value: 0, avg_warmth: 0, prospects: [] };
    groups[key].count++;
    groups[key].total_value += p.estimated_value || 0;
    groups[key].avg_warmth += p.warmth_score || 0;
    groups[key].prospects.push(p.ref_id);
  }
  // Compute averages
  for (const key of Object.keys(groups)) {
    groups[key].avg_warmth = Math.round(groups[key].avg_warmth / groups[key].count);
  }

  // ---- Top opportunities (highest warmth) ----
  const topOpportunities = prospects
    .slice(0, 5)
    .map((p) => {
      const contact = p.primary_contact_ref ? contactMap[p.primary_contact_ref] : null;
      return {
        ref_id: p.ref_id,
        project_name: p.project_name,
        gc_name: p.gc_name,
        warmth_score: p.warmth_score,
        estimated_value: p.estimated_value,
        phase: p.phase,
        stage: p.stage,
        contact_name: contact?.name || null,
        has_decision_maker: contact?.decision_maker || false,
      };
    });

  // ---- Warmth distribution ----
  const warmthBuckets = { hot: 0, warm: 0, cool: 0, cold: 0 };
  for (const p of prospects) {
    const w = p.warmth_score || 0;
    if (w >= 80) warmthBuckets.hot++;
    else if (w >= 60) warmthBuckets.warm++;
    else if (w >= 40) warmthBuckets.cool++;
    else warmthBuckets.cold++;
  }

  // ---- Total pipeline value ----
  const totalValue = prospects.reduce((sum, p) => sum + (p.estimated_value || 0), 0);
  const avgWarmth = prospects.length > 0
    ? Math.round(prospects.reduce((sum, p) => sum + (p.warmth_score || 0), 0) / prospects.length)
    : 0;

  // ---- Stalled prospects (high warmth but early stage) ----
  const stalled = prospects
    .filter(
      (p) =>
        p.warmth_score >= 60 &&
        p.stage &&
        ['identified', 'researching'].includes(p.stage.toLowerCase())
    )
    .slice(0, 5)
    .map((p) => ({
      ref_id: p.ref_id,
      project_name: p.project_name,
      warmth_score: p.warmth_score,
      stage: p.stage,
    }));

  return {
    total_prospects: prospects.length,
    total_pipeline_value: totalValue,
    avg_warmth_score: avgWarmth,
    warmth_distribution: warmthBuckets,
    grouped_by: group_by,
    groups,
    top_opportunities: topOpportunities,
    stalled_prospects: stalled,
    analysis_note:
      'Use this data to provide the user with actionable pipeline insights. ' +
      'Highlight top opportunities they should pursue this week. ' +
      'Flag any stalled high-warmth prospects that need attention.',
  };
}
