/**
 * PlexifyAEC — LLM Response Normalizer
 *
 * Converts raw provider responses into StandardResponse shape.
 * Also exports extractJSON() for stripping markdown code fences.
 */

/**
 * Normalize a raw provider response into StandardResponse.
 * Typically called by each adapter's send() method.
 *
 * @param {Object} rawResponse - Raw response from provider SDK
 * @param {string} provider - 'anthropic'|'openai'
 * @param {number} startTime - Date.now() from before the call
 * @returns {Object} StandardResponse
 */
export function normalizeResponse(rawResponse, provider, startTime) {
  const latency = Date.now() - startTime;

  if (provider === 'anthropic') {
    const textBlocks = (rawResponse.content || []).filter((b) => b.type === 'text');
    return {
      content: textBlocks.map((b) => b.text).join('\n'),
      provider: 'anthropic',
      model: rawResponse.model,
      usage: {
        inputTokens: rawResponse.usage?.input_tokens || 0,
        outputTokens: rawResponse.usage?.output_tokens || 0,
        input_tokens: rawResponse.usage?.input_tokens || 0,
        output_tokens: rawResponse.usage?.output_tokens || 0,
      },
      latency,
      metadata: {
        stopReason: rawResponse.stop_reason,
        id: rawResponse.id,
      },
      _raw: rawResponse,
    };
  }

  if (provider === 'openai') {
    const choice = rawResponse.choices?.[0];
    return {
      content: choice?.message?.content || '',
      provider: 'openai',
      model: rawResponse.model,
      usage: {
        inputTokens: rawResponse.usage?.prompt_tokens || 0,
        outputTokens: rawResponse.usage?.completion_tokens || 0,
        input_tokens: rawResponse.usage?.prompt_tokens || 0,
        output_tokens: rawResponse.usage?.completion_tokens || 0,
      },
      latency,
      metadata: {
        finishReason: choice?.finish_reason,
        id: rawResponse.id,
      },
      _raw: rawResponse,
    };
  }

  // Unknown provider — pass through
  return {
    content: String(rawResponse),
    provider,
    model: 'unknown',
    usage: { inputTokens: 0, outputTokens: 0 },
    latency,
    metadata: {},
    _raw: rawResponse,
  };
}

/**
 * Extract JSON from a string that may be wrapped in markdown code fences.
 * Simple regex — strips triple-backtick wrappers and parses.
 *
 * @param {string} text - Raw text potentially containing ```json ... ```
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON parsing fails after stripping
 */
export function extractJSON(text) {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(stripped);
}
