/**
 * PlexifySOLO — Powerflow Pipeline routes
 *
 * GET  /api/powerflow/today  — Get today's powerflow state (timezone-aware)
 * POST /api/powerflow/complete — Manually complete a stage (e.g., stage 6 = win logged)
 *
 * Auth: sandboxAuth middleware sets req.tenant before these handlers run.
 */

import {
  getOrCreatePowerflowState,
  updatePowerflowStage,
  logUsageEvent,
} from '../lib/supabase.js';

/**
 * Resolve the tenant's local date using their IANA timezone string.
 * Always uses Intl.DateTimeFormat — never caches offsets.
 */
function getLocalDate(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA formats as YYYY-MM-DD
  return formatter.format(new Date());
}

/**
 * GET /api/powerflow/today
 */
export async function handleGetToday(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const localDate = getLocalDate(tenant.timezone);
    const state = await getOrCreatePowerflowState(tenant.id, localDate);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ powerflow: state, local_date: localDate }));
  } catch (err) {
    console.error('[powerflow] GET today error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to load powerflow state' }));
  }
}

/**
 * POST /api/powerflow/complete
 * Body: { stage: number }  (1-6)
 */
export async function handleCompleteStage(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { stage } = body || {};
  if (!stage || stage < 1 || stage > 6) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'stage must be 1-6' }));
  }

  try {
    const localDate = getLocalDate(tenant.timezone);
    const state = await updatePowerflowStage(tenant.id, localDate, stage);

    logUsageEvent(tenant.id, 'powerflow_stage_complete', {
      stage,
      local_date: localDate,
    }).catch(() => {});

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ powerflow: state, local_date: localDate }));
  } catch (err) {
    console.error('[powerflow] POST complete error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to update powerflow stage' }));
  }
}

/**
 * Helper: Mark a powerflow stage as completed (called from other routes).
 * Silently fails — powerflow tracking is non-blocking.
 */
export function markPowerflowStage(tenant, stageNumber) {
  try {
    const localDate = getLocalDate(tenant.timezone);
    updatePowerflowStage(tenant.id, localDate, stageNumber).catch((err) => {
      console.error(`[powerflow] Failed to mark stage ${stageNumber}:`, err.message);
    });
  } catch (err) {
    console.error(`[powerflow] Failed to resolve date for stage ${stageNumber}:`, err.message);
  }
}
