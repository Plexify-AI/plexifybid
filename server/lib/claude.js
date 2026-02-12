/**
 * PlexifySOLO — Claude API client
 *
 * Wraps @anthropic-ai/sdk for Ask Plexi chat with tool_use support.
 * Handles the tool-use conversation loop: when Claude returns tool_use
 * blocks, we execute the tool, send tool_result back, and continue
 * until Claude produces a final text response.
 */

import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Client init (lazy — env vars may not be set at import time in Vite dev)
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing ANTHROPIC_API_KEY. Set it in .env.local.'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// sendMessage — drives the tool_use conversation loop
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {Array} options.messages - Conversation history (role/content pairs)
 * @param {Array} options.tools - Claude tool definitions
 * @param {string} options.systemPrompt - System prompt string
 * @param {Record<string, Function>} options.toolExecutors - Map of tool name → async execute(input, tenantId)
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
  const conversationMessages = [...messages];
  const allToolResults = [];
  let totalUsage = { input_tokens: 0, output_tokens: 0 };

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages,
      tools: tools.length > 0 ? tools : undefined,
    });

    // Accumulate usage
    if (response.usage) {
      totalUsage.input_tokens += response.usage.input_tokens || 0;
      totalUsage.output_tokens += response.usage.output_tokens || 0;
    }

    // If Claude is done (no more tool use), extract final text
    if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
      const textBlocks = response.content.filter((b) => b.type === 'text');
      const finalText = textBlocks.map((b) => b.text).join('\n');
      return {
        content: finalText,
        toolResults: allToolResults,
        usage: totalUsage,
      };
    }

    // Claude wants to use tools — process each tool_use block
    const assistantContent = response.content;
    conversationMessages.push({ role: 'assistant', content: assistantContent });

    const toolResultBlocks = [];

    for (const block of assistantContent) {
      if (block.type !== 'tool_use') continue;

      const executor = toolExecutors[block.name];
      if (!executor) {
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
          is_error: true,
        });
        continue;
      }

      try {
        console.log(`[claude] Executing tool: ${block.name}`, JSON.stringify(block.input));
        const result = await executor(block.input, tenantId);
        allToolResults.push({ tool: block.name, input: block.input, result });

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        console.error(`[claude] Tool ${block.name} failed:`, err.message);
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: err.message }),
          is_error: true,
        });
      }
    }

    conversationMessages.push({ role: 'user', content: toolResultBlocks });
  }

  // Safety: if we hit maxToolRounds, return whatever we have
  return {
    content: 'I ran into a processing limit. Please try a more specific question.',
    toolResults: allToolResults,
    usage: totalUsage,
  };
}
