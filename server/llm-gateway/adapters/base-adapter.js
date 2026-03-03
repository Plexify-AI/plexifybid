/**
 * PlexifyAEC — Base LLM Adapter
 *
 * Duck-type contract that each provider adapter must implement.
 * Provides default no-op implementations.
 */

export class BaseAdapter {
  constructor(config) {
    this.name = config?.name || 'unknown';
    this.config = config;
    this.healthy = true;
    this.lastHealthCheck = null;
  }

  /** @returns {boolean} Whether this adapter has valid credentials */
  isConfigured() {
    return false;
  }

  /**
   * Check if the provider is available (cached for 30s).
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (this.lastHealthCheck && Date.now() - this.lastHealthCheck < 30000) {
      return this.healthy;
    }
    try {
      this.healthy = this.isConfigured();
      this.lastHealthCheck = Date.now();
      return this.healthy;
    } catch {
      this.healthy = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  /**
   * Single-shot prompt — no tool use.
   * @param {import('../types.js').StandardRequest} request
   * @returns {Promise<import('../types.js').StandardResponse>}
   */
  async send(request) {
    throw new Error(`${this.name} adapter: send() not implemented`);
  }

  /**
   * Estimate cost before sending.
   * @param {import('../types.js').StandardRequest} request
   * @returns {number} Estimated USD cost
   */
  estimateCost(request) {
    return 0;
  }

  /**
   * Calculate actual cost from usage.
   * @param {{ inputTokens: number, outputTokens: number }} usage
   * @returns {number} USD cost
   */
  calculateCost(usage) {
    return 0;
  }
}
