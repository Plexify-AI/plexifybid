/**
 * PlexifyAEC — LLM Router
 *
 * Selects ordered provider chain for a request based on:
 *   1. Client tier (government = exclude Anthropic)
 *   2. Task type (writing → Claude, research → GPT-4o)
 *   3. Provider health (skip unhealthy providers)
 *
 * Returns an array of provider names to try in order.
 */

import { rules, defaultChain } from './config/routing-config.js';

/**
 * Route a request to an ordered list of provider names.
 * First matching rule wins.
 *
 * @param {Object} request - StandardRequest
 * @returns {string[]} Ordered provider names, e.g. ['anthropic', 'openai']
 */
export function route(request) {
  for (const rule of rules) {
    if (matchesRule(request, rule.match)) {
      return rule.providers;
    }
  }
  return defaultChain;
}

/**
 * Check if a request matches a rule's conditions.
 * All conditions in the match object must be satisfied.
 */
function matchesRule(request, match) {
  if (match.clientTier && request.clientTier !== match.clientTier) return false;
  if (match.taskType && request.taskType !== match.taskType) return false;
  if (match.priority && request.priority !== match.priority) return false;
  return true;
}
