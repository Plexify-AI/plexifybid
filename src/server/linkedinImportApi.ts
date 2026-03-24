/**
 * LinkedIn Import — Vite dev middleware wrapper
 *
 * Wraps server/routes/linkedin-import.js for the Vite dev server.
 * Handles multipart file upload via multer.
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let _handler: any = null;

async function getHandler() {
  if (!_handler) {
    const mod = await import('../../server/routes/linkedin-import.js');
    _handler = mod.handleUploadLinkedInExport;
  }
  return _handler;
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

export function linkedinImportMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];

    if (url !== '/api/linkedin-import/upload' || req.method !== 'POST') {
      return next();
    }

    try {
      const multerInstance = await getMulter();
      await runMulter(multerInstance, req, res);

      const handler = await getHandler();
      await handler(req, res);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
