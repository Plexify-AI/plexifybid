/**
 * PlexifySOLO — Voice Corrections Capture API (Sprint B / B2)
 *
 * POST /api/voice-corrections/capture
 *   body: { original_text: string, edited_text: string, context?: string }
 *
 *   Diffs the two texts, appends any non-trivial {original_snippet,
 *   corrected_snippet} pairs to user_preferences.voice_corrections,
 *   and trims the list FIFO to FIFO_CAP entries.
 *
 *   Returns:
 *     200 { added: N, total: M, dropped: K } — new pairs captured
 *     204 (no body)                          — nothing non-trivial to capture
 *
 * This endpoint is fire-and-forget from the frontend. The user's workflow
 * (Save, Send, etc.) must never block on capture outcome.
 *
 * Phase 1: user_id = tenant.id (app currently treats tenant = user).
 */

import { diffToCorrections } from '../lib/voice-correction-diff.js';
import {
  getUserPreferences,
  upsertUserPreferences,
} from '../lib/supabase.js';

const FIFO_CAP = 50;                       // per spec
const CONTEXT_MAX_CHARS = 80;              // trim context tags to keep entries bounded

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(payload));
}

/**
 * POST /api/voice-corrections/capture
 */
export async function handleCapture(req, res, body) {
  const tenantId = req.tenant?.id;
  if (!tenantId) return jsonResponse(res, 401, { error: 'Not authenticated' });

  const { original_text, edited_text, context } = body || {};
  if (typeof original_text !== 'string' || typeof edited_text !== 'string') {
    return jsonResponse(res, 400, {
      error: 'Both original_text and edited_text must be strings',
    });
  }

  // Quick-exit when the two strings are byte-identical — very common case,
  // no reason to run the diff algorithm.
  if (original_text === edited_text) {
    res.statusCode = 204;
    return res.end();
  }

  let pairs;
  try {
    pairs = diffToCorrections(original_text, edited_text);
  } catch (err) {
    console.error('[voice-corrections] diff failed:', err.message);
    // Never propagate diff failures — callers are fire-and-forget.
    return jsonResponse(res, 500, { error: 'Diff failed' });
  }

  if (!Array.isArray(pairs) || pairs.length === 0) {
    res.statusCode = 204;
    return res.end();
  }

  const ctxTag = typeof context === 'string' && context.trim()
    ? context.trim().slice(0, CONTEXT_MAX_CHARS)
    : null;

  const nowIso = new Date().toISOString();
  const userId = tenantId; // Phase 1

  try {
    const existing = await getUserPreferences(tenantId, userId, 'voice_corrections');
    const existingList = Array.isArray(existing.corrections) ? existing.corrections : [];

    const newEntries = pairs.map((p) => ({
      id: safeRandomUUID(),
      original_snippet: p.original_snippet,
      corrected_snippet: p.corrected_snippet,
      ...(ctxTag ? { context: ctxTag } : {}),
      created_at: nowIso,
    }));

    const combined = [...existingList, ...newEntries];

    // FIFO trim — oldest at the front, newest at the end
    const dropped = Math.max(0, combined.length - FIFO_CAP);
    const trimmed = dropped > 0 ? combined.slice(dropped) : combined;

    await upsertUserPreferences(tenantId, userId, 'voice_corrections', {
      corrections: trimmed,
      max_corrections: FIFO_CAP,
    });

    return jsonResponse(res, 200, {
      added: newEntries.length,
      total: trimmed.length,
      dropped,
    });
  } catch (err) {
    console.error('[voice-corrections] persist failed:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to persist voice corrections' });
  }
}

function safeRandomUUID() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return `vc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
