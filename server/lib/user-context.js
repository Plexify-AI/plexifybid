/**
 * PlexifySOLO — Unified User Context Builder (Sprint B / B5A)
 *
 * Single injection point for per-user context that prepends to LLM system prompts.
 * Consolidates three sources:
 *
 *   1. Factual Corrections (user_preferences.factual_corrections) — non-negotiable
 *      substitutions the user has taught the system. Stated FIRST because they are
 *      facts, not style.
 *
 *   2. Voice DNA (voice_dna_profiles) — the existing profile-based style block.
 *      Loaded via injectVoicePrompt() which stays the source of truth for Voice DNA.
 *
 *   3. Voice Corrections (user_preferences.voice_corrections) — captured style edits
 *      from when the user has rewritten AI output. Stated LAST so they serve as
 *      recent overrides on top of the default Voice DNA style.
 *
 * DESIGN CONTRACT:
 *   - Never throws. Every load is wrapped; a failed section is omitted, not fatal.
 *   - Returns null when ALL three sources produce nothing — callers can then skip
 *     prepending an empty block to the system prompt.
 *   - Fresh DB read per call. Do NOT memoize across requests; corrections change.
 *   - Read-only. Does not mutate preferences or Voice DNA profiles.
 *
 * When PlexiCoS (Sprint E) needs workspace/agent context, it extends this function.
 * That is the point of having a single entry point.
 */

import { getUserPreferences } from './supabase.js';
import { injectVoicePrompt } from './voice-dna/inject-voice-prompt.js';

/**
 * Build a unified user-context prompt block.
 *
 * @param {string} tenantId - Authenticated tenant UUID.
 * @param {object} [opts]
 * @param {string} [opts.userId]      - Defaults to tenantId (Phase 1: tenant = user).
 * @param {string} [opts.contentType] - Voice DNA tone adaptation key. Defaults to 'general'.
 * @returns {Promise<string|null>} Formatted block, or null if nothing to inject.
 */
export async function buildUserContext(tenantId, opts = {}) {
  if (!tenantId) return null;
  const userId = opts.userId || tenantId;
  const contentType = opts.contentType || 'general';

  // Load all three sources concurrently — one slow source should not stall the others.
  const [factualRaw, voiceCorrRaw, voiceDnaBlock] = await Promise.all([
    safeLoadPrefs(tenantId, userId, 'factual_corrections'),
    safeLoadPrefs(tenantId, userId, 'voice_corrections'),
    safeLoadVoiceDna(tenantId, contentType),
  ]);

  const factualBlock = formatFactualBlock(factualRaw);
  const voiceCorrBlock = formatVoiceCorrectionsBlock(voiceCorrRaw);

  const sections = [factualBlock, voiceDnaBlock, voiceCorrBlock].filter(Boolean);
  if (sections.length === 0) return null;

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Loaders (never throw — swallow + log, return empty)
// ---------------------------------------------------------------------------

async function safeLoadPrefs(tenantId, userId, category) {
  try {
    return await getUserPreferences(tenantId, userId, category);
  } catch (err) {
    console.error(`[user-context] Failed to load ${category}:`, err.message);
    return {};
  }
}

async function safeLoadVoiceDna(tenantId, contentType) {
  try {
    return await injectVoicePrompt(tenantId, contentType);
  } catch (err) {
    console.error('[user-context] Failed to load Voice DNA:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Render factual corrections as a labelled instruction block.
 * Returns null when no valid corrections are present.
 */
function formatFactualBlock(prefs) {
  const list = Array.isArray(prefs?.corrections) ? prefs.corrections : [];
  const valid = list.filter(
    (c) =>
      c &&
      typeof c.correct_value === 'string' &&
      c.correct_value.trim() &&
      typeof c.wrong_value === 'string' &&
      c.wrong_value.trim()
  );
  if (valid.length === 0) return null;

  const lines = ['--- FACTUAL CORRECTIONS ---'];
  lines.push('Always use these exact values. Never estimate, paraphrase, or guess:');
  for (const c of valid) {
    const label = humaniseField(c.field);
    lines.push(
      `- ${label}: Use "${c.correct_value}" (NOT "${c.wrong_value}"${
        c.scope && c.scope !== 'global' ? ` — scope: ${c.scope}` : ''
      })`
    );
  }
  lines.push('These corrections are non-negotiable. Apply them in all outputs.');
  lines.push('--- END FACTUAL CORRECTIONS ---');
  return lines.join('\n');
}

/**
 * Render voice corrections as an instruction block.
 * Returns null when no valid corrections are present.
 *
 * Each correction has an original snippet and a user-corrected snippet, showing
 * how the user has rewritten similar AI output previously.
 */
function formatVoiceCorrectionsBlock(prefs) {
  const list = Array.isArray(prefs?.corrections) ? prefs.corrections : [];
  const valid = list.filter(
    (c) =>
      c &&
      typeof c.original_snippet === 'string' &&
      c.original_snippet.trim() &&
      typeof c.corrected_snippet === 'string' &&
      c.corrected_snippet.trim()
  );
  if (valid.length === 0) return null;

  const lines = ['--- VOICE CORRECTIONS ---'];
  lines.push(
    'The user has previously edited AI-generated text. Apply these style patterns — prefer the corrected form over defaults:'
  );
  for (const c of valid) {
    const ctx = c.context ? ` [${c.context}]` : '';
    lines.push(`- Instead of: "${c.original_snippet}" → Use: "${c.corrected_snippet}"${ctx}`);
  }
  lines.push('--- END VOICE CORRECTIONS ---');
  return lines.join('\n');
}

/**
 * Convert a snake_case field name ("company_name") to a human label ("Company name").
 * Falls back to "Value" when field is missing or malformed.
 */
function humaniseField(field) {
  if (typeof field !== 'string' || !field.trim()) return 'Value';
  return field
    .trim()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
