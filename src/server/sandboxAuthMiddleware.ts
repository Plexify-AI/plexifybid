/**
 * Sandbox Auth — Vite dev middleware wrapper
 *
 * Applies sandbox token validation to /api/ routes in development.
 * Mirrors what server/middleware/sandboxAuth.js does in production.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let sandboxAuthFn: any = null;

async function getMiddleware() {
  if (!sandboxAuthFn) {
    const mod = await import('../../server/middleware/sandboxAuth.js');
    sandboxAuthFn = mod.sandboxAuth;
  }
  return sandboxAuthFn;
}

export function sandboxAuthDevMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    // Only apply to /api/ routes
    if (!url.startsWith('/api/')) return next();

    try {
      const createMiddleware = await getMiddleware();
      const middleware = createMiddleware();
      // The sandboxAuth middleware calls next() on success
      await middleware(req, res, next);
    } catch (err: any) {
      console.error('[sandboxAuthDev] Error:', err.message);
      next(); // Don't block on middleware errors in dev
    }
  };
}
