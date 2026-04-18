/**
 * Skill: stakeholder_entry_map (Sprint E / E3)
 *
 * Role-based stakeholder map for a BID / OZ tract / municipality with
 * warmth signals pulled from the tenant's existing prospect + contact data
 * and Sprint B factual corrections. Never invents names.
 */

export const definition = {
  skill_key: 'stakeholder_entry_map',
  skill_name: 'Stakeholder Entry Map',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'enrich',
  is_active: true,
  eval_path: 'server/skills/evals/stakeholder_entry_map.jsonl',

  system_prompt: `You are a construction BD principal mapping the stakeholder landscape of a specific district for your firm's entry play. The audience is a BD exec preparing a cold-start campaign.

SOURCES YOU MAY USE:
- Uploaded Deal Room sources (if present in the prospect context)
- Tenant prospect + contact data (injected by the runtime)
- Factual corrections the user has taught the system (injected via buildUserContext)
- Reasoned inference from public role structures (e.g. "every BID has an Executive Director")

RULE — NO INVENTED NAMES:
- If you do not know the specific person in a role, state the role + "name not yet identified" + how to find them.
- Never guess at names. Never hallucinate emails or titles.
- When you DO name someone, cite the source (prospect row, uploaded doc, factual correction).

OUTPUT STRUCTURE:
- stakeholders: array of stakeholder entries with role, optional name, organization, warmth signal, relationship basis, and suggested first touch.
- sequencingAdvice: who to contact first, second, third and why. Front-load warm paths.
- networkPaths: known introduction routes from the firm's network to named stakeholders. Includes hop count and strength. Empty if no known paths.
- risksAndPitfalls: 2-4 common failure modes for this district entry (e.g. "BID board turnover before Q3", "ED controls agenda, assistant gatekeeps calendar").

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      districtType: { enum: ['bid', 'oz_tract', 'municipality'] },
      districtId: { type: 'string', minLength: 1 },
      firmName: { type: 'string', minLength: 1 },
    },
    required: ['districtType', 'districtId', 'firmName'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['stakeholders', 'sequencingAdvice', 'networkPaths', 'risksAndPitfalls', 'citations'],
    properties: {
      stakeholders: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['role', 'warmthSignal', 'suggestedFirstTouch'],
          properties: {
            role: { type: 'string' },
            name: { type: 'string' },
            organization: { type: 'string' },
            warmthSignal: { enum: ['cold', 'warm', 'hot', 'unknown'] },
            relationshipBasis: { type: 'string' },
            suggestedFirstTouch: {
              type: 'object',
              required: ['channel', 'talkingPoints'],
              properties: {
                channel: { enum: ['email', 'linkedin', 'event', 'call', 'warm_intro', 'in_person'] },
                talkingPoints: { type: 'array', items: { type: 'string' }, minItems: 1 },
              },
            },
          },
        },
      },
      sequencingAdvice: { type: 'string' },
      networkPaths: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'to', 'hops', 'strength'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            hops: { type: 'integer', minimum: 1 },
            strength: { enum: ['weak', 'medium', 'strong'] },
          },
        },
      },
      risksAndPitfalls: { type: 'array', items: { type: 'string' }, minItems: 1 },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['prospect', 'user_upload', 'factual_correction', 'role_inference', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
