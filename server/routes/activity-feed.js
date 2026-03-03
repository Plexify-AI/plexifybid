/**
 * PlexifyAEC — Activity Feed API
 *
 * GET /api/activity-feed — Recent events across ALL opportunities for tenant.
 * Returns events enriched with opportunity account_name and warmth_score.
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { getSupabase } from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// GET /api/activity-feed
// ---------------------------------------------------------------------------

export async function handleActivityFeed(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const supabase = getSupabase();
    const tenantId = tenant.id;

    // Parse query params
    const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20);

    // Fetch recent events for this tenant
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, event_type, payload, created_at, opportunity_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ events: [] }));
    }

    // Batch-fetch related opportunities for account_name + warmth_score
    const oppIds = [...new Set(events.map((e) => e.opportunity_id).filter(Boolean))];
    const { data: opps, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, account_name, warmth_score')
      .eq('tenant_id', tenantId)
      .in('id', oppIds);

    if (oppsError) throw oppsError;

    // Build lookup map
    const oppMap = new Map((opps || []).map((o) => [o.id, o]));

    // Enrich events with opportunity data
    const feed = events.map((e) => {
      const opp = oppMap.get(e.opportunity_id);
      return {
        id: e.id,
        event_type: e.event_type,
        payload: e.payload,
        created_at: e.created_at,
        opportunity_id: e.opportunity_id,
        account_name: opp?.account_name || 'Unknown',
        warmth_score: opp?.warmth_score || 0,
      };
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ events: feed }));
  } catch (err) {
    console.error('[activity-feed] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to load activity feed',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}
