/**
 * Voice Corrections — Vite dev middleware wrapper (Sprint B / B2)
 *
 * Wraps server/routes/voice-corrections.js for the Vite dev server.
 * In production, server/index.mjs handles this route directly via Express.
 *
 * Routes:
 *   POST /api/voice-corrections/capture
 */

import type { IncomingMessage, ServerResponse } from 'http';

const PATH = '/api/voice-corrections/capture';

let handleCaptureFn: any = null;

async function getHandler() {
  if (!handleCaptureFn) {
    const mod = await import('../../server/routes/voice-corrections.js');
    handleCaptureFn = mod.handleCapture;
  }
  return handleCaptureFn;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function voiceCorrectionsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url || '').split('?')[0];
    if (path !== PATH) return next();

    try {
      const handler = await getHandler();

      if (req.method === 'POST') {
        const body = await readBody(req);
        await handler(req, res, body);
        return;
      }

      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  };
}
