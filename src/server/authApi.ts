/**
 * Auth API — Vite dev middleware wrapper
 *
 * Handles /api/auth/* routes in development.
 * Production uses server/index.mjs directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleValidateFn: any = null;

async function getHandler() {
  if (!handleValidateFn) {
    const mod = await import('../../server/routes/auth.js');
    handleValidateFn = mod.handleValidate;
  }
  return handleValidateFn;
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

export function authMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    if (!url.startsWith('/api/auth')) return next();

    // POST /api/auth/validate
    if (url.startsWith('/api/auth/validate') && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const handler = await getHandler();
        await handler(req, res, body);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ valid: false, error: err.message }));
      }
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}
