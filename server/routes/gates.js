/**
 * Gates routes (Sprint E / E5)
 *
 * POST /api/gates/audit                  — run factual_auditor for an artifact
 * POST /api/gates/compliance             — run compliance_guard for an artifact
 * POST /api/gate-overrides               — record an override + return its id
 * GET  /api/gate-overrides?artifact_id=  — list overrides for an artifact
 *
 * Pre-export wiring (DealRoomHeader → /api/export/{docx,pptx}) calls the audit
 * endpoints first; on a block response, the UI prompts for an override and
 * re-tries the export with ?override=<id>.
 */

import { auditArtifact } from '../workers/factual_auditor.mjs';
import { complianceCheck, COMPLIANCE_ELIGIBLE_TYPES } from '../workers/compliance_guard.mjs';
import { getSupabase } from '../lib/supabase.js';

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleAudit(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  const { artifact_id } = body || {};
  if (!artifact_id) return sendJSON(res, 400, { error: 'artifact_id required' });
  try {
    const result = await auditArtifact({ tenantId: tenant.id, userId: tenant.id, artifactId: artifact_id });
    return sendJSON(res, 200, result);
  } catch (err) {
    console.error('[gates/audit]', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

export async function handleCompliance(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  const { artifact_id } = body || {};
  if (!artifact_id) return sendJSON(res, 400, { error: 'artifact_id required' });
  try {
    const result = await complianceCheck({ tenantId: tenant.id, userId: tenant.id, artifactId: artifact_id });
    return sendJSON(res, 200, result);
  } catch (err) {
    console.error('[gates/compliance]', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

export async function handleCreateOverride(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  const { artifact_id, gate_kind, reason, original_findings } = body || {};
  if (!artifact_id || !gate_kind || !reason) {
    return sendJSON(res, 400, { error: 'artifact_id, gate_kind, reason required' });
  }
  if (!['factual_auditor', 'compliance_guard'].includes(gate_kind)) {
    return sendJSON(res, 400, { error: 'gate_kind must be factual_auditor or compliance_guard' });
  }
  if (!reason || String(reason).trim().length < 10) {
    return sendJSON(res, 400, { error: 'reason must be at least 10 characters' });
  }
  try {
    const { data, error } = await getSupabase()
      .from('gate_overrides')
      .insert({
        tenant_id: tenant.id,
        user_id: tenant.id,
        artifact_id,
        gate_kind,
        original_findings: original_findings || {},
        reason: String(reason).trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return sendJSON(res, 201, { override_id: data.id, ok: true });
  } catch (err) {
    console.error('[gates/override-create]', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

export async function handleListOverrides(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  const url = new URL(req.url, 'http://local');
  const artifactId = url.searchParams.get('artifact_id');
  if (!artifactId) return sendJSON(res, 400, { error: 'artifact_id query param required' });
  try {
    const { data, error } = await getSupabase()
      .from('gate_overrides')
      .select('id, gate_kind, reason, created_at, user_id')
      .eq('tenant_id', tenant.id)
      .eq('artifact_id', artifactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendJSON(res, 200, { overrides: data || [] });
  } catch (err) {
    console.error('[gates/override-list]', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

/**
 * Helper used by export routes to enforce gates pre-export.
 * Returns { passed, blocked_by, factual?, compliance? } where blocked_by is null
 * if every applicable gate passes (or has a sticky override).
 */
export async function runExportGates({ tenantId, userId, artifactId, overrideIds = [] }) {
  if (!artifactId) {
    // No artifact context — gates can't run; pass through (back-compat with
    // legacy ad-hoc exports that didn't carry artifact_id).
    return { passed: true, blocked_by: null, gates_run: [] };
  }
  const supabase = getSupabase();

  // Resolve artifact_type to know if compliance applies
  const { data: artifact } = await supabase
    .from('deal_room_artifacts')
    .select('artifact_type')
    .eq('id', artifactId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!artifact) return { passed: true, blocked_by: null, gates_run: [] };

  const { data: stickyOverrides } = await supabase
    .from('gate_overrides')
    .select('id, gate_kind')
    .eq('tenant_id', tenantId)
    .eq('artifact_id', artifactId);
  const overrideKinds = new Set();
  for (const ov of stickyOverrides || []) overrideKinds.add(ov.gate_kind);
  // Caller can also pass explicit override IDs (defensive — sticky covers it but
  // a fresh override may not yet be reflected in the read).
  for (const id of overrideIds || []) {
    const matched = (stickyOverrides || []).find((o) => o.id === id);
    if (matched) overrideKinds.add(matched.gate_kind);
  }

  const gatesRun = [];
  const blockers = [];

  // 1. Factual Auditor — always runs unless overridden
  if (!overrideKinds.has('factual_auditor')) {
    const fa = await auditArtifact({ tenantId, userId, artifactId });
    gatesRun.push({ kind: 'factual_auditor', result: fa });
    if (!fa.passed) blockers.push({ gate: 'factual_auditor', audit_id: fa.audit_id, findings: fa.findings, summary: fa.summary });
  } else {
    gatesRun.push({ kind: 'factual_auditor', overridden: true });
  }

  // 2. Compliance Guard — only for eligible types; honors override
  if (COMPLIANCE_ELIGIBLE_TYPES.has(artifact.artifact_type)) {
    if (!overrideKinds.has('compliance_guard')) {
      const cg = await complianceCheck({ tenantId, userId, artifactId });
      gatesRun.push({ kind: 'compliance_guard', result: cg });
      if (!cg.passed) blockers.push({ gate: 'compliance_guard', audit_id: cg.audit_id, findings: cg.findings, summary: cg.summary });
    } else {
      gatesRun.push({ kind: 'compliance_guard', overridden: true });
    }
  }

  return {
    passed: blockers.length === 0,
    blocked_by: blockers.length ? blockers : null,
    gates_run: gatesRun,
  };
}
