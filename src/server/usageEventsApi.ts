/**
 * Usage Events — Vite dev middleware wrapper
 *
 * Wraps server/routes/usage-events.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlerFn: any = null;

async function getHandler() {
  if (!handlerFn) {
    const mod = await import('../../server/routes/usage-events.js');
    handlerFn = mod.handleGetUsageEvents;
  }
  return handlerFn;
}

export function usageEventsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    // Only handle GET /api/usage-events
    if (url.startsWith('/api/usage-events') && req.method === 'GET') {
      try {
        // Parse query params from URL
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        (req as any).query = Object.fromEntries(urlObj.searchParams);

        const handler = await getHandler();
        await handler(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    next();
  };
}
