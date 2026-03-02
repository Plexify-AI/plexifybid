/**
 * PlexifyAEC — Signal Logging API
 *
 * POST /api/signals           — Log signal, trigger warmth recompute
 * GET  /api/signals/:oppId    — Event history for an opportunity
 * POST /api/signals/bulk      — Bulk import, single recompute after all inserts
 *
 * Auth: sandboxAuth middleware sets req.tenant before handlers run.
 */

import { getSupabase } from '../lib/supabase.js';
import { recomputeAndStore } from '../services/warmth-engine.js';
import { generateScoreExplanation } from '../services/evidence-bundler.js';

// ---------------------------------------------------------------------------
// POST /api/signals — Log a single signal
// ---------------------------------------------------------------------------

export async function handleLogSignal(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { opportunity_id, event_type, payload, source } = body || {};

  if (!opportunity_id || !event_type) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing required fields: opportunity_id, event_type' }));
  }

  // Validate event_type against allowed types
  const VALID_TYPES = [
    'SIGNAL_LOGGED', 'OUTREACH_SENT', 'OUTREACH_OPENED', 'OUTREACH_CLICKED',
    'OUTREACH_REPLIED', 'MEETING_BOOKED', 'MEETING_COMPLETED',
    'PROPOSAL_SENT', 'DEAL_WON', 'DEAL_LOST',
  ];

  if (!VALID_TYPES.includes(event_type)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `Invalid event_type. Must be one of: ${VALID_TYPES.join(', ')}` }));
  }

  try {
    const supabase = getSupabase();
    const tenantId = tenant.id;

    // Verify opportunity belongs to tenant
    const { data: opp, error: oppError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', opportunity_id)
      .eq('tenant_id', tenantId)
      .single();

    if (oppError || !opp) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Opportunity not found' }));
    }

    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        opportunity_id,
        event_type,
        payload: payload || {},
        source: source || 'manual',
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // Recompute warmth
    const warmthResult = await recomputeAndStore(supabase, tenantId, opportunity_id);

    // Generate score explanation
    const explanation = generateScoreExplanation(
      warmthResult.scoreAfter,
      [], // drivers already in warmth_history
      0,
      0
    );

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      event,
      warmth: {
        scoreBefore: warmthResult.scoreBefore,
        scoreAfter: warmthResult.scoreAfter,
        delta: warmthResult.delta,
        promoted: warmthResult.promoted,
        ejected: warmthResult.ejected,
        explanation: explanation.summary,
      },
    }));
  } catch (err) {
    console.error('[signals] Error logging signal:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to log signal',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// GET /api/signals/:opportunityId — Event history
// ---------------------------------------------------------------------------

export async function handleGetSignals(req, res, opportunityId) {
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
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Verify opportunity belongs to tenant
    const { data: opp, error: oppError } = await supabase
      .from('opportunities')
      .select('id, warmth_score, stage')
      .eq('id', opportunityId)
      .eq('tenant_id', tenantId)
      .single();

    if (oppError || !opp) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Opportunity not found' }));
    }

    // Fetch events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventsError) throw eventsError;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      events,
      warmth: opp.warmth_score,
      stage: opp.stage,
    }));
  } catch (err) {
    console.error('[signals] Error fetching signals:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to fetch signals',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// POST /api/signals/bulk — Bulk import
// ---------------------------------------------------------------------------

export async function handleBulkSignals(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { signals } = body || {};

  if (!Array.isArray(signals) || signals.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing or empty signals array' }));
  }

  if (signals.length > 100) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Max 100 signals per bulk import' }));
  }

  try {
    const supabase = getSupabase();
    const tenantId = tenant.id;

    // Insert all events
    const rows = signals.map(s => ({
      tenant_id: tenantId,
      opportunity_id: s.opportunity_id,
      event_type: s.event_type,
      payload: s.payload || {},
      source: s.source || 'manual',
    }));

    const { data: insertedEvents, error: insertError } = await supabase
      .from('events')
      .insert(rows)
      .select();

    if (insertError) throw insertError;

    // Collect unique opportunity IDs for recompute
    const oppIds = [...new Set(signals.map(s => s.opportunity_id).filter(Boolean))];

    // Single recompute per opportunity
    const warmthResults = {};
    for (const oppId of oppIds) {
      try {
        warmthResults[oppId] = await recomputeAndStore(supabase, tenantId, oppId);
      } catch (err) {
        console.error(`[signals/bulk] Recompute failed for opp ${oppId}:`, err.message);
        warmthResults[oppId] = { error: err.message };
      }
    }

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      inserted: insertedEvents.length,
      recomputed: oppIds.length,
      warmth: warmthResults,
    }));
  } catch (err) {
    console.error('[signals/bulk] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Bulk import failed',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}
