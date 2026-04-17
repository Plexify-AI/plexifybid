/**
 * PlexifySOLO — Per-tenant in-memory event bus for job state (Sprint E / E4)
 *
 * Lightweight pub/sub. The SSE route subscribes per tenant; jobs.mjs emits
 * on state changes. No persistence — late subscribers miss prior events
 * (by design; SSE is live-only, callers can GET /api/jobs to seed history).
 */

import { EventEmitter } from 'node:events';

class TenantJobBus {
  constructor() {
    this.emitters = new Map(); // tenantId -> EventEmitter
  }
  _get(tenantId) {
    if (!this.emitters.has(tenantId)) {
      const em = new EventEmitter();
      em.setMaxListeners(50);
      this.emitters.set(tenantId, em);
    }
    return this.emitters.get(tenantId);
  }
  emit(tenantId, event) {
    if (!tenantId) return;
    this._get(tenantId).emit('event', event);
  }
  subscribe(tenantId, handler) {
    const em = this._get(tenantId);
    em.on('event', handler);
    return () => em.off('event', handler);
  }
}

export const jobEvents = new TenantJobBus();
