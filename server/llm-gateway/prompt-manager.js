/**
 * PlexifyAEC — LLM Prompt Manager
 *
 * Adapts system prompts for target provider.
 * Claude prefers XML structure; GPT-4o prefers JSON/markdown.
 * Returns modified request with provider-specific prompt formatting.
 */

import templates from './config/prompt-templates.js';

/**
 * Get provider-specific prompt variant for a request.
 * If no variant exists for this taskType + provider, returns request as-is.
 *
 * @param {Object} request - StandardRequest
 * @param {string} providerName - 'anthropic'|'openai'
 * @returns {Object} Modified request with adapted prompts
 */
export function getPromptVariant(request, providerName) {
  const template = templates[request.taskType];

  if (!template || !template[providerName]) {
    // No provider-specific variant — use request as-is
    return request;
  }

  const variant = template[providerName];

  return {
    ...request,
    systemPrompt: variant.systemWrapper
      ? variant.systemWrapper(request.systemPrompt || '', request.context)
      : request.systemPrompt,
    prompt: variant.userWrapper
      ? variant.userWrapper(request.prompt || '', request.context)
      : request.prompt,
  };
}
