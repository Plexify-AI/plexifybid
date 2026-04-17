/**
 * Skill: competitor_teardown (Sprint E / E2)
 *
 * Named-competitor analysis for a specific market segment and optional prospect.
 * Extractive from uploaded sources when present; flags weak sourcing honestly.
 */

export const definition = {
  skill_key: 'competitor_teardown',
  skill_name: 'Competitor Teardown',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'enrich',
  is_active: true,
  eval_path: 'server/skills/evals/competitor_teardown.jsonl',

  system_prompt: `You are a construction BD principal analyzing a named competitor. Your output informs how to position against them on a specific pursuit or across a market segment.

SECTIONS TO PRODUCE:
- recentActivity: past-24-month wins and losses the competitor is known for. Include project names, approximate values if known, and outcome.
- feePattern: observed fee behavior — discount-driven, value-priced, or premium. Cite specific deals.
- principalTurnover: key departures, promotions, or hires that materially change their capacity.
- likelyPursuitApproach: if a prospect is given, predict their specific play — team composition, fee strategy, narrative hooks.
- weaknesses: 2-4 exploitable gaps you'd press in a head-to-head. Tie each to a piece of evidence.
- strengths: 2-3 real strengths you should expect to face, not platitudes.

EVIDENCE DISCIPLINE:
- Extractive priority: quote uploaded sources if available (citation source 'user_upload').
- External knowledge is acceptable but must be marked 'external'; flag as 'weak_sourcing' when claim confidence is low.
- Never invent project names, fee numbers, or personnel. "Unknown" is the correct answer when you don't know.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      competitorName: { type: 'string', minLength: 1 },
      marketSegment: { type: 'string', minLength: 1 },
      geography: { type: 'string' },
      prospectId: { type: 'string', format: 'uuid' },
    },
    required: ['competitorName', 'marketSegment'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['recentActivity', 'feePattern', 'strengths', 'weaknesses', 'citations'],
    properties: {
      recentActivity: {
        type: 'array',
        items: {
          type: 'object',
          required: ['project', 'outcome'],
          properties: {
            project: { type: 'string' },
            value: { type: 'string' },
            outcome: { enum: ['won', 'lost', 'withdrawn', 'ongoing', 'unknown'] },
            year: { type: 'integer' },
          },
        },
      },
      feePattern: {
        type: 'object',
        required: ['pattern', 'evidence'],
        properties: {
          pattern: { enum: ['discount_driven', 'value_priced', 'premium', 'mixed', 'unknown'] },
          evidence: { type: 'string' },
        },
      },
      principalTurnover: { type: 'array', items: { type: 'string' } },
      likelyPursuitApproach: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' }, minItems: 1 },
      weaknesses: { type: 'array', items: { type: 'string' }, minItems: 1 },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['user_upload', 'external', 'prospect', 'assumption', 'weak_sourcing', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
