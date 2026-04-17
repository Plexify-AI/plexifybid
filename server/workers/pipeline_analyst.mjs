/**
 * Worker: pipeline_analyst (Sprint E / E4)
 *
 * Nightly (or on-demand) pass over the tenant's opportunities. The managed
 * agent proposes warmth rescores; this worker applies them in Express.
 *
 * Per-tenant rate limit: 1 run per hour.
 * Schedule: 6am tenant-local via node-cron (server/cron/pipeline_analyst_cron.mjs).
 */

import { getSupabase } from '../lib/supabase.js';
import { runManagedAgent } from '../runtimes/managed_agents.mjs';
import { getAgentIdByKey } from '../agents/seed.mjs';
import { logUsage } from '../middleware/logUsage.mjs';

const HOURLY_RATE_LIMIT = 1;
const MAX_OPPS = 200;

export async function canRun(tenantId) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await getSupabase()
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('kind', 'pipeline_analyst')
    .gte('created_at', since)
    .in('status', ['queued', 'running', 'succeeded']);
  return (count || 0) < HOURLY_RATE_LIMIT;
}

export async function runPipelineAnalyst({ tenantId, userId, mode = 'on_demand' }) {
  const supabase = getSupabase();
  const agent = await getAgentIdByKey('pipeline_analyst');
  if (!agent) throw new Error('pipeline_analyst agent not synced yet');
  const envId = agent.metadata?.environment_id;
  if (!envId) throw new Error('pipeline_analyst environment_id missing from agent cache');

  // Pull opportunities + recent events. RLS is bypassed via service role;
  // we filter by tenant_id explicitly (app-layer convention).
  const { data: opps, error: oppsErr } = await supabase
    .from('opportunities')
    .select('id, account_name, contact_name, contact_title, stage, warmth_score, deal_hypothesis, source_type, industry, enrichment_data, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(MAX_OPPS);
  if (oppsErr) throw oppsErr;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('opportunity_id, event_type, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', sevenDaysAgo)
    .limit(500);

  const payload = {
    tenant_id: tenantId,
    mode,
    opportunities: (opps || []).map((o) => ({
      id: o.id,
      account_name: o.account_name,
      contact_name: o.contact_name,
      contact_title: o.contact_title,
      stage: o.stage,
      warmth_score: o.warmth_score,
      industry: o.industry,
      source_type: o.source_type,
      deal_hypothesis: o.deal_hypothesis,
      message_count: o.enrichment_data?.message_count || 0,
      last_message_at: o.enrichment_data?.last_message_at || null,
    })),
    recent_events: (events || []).map((e) => ({
      opportunity_id: e.opportunity_id,
      event_type: e.event_type,
      occurred_at: e.created_at,
    })),
  };

  const started = Date.now();
  const result = await runManagedAgent({
    agentId: agent.agent_id,
    environmentId: envId,
    input: JSON.stringify(payload),
    timeoutMs: 10 * 60 * 1000, // 10 min hard ceiling
  });

  const analysis = extractAgentJson(result.agentMessages);
  const elapsed = Date.now() - started;

  // Apply rescores. Tolerate absent or malformed responses gracefully.
  let applied = 0;
  if (analysis && Array.isArray(analysis.rescored)) {
    for (const r of analysis.rescored) {
      if (!r?.opportunity_id || typeof r.new_warmth !== 'number') continue;
      const clamped = Math.max(0, Math.min(100, Math.round(r.new_warmth)));
      const existing = (opps || []).find((o) => o.id === r.opportunity_id);
      const ed = { ...(existing?.enrichment_data || {}) };
      ed.composite_breakdown = {
        ...(ed.composite_breakdown || {}),
        last_rescore_at: new Date().toISOString(),
        last_rescore_rationale: r.rationale,
      };
      const { error: updErr } = await supabase
        .from('opportunities')
        .update({
          warmth_score: clamped,
          enrichment_data: ed,
          warmth_updated_at: new Date().toISOString(),
        })
        .eq('id', r.opportunity_id)
        .eq('tenant_id', tenantId);
      if (!updErr) applied++;
    }
  }

  // Surface summary in home feed.
  const cardTitle = applied > 0
    ? `Pipeline Analyst rescored ${applied} opportunity${applied === 1 ? '' : ''}`
    : `Pipeline Analyst ran — no rescores this pass`;

  await supabase.from('home_feed_cards').insert({
    tenant_id: tenantId,
    user_id: userId,
    kind: 'pipeline_rescore',
    title: cardTitle,
    body: analysis?.summary || 'No summary returned.',
  });

  const costCents = estimateCostCents(result.usage);
  logUsage({
    tenantId,
    userId,
    kind: 'worker_run',
    workerKind: 'pipeline_analyst',
    costCents,
    tokensIn: result.usage?.input_tokens ?? null,
    tokensOut: result.usage?.output_tokens ?? null,
    sessionSeconds: Math.round(elapsed / 1000),
  });

  return {
    sessionId: result.sessionId,
    applied,
    summary: analysis?.summary || null,
    topMovers: analysis?.top_movers || [],
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
      if (!text) continue;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) continue;
      try {
        return JSON.parse(text.slice(start, end + 1));
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
