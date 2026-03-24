/**
 * LinkedIn Import — Vite dev middleware wrapper
 *
 * Wraps server/routes/linkedin-import.js for the Vite dev server.
 * Handles multipart file upload via multer.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let _handlers: any = null;

async function getHandlers() {
  if (!_handlers) {
    const mod = await import('../../server/routes/linkedin-import.js');
    _handlers = {
      upload: mod.handleUploadLinkedInExport,
      start: mod.handleStartPipeline,
      status: mod.handleGetStatus,
      cancel: mod.handleCancelPipeline,
    };
  }
  return _handlers;
}

let _multer: any = null;

async function getMulter() {
  if (!_multer) {
    const multerMod = await import('multer');
    const multerFn = (multerMod as any).default || multerMod;
    _multer = multerFn({ storage: multerFn.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
  }
  return _multer;
}

function runMulter(multerInstance: any, req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    multerInstance.single('file')(req, res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Read JSON body from raw Node IncomingMessage.
 */
function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

export function linkedinImportMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    // POST /api/linkedin-import/upload — multipart file upload
    if (url === '/api/linkedin-import/upload' && req.method === 'POST') {
      try {
        const multerInstance = await getMulter();
        await runMulter(multerInstance, req, res);
        const handlers = await getHandlers();
        await handlers.upload(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // POST /api/linkedin-import/start — start pipeline
    if (url === '/api/linkedin-import/start' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        (req as any).body = body;
        const handlers = await getHandlers();
        await handlers.start(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // GET /api/linkedin-import/status/:jobId — poll status
    const statusMatch = url.match(/^\/api\/linkedin-import\/status\/([a-f0-9-]+)$/);
    if (statusMatch && req.method === 'GET') {
      try {
        (req as any).params = { jobId: statusMatch[1] };
        const handlers = await getHandlers();
        await handlers.status(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // POST /api/linkedin-import/cancel/:jobId — cancel pipeline
    const cancelMatch = url.match(/^\/api\/linkedin-import\/cancel\/([a-f0-9-]+)$/);
    if (cancelMatch && req.method === 'POST') {
      try {
        (req as any).params = { jobId: cancelMatch[1] };
        const body = await readBody(req);
        (req as any).body = body;
        const handlers = await getHandlers();
        await handlers.cancel(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    return next();
  };
}
