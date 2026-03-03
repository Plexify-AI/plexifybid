/**
 * System Status — Vite dev middleware wrapper
 *
 * Wraps server/routes/system-status.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleSystemStatusFn: any = null;

async function getHandler() {
  if (!handleSystemStatusFn) {
    const mod = await import('../../server/routes/system-status.js');
    handleSystemStatusFn = mod.handleSystemStatus;
  }
  return handleSystemStatusFn;
}

export function systemStatusMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (url !== '/api/system-status' || req.method !== 'GET') return next();

    try {
      const handler = await getHandler();
      await handler(req, res);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
