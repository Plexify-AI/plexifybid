/**
 * Nightly Pipeline Analyst scheduler (Sprint E / E4)
 *
 * Runs hourly. For each tenant whose local time equals 06:00, enqueues a
 * pipeline_analyst job. Doing it hourly rather than once daily lets us
 * respect per-tenant timezone without needing per-tenant cron entries.
 */

import cron from 'node-cron';
import { getSupabase } from '../lib/supabase.js';

let task = null;

export function startPipelineAnalystCron() {
  if (task) return task;
  // At minute 0 of every hour. Worker decides per-tenant eligibility.
  task = cron.schedule('0 * * * *', runHourlyPass, { scheduled: true, timezone: 'UTC' });
  console.log('[pipeline-cron] started — hourly tenant-local 6am trigger');
  return task;
}

async function runHourlyPass() {
  try {
    const supabase = getSupabase();
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, timezone, is_active')
      .eq('is_active', true);

    for (const t of tenants || []) {
      if (tenantLocalHour(t.timezone || 'America/New_York') !== 6) continue;
      try {
        const { startJob } = await import('../jobs.mjs');
        await startJob({
          tenantId: t.id,
          userId: t.id,
          kind: 'pipeline_analyst',
          input: { mode: 'nightly' },
        });
        console.log(`[pipeline-cron] queued for tenant ${t.id}`);
      } catch (err) {
        // Rate-limited or other expected reject — log and move on.
        console.log(`[pipeline-cron] skipped tenant ${t.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[pipeline-cron] cycle failed:', err.message);
  }
}

function tenantLocalHour(tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' });
    return Number(fmt.format(new Date()));
  } catch {
    return -1;
  }
}
