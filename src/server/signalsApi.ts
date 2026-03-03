/**
 * Signals — Vite dev middleware wrapper
 *
 * Wraps server/routes/signals.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlers: any = null;

async function getHandlers() {
  if (!handlers) {
    const mod = await import('../../server/routes/signals.js');
    handlers = {
      logSignal: mod.handleLogSignal,
      getSignals: mod.handleGetSignals,
      bulkSignals: mod.handleBulkSignals,
    };
  }
  return handlers;
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    // If body already parsed (e.g., by sandboxAuth middleware)
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

export function signalsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    // POST /api/signals — log single signal
    if (url === '/api/signals' && req.method === 'POST') {
      try {
        const h = await getHandlers();
        const body = await parseBody(req);
        await h.logSignal(req, res, body);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // POST /api/signals/bulk — bulk import
    if (url === '/api/signals/bulk' && req.method === 'POST') {
      try {
        const h = await getHandlers();
        const body = await parseBody(req);
        await h.bulkSignals(req, res, body);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // GET /api/signals/:opportunityId — event history
    const signalMatch = url.match(/^\/api\/signals\/([a-f0-9-]+)$/);
    if (signalMatch && req.method === 'GET') {
      try {
        const h = await getHandlers();
        await h.getSignals(req, res, signalMatch[1]);
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
