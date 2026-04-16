/**
 * AskPlexi Conversation Library — Vite dev middleware wrapper (Sprint B / B3)
 *
 * Wraps server/routes/askplexi-conversations.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly via Express.
 *
 * Routes:
 *   GET    /api/askplexi/conversations
 *   GET    /api/askplexi/conversations/:id
 *   PUT    /api/askplexi/conversations/:id
 *   DELETE /api/askplexi/conversations/:id
 */

import type { IncomingMessage, ServerResponse } from 'http';

const BASE = '/api/askplexi/conversations';

let handlersPromise: Promise<any> | null = null;

async function getHandlers() {
  if (!handlersPromise) {
    handlersPromise = import('../../server/routes/askplexi-conversations.js').then((mod) => ({
      list: mod.handleList,
      get: mod.handleGet,
      patch: mod.handlePatch,
      del: mod.handleDelete,
    }));
  }
  return handlersPromise;
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

export function askplexiConversationsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url || '').split('?')[0];

    // Only claim /api/askplexi/conversations and /api/askplexi/conversations/:id
    if (path !== BASE && !path.startsWith(`${BASE}/`)) return next();

    try {
      const h = await getHandlers();

      // Collection endpoint
      if (path === BASE) {
        if (req.method === 'GET') { await h.list(req, res); return; }
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // :id endpoint
      const id = decodeURIComponent(path.slice(BASE.length + 1));
      if (!id || id.includes('/')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      if (req.method === 'GET')    { await h.get(req, res, id); return; }
      if (req.method === 'PUT')    { const b = await readBody(req); await h.patch(req, res, id, b); return; }
      if (req.method === 'DELETE') { await h.del(req, res, id); return; }

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
