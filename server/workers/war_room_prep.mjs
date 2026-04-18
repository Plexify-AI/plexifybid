/**
 * Worker: war_room_prep (Sprint E / E4)
 *
 * Fires fire-and-forget on POST /api/deal-rooms. Idempotent per deal_room_id
 * via app-layer check (Sprint F upgrades to partial unique index — see
 * Sprint F handoff).
 */

import { getSupabase } from '../lib/supabase.js';
import { runManagedAgent } from '../runtimes/managed_agents.mjs';
import { getAgentIdByKey } from '../agents/seed.mjs';
import { logUsage } from '../middleware/logUsage.mjs';

export async function alreadyRanForRoom(tenantId, dealRoomId) {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('kind', 'war_room_prep')
    .filter('input->>deal_room_id', 'eq', dealRoomId)
    .limit(1);
  if (error) {
    console.error('[war_room_prep] alreadyRanForRoom lookup failed:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function runWarRoomPrep({ tenantId, userId, dealRoomId, opportunityId }) {
  if (!dealRoomId) throw new Error('runWarRoomPrep: dealRoomId required');

  const agent = await getAgentIdByKey('war_room_prep');
  if (!agent) throw new Error('war_room_prep agent not synced yet');
  const envId = agent.metadata?.environment_id;
  if (!envId) throw new Error('war_room_prep environment_id missing');

  const supabase = getSupabase();

  // Load deal room
  const { data: room } = await supabase
    .from('deal_rooms')
    .select('id, name, description, opportunity_id')
    .eq('id', dealRoomId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!room) throw new Error(`war_room_prep: deal room ${dealRoomId} not found`);

  const oppId = opportunityId || room.opportunity_id || null;
  let opportunity = null;
  if (oppId) {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id, account_name, contact_name, contact_title, stage, deal_hypothesis, industry, state')
      .eq('id', oppId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    opportunity = opp;
  }

  // Past performance — best-effort. If the table is empty we send an empty
  // array and the agent correctly marks most items "need".
  const { data: pastPerf } = await supabase
    .from('past_performance')
    .select('project_name, client_name, completion_date, project_type, role, description')
    .eq('tenant_id', tenantId)
    .limit(50);

  const payload = {
    tenant_id: tenantId,
    deal_room: { id: room.id, name: room.name, description: room.description },
    opportunity,
    past_performance: pastPerf || [],
    relevant_capabilities: [],
  };

  const started = Date.now();
  const result = await runManagedAgent({
    agentId: agent.agent_id,
    environmentId: envId,
    input: JSON.stringify(payload),
    timeoutMs: 5 * 60 * 1000,
  });
  const elapsed = Date.now() - started;

  const checklist = extractAgentJson(result.agentMessages);

  // Persist artifact
  const { data: artifact, error: artErr } = await supabase
    .from('deal_room_artifacts')
    .insert({
      tenant_id: tenantId,
      deal_room_id: dealRoomId,
      user_id: userId,
      artifact_type: 'war_room_checklist',
      title: `War Room Checklist — ${room.name}`,
      status: checklist ? 'ready' : 'failed',
      content: checklist,
      model_used: 'claude-sonnet-4-5',
      skill_version: '1',
      token_count_in: result.usage?.input_tokens || 0,
      token_count_out: result.usage?.output_tokens || 0,
      provenance_json: [],
    })
    .select()
    .single();
  if (artErr) console.error('[war_room_prep] artifact insert failed:', artErr.message);

  await supabase.from('home_feed_cards').insert({
    tenant_id: tenantId,
    user_id: userId,
    kind: 'war_room_ready',
    title: `War Room prep ready — ${room.name}`,
    body: checklist?.summary || null,
    artifact_id: artifact?.id || null,
  });

  const costCents = estimateCostCents(result.usage);
  logUsage({
    tenantId,
    userId,
    kind: 'worker_run',
    workerKind: 'war_room_prep',
    costCents,
    tokensIn: result.usage?.input_tokens ?? null,
    tokensOut: result.usage?.output_tokens ?? null,
    sessionSeconds: Math.round(elapsed / 1000),
  });

  return {
    sessionId: result.sessionId,
    artifactId: artifact?.id || null,
    costCents,
    elapsedMs: elapsed,
    terminalStatus: result.terminalStatus,
  };
}

function extractAgentJson(messages) {
  for (const m of messages || []) {
    for (const block of m.content || []) {
      if (block?.type !== 'text') continue;
      const text = String(block.text || '').trim();
      const s = text.indexOf('{');
      const e = text.lastIndexOf('}');
      if (s === -1 || e === -1 || e <= s) continue;
      try {
        return JSON.parse(text.slice(s, e + 1));
      } catch {}
    }
  }
  return null;
}

function estimateCostCents(usage) {
  if (!usage) return 0;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  return Math.round((inTok / 1_000_000) * 300 + (outTok / 1_000_000) * 1500);
}
