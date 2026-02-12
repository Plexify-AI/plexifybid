/**
 * Ask Plexi — Vite dev middleware wrapper
 *
 * Wraps server/routes/ask-plexi.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

// Dynamic import of the ESM route handler
// (server/ files use .js ESM imports — Vite handles the resolution in dev)
let handleChatFn: any = null;

async function getHandler() {
  if (!handleChatFn) {
    const mod = await import('../../server/routes/ask-plexi.js');
    handleChatFn = mod.handleChat;
  }
  return handleChatFn;
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

export function askPlexiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    // Only handle /api/ask-plexi/* routes
    if (!url.startsWith('/api/ask-plexi')) return next();

    // POST /api/ask-plexi/chat
    if (url === '/api/ask-plexi/chat' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const handler = await getHandler();
        await handler(req, res, body);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // Unknown ask-plexi route
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}
