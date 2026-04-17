/**
 * PlexifySOLO — Skill Registry + Runner (Sprint E / E2)
 *
 * Loads a skill definition from deal_room_skills (tenant-scoped with
 * global fallback), validates the caller's input against input_schema,
 * stacks buildUserContext() onto the skill system_prompt, calls Claude
 * through the LLM Gateway, validates the model output against
 * output_schema (with one retry on parse fail), persists the result to
 * deal_room_artifacts, and fires logUsage.
 *
 * Kept deliberately separate from server/routes/deal-room-generate.js —
 * that path handles document-backed artifacts (needs uploaded sources +
 * RAG). This runner handles prospect-backed strategy skills (no docs
 * required, input drives the call).
 */

import Ajv from 'ajv';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { buildUserContext } from '../lib/user-context.js';
import { logUsage } from '../middleware/logUsage.mjs';
import {
  getSupabase,
  createDealRoomArtifact,
  updateDealRoomArtifact,
  getOpportunityById,
} from '../lib/supabase.js';

const ajv = new Ajv({ allErrors: true, strict: false });

// Cache compiled validators per (skill_key, version) so we don't recompile on
// every call. Cache is process-local; cleared by a restart.
const validatorCache = new Map();

function cacheKey(skill, which) {
  return `${skill.skill_key}:${skill.version}:${which}`;
}

function getValidator(skill, which) {
  const key = cacheKey(skill, which);
  if (validatorCache.has(key)) return validatorCache.get(key);

  const schema = which === 'input' ? skill.input_schema : skill.output_schema;
  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    // Permissive validator — always passes when no schema is defined.
    const passThrough = () => true;
    passThrough.errors = null;
    validatorCache.set(key, passThrough);
    return passThrough;
  }

  const validate = ajv.compile(schema);
  validatorCache.set(key, validate);
  return validate;
}

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

/**
 * Resolve skill: tenant-specific override wins, global (tenant_id NULL) falls
 * through. Always filters is_active = true so inactive / [TEST] rows never
 * surface to end users.
 */
