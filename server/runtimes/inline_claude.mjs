/**
 * PlexifySOLO — Inline Claude runtime (Sprint E / E1)
 *
 * Wraps the LLM Gateway (sendPrompt) for synchronous / "user is waiting"
 * work. Injects the unified user-context block from buildUserContext() so
 * factual corrections, Voice DNA, and voice corrections apply everywhere.
 * Writes a tenant_usage row on success via fire-and-forget logUsage.
 *
 * Runtime layer contract (matches managed_agents.mjs scaffold):
 *   runInline({
 *     tenantId, userId,
 *     systemPrompt, userMessage,
 *     contentType?, tools?, toolExecutors?,
 *     workerKind?, kind?, retries?
 *   }) -> { output, costCents, tokensIn, tokensOut, elapsedMs }
 */

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { buildUserContext } from '../lib/user-context.js';
import { logUsage } from '../middleware/logUsage.mjs';

const DEFAULT_MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 600;

export async function runInline({
  tenantId,
  userId,
  systemPrompt,
  userMessage,
  contentType = 'general',
  tools = undefined,
  toolExecutors = undefined,
  workerKind = null,
  kind = 'inline_claude',
  maxRetries = DEFAULT_MAX_RETRIES,
  taskType = TASK_TYPES.ASK_PLEXI,
}) {
  if (!tenantId) throw new Error('runInline: tenantId is required');
  if (!userMessage) throw new Error('runInline: userMessage is required');

  const userContext = await buildUserContext(tenantId, { userId, contentType });
  const stackedSystem = [userContext, systemPrompt].filter(Boolean).join('\n\n');

  const messages = [{ role: 'user', content: userMessage }];

  const startedAt = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendPrompt({
        taskType,
        messages,
        systemPrompt: stackedSystem,
        tools,
        toolExecutors,
        tenantId,
      });

      const elapsedMs = Date.now() - startedAt;
      const tokensIn = response?.usage?.input_tokens ?? null;
      const tokensOut = response?.usage?.output_tokens ?? null;
      const costCents = estimateCostCents(tokensIn, tokensOut);

      logUsage({
        tenantId,
        userId,
        kind,
        workerKind,
        costCents,
        tokensIn,
        tokensOut,
      });

      return {
        output: response?.content ?? '',
        toolResults: response?.toolResults ?? [],
        costCents,
        tokensIn,
        tokensOut,
        elapsedMs,
      };
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastErr || new Error('runInline: exhausted retries without response');
}

// Rough cost estimate — only used for dashboard aggregates. Sprint F swaps in
// per-model rate cards from the LLM Gateway config.
function estimateCostCents(tokensIn, tokensOut) {
  if (tokensIn == null || tokensOut == null) return 0;
  const inputCents = (tokensIn / 1_000_000) * 300;   // ~$3 / MTok
  const outputCents = (tokensOut / 1_000_000) * 1500; // ~$15 / MTok
  return Math.round(inputCents + outputCents);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
