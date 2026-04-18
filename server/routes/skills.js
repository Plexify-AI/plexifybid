/**
 * PlexifySOLO — Skills API routes (Sprint E / E2)
 *
 * POST /api/skills/run  { deal_room_id, skill_key, input } -> artifact
 * GET  /api/skills                                         -> list (active, tenant + global)
 */

import { runSkill, listSkills } from '../skills/registry.mjs';

export async function handleRunSkill(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { deal_room_id, skill_key, input, content_type } = body || {};
  if (!deal_room_id || !skill_key) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'deal_room_id and skill_key are required' }));
  }

  try {
    const { artifact, costCents, elapsedMs } = await runSkill({
      skillKey: skill_key,
      input: input || {},
      tenantId: tenant.id,
      userId: tenant.id,
      dealRoomId: deal_room_id,
      contentType: content_type,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ artifact, cost_cents: costCents, elapsed_ms: elapsedMs }));
  } catch (err) {
    console.error('[skills] run error:', err.message);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export async function handleListSkills(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const skills = await listSkills(tenant.id);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ skills }));
  } catch (err) {
    console.error('[skills] list error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}
