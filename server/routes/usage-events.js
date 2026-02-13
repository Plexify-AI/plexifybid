/**
 * PlexifySOLO — Usage Events route
 *
 * GET /api/usage-events
 * Returns recent agent activity for the authenticated tenant.
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { getUsageEvents } from '../lib/supabase.js';

export async function handleGetUsageEvents(req, res) {
  const tenant = req.tenant;

  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const limit = Math.min(parseInt(req.query?.limit) || 10, 50);
    const events = await getUsageEvents(tenant.id, { limit });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ events }));
  } catch (err) {
    console.error('[usage-events] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to fetch usage events' }));
  }
}
