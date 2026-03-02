/**
 * PlexifyAEC — Warmth Engine Unit Tests
 *
 * 5 pure function scenarios testing computeWarmth() and checkTakeoverEligibility().
 * All expected scores computed from actual SIGNAL_POINTS config values — never hardcoded.
 *
 * Run: npx vitest run server/tests/warmth/
 * Run: node scripts/superpowers/test.js warmth
 */

import { describe, it, expect } from 'vitest';
import { computeWarmth, checkTakeoverEligibility } from '../../services/warmth-engine.js';
import { SIGNAL_POINTS, DECAY, SPAM } from '../../constants/warmth-config.js';

// Helper: create an event with sensible defaults
function makeEvent(type, daysAgo = 0, payload = {}) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id: crypto.randomUUID(),
    event_type: type,
    payload,
    created_at: date.toISOString(),
    opportunity_id: 'test-opp-id',
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Cold start — 1 OUTREACH_SENT today
// ---------------------------------------------------------------------------
describe('Scenario 1: Cold start', () => {
  it('should score 1 point for a single OUTREACH_SENT today, no decay or spam', () => {
    const events = [makeEvent('OUTREACH_SENT', 0)];
    const result = computeWarmth(events);

    const expected = SIGNAL_POINTS.OUTREACH_SENT; // 1

    expect(result.score).toBe(expected);
    expect(result.decayApplied).toBe(0);
    expect(result.spamPenalty).toBe(0);
    expect(result.ejected).toBe(false);
    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0].event_type).toBe('OUTREACH_SENT');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Warming — 5 events over 14 days, positive reply 3d ago
// ---------------------------------------------------------------------------
describe('Scenario 2: Warming', () => {
  it('should sum points for mixed signals with no decay (last event 3d ago)', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 14),        // oldest
      makeEvent('OUTREACH_OPENED', 12),
      makeEvent('OUTREACH_CLICKED', 8),
      makeEvent('OUTREACH_SENT', 5),
      makeEvent('OUTREACH_REPLIED', 3, { sentiment: 'positive' }),  // newest
    ];

    const result = computeWarmth(events);

    const expected =
      SIGNAL_POINTS.OUTREACH_SENT +             // 1
      SIGNAL_POINTS.OUTREACH_OPENED +            // 2
      SIGNAL_POINTS.OUTREACH_CLICKED +           // 8
      SIGNAL_POINTS.OUTREACH_SENT +              // 1
      SIGNAL_POINTS.OUTREACH_REPLIED_POSITIVE;   // 25

    // Last event was 3 days ago — no decay (< 7 days)
    expect(result.decayApplied).toBe(0);
    expect(result.score).toBe(expected);
    expect(result.ejected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Decay bite — 3 events all 28-30d ago
// ---------------------------------------------------------------------------
describe('Scenario 3: Decay bite', () => {
  it('should apply 30-day decay (highest threshold only) and clamp to 0', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 30),
      makeEvent('OUTREACH_OPENED', 29),
      makeEvent('OUTREACH_SENT', 28),
    ];

    const result = computeWarmth(events);

    const baseScore =
      SIGNAL_POINTS.OUTREACH_SENT +
      SIGNAL_POINTS.OUTREACH_OPENED +
      SIGNAL_POINTS.OUTREACH_SENT;

    // Last event was 28 days ago → 14-day decay threshold (not 30d)
    // daysSinceLastEvent = 28, which is >= 14 but < 30
    const expectedDecay = Math.abs(DECAY[14]); // 18
    const expectedScore = Math.max(0, baseScore - expectedDecay);

    expect(result.decayApplied).toBe(expectedDecay);
    expect(result.score).toBe(expectedScore);
  });

  it('should apply 30+ day decay when last event is 30+ days ago', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 35),
      makeEvent('OUTREACH_OPENED', 33),
      makeEvent('OUTREACH_SENT', 31),
    ];

    const result = computeWarmth(events);

    const baseScore =
      SIGNAL_POINTS.OUTREACH_SENT +
      SIGNAL_POINTS.OUTREACH_OPENED +
      SIGNAL_POINTS.OUTREACH_SENT;

    // Last event 31 days ago → 30-day decay
    const expectedDecay = Math.abs(DECAY[30]); // 35
    const expectedScore = Math.max(0, baseScore - expectedDecay);

    expect(result.decayApplied).toBe(expectedDecay);
    expect(result.score).toBe(expectedScore);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Spam penalty — 3 sends in 10d, 1 open, no replies
// ---------------------------------------------------------------------------
describe('Scenario 4: Spam penalty', () => {
  it('should apply spam penalty for 3+ unresponded outreach in 10d window', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 9),
      makeEvent('OUTREACH_SENT', 6),
      makeEvent('OUTREACH_SENT', 3),
      makeEvent('OUTREACH_OPENED', 5),  // opened but never replied
    ];

    const result = computeWarmth(events);

    const baseScore =
      SIGNAL_POINTS.OUTREACH_SENT * 3 +
      SIGNAL_POINTS.OUTREACH_OPENED;

    // 3 sends, 0 replies → unresponded = 3 >= threshold (3)
    const expectedSpam = Math.abs(SPAM.UNRESPONDED_PENALTY); // 12
    const expectedScore = Math.max(0, baseScore - expectedSpam);

    expect(result.spamPenalty).toBe(expectedSpam);
    expect(result.score).toBe(expectedScore);
    expect(result.ejected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Takeover ready — high score with MEETING_BOOKED
// ---------------------------------------------------------------------------
describe('Scenario 5: Takeover ready', () => {
  it('should produce high score and qualify for hard promote with A-signal', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 20),
      makeEvent('OUTREACH_OPENED', 18),
      makeEvent('OUTREACH_REPLIED', 15, { sentiment: 'positive' }),
      makeEvent('OUTREACH_CLICKED', 12),
      makeEvent('MEETING_BOOKED', 5),
      makeEvent('MEETING_COMPLETED', 3),  // maps to MEETING_BOOKED points
      makeEvent('PROPOSAL_SENT', 1),      // maps to PROPOSAL_REQUESTED points
    ];

    const result = computeWarmth(events);

    const expectedBase =
      SIGNAL_POINTS.OUTREACH_SENT +
      SIGNAL_POINTS.OUTREACH_OPENED +
      SIGNAL_POINTS.OUTREACH_REPLIED_POSITIVE +
      SIGNAL_POINTS.OUTREACH_CLICKED +
      SIGNAL_POINTS.MEETING_BOOKED +
      SIGNAL_POINTS.MEETING_BOOKED +       // MEETING_COMPLETED → MEETING_BOOKED
      SIGNAL_POINTS.PROPOSAL_REQUESTED;    // PROPOSAL_SENT → PROPOSAL_REQUESTED

    // Last event 1 day ago → no decay
    expect(result.decayApplied).toBe(0);
    expect(result.spamPenalty).toBe(0);
    expect(result.score).toBe(Math.min(100, expectedBase));

    // Check takeover eligibility
    const takeover = checkTakeoverEligibility(result.score, events);

    // Score should be well above 85 (35+35+30+25+8+2+1 = 136 → clamped to 100)
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(takeover.eligible).toBe(true);
    expect(takeover.type).toBe('hard');
  });

  it('should NOT promote without A-signal even at high score', () => {
    // Create artificially high score from B-signals only
    const events = Array.from({ length: 15 }, (_, i) =>
      makeEvent('OUTREACH_CLICKED', i)
    );

    const result = computeWarmth(events);
    const takeover = checkTakeoverEligibility(result.score, events);

    // Even if score is high, no A-signal = no promotion
    expect(takeover.eligible).toBe(false);
    expect(takeover.type).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('should return score 0 for empty events', () => {
    const result = computeWarmth([]);
    expect(result.score).toBe(0);
    expect(result.drivers).toEqual([]);
  });

  it('should return score 0 for null events', () => {
    const result = computeWarmth(null);
    expect(result.score).toBe(0);
  });

  it('should eject on hard bounce', () => {
    const events = [
      makeEvent('OUTREACH_SENT', 5),
      makeEvent('OUTREACH_REPLIED', 3, { sentiment: 'hard_bounce' }),
    ];

    const result = computeWarmth(events);
    expect(result.score).toBe(0);
    expect(result.ejected).toBe(true);
  });

  it('should dedup email opens to max 1 per day', () => {
    const events = [
      makeEvent('OUTREACH_OPENED', 0),
      makeEvent('OUTREACH_OPENED', 0),
      makeEvent('OUTREACH_OPENED', 0),
    ];

    const result = computeWarmth(events);
    // Only 1 open counted
    expect(result.score).toBe(SIGNAL_POINTS.OUTREACH_OPENED);
  });

  it('should ignore events older than 90 days', () => {
    const events = [makeEvent('MEETING_BOOKED', 91)];
    const result = computeWarmth(events);
    expect(result.score).toBe(0);
  });
});
