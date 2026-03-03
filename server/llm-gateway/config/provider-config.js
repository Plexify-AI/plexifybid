/**
 * PlexifyAEC — LLM Provider Configuration
 *
 * Each provider entry defines API keys, model defaults, and capabilities.
 * OpenAI is enabled only when OPENAI_API_KEY is present in environment.
 *
 * Model string uses the codebase's current model: claude-sonnet-4-20250514
 */

export default {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    enabled: true,
    governmentEligible: false,
    maxConcurrent: 10,
    costPerInputToken: 3 / 1_000_000,
    costPerOutputToken: 15 / 1_000_000,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    enabled: !!process.env.OPENAI_API_KEY,
    governmentEligible: true,
    maxConcurrent: 10,
    costPerInputToken: 2.5 / 1_000_000,
    costPerOutputToken: 10 / 1_000_000,
  },
  // google: { ... }  -- Gemini adapter added Sprint 3+
};
