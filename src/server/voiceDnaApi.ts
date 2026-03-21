/**
 * Voice DNA — Vite dev middleware wrapper
 *
 * Wraps server/routes/voice-dna.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlers: any = null;

async function getHandlers() {
  if (!handlers) {
    const mod = await import('../../server/routes/voice-dna.js');
    handlers = {
      create: mod.handleCreateProfile,
      active: mod.handleGetActive,
      get: mod.handleGetProfile,
      approve: mod.handleApproveProfile,
      dimensions: mod.handleUpdateDimensions,
    };
  }
  return handlers;
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

export function voiceDnaMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (!url.startsWith('/api/voice-dna')) return next();

    try {
      const h = await getHandlers();

      // POST /api/voice-dna/profiles
      if (url === '/api/voice-dna/profiles' && req.method === 'POST') {
        const body = await readBody(req);
        await h.create(req, res, body);
        return;
      }

      // GET /api/voice-dna/profiles/active
      if (url === '/api/voice-dna/profiles/active' && req.method === 'GET') {
        await h.active(req, res);
        return;
      }

      // GET /api/voice-dna/profiles/:id
      const getMatch = url.match(/^\/api\/voice-dna\/profiles\/([0-9a-f-]+)$/);
      if (getMatch && req.method === 'GET') {
        await h.get(req, res, getMatch[1]);
        return;
      }

      // PUT /api/voice-dna/profiles/:id/approve
      const approveMatch = url.match(/^\/api\/voice-dna\/profiles\/([0-9a-f-]+)\/approve$/);
      if (approveMatch && req.method === 'PUT') {
        await h.approve(req, res, approveMatch[1]);
        return;
      }

      // PUT /api/voice-dna/profiles/:id/dimensions
      const dimMatch = url.match(/^\/api\/voice-dna\/profiles\/([0-9a-f-]+)\/dimensions$/);
      if (dimMatch && req.method === 'PUT') {
        const body = await readBody(req);
        await h.dimensions(req, res, dimMatch[1], body);
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
