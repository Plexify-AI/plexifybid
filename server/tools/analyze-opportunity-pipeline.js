/**
 * Tool: analyze_opportunity_pipeline
 *
 * Analyze the opportunity pipeline with stats and recommendations.
 * Adapts analysis based on data shape: warm LinkedIn data vs cold lead lists.
 */

import { getOpportunities } from '../lib/supabase.js';

export const definition = {
  name: 'analyze_opportunity_pipeline',
  description:
    'Analyze the opportunity pipeline — stats, breakdowns, and recommendations. ' +
    'Adapts to data shape: warm contacts with LinkedIn history get relationship-based advice, ' +
    'cold leads with email get outreach-sequence advice. ' +
    'Use when the user asks about pipeline health, lead counts, industry breakdown, ' +
    'campaign breakdowns (via group_by="campaign"), ' +
    'or wants strategic recommendations on who to pursue.',
  input_schema: {
    type: 'object',
    properties: {
      group_by: {
        type: 'string',
        description:
          'Group results by one of: ' +
          '"stage" (pipeline stage), ' +
          '"industry" (enrichment_data.industry), ' +
          '"region" (enrichment_data.region), ' +
          '"source" (enrichment_data.source — the import batch identifier, e.g., "sunnax_import", "linkedingraph_agent"), ' +
          '"campaign" (the source_campaign column — the user-facing campaign name, e.g., "Animation Yall TN 2026-04"), ' +
          '"lead_type" (warm vs. cold). ' +
          'Use "campaign" when the user asks about campaigns they have leads from. ' +
          'Use "source" only when they ask about import batches or data provenance.',
        enum: ['stage', 'industry', 'region', 'source', 'campaign', 'lead_type'],
      },
    },
  },
};

export async function execute(input, tenantId) {
  const { group_by = 'stage' } = input;

  const opportunities = await getOpportunities(tenantId, { limit: 2000 });

  // ── Grouping ──
  const groups = {};
  for (const o of opportunities) {
    const ed = o.enrichment_data || {};
    let key;
    switch (group_by) {
      case 'industry':
        key = ed.industry || 'Unknown';
        break;
      case 'region':
        key = ed.region || 'Unknown';
        break;
      case 'source':
        key = ed.source || 'unknown';
        break;
      case 'campaign':
        key = o.source_campaign || 'No campaign';
        break;
      case 'lead_type':
        key = ed.lead_type || (ed.warm_status === 'Y' ? 'warm' : 'cold');
        break;
      case 'stage':
      default:
        key = o.stage || 'Unknown';
        break;
    }
    if (!groups[key]) groups[key] = { count: 0, with_email: 0, with_linkedin: 0, warm: 0, avg_warmth: 0 };
    groups[key].count++;
    if (o.contact_email) groups[key].with_email++;
    if (ed.linkedin_url) groups[key].with_linkedin++;
    if (ed.warm_status === 'Y' || ed.message_count > 0) groups[key].warm++;
    groups[key].avg_warmth += o.warmth_score || 0;
  }
  for (const key of Object.keys(groups)) {
    groups[key].avg_warmth = Math.round(groups[key].avg_warmth / groups[key].count);
  }

  // ── Data shape analysis ──
  let withEmail = 0, withLinkedIn = 0, warmContacts = 0, coldLeads = 0;
  let totalMessageCount = 0;
  const industries = new Set();

  for (const o of opportunities) {
    const ed = o.enrichment_data || {};
    if (o.contact_email) withEmail++;
    if (ed.linkedin_url) withLinkedIn++;
    if (ed.warm_status === 'Y' || ed.message_count > 0) {
      warmContacts++;
      totalMessageCount += ed.message_count || 0;
    } else {
      coldLeads++;
    }
    if (ed.industry) industries.add(ed.industry);
  }

  // ── Top warm contacts (by message count) ──
  const topWarm = opportunities
    .filter(o => (o.enrichment_data?.message_count || 0) > 0)
    .sort((a, b) => (b.enrichment_data?.message_count || 0) - (a.enrichment_data?.message_count || 0))
    .slice(0, 5)
    .map(o => ({
      account_name: o.account_name,
      contact_name: o.contact_name,
      contact_title: o.contact_title,
      message_count: o.enrichment_data?.message_count || 0,
      warm_status: o.enrichment_data?.warm_status,
      warmth_score: o.warmth_score,
    }));

  // ── Top cold leads with email (ready for outreach) ──
  const topColdWithEmail = opportunities
    .filter(o => o.contact_email && (!o.enrichment_data?.warm_status || o.enrichment_data.warm_status === 'none'))
    .slice(0, 5)
    .map(o => ({
      account_name: o.account_name,
      contact_name: o.contact_name,
      contact_email: o.contact_email,
      contact_title: o.contact_title,
      industry: o.enrichment_data?.industry,
      region: o.enrichment_data?.region,
    }));

  // ── Stage distribution ──
  const stages = {};
  for (const o of opportunities) {
    const s = o.stage || 'unknown';
    stages[s] = (stages[s] || 0) + 1;
  }

  return {
    total_opportunities: opportunities.length,
    data_shape: {
      with_email: withEmail,
      with_linkedin: withLinkedIn,
      warm_contacts: warmContacts,
      cold_leads: coldLeads,
      total_message_count: totalMessageCount,
      industries_count: industries.size,
      industries: [...industries].sort(),
    },
    stage_distribution: stages,
    grouped_by: group_by,
    groups,
    top_warm_contacts: topWarm,
    top_cold_leads_with_email: topColdWithEmail,
    analysis_instructions:
      'Provide actionable insights based on this data. ' +
      'For warm contacts (message_count > 0): recommend relationship-deepening outreach. ' +
      'For cold leads with email: recommend research-first, value-add email sequences. ' +
      'For cold leads without email: recommend LinkedIn connection requests. ' +
      'Highlight industry concentrations and suggest vertical-specific strategies. ' +
      'Be specific — use real names and companies from the data.',
  };
}
