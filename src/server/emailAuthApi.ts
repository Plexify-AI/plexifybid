/**
 * Email Auth — Vite dev middleware wrapper
 *
 * Wraps server/routes/email-auth.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handlers: any = null;

async function getHandlers() {
  if (!handlers) {
    const mod = await import('../../server/routes/email-auth.js');
    const toolMod = await import('../../server/services/email/tool-executor.mjs');
    handlers = {
      handleMicrosoftConnect: mod.handleMicrosoftConnect,
      handleMicrosoftCallback: mod.handleMicrosoftCallback,
      handleGmailConnect: mod.handleGmailConnect,
      handleGmailCallback: mod.handleGmailCallback,
      handleEmailDisconnect: mod.handleEmailDisconnect,
      handleEmailStatus: mod.handleEmailStatus,
      confirmSend: toolMod.confirmSend,
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

export function emailAuthMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (!url.startsWith('/api/auth/email') && !url.startsWith('/api/email/')) return next();

    try {
      const handlers = await getHandlers();

      // GET /api/auth/email/microsoft/connect
      if (url === '/api/auth/email/microsoft/connect' && req.method === 'GET') {
        await handlers.handleMicrosoftConnect(req, res);
        return;
      }

      // GET /api/auth/email/microsoft/callback
      if (url === '/api/auth/email/microsoft/callback' && req.method === 'GET') {
        await handlers.handleMicrosoftCallback(req, res);
        return;
      }

      // GET /api/auth/email/gmail/connect
      if (url === '/api/auth/email/gmail/connect' && req.method === 'GET') {
        await handlers.handleGmailConnect(req, res);
        return;
      }

      // GET /api/auth/email/gmail/callback
      if (url === '/api/auth/email/gmail/callback' && req.method === 'GET') {
        await handlers.handleGmailCallback(req, res);
        return;
      }

      // POST /api/auth/email/disconnect
      if (url === '/api/auth/email/disconnect' && req.method === 'POST') {
        await handlers.handleEmailDisconnect(req, res);
        return;
      }

      // GET /api/auth/email/status
      if (url === '/api/auth/email/status' && req.method === 'GET') {
        await handlers.handleEmailStatus(req, res);
        return;
      }

      // POST /api/email/confirm-send
      if (url === '/api/email/confirm-send' && req.method === 'POST') {
        const body = await readBody(req);
        const tenant = (req as any).tenant;
        if (!tenant) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not authenticated' }));
          return;
        }
        const { draft_id } = body;
        if (!draft_id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing draft_id' }));
          return;
        }
        const result = await handlers.confirmSend(draft_id, tenant.id);
        res.statusCode = result.success ? 200 : 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
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
