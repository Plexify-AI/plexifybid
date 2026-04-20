/**
 * Factual Auditor — pre-export hallucination gate (Sprint E / E5)
 *
 * "Never hallucinate a past project" made concrete. Runs inline (~5-10s) on
 * the artifact about to be exported. Returns block / warn / info findings.
 * ANY block → caller refuses the export until a gate_overrides row is written.
 *
 * BID/OZ rule pack:
 *   OZ_TRACT_VERIFY    — tract IDs in artifact must pass isOzDesignated. block.
 *   OZ_DEADLINE_DRIFT  — §1400Z-2 deadlines without specific dates. warn.
 *   BID_BOUNDARY       — "in the X BID" without verified address. warn.
 *   CAPITAL_PLAN_REF   — "BID capital plan line item X" without source. block.
 * Generic rule pack:
 *   PAST_PROJECT_VERIFY  — past projects must match past_performance row. block.
 *   DOLLAR_FIGURE_VERIFY — dollar figures need a source (prospect, past_perf, upload). warn.
 *   EXTERNAL_UNVERIFIED  — external claims that need a web lookup (Sprint F). info.
 *   ASSUMPTION           — explicit assumptions surfaced for review. info.
 */

import Ajv from 'ajv';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { buildUserContext } from '../lib/user-context.js';
import { logUsage } from '../middleware/logUsage.mjs';
import { getSupabase } from '../lib/supabase.js';
import { isOzDesignated } from '../data/oz_tracts.mjs';

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
        required: ['claim', 'rule', 'severity', 'evidence', 'source'],
        properties: {
          claim: { type: 'string' },
          rule: {
            enum: [
              'OZ_TRACT_VERIFY', 'OZ_DEADLINE_DRIFT', 'BID_BOUNDARY', 'CAPITAL_PLAN_REF',
              'PAST_PROJECT_VERIFY', 'DOLLAR_FIGURE_VERIFY', 'EXTERNAL_UNVERIFIED', 'ASSUMPTION',
            ],
          },
          severity: { enum: ['block', 'warn', 'info'] },
          evidence: { type: 'string' },
          source: {
            enum: [
              'past_performance', 'prospect', 'oz_tracts_cache', 'acs_data_cache',
              'statute', 'user_upload', 'missing_evidence', 'assumption', 'external_unverified',
            ],
          },
        },
      },
    },
  },
};
const validateFindings = ajv.compile(FINDING_SCHEMA);

const SYSTEM_PROMPT = `You are PlexifySOLO's Factual Auditor. The user is about to export a deliverable artifact. Your job is to find every claim that could embarrass the firm — fabricated past projects, unverified deadlines, made-up dollar figures, OZ tracts the IRS doesn't list. Block the export when claims fail; flag them when they're weak; pass them when evidence is solid.

INPUT — JSON object with:
  artifact: { artifact_type, title, content }                 // the thing being exported
  tenant_past_performance: [{ project_name, client_name, completion_date, contract_value_cents, project_type, role, description }]
  tenant_opportunities_sample: [{ id, account_name, contact_name, stage, warmth_score }]   // for prospect-context claims
  oz_tract_lookups: { "<tract_id>": { known: bool, is_oz_designated: bool, designation_date?: string, source?: string } }   // pre-resolved by runtime
  uploaded_source_excerpts: [{ source_id, name, snippet }]    // present when artifact was source-grounded; may be empty

EXTRACTION:
- Pull every verifiable claim from artifact.content. Verifiable = past project reference, dollar figure, named stakeholder, date, OZ tract id, BID name, capital-plan line item, statute citation, win/loss assertion.
- Skip claims that are clearly opinion ("we think", "it appears") or universally true.
- For each claim, classify the source it should match against, then check.

CLASSIFICATION + SEVERITY:
- PAST_PROJECT_VERIFY (block): claim references a specific past project. Match against tenant_past_performance.project_name + client_name. If no match → severity=block, source=missing_evidence.
- DOLLAR_FIGURE_VERIFY (warn): a specific dollar figure (fee, contract value, market size). If no source, severity=warn, source=missing_evidence.
- OZ_TRACT_VERIFY (block): the artifact mentions or asserts OZ designation for a tract. Use oz_tract_lookups for that tract. If oz_tract_lookups[tract].is_oz_designated is false OR known is false → severity=block.
- OZ_DEADLINE_DRIFT (warn): mentions of "180-day" or "30-month" §1400Z-2 deadlines without an anchor date in the artifact → severity=warn.
- BID_BOUNDARY (warn): "in the X BID" or "within the X BID boundary" without a verified address. Without uploaded_source_excerpts confirming → severity=warn.
- CAPITAL_PLAN_REF (block): "BID capital plan line item X" or similar references. Must appear in uploaded_source_excerpts. Otherwise severity=block.
- EXTERNAL_UNVERIFIED (info): external statistics or third-party assertions you cannot verify. Sprint F adds web verification. severity=info.
- ASSUMPTION (info): claims the artifact itself flags as assumptions (already cited assumption in source). severity=info.

VALID source values (must be exactly one of):
  past_performance | prospect | oz_tracts_cache | acs_data_cache | statute | user_upload | missing_evidence | assumption | external_unverified

Use 'statute' for §1400Z-2 or other code citations the artifact correctly invokes.
Use 'acs_data_cache' for Census ACS demographic figures (medianIncome, population, etc.).
Use 'oz_tracts_cache' only for IRS OZ designation status, not demographics.

OUTPUT — strict JSON only:
  {
    "passed": <true if no block findings>,
    "summary": "one sentence verdict",
    "findings": [{ "claim", "rule", "severity", "evidence", "source" }]
  }

DISCIPLINE:
- Cite the verifying row's project_name when matching past performance.
- For OZ_TRACT_VERIFY blocks, quote the lookup result in evidence ("oz_tract_lookups[36099999999] is unknown").
- Do NOT invent past performance rows or oz lookups. If you'd have to guess, mark it block.
- Pass-through artifacts with zero verifiable claims (rare — almost everything has at least an assumption). Empty findings + passed=true is valid.
- Banned words in your output: delve, leverage, seamless, transformative.

Return only the JSON object. No commentary.`;

