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
import { jobEvents } from './events/jobEvents.mjs';

// ---------------------------------------------------------------------------
// Kind registry — maps job.kind to (runtime, handler)
// Workers lazy-load to avoid pulling Managed Agents imports at module parse
// time when ANTHROPIC_API_KEY isn't set.
// ---------------------------------------------------------------------------

const KIND_REGISTRY = {
  test_inline_echo: {
    runtime: 'inline',
    revenueLoopStage: 'identify',
    async handler({ input }) {
      const message = input?.message || '';
      return {
        output: { echo: message, ran_at: new Date().toISOString() },
        costCents: 0,
      };
    },
  },

  pipeline_analyst: {
    runtime: 'managed_agent',
    revenueLoopStage: 'identify',
    async preflight({ tenantId }) {
      const { canRun } = await import('./workers/pipeline_analyst.mjs');
      if (!(await canRun(tenantId))) {
        throw new Error('Pipeline Analyst rate-limited: 1 run per tenant per hour.');
      }
    },
    async handler({ input, tenantId, userId }) {
      const { runPipelineAnalyst } = await import('./workers/pipeline_analyst.mjs');
      const r = await runPipelineAnalyst({ tenantId, userId, mode: input?.mode || 'on_demand' });
      return {
        output: { applied: r.applied, summary: r.summary, top_movers: r.topMovers, session_id: r.sessionId },
        externalId: r.sessionId,
        costCents: r.costCents,
      };
    },
  },

  research_scanner: {
    runtime: 'managed_agent',
    revenueLoopStage: 'identify',
    async preflight({ tenantId }) {
      const { assertWithinCap } = await import('./workers/research_scanner.mjs');
      await assertWithinCap(tenantId);
    },
    async handler({ input, tenantId, userId }) {
      const { runResearchScanner } = await import('./workers/research_scanner.mjs');
      const r = await runResearchScanner({
        tenantId,
        userId,
        query: input?.query,
        maxSearches: input?.max_searches,
        context: input?.context,
      });
      return {
        output: {
          memo: r.memo,
          cap: r.cap,
          cap_hit: r.capHit,
          known: r.known ?? true,
          reason: r.reason || null,
          session_id: r.sessionId,
          note_id: r.noteId,
        },
        externalId: r.sessionId,
        costCents: r.costCents,
      };
    },
  },

  war_room_prep: {
    runtime: 'managed_agent',
    revenueLoopStage: 'enrich',
    async preflight({ tenantId, input }) {
      const { alreadyRanForRoom } = await import('./workers/war_room_prep.mjs');
      if (input?.deal_room_id && await alreadyRanForRoom(tenantId, input.deal_room_id)) {
        throw new Error('War Room Prep already ran (or is running) for this deal room.');
      }
    },
    async handler({ input, tenantId, userId }) {
      const { runWarRoomPrep } = await import('./workers/war_room_prep.mjs');
      const r = await runWarRoomPrep({
        tenantId,
        userId,
        dealRoomId: input?.deal_room_id,
        opportunityId: input?.opportunity_id,
      });
      return {
        output: { artifact_id: r.artifactId, session_id: r.sessionId },
        externalId: r.sessionId,
        costCents: r.costCents,
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

  // Run preflight BEFORE inserting the job row so rate-limit / cap rejections
  // surface as 4xx at the API layer rather than leaving a "failed" row.
  if (spec.preflight) {
    await spec.preflight({ tenantId, userId, input });
  }

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

  jobEvents.emit(tenantId, { type: 'job.queued', job });

  executeJob(job.id, spec, { input, tenantId, userId }).catch((err) => {
    console.error(`[jobs] executeJob ${job.id} unhandled:`, err.message);
  });

  return job;
}

async function executeJob(jobId, spec, ctx) {
  const supabase = getSupabase();
  const { tenantId } = ctx;

  const runningRow = { status: 'running', started_at: new Date().toISOString() };
  const { data: runningJob } = await supabase
    .from('jobs').update(runningRow).eq('id', jobId).select().single();
  jobEvents.emit(tenantId, { type: 'job.running', job: runningJob });

  try {
    const result = await spec.handler(ctx);

    const update = {
      status: 'succeeded',
      ended_at: new Date().toISOString(),
      output: result.output ?? null,
      cost_cents: result.costCents ?? 0,
      updated_at: new Date().toISOString(),
    };
    if (result.externalId) update.external_id = result.externalId;

    const { data: succeededJob } = await supabase
      .from('jobs').update(update).eq('id', jobId).select().single();
    jobEvents.emit(tenantId, { type: 'job.succeeded', job: succeededJob });
  } catch (err) {
    console.error(`[jobs] ${jobId} failed:`, err.message);
    const { data: failedJob } = await supabase
      .from('jobs').update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        error: err.message || String(err),
        updated_at: new Date().toISOString(),
      }).eq('id', jobId).select().single();
    jobEvents.emit(tenantId, { type: 'job.failed', job: failedJob });
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
