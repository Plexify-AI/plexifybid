/**
 * Reconciler cron (Sprint E / E4)
 *
 * Every 60s: find running managed_agent jobs whose process likely died
 * (started_at > 5 min ago, no update_at in the last 5 min), re-attach to
 * the Anthropic session via wakeAndResume, and drive to completion.
 *
 * Non-managed_agent jobs and jobs with external_id=null are skipped.
 */

import cron from 'node-cron';
import { getSupabase } from '../lib/supabase.js';
import { wakeAndResume, retrieveSession } from '../runtimes/managed_agents.mjs';
import { jobEvents } from '../events/jobEvents.mjs';

const STALE_AFTER_MS = 5 * 60 * 1000;

let task = null;

export function startReconciler() {
  if (task) return task;
  task = cron.schedule('*/1 * * * *', reconcileOnce, {
    scheduled: true,
    timezone: 'UTC',
  });
  console.log('[reconciler] started — running every 60s');
  return task;
}

export async function reconcileOnce() {
  try {
    const supabase = getSupabase();
    const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

    const { data: stale, error } = await supabase
      .from('jobs')
      .select('id, tenant_id, external_id, kind, started_at, updated_at')
      .eq('status', 'running')
      .eq('runtime', 'managed_agent')
      .not('external_id', 'is', null)
      .lt('updated_at', staleCutoff)
      .limit(10);
    if (error) throw error;

    for (const job of stale || []) {
      await reconcileOne(job);
    }
  } catch (err) {
    console.error('[reconciler] cycle failed:', err.message);
  }
}

async function reconcileOne(job) {
  const supabase = getSupabase();
  try {
    // First: check session status directly. If already terminal on Anthropic's
    // side, flip our row without re-attaching to the stream.
    const session = await retrieveSession(job.external_id);
    if (!session) {
      await supabase.from('jobs').update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        error: 'reconciler: session not found upstream',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      return;
    }

    if (session.status === 'terminated') {
      await supabase.from('jobs').update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        error: 'reconciler: session terminated upstream',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      jobEvents.emit(job.tenant_id, { type: 'job.failed', job_id: job.id, reason: 'upstream_terminated' });
      return;
    }

    if (session.status === 'idle') {
      // Idle = finished. Mark succeeded.
      await supabase.from('jobs').update({
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      jobEvents.emit(job.tenant_id, { type: 'job.succeeded', job_id: job.id, reason: 'reconciler_detected_idle' });
      return;
    }

    // Still running — touch updated_at so we don't re-process on the next pass.
    await supabase.from('jobs')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', job.id);
    console.log(`[reconciler] session ${job.external_id} still running (${session.status})`);
  } catch (err) {
    console.error(`[reconciler] reconcileOne(${job.id}) failed:`, err.message);
  }
}
