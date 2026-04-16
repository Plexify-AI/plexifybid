/**
 * User Preferences — Vite dev middleware wrapper (Sprint B / B1)
 *
 * Wraps server/routes/user-preferences.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly via Express.
 *
 * Routes:
 *   GET    /api/user-preferences            — all categories
 *   GET    /api/user-preferences/:category  — one category
 *   PUT    /api/user-preferences/:category  — shallow-merge patch
 */

import type { IncomingMessage, ServerResponse } from 'http';

const BASE = '/api/user-preferences';

let handleGetAllFn: any = null;
let handleGetOneFn: any = null;
let handleUpdateFn: any = null;

async function getHandlers() {
  if (!handleGetAllFn) {
    const mod = await import('../../server/routes/user-preferences.js');
    handleGetAllFn = mod.handleGetAllUserPreferences;
    handleGetOneFn = mod.handleGetUserPreferences;
    handleUpdateFn = mod.handleUpdateUserPreferences;
  }
  return { handleGetAllFn, handleGetOneFn, handleUpdateFn };
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function userPreferencesMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url || '').split('?')[0];

    // Only claim /api/user-preferences and /api/user-preferences/<category>.
    // Every other URL (including /api/preferences, which is the legacy route)
    // falls through to the next middleware.
    if (path !== BASE && !path.startsWith(`${BASE}/`)) return next();

    try {
      const { handleGetAllFn: all, handleGetOneFn: one, handleUpdateFn: update } = await getHandlers();

      // Collection endpoint
      if (path === BASE) {
        if (req.method === 'GET') {
          await all(req, res);
          return;
        }
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // Category endpoint — everything after /api/user-preferences/
      const category = decodeURIComponent(path.slice(BASE.length + 1));

      if (!category || category.includes('/')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      if (req.method === 'GET') {
        await one(req, res, category);
        return;
      }

      if (req.method === 'PUT') {
        const body = await readBody(req);
        await update(req, res, category, body);
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
