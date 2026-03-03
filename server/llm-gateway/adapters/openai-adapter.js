/**
 * PlexifyAEC — OpenAI Adapter
 *
 * Secondary provider. Government-eligible via Azure OpenAI.
 * Only active when OPENAI_API_KEY is set in environment.
 *
 * Uses dynamic import to avoid crash if openai package isn't installed.
 */

import { BaseAdapter } from './base-adapter.js';

export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'openai';
    this._client = null;
  }

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  async _getClient() {
    if (!this._client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('Missing OPENAI_API_KEY');
      }
      // Dynamic import — openai package may not be installed
      const { default: OpenAI } = await import('openai');
      this._client = new OpenAI({
        apiKey,
        baseURL: this.config.baseURL || 'https://api.openai.com/v1',
      });
    }
    return this._client;
  }

  /**
   * Single-shot prompt via OpenAI chat completions.
   */
  async send(request) {
    const startTime = Date.now();
    const client = await this._getClient();
    const model = this.config.model || 'gpt-4o';

    const messages = [];

    // OpenAI uses system role message instead of separate field
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    // Add conversation messages or single prompt
    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages);
    } else if (request.prompt) {
      messages.push({ role: 'user', content: request.prompt });
    }

    const params = {
      model,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature ?? 0.7,
      messages,
    };

    // Map tools from Claude format to OpenAI format
    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const response = await client.chat.completions.create(params);

    const content = response.choices[0]?.message?.content || '';

    return {
      content,
      provider: 'openai',
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        cost: this.calculateCost(response.usage),
      },
      latency: Date.now() - startTime,
      metadata: {
        finishReason: response.choices[0]?.finish_reason,
        id: response.id,
      },
      toolResults: [],
      _raw: response,
    };
  }

  calculateCost(usage) {
    if (!usage) return 0;
    const input = usage.prompt_tokens || 0;
    const output = usage.completion_tokens || 0;
    return (
      input * (this.config.costPerInputToken || 2.5 / 1_000_000) +
      output * (this.config.costPerOutputToken || 10 / 1_000_000)
    );
  }

  estimateCost(request) {
    const estimatedInput = (request.prompt?.length || 0) / 4;
    const estimatedOutput = request.maxTokens || 1024;
    return (
      estimatedInput * (this.config.costPerInputToken || 2.5 / 1_000_000) +
      estimatedOutput * (this.config.costPerOutputToken || 10 / 1_000_000)
    );
  }
}
