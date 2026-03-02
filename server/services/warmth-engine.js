/**
 * PlexifyAEC — Warmth Computation Engine
 *
 * Warmth scores are DERIVED from events — never stored independently.
 * Same events = same score every time (deterministic).
 *
 * Three exports:
 *   computeWarmth(events)     — Pure function. No DB, no side effects.
 *   recomputeAndStore(...)    — Fetches events, computes, persists, checks takeover.
 *   checkTakeoverEligibility  — Pure function. Promotion logic.
 */

import { SIGNAL_POINTS, DECAY, SPAM, TAKEOVER, DEDUP, FORMULA_VERSION } from '../constants/warmth-config.js';

// ---------------------------------------------------------------------------
// Signal classification (per Sprint 1 spec)
// ---------------------------------------------------------------------------

const A_SIGNALS = new Set([
  'MEETING_BOOKED',
  'MEETING_COMPLETED',
  'PROPOSAL_SENT',
  // OUTREACH_REPLIED with positive sentiment — checked dynamically
]);

const B_SIGNALS = new Set([
  'OUTREACH_CLICKED',
  'OUTREACH_OPENED',
  'SIGNAL_LOGGED',
]);

/**
 * Check if an event is an A-signal.
 * OUTREACH_REPLIED is A-signal only if sentiment is positive.
 */
function isASignal(event) {
  if (A_SIGNALS.has(event.event_type)) return true;
  if (event.event_type === 'OUTREACH_REPLIED' && event.payload?.sentiment === 'positive') return true;
  return false;
}

function isBSignal(event) {
  return B_SIGNALS.has(event.event_type);
}

// ---------------------------------------------------------------------------
// computeWarmth — Pure function
// ---------------------------------------------------------------------------

/**
 * Compute warmth score from an array of event objects.
 * Each event: { event_type, payload, created_at }
 *
 * Returns: { score, drivers, decayApplied, spamPenalty, ejected }
 */
