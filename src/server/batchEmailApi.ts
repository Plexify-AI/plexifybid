/**
 * Batch Email API (dev middleware)
 *
 * Handles POST /api/batch-email/generate in Vite dev.
 * Production uses server/routes/batch-email.js via server/index.mjs.
 */

import type { IncomingMessage, ServerResponse } from 'http';

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

let _handler: any = null;

async function getHandler() {
  if (!_handler) {
    const mod = await import('../../server/routes/batch-email.js');
    _handler = mod.handleBatchGenerate;
  }
  return _handler;
}

export function batchEmailMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    if (url.startsWith('/api/batch-email/generate') && req.method === 'POST') {
      try {
        const handler = await getHandler();
        const body = await readJson(req);
        await handler(req, res, body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Batch Email] Error:', err);
        return sendJson(res, 500, { error: message });
      }
      return;
    }

    next();
  };
}
