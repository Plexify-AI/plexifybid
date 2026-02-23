/**
 * Pipeline Summary — Vite dev middleware wrapper
 *
 * Wraps server/routes/pipeline-summary.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlePipelineSummaryFn: any = null;

async function getHandler() {
  if (!handlePipelineSummaryFn) {
    const mod = await import('../../server/routes/pipeline-summary.js');
    handlePipelineSummaryFn = mod.handlePipelineSummary;
  }
  return handlePipelineSummaryFn;
}

export function pipelineSummaryMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (url !== '/api/pipeline-summary' || req.method !== 'GET') return next();

    try {
      const handler = await getHandler();
      await handler(req, res);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