async function loadSkill(skillKey, tenantId) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('deal_room_skills')
    .select('*')
    .eq('skill_key', skillKey)
    .eq('is_active', true)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) throw new Error(`skill lookup failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`skill not found or inactive: ${skillKey}`);
  }
  return data[0];
}

// ---------------------------------------------------------------------------
// Prospect context — lookup the opportunity row and serialize the fields that
// actually help the model reason. Redundant fields and nulls get dropped.
// ---------------------------------------------------------------------------

async function loadProspectContext(tenantId, prospectId) {
  if (!prospectId) return null;
  try {
    const opp = await getOpportunityById(tenantId, prospectId);
    if (!opp) return null;
    // Whitelist — everything else is noise for strategy reasoning
    const ed = opp.enrichment_data || {};
    return {
      id: opp.id,
      name: opp.name || opp.company_name,
      company: opp.company_name,
      stage: opp.stage,
      source: opp.source,
      warmth_score: opp.warmth_score,
      contact_name: opp.contact_name,
      contact_title: opp.contact_title,
      contact_email: opp.contact_email,
      industry: ed.industry || null,
      linkedin_url: ed.linkedin_url || null,
      last_message_at: ed.last_message_at || null,
      message_count: ed.message_count || 0,
      warm_status: ed.warm_status || null,
      notes: ed.notes || null,
    };
  } catch (err) {
    console.error('[skills] prospect context load failed:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Output extraction — strips code fences, finds the JSON object.
// ---------------------------------------------------------------------------

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Title helper — short, renderable summary for the artifact list
// ---------------------------------------------------------------------------

function buildArtifactTitle(skill, input, prospect) {
  const prospectName = prospect?.name || prospect?.company || null;
  const skillLabel = skill.skill_name.replace(/^\[TEST\]\s*/i, '');
  if (prospectName) return `${skillLabel} — ${prospectName}`;
  return skillLabel;
}

// ---------------------------------------------------------------------------
// runSkill — primary public entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string} opts.skillKey
 * @param {object} opts.input           - Caller-supplied input; validated against input_schema.
 * @param {string} opts.tenantId
 * @param {string} opts.userId
 * @param {string} [opts.dealRoomId]    - Required; every artifact row belongs to a deal room.
 * @param {string} [opts.contentType]   - Voice DNA tone key. Default 'general'.
 * @returns {Promise<{ artifact: object, costCents: number, elapsedMs: number }>}
 */
export async function runSkill({
  skillKey,
  input,
  tenantId,
  userId,
  dealRoomId,
  contentType = 'general',
}) {
  if (!skillKey) throw new Error('runSkill: skillKey required');
  if (!tenantId) throw new Error('runSkill: tenantId required');
  if (!dealRoomId) throw new Error('runSkill: dealRoomId required (artifacts must belong to a deal room)');

  const startedAt = Date.now();
  const skill = await loadSkill(skillKey, tenantId);

  // Input validation
  const validateIn = getValidator(skill, 'input');
  if (!validateIn(input || {})) {
    throw new Error(`input validation failed: ${JSON.stringify(validateIn.errors)}`);
  }

  // Prospect context (optional — skills may omit prospectId)
  const prospect = await loadProspectContext(tenantId, input?.prospectId || null);
  if (input?.prospectId && !prospect) {
    throw new Error(`prospect not found: ${input.prospectId}`);
  }

  // Stack context onto system prompt
  const userContext = await buildUserContext(tenantId, { userId, contentType });
  const systemPrompt = [userContext, skill.system_prompt].filter(Boolean).join('\n\n');

  // Assemble user message — structured JSON block the model consumes directly
  const userPayload = {
    input,
    prospect,
    output_schema: skill.output_schema,
    instruction: 'Return a single JSON object that strictly matches output_schema. No commentary outside the JSON.',
  };

  // Placeholder artifact row — flipped to ready or failed after the call.
  // Gives the UI something to render as "generating..." if desired.
  const pending = await createDealRoomArtifact(tenantId, dealRoomId, {
    user_id: userId,
    artifact_type: skill.skill_key,
    title: buildArtifactTitle(skill, input, prospect),
    status: 'generating',
    content: null,
    model_used: null,
    skill_version: String(skill.version),
  });

  // Run — one retry on schema parse failure, second attempt forces strict JSON reminder.
  let parsed = null;
  let rawResp = null;
  let lastError = null;
  let tokensIn = null;
  let tokensOut = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const reminder = attempt === 0
      ? ''
      : '\n\nREMINDER: Your previous response did not parse. Return ONLY a JSON object matching the schema exactly. No prose.';

    try {
      const resp = await sendPrompt({
        taskType: TASK_TYPES.ASK_PLEXI,
        messages: [{ role: 'user', content: JSON.stringify(userPayload) + reminder }],
        systemPrompt,
        tenantId,
      });
      rawResp = resp?.content || '';
      tokensIn = resp?.usage?.input_tokens ?? tokensIn;
      tokensOut = resp?.usage?.output_tokens ?? tokensOut;

      parsed = extractJSON(rawResp);
      if (!parsed) {
        lastError = 'JSON extraction failed';
        continue;
      }

      const validateOut = getValidator(skill, 'output');
      if (!validateOut(parsed)) {
        lastError = `output schema violation: ${JSON.stringify(validateOut.errors)}`;
        parsed = null;
        continue;
      }

      break; // success
    } catch (err) {
      lastError = err.message;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const costCents = estimateCostCents(tokensIn, tokensOut);

  if (!parsed) {
    await updateDealRoomArtifact(pending.id, {
      status: 'failed',
      error_message: lastError || 'unknown failure',
      token_count_in: tokensIn,
      token_count_out: tokensOut,
    });
    logUsage({
      tenantId,
      userId,
      kind: 'skill_run_failed',
      workerKind: skill.skill_key,
      costCents,
      tokensIn,
      tokensOut,
    });
    throw new Error(lastError || 'skill run failed');
  }

  // Success — persist parsed output. provenance_json captures the citations
  // array if the skill's schema includes one; else []
  const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
  const artifact = await updateDealRoomArtifact(pending.id, {
    status: 'ready',
    content: parsed,
    model_used: 'claude-sonnet-4-20250514',
    token_count_in: tokensIn,
    token_count_out: tokensOut,
    provenance_json: citations,
  });

  logUsage({
    tenantId,
    userId,
    kind: 'skill_run',
    workerKind: skill.skill_key,
    costCents,
    tokensIn,
    tokensOut,
  });

  return { artifact, costCents, elapsedMs };
}

// ---------------------------------------------------------------------------
// listSkills — surface only is_active=true entries for the tenant
// ---------------------------------------------------------------------------

export async function listSkills(tenantId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('deal_room_skills')
    .select('skill_key, skill_name, system_prompt, input_schema, output_schema, revenue_loop_stage, version, tenant_id')
    .eq('is_active', true)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('tenant_id', { ascending: false, nullsFirst: false });

  if (error) throw error;

  // Deduplicate: tenant-specific override hides the global row with the same skill_key.
  const seen = new Set();
  const out = [];
  for (const row of data || []) {
    if (seen.has(row.skill_key)) continue;
    seen.add(row.skill_key);
    // Strip system_prompt before returning to the client — that's server-only.
    out.push({
      skill_key: row.skill_key,
      skill_name: row.skill_name,
      input_schema: row.input_schema,
      output_schema: row.output_schema,
      revenue_loop_stage: row.revenue_loop_stage,
      version: row.version,
      is_tenant_override: row.tenant_id !== null,
    });
  }
  return out;
}

// Rough cost estimate shared with inline_claude.mjs — same formula for now.
function estimateCostCents(tokensIn, tokensOut) {
  if (tokensIn == null || tokensOut == null) return 0;
  const inputCents = (tokensIn / 1_000_000) * 300;
  const outputCents = (tokensOut / 1_000_000) * 1500;
  return Math.round(inputCents + outputCents);
}
