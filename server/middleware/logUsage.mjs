/**
 * PlexifySOLO — Usage logger (Sprint E / E1)
 *
 * Fire-and-forget write to tenant_usage. Never awaited on hot paths;
 * a logging failure must not fail the caller.
 *
 * Shape:
 *   logUsage({
 *     tenantId, userId, kind,
 *     workerKind?, costCents?, tokensIn?, tokensOut?,
 *     sessionSeconds?, toolCalls?
 *   })
 */

import { getSupabase } from '../lib/supabase.js';

export function logUsage({
  tenantId,
  userId,
  kind,
  workerKind = null,
  costCents = 0,
  tokensIn = null,
  tokensOut = null,
  sessionSeconds = null,
  toolCalls = null,
}) {
  if (!tenantId || !kind) return;

  // Intentionally not returning the promise — callers do not await this.
  getSupabase()
    .from('tenant_usage')
    .insert({
      tenant_id: tenantId,
      user_id: userId || null,
      kind,
      worker_kind: workerKind,
      cost_cents: costCents,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      session_seconds: sessionSeconds,
      tool_calls: toolCalls,
    })
    .then(({ error }) => {
      if (error) console.error('[logUsage] insert failed:', error.message);
    })
    .catch((err) => {
      console.error('[logUsage] unexpected error:', err.message);
    });
}
