/**
 * PlexifyAEC — Opportunities API
 *
 * GET  /api/opportunities  — List with warmth data, filters, explanations
 * POST /api/opportunities  — Create new opportunity
 *
 * Auth: sandboxAuth middleware sets req.tenant before handlers run.
 */

import { getSupabase } from '../lib/supabase.js';
import { generateScoreExplanation } from '../services/evidence-bundler.js';
import { computeWarmth } from '../services/warmth-engine.js';

// ---------------------------------------------------------------------------
// GET /api/opportunities — List with warmth data
// ---------------------------------------------------------------------------

export async function handleListOpportunities(req, res) {
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
    const filter = url.searchParams.get('filter') || 'all';
    const sort = url.searchParams.get('sort') || 'warmth_desc';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Build query
    let query = supabase
      .from('opportunities')
      .select('*')
      .eq('tenant_id', tenantId);

    // Apply filter
    switch (filter) {
      case 'hot':
        query = query.gte('warmth_score', 75);
        break;
      case 'warm':
        query = query.gte('warmth_score', 40).lt('warmth_score', 75);
        break;
      case 'cold':
        query = query.lt('warmth_score', 40);
        break;
      case 'promoted':
        query = query.eq('promoted_to_home', true);
        break;
      case 'home':
        // Hot + promoted combined for Home screen cards
        query = query.or('warmth_score.gte.40,promoted_to_home.eq.true');
        break;
      case 'all':
      default:
        // No filter — exclude ejected by default
        query = query.not('stage', 'eq', 'ejected');
        break;
    }

    // Apply sort — home filter uses promoted-first ordering
    if (filter === 'home') {
      query = query
        .order('promoted_to_home', { ascending: false })
        .order('warmth_score', { ascending: false })
        .limit(5);
    } else {
      switch (sort) {
        case 'warmth_asc':
          query = query.order('warmth_score', { ascending: true });
          break;
        case 'created':
          query = query.order('created_at', { ascending: false });
          break;
        case 'warmth_desc':
        default:
          query = query.order('warmth_score', { ascending: false });
          break;
      }
      query = query.limit(limit);
    }

    const { data: opportunities, error } = await query;
    if (error) throw error;

    // Enrich each opportunity with live warmth + latest events + explanation
    const enriched = await Promise.all(
      opportunities.map(async (opp) => {
        // Fetch ALL events for live warmth computation
        const { data: allEvents } = await supabase
          .from('events')
          .select('id, event_type, payload, source, created_at, opportunity_id')
          .eq('tenant_id', tenantId)
          .eq('opportunity_id', opp.id)
          .order('created_at', { ascending: false });

        // Compute warmth live from events (deterministic, no stale cache)
        const warmth = computeWarmth(allEvents || []);
        const liveScore = warmth.score;

        // Use latest 3 events for display
        const recentEvents = (allEvents || []).slice(0, 3);

        // Generate explanation from live computation
        const explanation = generateScoreExplanation(
          liveScore,
          warmth.drivers,
          warmth.decayApplied,
          warmth.spamPenalty
        );

        // Fetch latest warmth history for delta
        const { data: warmthHist } = await supabase
          .from('warmth_history')
          .select('score_before, score_after, delta, computed_at')
          .eq('opportunity_id', opp.id)
          .order('computed_at', { ascending: false })
          .limit(1);

        const lastCompute = warmthHist?.[0];

        return {
          ...opp,
          warmth_score: liveScore,
          recent_events: recentEvents,
          explanation,
          last_delta: lastCompute?.delta || 0,
          ejected: warmth.ejected || false,
        };
      })
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ opportunities: enriched }));
  } catch (err) {
    console.error('[opportunities] Error listing:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to list opportunities',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// POST /api/opportunities — Create new opportunity
// ---------------------------------------------------------------------------

export async function handleCreateOpportunity(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { account_name, contact_name, contact_email, contact_title, deal_hypothesis } = body || {};

  if (!account_name) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing required field: account_name' }));
  }

  try {
    const supabase = getSupabase();
    const tenantId = tenant.id;

    // Create opportunity — stage: prospecting, warmth: 0
    const { data: opp, error: oppError } = await supabase
      .from('opportunities')
      .insert({
        tenant_id: tenantId,
        account_name,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        contact_title: contact_title || null,
        deal_hypothesis: deal_hypothesis || null,
        stage: 'prospecting',
        warmth_score: 0,
      })
      .select()
      .single();

    if (oppError) throw oppError;

    // Emit SIGNAL_LOGGED event for creation
    await supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        opportunity_id: opp.id,
        event_type: 'SIGNAL_LOGGED',
        payload: { description: `Opportunity created: ${account_name}` },
        source: 'system',
      });

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ opportunity: opp }));
  } catch (err) {
    console.error('[opportunities] Error creating:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to create opportunity',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    }));
  }
}