export function computeWarmth(events) {
  if (!events || events.length === 0) {
    return { score: 0, drivers: [], decayApplied: 0, spamPenalty: 0, ejected: false };
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Filter to last 90 days
  const recentEvents = events.filter(e => new Date(e.created_at) >= ninetyDaysAgo);

  if (recentEvents.length === 0) {
    return { score: 0, drivers: [], decayApplied: 0, spamPenalty: 0, ejected: false };
  }

  // --- Check for ejection signals ---
  for (const e of recentEvents) {
    if (e.event_type === 'OUTREACH_REPLIED' && e.payload?.sentiment === 'hard_bounce') {
      return { score: 0, drivers: [], decayApplied: 0, spamPenalty: 0, ejected: true, ejectReason: 'hard_bounce' };
    }
    if (e.event_type === 'OUTREACH_REPLIED' && e.payload?.sentiment === 'unsubscribe') {
      return { score: 0, drivers: [], decayApplied: 0, spamPenalty: 0, ejected: true, ejectReason: 'unsubscribe' };
    }
  }

  // --- BASE SCORE: Sum signal points with dedup ---
  let baseScore = 0;
  const driverCandidates = [];

  // Track email opens per day for dedup (max 1 per day)
  const opensByDay = new Map();

  for (const e of recentEvents) {
    const eventDate = new Date(e.created_at).toISOString().split('T')[0];

    // Map event_type to signal point key
    const pointKey = mapEventToSignalKey(e);
    if (!pointKey || !(pointKey in SIGNAL_POINTS)) continue;

    // Dedup: max 1 EMAIL_OPEN per day
    if (pointKey === 'OUTREACH_OPENED') {
      const dayKey = `${e.opportunity_id || 'global'}_${eventDate}`;
      const count = opensByDay.get(dayKey) || 0;
      if (count >= DEDUP.EMAIL_OPEN_CAP_PER_DAY) continue;
      opensByDay.set(dayKey, count + 1);
    }

    const points = SIGNAL_POINTS[pointKey];
    baseScore += points;

    driverCandidates.push({
      event_type: e.event_type,
      points,
      description: describeEvent(e),
      created_at: e.created_at,
    });
  }

  // --- DECAY: Based on days since last event (highest threshold only, NOT cumulative) ---
  const sortedByDate = recentEvents
    .map(e => new Date(e.created_at))
    .sort((a, b) => b - a);
  const lastEventDate = sortedByDate[0];
  const daysSinceLastEvent = Math.floor((now - lastEventDate) / (1000 * 60 * 60 * 24));

  let decayApplied = 0;
  if (daysSinceLastEvent >= 30) {
    decayApplied = Math.abs(DECAY[30]);
  } else if (daysSinceLastEvent >= 14) {
    decayApplied = Math.abs(DECAY[14]);
  } else if (daysSinceLastEvent >= 7) {
    decayApplied = Math.abs(DECAY[7]);
  }

  // --- SPAM PENALTY: Unresponded outreach in last 10 days ---
  const recentOutreachSent = recentEvents.filter(
    e => e.event_type === 'OUTREACH_SENT' && new Date(e.created_at) >= tenDaysAgo
  ).length;

  const recentOutreachReplied = recentEvents.filter(
    e => e.event_type === 'OUTREACH_REPLIED' && new Date(e.created_at) >= tenDaysAgo
  ).length;

  const unresponded = recentOutreachSent - recentOutreachReplied;
  let spamPenalty = 0;
  if (unresponded >= SPAM.UNRESPONDED_THRESHOLD) {
    spamPenalty = Math.abs(SPAM.UNRESPONDED_PENALTY);
  }

  // --- CLAMP ---
  const score = Math.max(0, Math.min(100, baseScore - decayApplied - spamPenalty));

  // --- DRIVERS: Top 3 by point value ---
  const drivers = driverCandidates
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return { score, drivers, decayApplied, spamPenalty, ejected: false };
}

// ---------------------------------------------------------------------------
// checkTakeoverEligibility — Pure function
// ---------------------------------------------------------------------------

/**
 * Determine if an opportunity should promote to Home.
 *
 * Hard promote: score >= 85 AND has A-signal
 * Soft promote: score 80-84 AND 3+ B-signals in last 7 days AND has A-signal
 *
 * Returns: { eligible, reason, type: 'hard'|'soft'|'none' }
 */
export function checkTakeoverEligibility(score, events) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const hasASignal = events.some(e => isASignal(e));

  // A-signal is mandatory for any promotion
  if (!hasASignal) {
    return { eligible: false, reason: 'No A-signal detected', type: 'none' };
  }

  // Hard promote: score >= 85 AND A-signal
  if (score >= TAKEOVER.HARD_WARMTH_THRESHOLD) {
    return {
      eligible: true,
      reason: `Score ${score} >= ${TAKEOVER.HARD_WARMTH_THRESHOLD} with A-signal`,
      type: 'hard',
    };
  }

  // Soft promote: score 80-84 AND 3+ B-signals in 7 days
  if (score >= TAKEOVER.SOFT_WARMTH_MIN && score <= TAKEOVER.SOFT_WARMTH_MAX) {
    const recentBSignals = events.filter(
      e => isBSignal(e) && new Date(e.created_at) >= sevenDaysAgo
    ).length;

    if (recentBSignals >= 3) {
      return {
        eligible: true,
        reason: `Score ${score} in soft range with ${recentBSignals} B-signals in 7d`,
        type: 'soft',
      };
    }

    return {
      eligible: false,
      reason: `Score ${score} in soft range but only ${recentBSignals} B-signals in 7d (need 3+)`,
      type: 'none',
    };
  }

  return {
    eligible: false,
    reason: `Score ${score} below promotion threshold`,
    type: 'none',
  };
}

// ---------------------------------------------------------------------------
// recomputeAndStore — DB-touching function
// ---------------------------------------------------------------------------

/**
 * Full recompute cycle: fetch events → compute → update opp → write history → check takeover.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} tenantId - Tenant UUID
 * @param {string} opportunityId - Opportunity UUID
 * @returns {{ scoreBefore, scoreAfter, delta, promoted }}
 */
