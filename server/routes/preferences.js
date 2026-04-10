/**
 * PlexifySOLO — Tenant Preferences API
 *
 * GET  /api/preferences      — Returns preferences JSONB for the authenticated tenant
 * PUT  /api/preferences      — Shallow-merges new keys into existing preferences
 *
 * All access is scoped by req.tenant.id (set by sandboxAuth middleware).
 * Uses service-role Supabase client — no additional RLS policies needed.
 */

import { getSupabase } from '../lib/supabase.js';

/**
 * GET /api/preferences
 */
export async function handleGetPreferences(req, res) {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .select('preferences')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ preferences: data.preferences || {} }));
  } catch (err) {
    console.error('[preferences] GET error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to load preferences' }));
  }
}

/**
 * PUT /api/preferences
 * Shallow-merges request body into existing preferences JSONB.
 * e.g. sending { email_signature: "..." } won't wipe price_list.
 */
export async function handleUpdatePreferences(req, res, body) {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Request body must be a JSON object' }));
  }

  try {
    const supabase = getSupabase();

    // Read existing preferences
    const { data: existing, error: readErr } = await supabase
      .from('tenants')
      .select('preferences')
      .eq('id', tenantId)
      .single();

    if (readErr) throw readErr;

    // Shallow merge
    const merged = { ...(existing.preferences || {}), ...body };

    // Write back
    const { data, error: writeErr } = await supabase
      .from('tenants')
      .update({ preferences: merged })
      .eq('id', tenantId)
      .select('preferences')
      .single();

    if (writeErr) throw writeErr;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ preferences: data.preferences }));
  } catch (err) {
    console.error('[preferences] PUT error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to update preferences' }));
  }
}
