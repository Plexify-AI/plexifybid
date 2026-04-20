/**
 * Compliance Guard — pre-export jurisdictional rule check (Sprint E / E5)
 *
 * Runs ONLY for artifact_type in: proposal, ozrf_section, outreach_sequence,
 * board_brief. Other types skip this gate and only the Factual Auditor runs.
 *
 * Rule pack stratified by jurisdiction:
 *   - Federal:  FAR 52.219 acknowledgment present where required;
 *               no fabricated past performance;
 *               OZRF-specific: §1400Z-2 deadline math anchored to a date.
 *   - NY state: MWBE goal acknowledgment for procurement docs.
 *   - QBS jurisdictions (broad): no fee discussion in technical sections.
 *
 * Sprint E ships pragmatic rules; Sprint F adds full jurisdiction taxonomy.
 */

import Ajv from 'ajv';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { buildUserContext } from '../lib/user-context.js';
import { logUsage } from '../middleware/logUsage.mjs';
import { getSupabase } from '../lib/supabase.js';

export const COMPLIANCE_ELIGIBLE_TYPES = new Set([
  'proposal', 'ozrf_section', 'outreach_sequence', 'board_brief',
]);

const ajv = new Ajv({ allErrors: true, strict: false });

const FINDING_SCHEMA = {
  type: 'object',
  required: ['passed', 'findings', 'summary'],
  properties: {
    passed: { type: 'boolean' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'rule', 'severity', 'evidence', 'jurisdiction'],
        properties: {
          claim: { type: 'string' },
          rule: {
            enum: [
              'FAR_CLAUSE_PRESENT', 'FAR_PAST_PERFORMANCE', 'OZ_DEADLINE_ANCHOR',
              'NY_MWBE_ACK', 'QBS_FEE_IN_TECHNICAL', 'GENERAL_DISCLOSURE',
            ],
          },
          severity: { enum: ['block', 'warn', 'info'] },
          evidence: { type: 'string' },
          jurisdiction: { enum: ['federal', 'ny_state', 'qbs', 'general'] },
        },
      },
    },
  },
};
const validate = ajv.compile(FINDING_SCHEMA);