export async function recomputeAndStore(supabase, tenantId, opportunityId) {
  // 1. Get current score
  const { data: opp, error: oppError } = await supabase
    .from('opportunities')
    .select('warmth_score, stage')
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .single();

  if (oppError) throw oppError;

  const scoreBefore = opp.warmth_score;

  // 2. Fetch all events for this opportunity
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (eventsError) throw eventsError;

  // 3. Compute warmth
  const { score, drivers, decayApplied, spamPenalty, ejected, ejectReason } = computeWarmth(events);
  const scoreAfter = score;
  const delta = scoreAfter - scoreBefore;

  // 4. Update opportunity
  const oppUpdate = {
    warmth_score: scoreAfter,
    warmth_updated_at: new Date().toISOString(),
  };

  // Handle ejection
  if (ejected) {
    oppUpdate.stage = 'ejected';
    oppUpdate.warmth_score = 0;
  }

  await supabase
    .from('opportunities')
    .update(oppUpdate)
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId);

  // 5. Write warmth_history
  await supabase
    .from('warmth_history')
    .insert({
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      score_before: scoreBefore,
      score_after: ejected ? 0 : scoreAfter,
      delta: ejected ? -scoreBefore : delta,
      top_3_drivers: drivers,
      formula_version: FORMULA_VERSION,
    });

  // 6. Check takeover eligibility (skip if ejected or already promoted)
  let promoted = false;
  if (!ejected && opp.stage !== 'ejected' && opp.stage !== 'active_deal') {
    const takeover = checkTakeoverEligibility(scoreAfter, events);

    if (takeover.eligible) {
      promoted = true;
      await supabase
        .from('opportunities')
        .update({
          promoted_to_home: true,
          promoted_at: new Date().toISOString(),
          promotion_reason: takeover.reason,
          stage: 'takeover_ready',
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId);
    }
  }

  return {
    scoreBefore,
    scoreAfter: ejected ? 0 : scoreAfter,
    delta: ejected ? -scoreBefore : delta,
    promoted,
    ejected: ejected || false,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map an event object to its SIGNAL_POINTS key.
 * Most event_types map directly; OUTREACH_REPLIED depends on sentiment.
 */
function mapEventToSignalKey(event) {
  const type = event.event_type;

  // Direct mappings
  if (type in SIGNAL_POINTS) return type;

  // OUTREACH_REPLIED maps based on sentiment
  if (type === 'OUTREACH_REPLIED') {
    const sentiment = event.payload?.sentiment;
    if (sentiment === 'positive') return 'OUTREACH_REPLIED_POSITIVE';
    if (sentiment === 'neutral') return 'OUTREACH_REPLIED_NEUTRAL';
    return null; // negative/bounce/unsub handled elsewhere
  }

  // MEETING_COMPLETED and PROPOSAL_SENT are A-signals but not in SIGNAL_POINTS
  // They get MEETING_BOOKED and PROPOSAL_REQUESTED points respectively
  if (type === 'MEETING_COMPLETED') return 'MEETING_BOOKED';
  if (type === 'PROPOSAL_SENT') return 'PROPOSAL_REQUESTED';

  // SIGNAL_LOGGED (manual) maps to SIGNAL_LOGGED_MANUAL
  if (type === 'SIGNAL_LOGGED') return 'SIGNAL_LOGGED_MANUAL';

  return null;
}

/**
 * Human-readable description for a warmth driver.
 */
function describeEvent(event) {
  const descriptions = {
    MEETING_BOOKED: 'Meeting booked',
    MEETING_COMPLETED: 'Meeting completed',
    PROPOSAL_SENT: 'Proposal sent',
    OUTREACH_REPLIED: event.payload?.sentiment === 'positive'
      ? 'Positive reply received'
      : 'Reply received',
    OUTREACH_CLICKED: 'Link clicked in outreach',
    OUTREACH_OPENED: 'Email opened',
    OUTREACH_SENT: 'Outreach sent',
    SIGNAL_LOGGED: event.payload?.description || 'Manual signal logged',
    DEAL_WON: 'Deal won',
    DEAL_LOST: 'Deal lost',
  };

  return descriptions[event.event_type] || event.event_type;
}

// Export helpers for testing
export { isASignal, isBSignal, mapEventToSignalKey };
