/**
 * PPTX Export API (dev middleware)
 *
 * Handles:
 * - POST /api/export/pptx — Direct editor content → PPTX
 * - POST /api/deal-rooms/:id/generate-deck — LLM-driven deck generation
 *
 * In production these are handled by server/routes/export-pptx.js.
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

export function pptxExportMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    // Handle direct PPTX export from editor content
    if (url.startsWith('/api/export/pptx') && req.method === 'POST') {
      try {
        // Dynamically import the production handler
        const { handleExportPptx } = await import(
          /* @vite-ignore */ '../../server/routes/export-pptx.js'
        );

        const body = await readJson(req);

        // Wrap res to support Express-style .status().json() + .setHeader/.send
        const expressLikeRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return {
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
            };
          },
          send(data: any) {
            res.end(data);
          },
        });

        await handleExportPptx(expressLikeRes, expressLikeRes, body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[PPTX Export] Error:', err);
        return sendJson(res, 500, { error: message || 'Failed to generate presentation' });
      }
      return;
    }

    // Handle LLM-driven deck generation
    const deckMatch = url.match(/^\/api\/deal-rooms\/([^/]+)\/generate-deck/);
    if (deckMatch && req.method === 'POST') {
      try {
        const { handleGenerateDeck } = await import(
          /* @vite-ignore */ '../../server/routes/export-pptx.js'
        );

        const body = await readJson(req);
        const dealRoomId = deckMatch[1];

        // The req should already have .tenant from sandboxAuthDevMiddleware
        await handleGenerateDeck(req as any, res as any, dealRoomId, body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[PPTX Deck Gen] Error:', err);
        return sendJson(res, 500, { error: message || 'Failed to generate deck' });
      }
      return;
    }

    next();
  };
}
