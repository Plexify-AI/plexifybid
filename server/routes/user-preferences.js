/**
 * PlexifySOLO — User Preferences API (Sprint B / B1)
 *
 * Per-user JSONB store, scoped by (tenant_id, user_id, category).
 * Legacy tenant-level preferences (/api/preferences) are untouched.
 *
 * GET  /api/user-preferences            — returns all categories
 * GET  /api/user-preferences/:category  — returns one category
 * PUT  /api/user-preferences/:category  — shallow-merge patch
 *
 * Phase 1: user_id = req.tenant.id (app currently treats tenant = user).
 * All access is scoped by the authenticated tenant via sandboxAuth.
 */

import {
  getUserPreferences,
  getAllUserPreferences,
  upsertUserPreferences,
  isValidUserPrefCategory,
  USER_PREF_CATEGORIES,
} from '../lib/supabase.js';

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(payload));
}

function requireTenant(req, res) {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    jsonResponse(res, 401, { error: 'Not authenticated' });
    return null;
  }
  return tenantId;
}

/**
 * GET /api/user-preferences
 * Returns { preferences: { general: {...}, voice_corrections: {...}, factual_corrections: {...} } }
 */
export async function handleGetAllUserPreferences(req, res) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  // Phase 1: user_id === tenant.id
  const userId = tenantId;

  try {
    const preferences = await getAllUserPreferences(tenantId, userId);
    return jsonResponse(res, 200, { preferences, categories: USER_PREF_CATEGORIES });
  } catch (err) {
    console.error('[user-preferences] GET all error:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to load user preferences' });
  }
}

/**
 * GET /api/user-preferences/:category
 * Returns { category, preferences } — missing categories return {}.
 */
export async function handleGetUserPreferences(req, res, category) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  if (!isValidUserPrefCategory(category)) {
    return jsonResponse(res, 400, {
      error: `Unknown category "${category}". Allowed: ${USER_PREF_CATEGORIES.join(', ')}`,
    });
  }

  try {
    const preferences = await getUserPreferences(tenantId, userId, category);
    return jsonResponse(res, 200, { category, preferences });
  } catch (err) {
    console.error(`[user-preferences] GET ${category} error:`, err.message);
    return jsonResponse(res, 500, { error: 'Failed to load user preferences' });
  }
}

/**
 * PUT /api/user-preferences/:category
 * Body: partial JSON object. Shallow-merged into the existing row.
 */
export async function handleUpdateUserPreferences(req, res, category, body) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  if (!isValidUserPrefCategory(category)) {
    return jsonResponse(res, 400, {
      error: `Unknown category "${category}". Allowed: ${USER_PREF_CATEGORIES.join(', ')}`,
    });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(res, 400, { error: 'Request body must be a JSON object' });
  }

  try {
    const preferences = await upsertUserPreferences(tenantId, userId, category, body);
    return jsonResponse(res, 200, { category, preferences });
  } catch (err) {
    console.error(`[user-preferences] PUT ${category} error:`, err.message);
    return jsonResponse(res, 500, { error: 'Failed to update user preferences' });
  }
}
