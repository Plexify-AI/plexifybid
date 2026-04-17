/**
 * Public Data API — Vite dev middleware wrapper (Sprint E / E3)
 * Wraps server/routes/data.js for Vite dev.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let getOzTract: any = null;
let ozLookup: any = null;
let tractDemographics: any = null;

async function getHandlers() {
  if (!getOzTract) {
    const mod = await import('../../server/routes/data.js');
    getOzTract = mod.handleGetOzTract;
    ozLookup = mod.handleOzLookup;
    tractDemographics = mod.handleTractDemographics;
  }
  return { getOzTract, ozLookup, tractDemographics };
}

export function dataMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/data/')) return next();

    try {
      const h = await getHandlers();

      if (url === '/api/data/oz-lookup' && req.method === 'GET') {
        await h.ozLookup(req, res);
        return;
      }

      const ozMatch = url.match(/^\/api\/data\/oz-tract\/([^/]+)$/);
      if (ozMatch && req.method === 'GET') {
        await h.getOzTract(req, res, ozMatch[1]);
        return;
      }

      const demMatch = url.match(/^\/api\/data\/tract-demographics\/([^/]+)$/);
      if (demMatch && req.method === 'GET') {
        await h.tractDemographics(req, res, demMatch[1]);
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
