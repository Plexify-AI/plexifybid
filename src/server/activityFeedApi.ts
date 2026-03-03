/**
 * Activity Feed — Vite dev middleware wrapper
 *
 * Wraps server/routes/activity-feed.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handler: any = null;

async function getHandler() {
  if (!handler) {
    const mod = await import('../../server/routes/activity-feed.js');
    handler = mod.handleActivityFeed;
  }
  return handler;
}

export function activityFeedMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    // GET /api/activity-feed
    if (url === '/api/activity-feed' && req.method === 'GET') {
      try {
        const h = await getHandler();
        await h(req, res);
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
