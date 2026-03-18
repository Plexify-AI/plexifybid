/**
 * Opportunities — Vite dev middleware wrapper
 *
 * Wraps server/routes/opportunities.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlers: any = null;

async function getHandlers() {
  if (!handlers) {
    const mod = await import('../../server/routes/opportunities.js');
    handlers = {
      list: mod.handleListOpportunities,
      getOne: mod.handleGetOpportunity,
      create: mod.handleCreateOpportunity,
    };
  }
  return handlers;
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((req as any).body) return resolve((req as any).body);
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export function opportunitiesMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    // Match /api/opportunities or /api/opportunities/:id
    const exactMatch = url === '/api/opportunities';
    const idMatch = url.match(/^\/api\/opportunities\/([0-9a-f-]{36})$/);
    if (!exactMatch && !idMatch) return next();

    try {
      const h = await getHandlers();

      if (idMatch && req.method === 'GET') {
        await h.getOne(req, res, idMatch[1]);
      } else if (exactMatch && req.method === 'GET') {
        await h.list(req, res);
      } else if (exactMatch && req.method === 'POST') {
        const body = await parseBody(req);
        await h.create(req, res, body);
      } else {
        return next();
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
