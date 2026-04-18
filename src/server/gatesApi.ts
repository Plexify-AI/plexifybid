/**
 * Gates API — Vite dev middleware wrapper (Sprint E / E5)
 *
 * Wraps server/routes/gates.js for the Vite dev server.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let auditFn: any = null;
let complianceFn: any = null;
let createOverrideFn: any = null;
let listOverridesFn: any = null;

async function getHandlers() {
  if (!auditFn) {
    const mod = await import('../../server/routes/gates.js');
    auditFn = mod.handleAudit;
    complianceFn = mod.handleCompliance;
    createOverrideFn = mod.handleCreateOverride;
    listOverridesFn = mod.handleListOverrides;
  }
  return { auditFn, complianceFn, createOverrideFn, listOverridesFn };
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

export function gatesMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/gates') && !url.startsWith('/api/gate-overrides')) return next();

    try {
      const h = await getHandlers();

      if (url === '/api/gates/audit' && req.method === 'POST') {
        const body = await readBody(req);
        await h.auditFn(req, res, body);
        return;
      }
      if (url === '/api/gates/compliance' && req.method === 'POST') {
        const body = await readBody(req);
        await h.complianceFn(req, res, body);
        return;
      }
      if (url === '/api/gate-overrides' && req.method === 'POST') {
        const body = await readBody(req);
        await h.createOverrideFn(req, res, body);
        return;
      }
      if (url === '/api/gate-overrides' && req.method === 'GET') {
        await h.listOverridesFn(req, res);
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
