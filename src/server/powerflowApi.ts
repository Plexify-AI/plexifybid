/**
 * Powerflow Pipeline — Vite dev middleware wrapper
 *
 * Wraps server/routes/powerflow.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleGetTodayFn: any = null;
let handleCompleteStageFn: any = null;

async function getHandlers() {
  if (!handleGetTodayFn) {
    const mod = await import('../../server/routes/powerflow.js');
    handleGetTodayFn = mod.handleGetToday;
    handleCompleteStageFn = mod.handleCompleteStage;
  }
  return { handleGetTodayFn, handleCompleteStageFn };
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function powerflowMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (!url.startsWith('/api/powerflow')) return next();

    try {
      const { handleGetTodayFn: getToday, handleCompleteStageFn: complete } = await getHandlers();

      // GET /api/powerflow/today
      if (url === '/api/powerflow/today' && req.method === 'GET') {
        await getToday(req, res);
        return;
      }

      // POST /api/powerflow/complete
      if (url === '/api/powerflow/complete' && req.method === 'POST') {
        const body = await readBody(req);
        await complete(req, res, body);
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
