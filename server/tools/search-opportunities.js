/**
 * Tool: search_opportunities
 *
 * Search the opportunities table for contacts matching criteria.
 * Works for both warm LinkedIn contacts (Ken) and cold leads (Ben/SunnAx).
 * Returns ranked results with enrichment data context.
 */

import { getOpportunities } from '../lib/supabase.js';

export const definition = {
  name: 'search_opportunities',
  description:
    'Search the opportunity pipeline for contacts and accounts. ' +
    'Works across all data types: warm LinkedIn contacts (with message counts), ' +
    'cold leads (with email + industry), and company-only records. ' +
    'Use this when the user asks about opportunities, contacts, leads, accounts, ' +
    'or wants to find people by industry, region, warm status, company name, ' +
    'or campaign (e.g., trade show lead batches, import cohorts).',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language search query, e.g. "Higher Ed leads in New York" or "warmest contacts"',
      },
      filters: {
        type: 'object',
        description: 'Optional filters to narrow results',
        properties: {
          industry: {
            type: 'string',
            description: 'Industry filter from enrichment_data, e.g. "Higher Ed", "Game Development", "K-12"',
          },
          region: {
            type: 'string',
            description: 'Region filter from enrichment_data, e.g. "New York", "South Carolina"',
          },
          warm_status: {
            type: 'string',
            description: 'Warm status filter: "Y" for warm contacts, "none" for cold leads',
            enum: ['Y', 'none'],
          },
          has_email: {
            type: 'boolean',
            description: 'Filter for contacts that have an email address',
          },
          stage: {
            type: 'string',
            description: 'Pipeline stage filter, e.g. "prospecting", "warming", "engaged"',
          },
          source: {
            type: 'string',
            description: 'Data source filter, e.g. "linkedingraph_agent", "sunnax_import"',
          },
          source_campaign: {
            type: 'string',
            description: 'Filter by the exact campaign name the lead was imported under. Use this when the user references a specific campaign by name (e.g., "Animation Yall TN 2026-04", "xencelabs_ga_leads"). Must be an exact string match.',
          },
        },
      },
      sort_by: {
        type: 'string',
        description: 'Sort results by: "warmth" (default), "message_count", "recent", "name"',
        enum: ['warmth', 'message_count', 'recent', 'name'],
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 15)',
      },
    },
    required: ['query'],
  },
};

export async function execute(input, tenantId) {
  const { query, filters = {}, sort_by = 'warmth', limit = 15 } = input;

  let opportunities = await getOpportunities(tenantId, { limit: 500 });

  // Apply filters
  if (filters.industry) {
    const ind = filters.industry.toLowerCase();
    opportunities = opportunities.filter(o => {
      const ed = o.enrichment_data || {};
      return (ed.industry && ed.industry.toLowerCase().includes(ind)) ||
             (o.deal_hypothesis && o.deal_hypothesis.toLowerCase().includes(ind));
    });
  }

  if (filters.region) {
    const reg = filters.region.toLowerCase();
    opportunities = opportunities.filter(o => {
      const ed = o.enrichment_data || {};
      return ed.region && ed.region.toLowerCase().includes(reg);
    });
  }

  if (filters.warm_status) {
    opportunities = opportunities.filter(o => {
      const ed = o.enrichment_data || {};
      return ed.warm_status === filters.warm_status;
    });
  }

  if (filters.has_email) {
    opportunities = opportunities.filter(o => o.contact_email);
  }

  if (filters.stage) {
    const stg = filters.stage.toLowerCase();
    opportunities = opportunities.filter(o => o.stage && o.stage.toLowerCase() === stg);
  }

  if (filters.source) {
    const src = filters.source.toLowerCase();
    opportunities = opportunities.filter(o => {
      const ed = o.enrichment_data || {};
      return ed.source && ed.source.toLowerCase().includes(src);
    });
  }

  // Text search across key fields
  if (query) {
    const q = query.toLowerCase();
    const stopWords = new Set([
      'top', 'best', 'show', 'find', 'get', 'my', 'me', 'the', 'all',
      'opportunities', 'opportunity', 'contacts', 'contact', 'leads', 'lead',
      'list', 'search', 'look', 'for', 'with', 'and', 'from', 'who', 'what',
      'how', 'many', 'should', 'can', 'do', 'have', 'are', 'is', 'in',
    ]);
    const keywords = q.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length > 0) {
      opportunities = opportunities.filter(o => {
        const ed = o.enrichment_data || {};
        const searchable = [
          o.account_name,
          o.contact_name,
          o.contact_title,
          o.contact_email,
          o.deal_hypothesis,
          o.stage,
          ed.industry,
          ed.region,
          ed.source,
        ].filter(Boolean).join(' ').toLowerCase();
        return keywords.some(kw => searchable.includes(kw));
      });
    }
  }

  // Sort
  switch (sort_by) {
    case 'message_count':
      opportunities.sort((a, b) =>
        ((b.enrichment_data?.message_count || 0) - (a.enrichment_data?.message_count || 0))
      );
      break;
    case 'recent':
      opportunities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case 'name':
      opportunities.sort((a, b) => (a.contact_name || a.account_name || '').localeCompare(b.contact_name || b.account_name || ''));
      break;
    case 'warmth':
    default:
      opportunities.sort((a, b) => (b.warmth_score || 0) - (a.warmth_score || 0));
      break;
  }

  // Trim to limit
  opportunities = opportunities.slice(0, limit);

  // Build enriched results
  const results = opportunities.map(o => {
    const ed = o.enrichment_data || {};
    return {
      id: o.id,
      account_name: o.account_name,
      contact_name: o.contact_name,
      contact_email: o.contact_email,
      contact_title: o.contact_title,
      stage: o.stage,
      warmth_score: o.warmth_score,
      deal_hypothesis: o.deal_hypothesis,
      // Enrichment highlights
      source: ed.source || 'unknown',
      industry: ed.industry || null,
      region: ed.region || null,
      warm_status: ed.warm_status || 'none',
      message_count: ed.message_count || 0,
      linkedin_url: ed.linkedin_url || null,
      lead_type: ed.lead_type || (ed.warm_status === 'Y' ? 'warm' : 'cold'),
      won_leads: ed.won_leads || 0,
      open_leads: ed.open_leads || 0,
    };
  });

  return {
    total_matches: results.length,
    query,
    filters_applied: filters,
    opportunities: results,
  };
}
