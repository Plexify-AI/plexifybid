/**
 * Pipeline Summary — Lightweight endpoint for Level 1 template interpolation.
 *
 * GET /api/pipeline-summary
 * Returns: { activeOpportunityCount, topOpportunityName, topWarmthScore }
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 * Reuses existing getProspects() from server/lib/supabase.js.
 */

import { getProspects } from '../lib/supabase.js';

export async function handlePipelineSummary(req, res) {
  const tenant = req.tenant;

  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    // Fetch top prospects ordered by warmth_score descending (default)
    const prospects = await getProspects(tenant.id, { limit: 50 });

    const activeCount = prospects.length;
    const top = prospects[0] || null;

    const summary = {
      activeOpportunityCount: activeCount,
      topOpportunityName: top ? top.project_name : null,
      topWarmthScore: top ? (top.warmth_score || 0) : 0,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(summary));
  } catch (err) {
    console.error('[pipeline-summary] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Failed to fetch pipeline summary',
        details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      })
    );
  }
}
