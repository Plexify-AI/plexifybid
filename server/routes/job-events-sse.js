/**
 * Jobs SSE stream (Sprint E / E4)
 *
 * GET /api/jobs/events            — tenant-scoped multiplex of all job events
 * GET /api/jobs/:id/events        — single job's lifecycle events
 *
 * Auth: sandboxAuth sets req.tenant. We subscribe per tenant_id.
 * Heartbeat every 30s prevents idle disconnects.
 */

import { jobEvents } from '../events/jobEvents.mjs';

export async function handleMultiplexStream(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`: connected at ${new Date().toISOString()}\n\n`);

  const send = (event) => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      console.error('[sse] write failed:', err.message);
    }
  };

  const unsubscribe = jobEvents.subscribe(tenant.id, send);

  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {}
  }, 30_000);

  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
    try { res.end(); } catch {}
  };
  req.on('close', close);
  req.on('error', close);
}

export async function handleSingleJobStream(req, res, jobId) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const filter = (event) => {
    const id = event?.job?.id || event?.job_id;
    if (id && id !== jobId) return;
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {}
  };

  const unsubscribe = jobEvents.subscribe(tenant.id, filter);
  const heartbeat = setInterval(() => { try { res.write(`: hb\n\n`); } catch {} }, 30_000);
  const close = () => { clearInterval(heartbeat); unsubscribe(); try { res.end(); } catch {} };
  req.on('close', close);
  req.on('error', close);
}
