/**
 * PlexifyAEC — Evidence Bundle Generator
 *
 * Two exports:
 *   generateScoreExplanation(score, drivers, decayApplied, spamPenalty)
 *     — NO LLM. Pure formatting. Returns structured explanation.
 *
 *   generatePromotionBundle(supabase, tenantId, opportunityId)
 *     — Uses LLM Gateway. Generates "why you should care" summary.
 */

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';

// ---------------------------------------------------------------------------
// Score label thresholds
// ---------------------------------------------------------------------------

const SCORE_LABELS = [
  { min: 85, max: 100, label: 'Takeover Ready' },
  { min: 75, max: 84,  label: 'Hot' },
  { min: 50, max: 74,  label: 'Engaged and warming' },
  { min: 25, max: 49,  label: 'Early signals' },
  { min: 1,  max: 24,  label: 'Cold' },
  { min: 0,  max: 0,   label: 'No engagement' },
];

function getScoreLabel(score) {
  for (const tier of SCORE_LABELS) {
    if (score >= tier.min && score <= tier.max) return tier.label;
  }
  return 'No engagement';
}

// ---------------------------------------------------------------------------
// generateScoreExplanation — Pure formatting, no LLM
// ---------------------------------------------------------------------------

/**
 * Generate a structured explanation of a warmth score.
 *
 * @param {number} score - Current warmth score (0-100)
 * @param {Array} drivers - Top 3 driver events [{event_type, points, description, created_at}]
 * @param {number} decayApplied - Points subtracted for silence
 * @param {number} spamPenalty - Points subtracted for spam behavior
 * @returns {{ summary, drivers, penalties, nextAction }}
 */
export function generateScoreExplanation(score, drivers = [], decayApplied = 0, spamPenalty = 0) {
  const label = getScoreLabel(score);

  const summary = `${label} (${score}/100)`;

  const formattedDrivers = drivers.map(d => ({
    event: d.event_type,
    points: `+${d.points}`,
    description: d.description,
    when: d.created_at ? formatTimeAgo(d.created_at) : 'unknown',
  }));

  const penalties = [];
  if (decayApplied > 0) {
    penalties.push({
      type: 'decay',
      points: `-${decayApplied}`,
      description: 'Silence penalty — no recent engagement',
    });
  }
  if (spamPenalty > 0) {
    penalties.push({
      type: 'spam',
      points: `-${spamPenalty}`,
      description: 'Too many unanswered outreach attempts',
    });
  }

  const nextAction = getNextAction(score, drivers, decayApplied, spamPenalty);

  return { summary, drivers: formattedDrivers, penalties, nextAction };
}

// ---------------------------------------------------------------------------
// generatePromotionBundle — LLM-powered
// ---------------------------------------------------------------------------

/**
 * Generate a 2-3 sentence "why you should care" promotion summary.
 * Stores result in opportunities.promotion_reason.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} tenantId - Tenant UUID
 * @param {string} opportunityId - Opportunity UUID
 * @returns {string} The generated promotion reason
 */
export async function generatePromotionBundle(supabase, tenantId, opportunityId) {
  // Fetch opportunity data
  const { data: opp, error: oppError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .single();

  if (oppError) throw oppError;

  // Fetch recent events
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('event_type, payload, created_at')
    .eq('tenant_id', tenantId)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (eventsError) throw eventsError;

  // Build context for LLM
  const eventSummary = events.map(e => {
    const ago = formatTimeAgo(e.created_at);
    return `- ${e.event_type} (${ago})${e.payload?.description ? ': ' + e.payload.description : ''}`;
  }).join('\n');

  const prompt = `You are a BD intelligence analyst. Write 2-3 sentences explaining why this opportunity deserves the executive's attention NOW. Be specific, cite the signals, and suggest one concrete next action.

Account: ${opp.account_name}
Contact: ${opp.contact_name || 'Unknown'}${opp.contact_title ? ' (' + opp.contact_title + ')' : ''}
Warmth Score: ${opp.warmth_score}/100
Stage: ${opp.stage}
Deal Hypothesis: ${opp.deal_hypothesis || 'Not defined'}

Recent signals:
${eventSummary || 'No events logged'}

Write exactly 2-3 sentences. No bullet points. No headers. Direct and actionable.`;

  const response = await sendPrompt({
    taskType: TASK_TYPES.EVIDENCE_BUNDLE,
    prompt,
    maxTokens: 200,
    temperature: 0.3,
    tenantId,
  });

  const promotionReason = response.content?.trim() || 'Promoted based on warmth score and engagement signals.';

  // Store in opportunities table
  await supabase
    .from('opportunities')
    .update({ promotion_reason: promotionReason })
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId);

  return promotionReason;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getNextAction(score, drivers, decayApplied, spamPenalty) {
  if (score === 0 && spamPenalty > 0) {
    return 'Back off — too many unanswered outreach attempts. Wait 7-10 days before next touch.';
  }
  if (score === 0) {
    return 'Start engagement — send a personalized intro referencing a specific project or pain point.';
  }
  if (decayApplied > 0 && score < 25) {
    return 'Re-engage — this contact has gone quiet. Share relevant content or reference a recent industry development.';
  }
  if (score >= 85) {
    return 'Close it — schedule the meeting, send the proposal, or ask for the decision.';
  }
  if (score >= 75) {
    return 'Push for commitment — this is hot. Request a meeting or next step.';
  }
  if (score >= 50) {
    return 'Deepen the relationship — share a case study, make an introduction, or add value.';
  }
  if (score >= 25) {
    return 'Keep warming — follow up on the last interaction with something specific and relevant.';
  }
  return 'Begin outreach — send a personalized intro email.';
}

function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
