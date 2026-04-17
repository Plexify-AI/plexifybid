/**
 * Skill: bid_oz_opportunity_brief (Sprint E / E3)
 *
 * BID/OZ-native opportunity brief. Verifies location against IRS OZ list or
 * BID directory, pulls Census ACS baseline, calculates tax-timing deadlines
 * under 26 U.S.C. §1400Z-2, and frames the project thesis.
 *
 * NOTE: this skill's system prompt expects the caller to PRE-ENRICH the
 * input with verification + demographics results. runSkill populates these
 * fields in the user payload so the model doesn't have to call tools inside
 * the prompt. See server/skills/registry.mjs enrichBidOzInput() (added in
 * E3) for the enrichment wiring.
 */

export const definition = {
  skill_key: 'bid_oz_opportunity_brief',
  skill_name: 'BID/OZ Opportunity Brief',
  version: 1,
  tenant_id: null,
  revenue_loop_stage: 'identify',
  is_active: true,
  eval_path: 'server/skills/evals/bid_oz_opportunity_brief.jsonl',

  system_prompt: `You are a construction BD principal producing an opportunity brief for a specific BID or Opportunity Zone location. Your output enables the firm to decide whether to pursue and how to enter.

ENRICHMENT CONTRACT:
The user payload includes two pre-enriched blocks:
- "verification": the result of checking the location. If verification.verified is false, you MUST mark locationVerified.verified false in your output and name what's missing. Never claim OZ status you cannot verify.
- "demographics": Census ACS 5-year data for the tract. If demographics.known is false, leave economicBaseline fields null and cite "missing_evidence".

TAX-TIMING RULES (26 U.S.C. §1400Z-2):
- QOF 180-day reinvestment deadline: 180 days after the sale that generated the eligible gain.
- Substantial-improvement test: basis must be doubled within 30 months of acquisition.
- The original OZ designations were set at the 2017 TCJA; downstream deadlines derive from statute. Cite §1400Z-2 for any timing claim.
- If the caller does not provide a specific date (acquisition date, gain date), DO NOT fabricate one — state the rule and flag the missing input.

OUTPUT STRUCTURE:
- locationVerified: pass through verification block + expose verified/source/tractId/designationDate.
- economicBaseline: pull medianIncome, population, housingUnits, povertyRate, acsYear from demographics. Null if unknown.
- projectThesis: 2-4 sentences — why this location, why now, given the firm's capabilities.
- keyStakeholders: who moves the project. Role-based when names unknown.
- taxTimingFlags: deadlines and rules relevant to this deal. Each cites the statute.
- relationshipEntryPoints: 2-4 concrete entry paths — named contact, known prior engagement, or "cold-but-warmable-through-X".
- recommendedNextActions: 3-5 actions with owner (bd_exec or principal) and timeframe.
- citations: every claim tagged with its source.

FORBIDDEN WORDS in all output: delve, leverage, seamless, transformative. Rewrite any sentence that would otherwise use them.

Return ONLY a JSON object matching the output_schema. No commentary.`,

  input_schema: {
    type: 'object',
    properties: {
      locationType: { enum: ['bid', 'oz_tract'] },
      locationId: { type: 'string', minLength: 1 },
      firmCapabilities: { type: 'array', items: { type: 'string' } },
      horizonMonths: { type: 'integer', minimum: 1, maximum: 60 },
      gainDate: { type: 'string' },
      acquisitionDate: { type: 'string' },
    },
    required: ['locationType', 'locationId', 'firmCapabilities', 'horizonMonths'],
    additionalProperties: false,
  },

  output_schema: {
    type: 'object',
    required: ['locationVerified', 'economicBaseline', 'projectThesis', 'keyStakeholders', 'taxTimingFlags', 'relationshipEntryPoints', 'recommendedNextActions', 'citations'],
    properties: {
      locationVerified: {
        type: 'object',
        required: ['verified', 'source'],
        properties: {
          verified: { type: 'boolean' },
          source: { enum: ['irs_oz', 'bid_directory', 'manual', 'unverified'] },
          tractId: { type: 'string' },
          designationDate: { type: 'string' },
          note: { type: 'string' },
        },
      },
      economicBaseline: {
        type: 'object',
        properties: {
          medianIncome: { type: ['number', 'null'] },
          population: { type: ['number', 'null'] },
          housingUnits: { type: ['number', 'null'] },
          povertyRate: { type: ['number', 'null'] },
          medianHomeValue: { type: ['number', 'null'] },
          medianGrossRent: { type: ['number', 'null'] },
          acsYear: { type: ['integer', 'null'] },
        },
      },
      projectThesis: { type: 'string' },
      keyStakeholders: {
        type: 'array',
        items: {
          type: 'object',
          required: ['role', 'entryApproach'],
          properties: {
            role: { type: 'string' },
            name: { type: 'string' },
            entryApproach: { type: 'string' },
          },
        },
      },
      taxTimingFlags: {
        type: 'array',
        items: {
          type: 'object',
          required: ['rule', 'impact'],
          properties: {
            rule: { type: 'string' },
            deadline: { type: 'string' },
            impact: { type: 'string' },
          },
        },
      },
      relationshipEntryPoints: { type: 'array', items: { type: 'string' } },
      recommendedNextActions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['action', 'owner'],
          properties: {
            action: { type: 'string' },
            owner: { enum: ['bd_exec', 'principal', 'both'] },
            timeframe: { type: 'string' },
          },
        },
      },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['claim', 'source'],
          properties: {
            claim: { type: 'string' },
            source: { enum: ['oz_tracts_cache', 'acs_data_cache', 'user_upload', 'prospect', 'statute_1400Z-2', 'assumption', 'missing_evidence'] },
            sourceId: { type: 'string' },
          },
        },
      },
    },
  },
};
