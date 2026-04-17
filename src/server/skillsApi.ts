/**
 * Skills API — Vite dev middleware wrapper (Sprint E / E2)
 *
 * Wraps server/routes/skills.js for the Vite dev server.
 * In production, server/index.mjs handles these routes directly.
 * Also kicks off the one-shot seed on first load.
 */

import type { IncomingMessage, ServerResponse } from 'http';

let handleRunSkillFn: any = null;
let handleListSkillsFn: any = null;
let seedStarted = false;

async function getHandlers() {
  if (!handleRunSkillFn) {
    const mod = await import('../../server/routes/skills.js');
    handleRunSkillFn = mod.handleRunSkill;
    handleListSkillsFn = mod.handleListSkills;
  }
  if (!seedStarted) {
    seedStarted = true;
    import('../../server/skills/seed.mjs')
      .then((m: any) => m.seedSkills())
      .catch((err: any) => console.error('[skill-seed] dev seed failed:', err?.message));
  }
  return { handleRunSkillFn, handleListSkillsFn };
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

export function skillsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/skills')) return next();

    try {
      const handlers = await getHandlers();

      if (url === '/api/skills/run' && req.method === 'POST') {
        const body = await readBody(req);
        await handlers.handleRunSkillFn(req, res, body);
        return;
      }

      if (url === '/api/skills' && req.method === 'GET') {
        await handlers.handleListSkillsFn(req, res);
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