const SYSTEM_PROMPT = `You are PlexifySOLO's Compliance Guard. The user is about to export a proposal-class artifact. Your job is to catch jurisdictional rule violations before the export goes out the door — missing FAR clauses on a federal submission, missing MWBE acknowledgments on an NY procurement, fee discussion buried in a technical section under QBS rules.

INPUT — JSON object with:
  artifact: { artifact_type, title, content }
  jurisdiction_hints: { state?: string, source_type?: string, opportunity_id?: string }   // best-effort signal of which rule pack to apply
  rules_in_scope: [...]   // pre-filtered list (runtime tells you which jurisdictions are likely relevant)

RULE PACK — apply only the rules in scope:

federal:
  FAR_CLAUSE_PRESENT (warn): If artifact_type is 'proposal' and jurisdiction is federal,
    look for FAR 52.219-9 (Small Business Subcontracting) or 52.232-25 (Prompt Payment)
    acknowledgment. Missing → severity=warn (not block — many proposals reference these
    elsewhere; this catches obvious omissions).
  FAR_PAST_PERFORMANCE (block): If artifact references past performance for a federal
    pursuit, every named project must be defensible. The Factual Auditor catches the
    fabrication; you catch incomplete reference packages (no client POC, no contract
    number, no period of performance). Missing those → severity=block.

ozrf:
  OZ_DEADLINE_ANCHOR (warn): If artifact mentions §1400Z-2 deadlines (180-day, 30-month)
    without an anchor date in the artifact text → warn.

ny_state:
  NY_MWBE_ACK (block): NY state procurement documents must acknowledge MWBE goals when
    the procurement total exceeds threshold. Missing acknowledgment for an NY-state
    artifact → severity=block. (If you cannot determine threshold from the artifact,
    severity=warn instead and explain.)

qbs (any state with QBS-style selection):
  QBS_FEE_IN_TECHNICAL (block): If the artifact is a technical proposal section AND
    contains specific dollar figures for the firm's fee → severity=block. Mentioning
    market-size or client budget figures is OK.

general:
  GENERAL_DISCLOSURE (info): Catch claims that read like marketing puffery on a
    formal submission (e.g. "industry-leading", "proven track record" without backing).
    severity=info — these don't block, just surface.

OUTPUT — strict JSON only:
  {
    "passed": <true if no block findings>,
    "summary": "one sentence verdict per jurisdiction",
    "findings": [{ "claim", "rule", "severity", "evidence", "jurisdiction" }]
  }

DISCIPLINE:
- Apply ONLY rules from rules_in_scope. Don't catch federal violations for an NY-only artifact.
- Cite the artifact text in evidence when possible.
- Banned words: delve, leverage, seamless, transformative.

Return only the JSON object.`;

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function complianceCheck({ tenantId, userId, artifactId }) {
  if (!tenantId) throw new Error('complianceCheck: tenantId required');
  if (!artifactId) throw new Error('complianceCheck: artifactId required');

  const supabase = getSupabase();
  const startedAt = Date.now();

  const { data: artifact, error: artErr } = await supabase
    .from('deal_room_artifacts')
    .select('id, artifact_type, title, content, deal_room_id')
    .eq('id', artifactId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (artErr) throw artErr;
  if (!artifact) throw new Error(`compliance target artifact ${artifactId} not found`);

  if (!COMPLIANCE_ELIGIBLE_TYPES.has(artifact.artifact_type)) {
    return { skipped: true, reason: `compliance_guard does not apply to ${artifact.artifact_type}` };
  }

  // Resolve jurisdiction from linked opportunity (if any)
  const hints = await resolveJurisdictionHints(tenantId, artifact.deal_room_id);
  const rulesInScope = pickRules(artifact.artifact_type, hints);

  const userContext = await buildUserContext(tenantId, { userId });
  const systemPrompt = [userContext, SYSTEM_PROMPT].filter(Boolean).join('\n\n');

  const userPayload = {
    artifact: {
      artifact_type: artifact.artifact_type,
      title: artifact.title,
      content: artifact.content,
    },
    jurisdiction_hints: hints,
    rules_in_scope: rulesInScope,
  };

  let resp;
  try {
    resp = await sendPrompt({
      taskType: TASK_TYPES.ASK_PLEXI,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      systemPrompt,
      tenantId,
      maxTokens: 2048,
    });
  } catch (err) {
    return persistAudit({
      artifactId, tenantId, passed: false,
      findings: [{ claim: 'Compliance Guard unavailable', rule: 'GENERAL_DISCLOSURE', severity: 'block', evidence: err.message, jurisdiction: 'general' }],
      summary: `Compliance Guard failed to run: ${err.message}`,
      costCents: 0, tokensIn: null, tokensOut: null,
      elapsedMs: Date.now() - startedAt, userId,
    });
  }

  let parsed = extractJson(resp?.content);
  if (parsed) normalizeFindings(parsed);
  if (!parsed || !validate(parsed)) {
    parsed = {
      passed: false,
      summary: 'Compliance Guard output failed schema validation; blocking export as a fail-safe.',
      findings: [{
        claim: 'Compliance Guard schema invalid',
        rule: 'GENERAL_DISCLOSURE',
        severity: 'block',
        evidence: parsed ? JSON.stringify(validate.errors) : 'no JSON extracted',
        jurisdiction: 'general',
      }],
    };
  }

  const hasBlock = (parsed.findings || []).some((f) => f.severity === 'block');
  parsed.passed = !hasBlock;

  return persistAudit({
    artifactId, tenantId, passed: parsed.passed,
    findings: parsed.findings, summary: parsed.summary,
    costCents: estimateCostCents(resp?.usage),
    tokensIn: resp?.usage?.input_tokens ?? null,
    tokensOut: resp?.usage?.output_tokens ?? null,
    elapsedMs: Date.now() - startedAt, userId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveJurisdictionHints(tenantId, dealRoomId) {
  if (!dealRoomId) return { state: null, source_type: null, opportunity_id: null };
  const supabase = getSupabase();
  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('opportunity_id')
      .eq('id', dealRoomId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const oppId = room?.opportunity_id;
    if (!oppId) return { state: null, source_type: null, opportunity_id: null };
    const { data: opp } = await supabase
      .from('opportunities')
      .select('state, source_type')
      .eq('id', oppId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return {
      state: opp?.state || null,
      source_type: opp?.source_type || null,
      opportunity_id: oppId,
    };
  } catch {
    return { state: null, source_type: null, opportunity_id: null };
  }
}

function pickRules(artifactType, hints) {
  const rules = ['general'];
  const isFederal = !hints?.state || /federal|fed|gsa|dod|sam/i.test(String(hints.source_type || ''));
  const isNy = (hints?.state || '').toUpperCase() === 'NY';
  if (artifactType === 'proposal') {
    if (isFederal) rules.push('federal');
    if (isNy) rules.push('ny_state');
    rules.push('qbs'); // QBS rules apply broadly to technical sections
  }
  if (artifactType === 'ozrf_section') {
    rules.push('ozrf');
    if (isFederal) rules.push('federal');
  }
  if (artifactType === 'outreach_sequence' || artifactType === 'board_brief') {
    // Lighter rule set — only general puffery + QBS fee leak in technical voices
    rules.push('qbs');
  }
  return rules;
}

// Normalize model severity vocabulary to the strict enum (mirrors
// factual_auditor.mjs).
const SEVERITY_ALIASES = {
  block: 'block', critical: 'block', high: 'block', error: 'block', fatal: 'block', severe: 'block',
  warn: 'warn', warning: 'warn', medium: 'warn', moderate: 'warn', caution: 'warn',
  info: 'info', low: 'info', notice: 'info', informational: 'info',
  pass: 'info', passed: 'info', verified: 'info', ok: 'info', good: 'info',
  confirmed: 'info', valid: 'info', match: 'info', matched: 'info',
  none: 'info', na: 'info', 'n/a': 'info',
};
const JURISDICTION_ALIASES = {
  federal: 'federal', us_federal: 'federal', far: 'federal',
  ny_state: 'ny_state', ny: 'ny_state', new_york: 'ny_state', nys: 'ny_state',
  qbs: 'qbs',
  general: 'general', other: 'general',
};

const VALID_SEVERITIES = new Set(['block', 'warn', 'info']);
const VALID_JURISDICTIONS = new Set(['federal', 'ny_state', 'qbs', 'general']);

function normalizeFindings(parsed) {
  if (!parsed || !Array.isArray(parsed.findings)) return;
  const kept = [];
  for (const f of parsed.findings) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.severity === 'string') {
      const k = f.severity.toLowerCase().trim();
      const aliased = SEVERITY_ALIASES[k];
      if (aliased) f.severity = aliased;
    }
    if (typeof f.jurisdiction === 'string') {
      const k = f.jurisdiction.toLowerCase().trim().replace(/\s+/g, '_');
      const aliased = JURISDICTION_ALIASES[k];
      if (aliased) f.jurisdiction = aliased;
    }
    // Drop findings with unsalvageable severity. Unknown jurisdiction ->
    // coerce to 'general' rather than drop.
    if (!VALID_SEVERITIES.has(f.severity)) continue;
    if (!VALID_JURISDICTIONS.has(f.jurisdiction)) f.jurisdiction = 'general';
    kept.push(f);
  }
  parsed.findings = kept;
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

async function persistAudit({ artifactId, tenantId, passed, findings, summary, costCents, tokensIn, tokensOut, elapsedMs, userId }) {
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('factual_audits')
    .insert({
      artifact_id: artifactId,
      tenant_id: tenantId,
      passed,
      findings: { findings: findings || [], summary },
      auditor_version: 2, // distinguishes compliance_guard from factual_auditor
    })
    .select()
    .single();
  logUsage({
    tenantId, userId, kind: 'gate_run',
    workerKind: 'compliance_guard',
    costCents, tokensIn, tokensOut,
    sessionSeconds: Math.round(elapsedMs / 1000),
  });
  return {
    audit_id: row?.id || null,
    passed,
    findings: findings || [],
    summary,
    cost_cents: costCents,
    elapsed_ms: elapsedMs,
  };
}

function estimateCostCents(usage) {
  if (!usage) return 0;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  return Math.round((inTok / 1_000_000) * 300 + (outTok / 1_000_000) * 1500);
}
