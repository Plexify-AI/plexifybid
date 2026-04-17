/**
 * Skill: pursuit_go_no_go (Sprint E / E2)
 *
 * Disciplined Go/No-Go gate. Scores across 5 dimensions, enforces dealbreakers,
 * produces a verdict. Cites specific evidence for every score; missing evidence
 * costs points; never invents past performance.
 */

export const definition = {
  skill_key: 'pursuit_go_no_go',
  skill_name: 'Pursuit Go/No-Go',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'close',
  is_active: true,
  eval_path: 'server/skills/evals/pursuit_go_no_go.jsonl',

  system_prompt: `You are a construction BD principal running a disciplined Go/No-Go gate on a single pursuit. Your output drives a partner-level decision: go, no-go, or conditional.

SCORING RUBRIC — each dimension is 0-100:
- fit: alignment between the firm's capability set and the prospect's technical + commercial requirements
- feeViability: probability the firm can price to win AND to margin
- relationships: existence and warmth of a path to the decision-maker (not just any contact)
- competition: inverse of competitive intensity; fewer peers + lower price sensitivity = higher score
- risk: inverse of project risk (schedule, scope, payment, reputational); higher = safer

COMPOSITE: weighted average. If weighting is provided, use it. Default weights: fit 0.25, feeViability 0.20, relationships 0.20, competition 0.15, risk 0.20.

VERDICT RULES:
- GO if compositeScore >= 70 AND no dealbreaker
- NO_GO if ANY dealbreaker (active conflict of interest; fee viability below threshold; no identified path to decision-maker; unacceptable risk)
- CONDITIONAL otherwise — state the specific conditions that would flip it to GO

EVIDENCE DISCIPLINE:
- Every score cites the evidence that drove it (prospect row fields, past performance, external signal, OR an explicit "missing evidence" note with score penalty)
- Never invent past projects. Never quote fees without a source. If evidence is absent, mark it absent and deduct.
- Citations array: one entry per load-bearing claim, with claim text, source type, source id if known.

RECOMMENDED ACTION:
- One concrete next step sized to the verdict. GO → specific outreach or meeting. CONDITIONAL → the first condition to resolve. NO_GO → park reason + re-engage trigger.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      prospectId: { type: 'string', format: 'uuid' },
      weighting: {
        type: 'object',
        properties: {
          fit: { type: 'number', minimum: 0, maximum: 1 },
          feeViability: { type: 'number', minimum: 0, maximum: 1 },
          relationships: { type: 'number', minimum: 0, maximum: 1 },
          competition: { type: 'number', minimum: 0, maximum: 1 },
          risk: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
    required: ['prospectId'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['verdict', 'compositeScore', 'scores', 'rationale', 'recommendedAction', 'citations'],
    properties: {
      verdict: { enum: ['GO', 'NO_GO', 'CONDITIONAL'] },
      conditions: { type: 'array', items: { type: 'string' } },
      scores: {
        type: 'object',
        required: ['fit', 'feeViability', 'relationships', 'competition', 'risk'],
        properties: {
          fit: { type: 'integer', minimum: 0, maximum: 100 },
          feeViability: { type: 'integer', minimum: 0, maximum: 100 },
          relationships: { type: 'integer', minimum: 0, maximum: 100 },
          competition: { type: 'integer', minimum: 0, maximum: 100 },
          risk: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      compositeScore: { type: 'integer', minimum: 0, maximum: 100 },
      rationale: {
        type: 'object',
        required: ['strengths', 'weaknesses', 'dealbreakers'],
        properties: {
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          dealbreakers: { type: 'array', items: { type: 'string' } },
        },
      },
      recommendedAction: { type: 'string' },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['prospect', 'past_performance', 'external', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
