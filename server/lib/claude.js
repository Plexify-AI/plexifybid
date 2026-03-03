/**
 * PlexifyAEC — Claude API client (Gateway Wrapper)
 *
 * Backward-compatible wrapper around the LLM Gateway.
 * All real logic has moved to server/llm-gateway/adapters/anthropic-adapter.js.
 *
 * The sendMessage() export signature is unchanged — callers (ask-plexi.js)
 * continue to work without modification.
 */

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';

// ---------------------------------------------------------------------------
// sendMessage — backward-compatible wrapper
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {Array} options.messages - Conversation history (role/content pairs)
 * @param {Array} options.tools - Claude tool definitions
 * @param {string} options.systemPrompt - System prompt string
 * @param {Record<string, Function>} options.toolExecutors - Map of tool name -> async execute(input, tenantId)
 * @param {string} options.tenantId - Tenant UUID for Supabase queries
 * @param {number} [options.maxToolRounds=5] - Safety limit on tool-use loops
 * @returns {Promise<{content: string, toolResults: Array, usage: object}>}
 */
export async function sendMessage({
  messages,
  tools,
  systemPrompt,
  toolExecutors,
  tenantId,
  maxToolRounds = 5,
}) {
  return sendPrompt({
    taskType: TASK_TYPES.ASK_PLEXI,
    messages,
    systemPrompt,
    tools,
    toolExecutors,
    tenantId,
    maxToolRounds,
  });
}
