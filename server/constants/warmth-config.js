/**
 * PlexifyAEC — Warmth Score Formula Configuration
 *
 * Warmth scores are DERIVED from events — never stored independently
 * of their evidence. This config defines the formula that computes
 * warmth from the event log.
 *
 * Formula version is incremented when tuning. warmth_history rows
 * record which version produced each score.
 */

// Signal point values — added when event is logged
export const SIGNAL_POINTS = {
  // A-signals (high-intent — trigger takeover evaluation)
  MEETING_BOOKED: 35,
  PROPOSAL_REQUESTED: 30,
  OUTREACH_REPLIED_POSITIVE: 25,

  // B-signals (engagement)
  OUTREACH_REPLIED_NEUTRAL: 12,
  OUTREACH_CLICKED: 8,
  CONTENT_SHARED: 6,
  LINKEDIN_CONNECTION: 5,

  // C-signals (awareness)
  OUTREACH_OPENED: 2,
  OUTREACH_SENT: 1,
  SIGNAL_LOGGED_MANUAL: 3,
};

// Decay rules — points subtracted based on days since last signal
export const DECAY = {
  7: -8,    // 7 days silence: -8 points
  14: -18,  // 14 days: -18 points (cumulative with 7d)
  30: -35,  // 30 days: -35 points (cumulative)
};

// Spam penalties — protect domain reputation
export const SPAM = {
  UNRESPONDED_THRESHOLD: 3,       // 3+ unresponded in window
  UNRESPONDED_WINDOW_DAYS: 10,
  UNRESPONDED_PENALTY: -12,
  HARD_BOUNCE_ACTION: 'eject',    // warmth = 0, stage = ejected
  UNSUBSCRIBE_ACTION: 'eject',
};

// Takeover thresholds — when an opportunity promotes to Home
export const TAKEOVER = {
  HARD_WARMTH_THRESHOLD: 85,      // warmth >= 85 AND A-signal = hard promote
  SOFT_WARMTH_MIN: 80,            // 80-84 + strong B signals = PlexiCoS review
  SOFT_WARMTH_MAX: 84,
  REQUIRES_A_SIGNAL: true,        // A-signal mandatory for any promotion
};

// Signal deduping — prevent event spam from inflating scores
export const DEDUP = {
  EMAIL_OPEN_CAP_PER_DAY: 1,     // max 1 open event per day per email
};

// Formula version — increment when tuning the formula
export const FORMULA_VERSION = 1;

// NOTE: MomentumBonus deferred to Sprint 4 — needs real pilot data to define

export default {
  SIGNAL_POINTS,
  DECAY,
  SPAM,
  TAKEOVER,
  DEDUP,
  FORMULA_VERSION,
};
