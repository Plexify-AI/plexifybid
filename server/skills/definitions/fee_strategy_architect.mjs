/**
 * Skill: fee_strategy_architect (Sprint E / E2)
 *
 * Value-based pricing, not cost-plus. Floor / target / ceiling with risk-adjusted
 * probability of winning at each point. Pulls historical fee patterns if provided.
 */

export const definition = {
  skill_key: 'fee_strategy_architect',
  skill_name: 'Fee Strategy Architect',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'close',
  is_active: true,
  eval_path: 'server/skills/evals/fee_strategy_architect.jsonl',

  system_prompt: `You are a construction BD principal pricing a pursuit. Your output advises three fee points — floor, target, ceiling — each with the risk-adjusted probability of winning at that price.

APPROACH:
- Start from value, not cost. Ask: what is this pursuit worth to the prospect given their alternatives?
- BID-funded public work: speed, reliability, and political cover often beat lowest bid. Adjust accordingly.
- Private work: owner appetite for disruption + schedule risk drive willingness to pay.
- Incumbent dynamics: if a rival is defending, target price tests their bottom; if open field, ceiling is achievable.

OUTPUT REQUIREMENTS:
- floor: lowest fee that still preserves acceptable margin. State the margin assumption in rationale.
- target: best-expected-value price. Include P(win) for this price.
- ceiling: stretch price assuming value narrative lands. Include P(win).
- discountTriggers: 2-3 specific prospect behaviors or market events that would justify dropping from target to floor.
- valueCaptureLevers: 2-4 specific additions (scope, speed, relationship, risk transfer) that justify moving toward ceiling.
- Every number is grounded: cite historical fees if provided, prospect stage, or explicit assumption.

EVIDENCE DISCIPLINE:
- If historical fees or prospect data are absent, mark assumptions as such in citations — never fabricate.
- If targetMargin is provided, respect it as a hard constraint on floor.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      prospectId: { type: 'string', format: 'uuid' },
      historicalFees: {
        type: 'array',
        items: {
          type: 'object',
          required: ['project', 'fee', 'outcome'],
          properties: {
            project: { type: 'string' },
            fee: { type: 'number' },
            outcome: { enum: ['won', 'lost', 'withdrawn'] },
          },
          additionalProperties: false,
        },
      },
      targetMargin: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['prospectId'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['floor', 'target', 'ceiling', 'discountTriggers', 'valueCaptureLevers', 'citations'],
    properties: {
      floor: {
        type: 'object',
        required: ['amount', 'rationale'],
        properties: {
          amount: { type: 'number' },
          rationale: { type: 'string' },
          marginAssumption: { type: 'number' },
        },
      },
      target: {
        type: 'object',
        required: ['amount', 'rationale', 'probabilityWin'],
        properties: {
          amount: { type: 'number' },
          rationale: { type: 'string' },
          probabilityWin: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      ceiling: {
        type: 'object',
        required: ['amount', 'rationale', 'probabilityWin'],
        properties: {
          amount: { type: 'number' },
          rationale: { type: 'string' },
          probabilityWin: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      discountTriggers: { type: 'array', items: { type: 'string' }, minItems: 1 },
      valueCaptureLevers: { type: 'array', items: { type: 'string' }, minItems: 1 },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['prospect', 'historical_fees', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
