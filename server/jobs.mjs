/**
 * PlexifySOLO — Jobs dispatcher + REST handlers (Sprint E / E1)
 *
 * Unified entry point for all async work, inline or Managed Agent.
 * E1 routes inline only; Managed Agent runtime throws until E4.
 *
 * Public API:
 *   startJob({ userId, tenantId, kind, input, dependsOn?, revenueLoopStage? })
 *   getJob(jobId, tenantId)
 *   cancelJob(jobId, tenantId)
 *   listJobs(tenantId, { limit, status, kind })
 *
 * REST handlers (wired in server/index.mjs + vite dev middleware):
 *   POST /api/jobs
 *   GET  /api/jobs
 *   GET  /api/jobs/:id
 *   POST /api/jobs/:id/cancel
 *   GET  /api/tenant-usage/summary
 */

import { getSupabase } from './lib/supabase.js';

// ---------------------------------------------------------------------------
// Kind registry — maps job.kind to (runtime, handler)
// Add new kinds here as Sprint E evolves. Keep shape minimal in E1.
// ---------------------------------------------------------------------------

const KIND_REGISTRY = {
  test_inline_echo: {
    runtime: 'inline',
    revenueLoopStage: 'identify',
    async handler({ input, tenantId, userId }) {
      const message = input?.message || '';
      // Structured echo — proves runtime plumbing without calling Claude.
      // Switch to a real Claude call once E2's runSkill exists.
      return {
        output: { echo: message, ran_at: new Date().toISOString() },
        costCents: 0,
        tokensIn: 0,
        tokensOut: 0,
      };
    },
  },
};

function getKindSpec(kind) {
  const spec = KIND_REGISTRY[kind];
  if (!spec) throw new Error(`Unknown job kind: ${kind}`);
  return spec;
}

// ---------------------------------------------------------------------------
// Core dispatcher
// ---------------------------------------------------------------------------

export async function startJob({ userId, tenantId, kind, input, dependsOn = null, revenueLoopStage = null }) {
  if (!tenantId) throw new Error('startJob: tenantId required');
  if (!userId) throw new Error('startJob: userId required');
  if (!kind) throw new Error('startJob: kind required');

  const spec = getKindSpec(kind);
  const supabase = getSupabase();

  // Insert queued row
  const { data: job, error: insertErr } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      kind,
      status: 'queued',
      runtime: spec.runtime === 'inline' ? 'inline' : 'managed_agent',
      revenue_loop_stage: revenueLoopStage || spec.revenueLoopStage || null,
      depends_on: dependsOn,
      input: input || null,
    })
    .select()
    .single();

  if (insertErr) throw new Error(`jobs insert failed: ${insertErr.message}`);

  // Fire-and-forget execution; caller gets the queued row back immediately.
  executeJob(job.id, spec, { input, tenantId, userId }).catch((err) => {
    console.error(`[jobs] executeJob ${job.id} unhandled:`, err.message);
  });

  return job;
}

async function executeJob(jobId, spec, ctx) {
  const supabase = getSupabase();

  await supabase
    .from('jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    const result = await spec.handler(ctx);

    await supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        output: result.output ?? null,
        cost_cents: result.costCents ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (err) {
    console.error(`[jobs] ${jobId} failed:`, err.message);
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        error: err.message || String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

export async function getJob(jobId, tenantId) {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cancelJob(jobId, tenantId) {
  const { data, error } = await getSupabase()
    .from('jobs')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .in('status', ['queued', 'running'])
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listJobs(tenantId, { limit = 10, status, kind } = {}) {
  let query = getSupabase()
    .from('jobs')
    .select('id, kind, status, runtime, revenue_loop_stage, input, output, cost_cents, error, started_at, ended_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (status) query = query.eq('status', status);
  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// REST handlers
// ---------------------------------------------------------------------------

function requireTenant(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not authenticated' }));
    return null;
  }
  return tenant;
}

export async function handleStartJob(req, res, body) {
  const tenant = requireTenant(req, res);
  if (!tenant) return;

  const { kind, input, depends_on, revenue_loop_stage } = body || {};
  if (!kind) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'kind is required' }));
  }

  try {
    const job = await startJob({
      tenantId: tenant.id,
      userId: tenant.id,
      kind,
      input,
      dependsOn: depends_on || null,
      revenueLoopStage: revenue_loop_stage || null,
    });
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ job }));
  } catch (err) {
    console.error('[jobs] start error:', err.message);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export async function handleGetJob(req, res, jobId) {
  const tenant = requireTenant(req, res);
  if (!tenant) return;

  try {
    const job = await getJob(jobId, tenant.id);
    if (!job) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Job not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ job }));
  } catch (err) {
    console.error('[jobs] get error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export async function handleCancelJob(req, res, jobId) {
  const tenant = requireTenant(req, res);
  if (!tenant) return;

  try {
    const job = await cancelJob(jobId, tenant.id);
    if (!job) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Job is not cancellable or not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ job }));
  } catch (err) {
    console.error('[jobs] cancel error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export async function handleListJobs(req, res) {
  const tenant = requireTenant(req, res);
  if (!tenant) return;

  const url = new URL(req.url, 'http://local');
  const limit = Number(url.searchParams.get('limit') || 10);
  const status = url.searchParams.get('status') || undefined;
  const kind = url.searchParams.get('kind') || undefined;

  try {
    const jobs = await listJobs(tenant.id, { limit, status, kind });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ jobs }));
  } catch (err) {
    console.error('[jobs] list error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export async function handleUsageSummary(req, res) {
  const tenant = requireTenant(req, res);
  if (!tenant) return;

  try {
    // Current month window (UTC). Tenant-local month rollup lands in E4 when
    // usage dashboards need calendar boundaries.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data, error } = await getSupabase()
      .from('tenant_usage')
      .select('kind, worker_kind, cost_cents, tokens_in, tokens_out, session_seconds, tool_calls')
      .eq('tenant_id', tenant.id)
      .gte('created_at', monthStart);

    if (error) throw error;

    const byWorker = {};
    let totalCents = 0;
    for (const row of data || []) {
      const key = row.worker_kind || row.kind || 'unknown';
      if (!byWorker[key]) {
        byWorker[key] = { cost_cents: 0, tokens_in: 0, tokens_out: 0, count: 0 };
      }
      byWorker[key].cost_cents += row.cost_cents || 0;
      byWorker[key].tokens_in += row.tokens_in || 0;
      byWorker[key].tokens_out += row.tokens_out || 0;
      byWorker[key].count += 1;
      totalCents += row.cost_cents || 0;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      month_start: monthStart,
      total_cost_cents: totalCents,
      by_worker: byWorker,
    }));
  } catch (err) {
    console.error('[jobs] usage summary error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

// Exposed for testing + future worker registration (E4).
export const __internals = { KIND_REGISTRY, executeJob };
