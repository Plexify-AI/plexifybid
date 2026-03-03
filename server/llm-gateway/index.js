/**
 * PlexifyAEC — LLM Gateway Entry Point
 *
 * Single entry point for ALL AI calls in PlexifyAEC.
 * Feature code imports sendPrompt() from here instead of
 * calling Anthropic/OpenAI SDK directly.
 *
 * Exports:
 *   sendPrompt(request)     — single-shot AI call with failover
 *   getProviderHealth()     — health status for system-status endpoint
 */

import { route } from './router.js';
import { getPromptVariant } from './prompt-manager.js';
import providerConfig from './config/provider-config.js';
import { AnthropicAdapter } from './adapters/anthropic-adapter.js';
import { OpenAIAdapter } from './adapters/openai-adapter.js';

// ---------------------------------------------------------------------------
// Lazy-initialized adapters (env vars may not be set at import time)
// ---------------------------------------------------------------------------

let _adapters = null;

function getAdapters() {
  if (!_adapters) {
    _adapters = {
      anthropic: new AnthropicAdapter(providerConfig.anthropic),
      openai: new OpenAIAdapter(providerConfig.openai),
    };
  }
  return _adapters;
}

function getAdapter(name) {
  const adapters = getAdapters();
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`[LLM Gateway] Unknown provider: ${name}`);
  }
  return adapter;
}

// ---------------------------------------------------------------------------
// sendPrompt — primary gateway function
// ---------------------------------------------------------------------------

/**
 * Send a prompt through the LLM Gateway.
 * Routes to the best available provider based on task type + client tier.
 * Falls through to next provider on failure.
 *
 * For tool-use conversations (Ask Plexi), pass tools + toolExecutors.
 * The Anthropic adapter handles the multi-round tool-use loop internally.
 *
 * @param {Object} request - StandardRequest shape
 * @param {string} request.taskType - from TASK_TYPES
 * @param {string} [request.prompt] - user message (single-shot)
 * @param {Array}  [request.messages] - conversation history (multi-turn)
 * @param {string} [request.systemPrompt] - system prompt
 * @param {number} [request.maxTokens] - default 1024
 * @param {string} [request.clientTier] - from CLIENT_TIERS
 * @param {string} [request.tenantId] - for logging
 * @param {Array}  [request.tools] - tool definitions
 * @param {Object} [request.toolExecutors] - tool name -> async function map
 * @param {number} [request.maxToolRounds] - tool-use loop limit (default 5)
 * @returns {Promise<Object>} StandardResponse
 */
export async function sendPrompt(request) {
  const providerChain = route(request);

  let lastError = null;
  for (const providerName of providerChain) {
    try {
      const adapter = getAdapter(providerName);

      // Skip providers that aren't configured
      if (!adapter.isConfigured()) {
        continue;
      }

      // Adapt prompt for target provider
      const adaptedRequest = getPromptVariant(request, providerName);

      let response;

      // If tools + toolExecutors are provided, use the tool-use loop
      if (adaptedRequest.tools && adaptedRequest.toolExecutors) {
        // Only Anthropic adapter supports sendWithTools currently
        if (typeof adapter.sendWithTools !== 'function') {
          console.warn(`[LLM Gateway] ${providerName} does not support tool use, skipping`);
          continue;
        }
        response = await adapter.sendWithTools({
          messages: adaptedRequest.messages || [{ role: 'user', content: adaptedRequest.prompt }],
          systemPrompt: adaptedRequest.systemPrompt,
          tools: adaptedRequest.tools,
          toolExecutors: adaptedRequest.toolExecutors,
          tenantId: adaptedRequest.tenantId,
          maxToolRounds: adaptedRequest.maxToolRounds || 5,
        });
      } else {
        // Single-shot call
        response = await adapter.send(adaptedRequest);
      }

      // Log cost for observability
      if (response.usage?.cost) {
        console.log(
          `[LLM Gateway] ${providerName} | ${request.taskType} | $${response.usage.cost.toFixed(5)} | ${response.latency || 0}ms`
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      console.error(`[LLM Gateway] ${providerName} failed:`, error.message);
      // Continue to next provider in failover chain
    }
  }

  // All providers failed
  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}

// ---------------------------------------------------------------------------
// Health check — used by /api/system-status
// ---------------------------------------------------------------------------

/**
 * Get health status for all configured providers.
 * @returns {Promise<Object>} { anthropic: {...}, openai: {...} }
 */
export async function getProviderHealth() {
  const adapters = getAdapters();
  const health = {};

  for (const [name, adapter] of Object.entries(adapters)) {
    health[name] = {
      configured: adapter.isConfigured(),
      enabled: providerConfig[name]?.enabled ?? false,
      governmentEligible: providerConfig[name]?.governmentEligible ?? false,
      model: providerConfig[name]?.model || 'unknown',
    };
  }

  return health;
}
