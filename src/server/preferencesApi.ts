/**
 * Tenant Preferences — Vite dev middleware wrapper
 *
 * Wraps server/routes/preferences.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleGetFn: any = null;
let handleUpdateFn: any = null;

async function getHandlers() {
  if (!handleGetFn) {
    const mod = await import('../../server/routes/preferences.js');
    handleGetFn = mod.handleGetPreferences;
    handleUpdateFn = mod.handleUpdatePreferences;
  }
  return { handleGetFn, handleUpdateFn };
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

export function preferencesMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (url !== '/api/preferences') return next();

    try {
      const { handleGetFn: get, handleUpdateFn: update } = await getHandlers();

      if (req.method === 'GET') {
        await get(req, res);
        return;
      }

      if (req.method === 'PUT') {
        const body = await readBody(req);
        await update(req, res, body);
        return;
      }

      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