const TRACT_REGEX = /\b\d{11}\b/g;
const MAX_TRACTS_PER_AUDIT = 25;

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * @returns { passed: boolean, findings: [...], summary: string, audit_id, cost_cents, elapsed_ms }
 */
export async function auditArtifact({ tenantId, userId, artifactId }) {
  if (!tenantId) throw new Error('auditArtifact: tenantId required');
  if (!artifactId) throw new Error('auditArtifact: artifactId required');

  const supabase = getSupabase();
  const startedAt = Date.now();

  // 1. Load artifact
  const { data: artifact, error: artErr } = await supabase
    .from('deal_room_artifacts')
    .select('id, artifact_type, title, content, deal_room_id, status')
    .eq('id', artifactId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (artErr) throw artErr;
  if (!artifact) throw new Error(`audit target artifact ${artifactId} not found`);

  // 2. Load tenant verification corpus
  const [{ data: pastPerf }, { data: opps }, sourceExcerpts] = await Promise.all([
    supabase.from('past_performance').select('project_name, client_name, completion_date, contract_value_cents, project_type, role, description').eq('tenant_id', tenantId).limit(50),
    supabase.from('opportunities').select('id, account_name, contact_name, stage, warmth_score').eq('tenant_id', tenantId).limit(50),
    loadSourceExcerpts(tenantId, artifact.deal_room_id).catch(() => []),
  ]);

  // 3. Pre-resolve OZ tracts so the model never fabricates designation status
  const tractMatches = collectTractCandidates(artifact);
  const ozLookups = {};
  for (const tract of tractMatches.slice(0, MAX_TRACTS_PER_AUDIT)) {
    try {
      ozLookups[tract] = await isOzDesignated(tract);
    } catch {
      ozLookups[tract] = { known: false };
    }
  }

  // 4. Build prompt + call Claude
  const userContext = await buildUserContext(tenantId, { userId });
  const systemPrompt = [userContext, SYSTEM_PROMPT].filter(Boolean).join('\n\n');

  const userPayload = {
    artifact: {
      artifact_type: artifact.artifact_type,
      title: artifact.title,
      content: artifact.content,
    },
    tenant_past_performance: pastPerf || [],
    tenant_opportunities_sample: (opps || []).slice(0, 30),
    oz_tract_lookups: ozLookups,
    uploaded_source_excerpts: sourceExcerpts,
  };

  let resp;
  try {
    resp = await sendPrompt({
      taskType: TASK_TYPES.ASK_PLEXI,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      systemPrompt,
      tenantId,
      maxTokens: 4096,
    });
  } catch (err) {
    // Audit failures fall safe: block the export with a clear reason.
    return persistAudit({
      artifactId,
      tenantId,
      passed: false,
      findings: [{ claim: 'Auditor unavailable', rule: 'EXTERNAL_UNVERIFIED', severity: 'block', evidence: err.message, source: 'missing_evidence' }],
      summary: `Auditor failed to run: ${err.message}`,
      costCents: 0,
      tokensIn: null,
      tokensOut: null,
      elapsedMs: Date.now() - startedAt,
      userId,
    });
  }

  let parsed = extractJson(resp?.content);
  if (parsed) normalizeFindings(parsed);
  if (!parsed || !validateFindings(parsed)) {
    console.error('[factual_auditor] schema fail:', validateFindings.errors?.[0]?.message || 'no JSON');
    parsed = {
      passed: false,
      summary: 'Auditor output failed schema validation; blocking export as a fail-safe.',
      findings: [{
        claim: 'Auditor schema invalid',
        rule: 'EXTERNAL_UNVERIFIED',
        severity: 'block',
        evidence: parsed ? JSON.stringify(validateFindings.errors) : 'no JSON extracted',
        source: 'missing_evidence',
      }],
    };
  }

  // The model is supposed to derive `passed` from findings, but enforce it
  // server-side as a safety net.
  const hasBlock = (parsed.findings || []).some((f) => f.severity === 'block');
  parsed.passed = !hasBlock;

  return persistAudit({
    artifactId,
    tenantId,
    passed: parsed.passed,
    findings: parsed.findings,
    summary: parsed.summary,
    costCents: estimateCostCents(resp?.usage),
    tokensIn: resp?.usage?.input_tokens ?? null,
    tokensOut: resp?.usage?.output_tokens ?? null,
    elapsedMs: Date.now() - startedAt,
    userId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSourceExcerpts(tenantId, dealRoomId) {
  if (!dealRoomId) return [];
  try {
    const { data } = await getSupabase()
      .from('deal_room_sources')
      .select('id, name, chunks')
      .eq('tenant_id', tenantId)
      .eq('deal_room_id', dealRoomId)
      .limit(20);
    const out = [];
    for (const row of data || []) {
      const chunks = Array.isArray(row.chunks) ? row.chunks : [];
      // First few chunks per source are usually enough for boundary/capital-plan refs.
      for (const c of chunks.slice(0, 3)) {
        const snippet = typeof c === 'string' ? c : (c?.text || '');
        if (snippet) out.push({ source_id: row.id, name: row.name, snippet: snippet.slice(0, 800) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function collectTractCandidates(artifact) {
  const text = JSON.stringify(artifact.content || '');
  const found = new Set();
  let match;
  while ((match = TRACT_REGEX.exec(text)) !== null) found.add(match[0]);
  return Array.from(found);
}

// Models return varied severity vocabulary. Normalize to the strict enum
// before schema validation so a "high" / "critical" doesn't fail-safe block
// the entire export over what is really a recoverable model output choice.
const SEVERITY_ALIASES = {
  block: 'block', critical: 'block', high: 'block', error: 'block', fatal: 'block', severe: 'block',
  warn: 'warn', warning: 'warn', medium: 'warn', moderate: 'warn', caution: 'warn',
  info: 'info', low: 'info', notice: 'info', informational: 'info',
  // Positive / pass-through findings — model sometimes labels a verified claim
  // "pass" / "ok" rather than omitting it. Normalize to info so the Auditor
  // can still surface the verification reasoning without failing schema.
  pass: 'info', passed: 'info', verified: 'info', ok: 'info', good: 'info',
  confirmed: 'info', valid: 'info', match: 'info', matched: 'info',
  none: 'info', na: 'info', 'n/a': 'info',
};
const SOURCE_ALIASES = {
  past_performance: 'past_performance',
  prospect: 'prospect',
  oz_tracts_cache: 'oz_tracts_cache', oz_cache: 'oz_tracts_cache', irs_oz: 'oz_tracts_cache',
  acs_data_cache: 'acs_data_cache', acs: 'acs_data_cache', census_acs: 'acs_data_cache', census: 'acs_data_cache',
  statute: 'statute', 'statute_1400z-2': 'statute', '1400z-2': 'statute', irc: 'statute',
  user_upload: 'user_upload', upload: 'user_upload', source_upload: 'user_upload',
  missing_evidence: 'missing_evidence', missing: 'missing_evidence', none: 'missing_evidence',
  assumption: 'assumption',
  external_unverified: 'external_unverified', external: 'external_unverified', web: 'external_unverified',
};

const VALID_SEVERITIES = new Set(['block', 'warn', 'info']);
const VALID_SOURCES = new Set([
  'past_performance', 'prospect', 'oz_tracts_cache', 'acs_data_cache',
  'statute', 'user_upload', 'missing_evidence', 'assumption', 'external_unverified',
]);

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
    if (typeof f.source === 'string') {
      const k = f.source.toLowerCase().trim();
      const aliased = SOURCE_ALIASES[k];
      if (aliased) f.source = aliased;
    }
    // Drop entries that still don't conform — one weird finding shouldn't
    // fail-safe the whole audit. Unknown source -> coerce to
    // 'external_unverified' rather than drop (preserves the claim).
    if (!VALID_SEVERITIES.has(f.severity)) continue;
    if (!VALID_SOURCES.has(f.source)) f.source = 'external_unverified';
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
      auditor_version: 1,
    })
    .select()
    .single();
  logUsage({
    tenantId,
    userId,
    kind: 'gate_run',
    workerKind: 'factual_auditor',
    costCents,
    tokensIn,
    tokensOut,
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
