/**
 * Batch Email API (dev middleware)
 *
 * Handles POST /api/batch-email/generate and the Sprint BATCH-50 endpoints
 * (GET opportunities, GET campaigns) in Vite dev. Production uses
 * server/routes/batch-email.js wired through server/index.mjs.
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

let _handlers: any = null;

async function getHandlers() {
  if (!_handlers) {
    const mod = await import('../../server/routes/batch-email.js');
    _handlers = {
      generate: mod.handleBatchGenerate,
      opportunities: mod.handleBatchOpportunities,
      campaigns: mod.handleBatchCampaigns,
      templates: mod.handleBatchTemplates,
    };
  }
  return _handlers;
}

export function batchEmailMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    try {
      if (url.startsWith('/api/batch-email/generate') && req.method === 'POST') {
        const handlers = await getHandlers();
        const body = await readJson(req);
        await handlers.generate(req, res, body);
        return;
      }

      if (url.startsWith('/api/batch-email/opportunities') && req.method === 'GET') {
        const handlers = await getHandlers();
        await handlers.opportunities(req, res);
        return;
      }

      if (url.startsWith('/api/batch-email/campaigns') && req.method === 'GET') {
        const handlers = await getHandlers();
        await handlers.campaigns(req, res);
        return;
      }

      if (url.startsWith('/api/batch-email/templates') && req.method === 'GET') {
        const handlers = await getHandlers();
        await handlers.templates(req, res);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Batch Email] Error:', err);
      return sendJson(res, 500, { error: message });
    }

    next();
  };
}
