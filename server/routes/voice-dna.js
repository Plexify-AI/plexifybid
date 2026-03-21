/**
 * PlexifySOLO — Voice DNA API Routes
 *
 * POST   /api/voice-dna/profiles           — Create profile + ingest samples
 * GET    /api/voice-dna/profiles/active     — Get active profile for tenant
 * GET    /api/voice-dna/profiles/:id        — Get profile by ID
 * PUT    /api/voice-dna/profiles/:id/approve    — Approve and activate profile
 * PUT    /api/voice-dna/profiles/:id/dimensions — Update dimension overrides
 *
 * Auth: sandboxAuth middleware sets req.tenant before these handlers run.
 */

import {
  createProfile,
  getActiveProfile,
  getProfileById,
  approveProfile,
  updateDimensions,
  saveSamples,
} from '../lib/voice-dna/voice-dna-service.js';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/voice-dna/profiles — Create a new profile and optionally ingest samples
 * Body: { profileName, ownerName, samples?: Array }
 */
export async function handleCreateProfile(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { profileName, ownerName, samples } = body || {};
  if (!profileName?.trim() || !ownerName?.trim()) {
    return sendError(res, 400, 'Missing "profileName" or "ownerName"');
  }

  try {
    const profile = await createProfile(tenant.id, {
      profileName: profileName.trim(),
      ownerName: ownerName.trim(),
    });

    // If samples provided, ingest them too
    if (Array.isArray(samples) && samples.length > 0) {
      await saveSamples(tenant.id, profile.id, samples);
    }

    return sendJSON(res, 201, profile);
  } catch (err) {
    console.error('[voice-dna] Create profile error:', err);
    return sendError(res, 500, 'Failed to create voice profile');
  }
}

/**
 * GET /api/voice-dna/profiles/active — Get the active profile for current tenant
 */
export async function handleGetActive(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const profile = await getActiveProfile(tenant.id);
    return sendJSON(res, 200, { profile });
  } catch (err) {
    console.error('[voice-dna] Get active error:', err);
    return sendError(res, 500, 'Failed to fetch active profile');
  }
}

/**
 * GET /api/voice-dna/profiles/:id — Get profile by ID
 */
export async function handleGetProfile(req, res, profileId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const profile = await getProfileById(tenant.id, profileId);
    return sendJSON(res, 200, { profile });
  } catch (err) {
    console.error('[voice-dna] Get profile error:', err);
    return sendError(res, 404, 'Profile not found');
  }
}

/**
 * PUT /api/voice-dna/profiles/:id/approve — Approve and activate
 */
export async function handleApproveProfile(req, res, profileId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const profile = await approveProfile(tenant.id, profileId);
    return sendJSON(res, 200, { profile });
  } catch (err) {
    console.error('[voice-dna] Approve error:', err);
    return sendError(res, 500, 'Failed to approve profile');
  }
}

/**
 * PUT /api/voice-dna/profiles/:id/dimensions — Update dimension overrides
 * Body: { dimensions: { formality: { score: 8, notes: "..." }, ... } }
 */
export async function handleUpdateDimensions(req, res, profileId, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { dimensions } = body || {};
  if (!dimensions || typeof dimensions !== 'object') {
    return sendError(res, 400, 'Missing "dimensions" object in body');
  }

  try {
    const profile = await updateDimensions(tenant.id, profileId, dimensions);
    return sendJSON(res, 200, { profile });
  } catch (err) {
    console.error('[voice-dna] Update dimensions error:', err);
    return sendError(res, 500, 'Failed to update dimensions');
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: message }));
}
