/**
 * Outreach Sequence — Vite dev middleware wrapper
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handler: any = null;

async function getHandler() {
  if (!handler) {
    const mod = await import('../../server/routes/outreach-sequence.js');
    handler = mod.handleGenerateSequence;
  }
  return handler;
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

export function outreachSequenceMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (url !== '/api/outreach-sequence' || req.method !== 'POST') return next();

    try {
      const h = await getHandler();
      const body = await parseBody(req);
      await h(req, res, body);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
