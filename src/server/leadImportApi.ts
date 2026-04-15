/**
 * Lead Import — Vite dev middleware wrapper
 *
 * Wraps server/routes/lead-import.js for the Vite dev server.
 * Handles multipart file upload via multer for /parse, JSON body for /import,
 * and static file serving for /template.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let _handlers: any = null;

async function getHandlers() {
  if (!_handlers) {
    const mod = await import('../../server/routes/lead-import.js');
    _handlers = {
      parse: mod.handleParse,
      import: mod.handleImport,
      template: mod.handleTemplate,
    };
  }
  return _handlers;
}

let _multer: any = null;

async function getMulter() {
  if (!_multer) {
    const multerMod = await import('multer');
    const multerFn = (multerMod as any).default || multerMod;
    _multer = multerFn({
      storage: multerFn.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        const allowedMime = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
          'text/plain',
        ];
        if (allowedMime.includes(file.mimetype) || ['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
        }
      },
    });
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

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((req as any).body) return resolve((req as any).body);
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => { chunks.push(chunk); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export function leadImportMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    // GET /api/leads/template — download import template
    if (url === '/api/leads/template' && req.method === 'GET') {
      try {
        const handlers = await getHandlers();
        await handlers.template(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // POST /api/leads/parse — multipart file upload
    if (url === '/api/leads/parse' && req.method === 'POST') {
      try {
        const multerInstance = await getMulter();
        await runMulter(multerInstance, req, res);
        const handlers = await getHandlers();
        await handlers.parse(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // POST /api/leads/import — JSON body
    if (url === '/api/leads/import' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        (req as any).body = body;
        const handlers = await getHandlers();
        await handlers.import(req, res);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    next();
  };
}
