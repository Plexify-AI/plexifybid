/**
 * Deal Rooms — Vite dev middleware wrapper
 *
 * Wraps server/routes/deal-rooms.js for the Vite dev server.
 * Handles both JSON body routes and multipart file upload (via multer).
 * In production, server/index.mjs handles these routes directly.
 */

import type { IncomingMessage, ServerResponse } from 'http';

// ---------------------------------------------------------------------------
// Lazy-loaded handlers
// ---------------------------------------------------------------------------

let _handlers: any = null;

async function getHandlers() {
  if (!_handlers) {
    const mod = await import('../../server/routes/deal-rooms.js');
    _handlers = {
      create: mod.handleCreateDealRoom,
      list: mod.handleListDealRooms,
      get: mod.handleGetDealRoom,
      upload: mod.handleUploadSource,
      deleteSource: mod.handleDeleteSource,
      chat: mod.handleDealRoomChat,
      generateArtifact: mod.handleGenerateArtifact,
      listArtifacts: mod.handleListArtifacts,
    };
  }
  return _handlers;
}

let _multer: any = null;

async function getMulter() {
  if (!_multer) {
    const multerMod = await import('multer');
    const multerFn = (multerMod as any).default || multerMod;
    _multer = multerFn({ storage: multerFn.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  }
  return _multer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function sendError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

/**
 * Run multer's single-file middleware as a promise.
 */
function runMulter(multerInstance: any, req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    multerInstance.single('file')(req, res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Parse route params from URL path.
 * /api/deal-rooms/:id/sources/:sourceId etc.
 */
function parseRoute(url: string) {
  // Strip query string
  const path = url.split('?')[0];

  // POST /api/deal-rooms
  // GET  /api/deal-rooms
  if (path === '/api/deal-rooms') {
    return { route: 'list-or-create' };
  }

  // POST /api/deal-rooms/:id/sources
  const sourcesMatch = path.match(/^\/api\/deal-rooms\/([^/]+)\/sources$/);
  if (sourcesMatch) {
    return { route: 'sources', dealRoomId: sourcesMatch[1] };
  }

  // DELETE /api/deal-rooms/:id/sources/:sourceId
  const deleteSourceMatch = path.match(/^\/api\/deal-rooms\/([^/]+)\/sources\/([^/]+)$/);
  if (deleteSourceMatch) {
    return { route: 'delete-source', dealRoomId: deleteSourceMatch[1], sourceId: deleteSourceMatch[2] };
  }

  // POST /api/deal-rooms/:id/chat
  const chatMatch = path.match(/^\/api\/deal-rooms\/([^/]+)\/chat$/);
  if (chatMatch) {
    return { route: 'chat', dealRoomId: chatMatch[1] };
  }

  // POST/GET /api/deal-rooms/:id/artifacts
  const artifactsMatch = path.match(/^\/api\/deal-rooms\/([^/]+)\/artifacts$/);
  if (artifactsMatch) {
    return { route: 'artifacts', dealRoomId: artifactsMatch[1] };
  }

  // GET /api/deal-rooms/:id
  const getMatch = path.match(/^\/api\/deal-rooms\/([^/]+)$/);
  if (getMatch) {
    return { route: 'get', dealRoomId: getMatch[1] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Middleware export
// ---------------------------------------------------------------------------

export function dealRoomsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';

    // Only handle /api/deal-rooms routes
    if (!url.startsWith('/api/deal-rooms')) return next();

    const parsed = parseRoute(url);
    if (!parsed) {
      sendError(res as any, 404, 'Not found');
      return;
    }

    try {
      const handlers = await getHandlers();

      switch (parsed.route) {
        case 'list-or-create': {
          if (req.method === 'POST') {
            const body = await readBody(req);
            await handlers.create(req, res, body);
          } else if (req.method === 'GET') {
            await handlers.list(req, res);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        case 'get': {
          if (req.method === 'GET') {
            await handlers.get(req, res, parsed.dealRoomId);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        case 'sources': {
          if (req.method === 'POST') {
            // Multipart file upload — run multer first
            const multerInstance = await getMulter();
            await runMulter(multerInstance, req, res);
            await handlers.upload(req, res, parsed.dealRoomId);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        case 'delete-source': {
          if (req.method === 'DELETE') {
            await handlers.deleteSource(req, res, parsed.dealRoomId, parsed.sourceId);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        case 'chat': {
          if (req.method === 'POST') {
            const body = await readBody(req);
            await handlers.chat(req, res, parsed.dealRoomId, body);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        case 'artifacts': {
          if (req.method === 'POST') {
            const body = await readBody(req);
            await handlers.generateArtifact(req, res, parsed.dealRoomId, body);
          } else if (req.method === 'GET') {
            await handlers.listArtifacts(req, res, parsed.dealRoomId);
          } else {
            sendError(res as any, 405, 'Method not allowed');
          }
          break;
        }

        default:
          sendError(res as any, 404, 'Not found');
      }
    } catch (err: any) {
      console.error('[dealRoomsApi] Error:', err);
      sendError(res as any, 500, err.message || 'Internal server error');
    }
  };
}
