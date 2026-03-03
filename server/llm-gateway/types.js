/**
 * PlexifyAEC — LLM Gateway Type Definitions
 *
 * StandardRequest / StandardResponse shapes used by all AI calls.
 * Feature code never references Anthropic/OpenAI directly.
 */

export const TASK_TYPES = {
  ASK_PLEXI: 'ask_plexi',
  OUTREACH_GENERATION: 'outreach_generation',
  ENRICHMENT: 'enrichment',
  DEAL_ROOM_ARTIFACT: 'deal_room_artifact',
  EVIDENCE_BUNDLE: 'evidence_bundle',
  WARMTH_ANALYSIS: 'warmth_analysis',
  DOCUMENT_SUMMARY: 'document_summary',
  GENERAL: 'general',
};

export const CLIENT_TIERS = {
  STANDARD: 'standard',
  GOVERNMENT: 'government',
  GOVERNMENT_STATE: 'gov_state',
  ENTERPRISE: 'enterprise',
};

/**
 * StandardRequest shape (JSDoc for IDE support):
 *
 * @typedef {Object} StandardRequest
 * @property {string} taskType        - from TASK_TYPES
 * @property {string} prompt          - user message content
 * @property {string} [systemPrompt]  - system prompt
 * @property {Array}  [messages]      - full conversation history [{role, content}]
 * @property {Object} [context]       - opportunity data, tenant config, etc.
 * @property {number} [maxTokens]     - default 1024
 * @property {number} [temperature]   - default 0.7
 * @property {string} [responseFormat] - 'text'|'json'|'structured'
 * @property {string} [priority]      - 'low'|'normal'|'high'
 * @property {string} [clientTier]    - from CLIENT_TIERS
 * @property {string} [tenantId]      - for logging and rate limiting
 * @property {Array}  [tools]         - tool definitions (provider-adapted)
 * @property {Object} [toolExecutors] - map of tool name -> async function
 * @property {number} [maxToolRounds] - safety limit on tool-use loops (default 5)
 */

/**
 * StandardResponse shape:
 *
 * @typedef {Object} StandardResponse
 * @property {string} content         - text response
 * @property {string} provider        - 'anthropic'|'openai'|'google'
 * @property {string} model           - exact model used
 * @property {Object} usage           - { inputTokens, outputTokens, cost }
 * @property {number} latency         - ms
 * @property {Object} metadata        - provider-specific extras
 * @property {Array}  [toolResults]   - results from tool-use loop
 * @property {Object} [_raw]          - full raw provider response
 */
