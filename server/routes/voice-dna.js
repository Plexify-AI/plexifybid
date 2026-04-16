/**
 * PlexifySOLO — Voice DNA API Routes
 *
 * POST   /api/voice-dna/profiles           — Create profile + ingest samples
 * GET    /api/voice-dna/profiles/active     — Get active profile for tenant
 * GET    /api/voice-dna/profiles/:id        — Get profile by ID
 * PUT    /api/voice-dna/profiles/:id/approve    — Approve and activate profile
 * PUT    /api/voice-dna/profiles/:id/dimensions — Update dimension overrides
 * POST   /api/voice-dna/generate            — Voice-match content using active profile
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
import { buildUserContext } from '../lib/user-context.js';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';

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

/**
 * POST /api/voice-dna/generate — Voice-match content using active profile
 * Body: { content, contentType, context?: { opportunityId?, recipientName? } }
 *
 * This is the PlexiCoS → PlexiVoice handoff endpoint.
 * Loads the active voice profile, injects it as a system prompt block,
 * and rewrites the content to match the tenant's voice.
 */
export async function handleVoiceGenerate(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { content, contentType = 'general', context } = body || {};
  if (!content?.trim()) {
    return sendError(res, 400, 'Missing "content" field');
  }

  try {
    // 1. Get active voice profile
    const profile = await getActiveProfile(tenant.id);
    if (!profile) {
      return sendError(res, 404, 'No active Voice DNA profile for this tenant. Create one first.');
    }

    // 2. Build system prompt with unified user context (factual corrections + Voice DNA + voice corrections)
    const contextBlock = await buildUserContext(tenant.id, { contentType });
    const systemPrompt = `${contextBlock || ''}

You are a professional communications specialist. Rewrite the following content to precisely match the Voice DNA profile above. Preserve all factual content — names, dates, numbers, and key information must remain unchanged. Change ONLY voice, tone, vocabulary, and sentence patterns to match the profile.

${context?.recipientName ? `Recipient: ${context.recipientName}` : ''}
Content type: ${contentType}

Return ONLY the rewritten text. No commentary, no explanations, no markdown fencing.`;

    // 3. Send to LLM Gateway
    const result = await sendPrompt({
      taskType: TASK_TYPES.GENERAL,
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: content.trim(),
        },
      ],
      maxTokens: 4096,
      temperature: 0.6,
      tenantId: tenant.id,
    });

    // 4. Extract dimension summary for response
    const dims = profile.profile_data?.voiceDimensions || {};
    const dimensionsApplied = {};
    for (const [key, val] of Object.entries(dims)) {
      if (val && typeof val === 'object' && typeof val.score === 'number') {
        dimensionsApplied[key] = val.score;
      }
    }

    return sendJSON(res, 200, {
      voiceMatched: result.content,
      profileUsed: profile.id,
      confidenceScore: profile.confidence_score,
      dimensionsApplied,
    });
  } catch (err) {
    console.error('[voice-dna] Generate error:', err);
    return sendError(res, 500, 'Failed to generate voice-matched content');
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
