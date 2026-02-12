/**
 * Tool: search_prospects
 *
 * Search the prospect database for AEC opportunities matching criteria.
 * Returns ranked prospects with warmth scores, pain points, and contact info.
 */

import {
  getProspects,
  getContacts,
  getCaseStudies,
} from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// Claude tool definition
// ---------------------------------------------------------------------------

export const definition = {
  name: 'search_prospects',
  description:
    'Search the prospect database for AEC construction opportunities matching criteria. ' +
    'Returns ranked prospects with warmth scores, pain points, and suggested approaches. ' +
    'Use this when the user asks about prospects, opportunities, pipeline, or project searches.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language search query, e.g. "healthcare projects" or "high warmth Turner jobs"',
      },
      filters: {
        type: 'object',
        description: 'Optional filters to narrow results',
        properties: {
          min_warmth: {
            type: 'number',
            description: 'Minimum warmth score (0-100)',
          },
          phase: {
            type: 'string',
            description:
              'Project phase filter, e.g. "Construction", "Pre-Construction", "Design"',
          },
          location: {
            type: 'string',
            description: 'Location filter, e.g. "Manhattan", "Brooklyn"',
          },
          gc: {
            type: 'string',
            description: 'General contractor name filter, e.g. "Turner", "Skanska"',
          },
        },
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 10)',
      },
    },
    required: ['query'],
  },
};

// ---------------------------------------------------------------------------
// Executor — queries Supabase, enriches with contacts + case studies
// ---------------------------------------------------------------------------

export async function execute(input, tenantId) {
  const { query, filters = {}, limit = 10 } = input;

  // Fetch prospects sorted by warmth
  let prospects = await getProspects(tenantId, {
    limit: 50, // fetch more, then filter
    orderBy: 'warmth_score',
    ascending: false,
  });

  // Apply filters
  if (filters.min_warmth) {
    prospects = prospects.filter((p) => p.warmth_score >= filters.min_warmth);
  }
  if (filters.phase) {
    const phase = filters.phase.toLowerCase();
    prospects = prospects.filter(
      (p) => p.phase && p.phase.toLowerCase().includes(phase)
    );
  }
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    prospects = prospects.filter(
      (p) =>
        (p.borough && p.borough.toLowerCase().includes(loc)) ||
        (p.neighborhood && p.neighborhood.toLowerCase().includes(loc)) ||
        (p.address && p.address.toLowerCase().includes(loc))
    );
  }
  if (filters.gc) {
    const gc = filters.gc.toLowerCase();
    prospects = prospects.filter(
      (p) => p.gc_name && p.gc_name.toLowerCase().includes(gc)
    );
  }

  // Text search across key fields — only apply if the query has
  // domain-specific keywords (skip generic phrases like "top prospects")
  if (query) {
    const q = query.toLowerCase();
    // Skip generic/meta words that don't describe actual project attributes
    const stopWords = new Set([
      'top', 'best', 'show', 'find', 'get', 'my', 'me', 'the', 'all',
      'prospects', 'prospect', 'opportunities', 'opportunity', 'projects',
      'project', 'highest', 'warmth', 'score', 'warmest', 'hottest',
      'list', 'ranked', 'search', 'look', 'for', 'with', 'and', 'from',
    ]);
    const keywords = q
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    if (keywords.length > 0) {
      prospects = prospects.filter((p) => {
        const searchable = [
          p.project_name,
          p.gc_name,
          p.owner,
          p.borough,
          p.neighborhood,
          p.sector,
          p.phase,
          p.stage,
          ...(p.pain_points || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return keywords.some((kw) => searchable.includes(kw));
      });
    }
  }

  // Trim to limit
  prospects = prospects.slice(0, limit);

  // Fetch contacts + case studies to enrich results
  const [contacts, caseStudies] = await Promise.all([
    getContacts(tenantId),
    getCaseStudies(tenantId),
  ]);

  // Build contact and case study lookup maps
  const contactMap = {};
  for (const c of contacts) contactMap[c.ref_id] = c;

  const caseStudyMap = {};
  for (const cs of caseStudies) caseStudyMap[cs.ref_id] = cs;

  // Enrich prospects
  const enriched = prospects.map((p) => {
    const contact = p.primary_contact_ref ? contactMap[p.primary_contact_ref] : null;
    const caseStudy = p.relevant_case_study_ref
      ? caseStudyMap[p.relevant_case_study_ref]
      : null;

    return {
      ref_id: p.ref_id,
      project_name: p.project_name,
      address: p.address,
      borough: p.borough,
      neighborhood: p.neighborhood,
      gc_name: p.gc_name,
      owner: p.owner,
      sector: p.sector,
      phase: p.phase,
      stage: p.stage,
      estimated_value: p.estimated_value,
      warmth_score: p.warmth_score,
      warmth_factors: p.warmth_factors,
      pain_points: p.pain_points,
      primary_contact: contact
        ? {
            name: contact.name,
            title: contact.title,
            company: contact.company,
            decision_maker: contact.decision_maker,
            budget_authority: contact.budget_authority,
            linkedin_connected: contact.linkedin_connected,
            linkedin_degree: contact.linkedin_degree,
            linkedin_mutual_name: contact.linkedin_mutual_name,
          }
        : null,
      relevant_case_study: caseStudy
        ? {
            client_name: caseStudy.client_name,
            project_name: caseStudy.project_name,
            service: caseStudy.service,
            roi_display: caseStudy.roi_display,
            roi_type: caseStudy.roi_type,
          }
        : null,
    };
  });

  return {
    total_matches: enriched.length,
    query,
    filters_applied: filters,
    prospects: enriched,
  };
}
