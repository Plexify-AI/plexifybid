/**
 * Jobs API — Vite dev middleware wrapper (Sprint E / E1)
 *
 * Wraps server/jobs.mjs for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleStartJobFn: any = null;
let handleGetJobFn: any = null;
let handleCancelJobFn: any = null;
let handleListJobsFn: any = null;
let handleUsageSummaryFn: any = null;

async function getHandlers() {
  if (!handleStartJobFn) {
    const mod = await import('../../server/jobs.mjs');
    handleStartJobFn = mod.handleStartJob;
    handleGetJobFn = mod.handleGetJob;
    handleCancelJobFn = mod.handleCancelJob;
    handleListJobsFn = mod.handleListJobs;
    handleUsageSummaryFn = mod.handleUsageSummary;
  }
  return {
    handleStartJobFn,
    handleGetJobFn,
    handleCancelJobFn,
    handleListJobsFn,
    handleUsageSummaryFn,
  };
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

export function jobsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    const isJobs = url === '/api/jobs' || url.startsWith('/api/jobs/');
    const isUsageSummary = url === '/api/tenant-usage/summary';
    if (!isJobs && !isUsageSummary) return next();

    try {
      const handlers = await getHandlers();

      if (isUsageSummary && req.method === 'GET') {
        await handlers.handleUsageSummaryFn(req, res);
        return;
      }

      if (url === '/api/jobs' && req.method === 'POST') {
        const body = await readBody(req);
        await handlers.handleStartJobFn(req, res, body);
        return;
      }

      if (url === '/api/jobs' && req.method === 'GET') {
        await handlers.handleListJobsFn(req, res);
        return;
      }

      // /api/jobs/:id or /api/jobs/:id/cancel
      const idMatch = url.match(/^\/api\/jobs\/([^/]+)(\/cancel)?$/);
      if (idMatch) {
        const jobId = idMatch[1];
        const isCancel = Boolean(idMatch[2]);

        if (isCancel && req.method === 'POST') {
          await handlers.handleCancelJobFn(req, res, jobId);
          return;
        }
        if (!isCancel && req.method === 'GET') {
          await handlers.handleGetJobFn(req, res, jobId);
          return;
        }
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
