/**
 * Skill: growth_plan_generator (Sprint E / E3)
 *
 * Principal-facing growth plan for a period (quarter or annual). Extends the
 * existing Board Brief shape with a "Strategic Initiatives" section that ties
 * initiatives to revenue impact and ownership.
 *
 * Wraps the Board Brief narrative layout but runs against tenant pipeline
 * context rather than a single deal room's sources.
 */

export const definition = {
  skill_key: 'growth_plan_generator',
  skill_name: 'Growth Plan',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'close',
  is_active: true,
  eval_path: 'server/skills/evals/growth_plan_generator.jsonl',

  system_prompt: `You are a construction BD principal producing a growth plan for a firm. The audience is the managing partner or board. This is a decision-forcing artifact, not a status report.

SECTION ORDER:
- title
- reportingPeriod (e.g. "Q2 2026" or "FY2026")
- executiveSummary: 3-5 bullets, each a decision or a claim with stakes.
- keyMetrics: 3-5 numeric targets with current-state vs goal (revenue, pipeline, win rate, avg fee, etc.)
- highlights: what shifted since last period — wins, losses, material changes.
- risks: specific named risks with mitigation. Each has a severity tag.
- strategicInitiatives: 3-5 initiatives. Each has name, rationale, owner, revenueImpactEstimate, timelineMonths, and dependencies. This section is what distinguishes a growth plan from a board brief.
- recommendations: 3-5 concrete actions the reader must approve or reject.

DISCIPLINE:
- Every metric or revenue estimate cites its source. If the firm's data doesn't support a number, say so and request it rather than fabricate.
- No filler. Cut anything that doesn't change a decision.
- Strategic initiatives must be ownable — "explore AI" is not an initiative; "launch BIM automation service line under [owner] in 4 months, target $800K revenue Year 1" is.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      period: { enum: ['quarter', 'annual'] },
      focusAreas: { type: 'array', items: { type: 'string' } },
      metrics: { type: 'object', additionalProperties: true },
    },
    required: ['period'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['title', 'reportingPeriod', 'executiveSummary', 'keyMetrics', 'highlights', 'risks', 'strategicInitiatives', 'recommendations', 'citations'],
    properties: {
      title: { type: 'string' },
      reportingPeriod: { type: 'string' },
      executiveSummary: { type: 'array', items: { type: 'string' }, minItems: 1 },
      keyMetrics: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['label', 'current', 'goal'],
          properties: {
            label: { type: 'string' },
            current: { type: 'string' },
            goal: { type: 'string' },
            trend: { enum: ['up', 'flat', 'down', 'unknown'] },
          },
        },
      },
      highlights: { type: 'array', items: { type: 'string' } },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['risk', 'mitigation', 'severity'],
          properties: {
            risk: { type: 'string' },
            mitigation: { type: 'string' },
            severity: { enum: ['low', 'medium', 'high', 'critical'] },
          },
        },
      },
      strategicInitiatives: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['name', 'rationale', 'owner', 'timelineMonths'],
          properties: {
            name: { type: 'string' },
            rationale: { type: 'string' },
            owner: { type: 'string' },
            timelineMonths: { type: 'integer', minimum: 1 },
            revenueImpactEstimate: { type: 'string' },
            dependencies: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      recommendations: { type: 'array', items: { type: 'string' }, minItems: 1 },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['pipeline', 'past_performance', 'tenant_prefs', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
