/**
 * Skill: acquisition_playbook (Sprint E / E3)
 *
 * Multi-touch engagement plan to earn the meeting. Recommends the plan —
 * does NOT draft the emails (trust graduation principle).
 */

export const definition = {
  skill_key: 'acquisition_playbook',
  skill_name: 'Acquisition Playbook',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'personalize',
  is_active: true,
  eval_path: 'server/skills/evals/acquisition_playbook.jsonl',

  system_prompt: `You are a construction BD principal building an acquisition playbook for a named target account. Your output is a multi-touch plan that earns the first substantive meeting — not pre-written emails.

OUTPUT CONSTRUCTION:
- decisionMakerMap: identify the actual buyer and the path from warm-or-cold to them. Pull from the prospect's stage, warmth score, message history, and title. When a decision-maker is not yet identified, mark it so and recommend how to discover them.
- touchSequence: 4-6 touches over the given timeframe. Each touch has a channel (email, linkedin, event, call, warm intro), a trigger (what signal or moment justifies it), and a talking-point theme (NOT copy). The plan must front-load mutual-connection paths before cold touches.
- warmthPathways: real warm-intro routes if they exist (mutual connections, shared prior projects, case-study ties). If none, say so — never invent.
- conversationStarters: 3-5 specific hooks grounded in public signals, recent project wins, or the prospect's stated priorities. Each must cite its source.
- cadence: pace + trigger-based adjustments (speed up on engagement, slow down on silence, park on explicit negative).
- successMetric: what defines "working" at day 30 and day 60.

PRINCIPLES:
- Recommended plan, not pre-written emails. "Lead with their Q1 earnings comment about BIM adoption" is the right altitude. Actual copy comes from outreach drafting later.
- Cite every claim.
- If data is thin, deduct confidence rather than fabricate.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      prospectId: { type: 'string', format: 'uuid' },
      currentPosition: { type: 'string' },
      objective: { type: 'string', minLength: 1 },
      timeframeMonths: { type: 'integer', minimum: 1, maximum: 12 },
    },
    required: ['prospectId', 'objective'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['decisionMakerMap', 'touchSequence', 'warmthPathways', 'conversationStarters', 'cadence', 'successMetric', 'citations'],
    properties: {
      decisionMakerMap: {
        type: 'object',
        required: ['identified', 'rationale'],
        properties: {
          identified: { type: 'boolean' },
          name: { type: 'string' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          discoveryPlan: { type: 'string' },
        },
      },
      touchSequence: {
        type: 'array',
        minItems: 3,
        items: {
          type: 'object',
          required: ['order', 'channel', 'trigger', 'themeSummary'],
          properties: {
            order: { type: 'integer', minimum: 1 },
            channel: { enum: ['email', 'linkedin', 'event', 'call', 'warm_intro', 'in_person'] },
            trigger: { type: 'string' },
            themeSummary: { type: 'string' },
            dayOffset: { type: 'integer', minimum: 0 },
          },
        },
      },
      warmthPathways: {
        type: 'array',
        items: {
          type: 'object',
          required: ['path', 'strength'],
          properties: {
            path: { type: 'string' },
            strength: { enum: ['strong', 'medium', 'weak', 'none'] },
            sourceId: { type: 'string' },
          },
        },
      },
      conversationStarters: {
        type: 'array',
        minItems: 3,
        items: {
          type: 'object',
          required: ['hook', 'source'],
          properties: {
            hook: { type: 'string' },
            source: { type: 'string' },
          },
        },
      },
      cadence: { type: 'string' },
      successMetric: {
        type: 'object',
        required: ['day30', 'day60'],
        properties: {
          day30: { type: 'string' },
          day60: { type: 'string' },
        },
      },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['prospect', 'public_signal', 'past_performance', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
