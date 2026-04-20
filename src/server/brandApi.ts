/**
 * Brand Config API — Vite dev middleware wrapper.
 * Mirrors the production Express routes in server/index.mjs.
 *
 * Uses multer for multipart parsing (matches dealRoomsApi.ts pattern).
 */

import type { IncomingMessage, ServerResponse } from 'http';

let getFn: any = null;
let uploadFn: any = null;
let deleteFn: any = null;
let _multer: any = null;
let _multerFn: any = null;

async function getHandlers() {
  if (!getFn) {
    const mod = await import('../../server/routes/brand.js');
    getFn = mod.handleGetEmailImages;
    uploadFn = mod.handleUploadEmailImages;
    deleteFn = mod.handleDeleteEmailImage;
  }
  return { getFn, uploadFn, deleteFn };
}

async function getMulter() {
  if (!_multer) {
    const multerMod = await import('multer');
    _multerFn = (multerMod as any).default || multerMod;
    _multer = _multerFn({
      storage: _multerFn.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 2 },
    });
  }
  return _multer;
}

// Run multer's fields() middleware as a promise.
function runMulterFields(multerInstance: any, req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    multerInstance.fields([
      { name: 'hero', maxCount: 1 },
      { name: 'footer', maxCount: 1 },
    ])(req, res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function brandMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/brand/')) return next();

    try {
      const h = await getHandlers();

      if (url === '/api/brand/email-images') {
        if (req.method === 'GET') {
          await h.getFn(req, res);
          return;
        }
        if (req.method === 'POST') {
          const m = await getMulter();
          await runMulterFields(m, req as any, res as any);
          // Normalize req.files from {fieldname: [file]} to flat array (matches
          // server/index.mjs prod wiring expectations)
          const flat: any[] = [];
          const filesObj = (req as any).files || {};
          for (const [fn, arr] of Object.entries(filesObj)) {
            for (const f of arr as any[]) flat.push({ ...f, fieldname: fn });
          }
          (req as any).files = flat;
          await h.uploadFn(req, res);
          return;
        }
        if (req.method === 'DELETE') {
          await h.deleteFn(req, res);
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
