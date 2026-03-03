/**
 * PlexifyAEC — System Status API
 *
 * GET /api/system-status
 * Returns health dashboard data: event counts, outreach caps,
 * job status, pipeline metrics, LLM provider health.
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { getSupabase } from '../lib/supabase.js';
import { getProviderHealth } from '../llm-gateway/index.js';
import CAPS from '../constants/outreach-caps.js';

export async function handleSystemStatus(req, res) {
  const tenant = req.tenant;

  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const tenantId = tenant.id;
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];

    const [
      eventsToday,
      outreachToday,
      jobsPending,
      jobsRunning,
      jobsDeadLetter,
      activeOpps,
      promotedOpps,
      agentCount,
      llmHealth,
    ] = await Promise.all([
      // Total events logged today
      supabase.from('events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', `${today}T00:00:00Z`),

      // Outreach sent today (for cap monitoring)
      supabase.from('outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .gte('sent_at', `${today}T00:00:00Z`),

      // Jobs pending
      supabase.from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending'),

      // Jobs running
      supabase.from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'running'),

      // Dead letter jobs (last 24h)
      supabase.from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'dead_letter')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),

      // Active opportunities (not parked/ejected)
      supabase.from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('stage', 'in', '("parked","ejected")'),

      // Promoted to home
      supabase.from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('promoted_to_home', true),

      // Total agents
      supabase.from('agents')
        .select('id', { count: 'exact', head: true }),

      // LLM Gateway health
      getProviderHealth(),
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      events: {
        today: eventsToday.count || 0,
      },
      outreach: {
        sent_today: outreachToday.count || 0,
        daily_cap: CAPS.PER_TENANT_PER_DAY,
        remaining: CAPS.PER_TENANT_PER_DAY - (outreachToday.count || 0),
      },
      jobs: {
        pending: jobsPending.count || 0,
        running: jobsRunning.count || 0,
        dead_letter_24h: jobsDeadLetter.count || 0,
      },
      pipeline: {
        active_opportunities: activeOpps.count || 0,
        promoted_to_home: promotedOpps.count || 0,
      },
      agents: {
        registered: agentCount.count || 0,
      },
      llm_providers: llmHealth,
    }));
  } catch (err) {
    console.error('[system-status] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'System status unavailable',
      detail: err.message,
    }));
  }
}
