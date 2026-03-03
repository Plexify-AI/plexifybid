/**
 * PlexifyAEC — Anthropic (Claude) Adapter
 *
 * Wraps @anthropic-ai/sdk behind the BaseAdapter interface.
 * Implements both single-shot send() and multi-round tool-use loop
 * (moved from server/lib/claude.js).
 *
 * Lazy client init — env vars may not be set at import time in Vite dev.
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAdapter } from './base-adapter.js';

export class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'anthropic';
    this._client = null;
  }

  /**
   * Lazy-init the Anthropic client.
   * Checks both ANTHROPIC_API_KEY and VITE_ANTHROPIC_API_KEY
   * (same pattern as the original server/lib/claude.js).
   */
  _getClient() {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Missing ANTHROPIC_API_KEY. Set it in .env.local.');
      }
      this._client = new Anthropic({ apiKey });
    }
    return this._client;
  }

  isConfigured() {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY);
  }

  /**
   * Single-shot prompt — no tool use.
   * Used by Deal Room chat, artifacts, audio scripts, summaries.
   */
  async send(request) {
    const startTime = Date.now();
    const model = this.config.model || 'claude-sonnet-4-20250514';

    const params = {
      model,
      max_tokens: request.maxTokens || 1024,
      system: request.systemPrompt || '',
      messages: request.messages || [{ role: 'user', content: request.prompt }],
    };

    // Remove empty system prompt (Claude doesn't like empty string)
    if (!params.system) delete params.system;

    // Add tools if provided (single-shot tool use)
    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools;
    }

    const response = await this._getClient().messages.create(params);

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const content = textBlocks.map((b) => b.text).join('\n');

    return {
      content,
      provider: 'anthropic',
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        // Keep original field names for backward compat with client API
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
        cost: this.calculateCost(response.usage),
      },
      latency: Date.now() - startTime,
      metadata: {
        stopReason: response.stop_reason,
        id: response.id,
      },
      toolResults: [],
      _raw: response,
    };
  }

  /**
   * Multi-round tool-use conversation loop.
   * Moved verbatim from server/lib/claude.js:sendMessage().
   *
   * When Claude returns tool_use blocks, we execute the tool,
   * send tool_result back, and continue until Claude produces
   * a final text response.
   *
   * @param {Object} options
   * @param {Array} options.messages - Conversation history
   * @param {string} options.systemPrompt - System prompt
   * @param {Array} options.tools - Claude tool definitions
   * @param {Object} options.toolExecutors - Map of tool name -> async execute(input, tenantId)
   * @param {string} options.tenantId - Tenant UUID for Supabase queries
   * @param {number} [options.maxToolRounds=5] - Safety limit
   * @returns {Promise<{content: string, toolResults: Array, usage: Object}>}
   */
  async sendWithTools({
    messages,
    systemPrompt,
    tools,
    toolExecutors,
    tenantId,
    maxToolRounds = 5,
  }) {
    const model = this.config.model || 'claude-sonnet-4-20250514';
    const conversationMessages = [...messages];
    const allToolResults = [];
    let totalUsage = { input_tokens: 0, output_tokens: 0 };
    const startTime = Date.now();

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await this._getClient().messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: conversationMessages,
        tools: tools && tools.length > 0 ? tools : undefined,
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
          console.log(`[llm-gateway] Executing tool: ${block.name}`, JSON.stringify(block.input));
          const result = await executor(block.input, tenantId);
          allToolResults.push({ tool: block.name, input: block.input, result });

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error(`[llm-gateway] Tool ${block.name} failed:`, err.message);
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

  calculateCost(usage) {
    if (!usage) return 0;
    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    return (
      input * (this.config.costPerInputToken || 3 / 1_000_000) +
      output * (this.config.costPerOutputToken || 15 / 1_000_000)
    );
  }

  estimateCost(request) {
    const estimatedInput = (request.prompt?.length || 0) / 4;
    const estimatedOutput = request.maxTokens || 1024;
    return (
      estimatedInput * (this.config.costPerInputToken || 3 / 1_000_000) +
      estimatedOutput * (this.config.costPerOutputToken || 15 / 1_000_000)
    );
  }
}
