/**
 * PlexifySOLO — Claude Managed Agents runtime (Sprint E / E4)
 *
 * Shape of the API (derived from Anthropic beta docs 2026-04-01):
 *
 *   Agents        POST/GET /v1/agents            versioned; fields: name, model,
 *                                                system, tools, mcp_servers, skills
 *   Environments  POST/GET /v1/environments      sandboxed cloud container
 *   Sessions      POST /v1/sessions              ref an agent + env, optional vaults
 *                 POST /v1/sessions/:id/events   send user.* events
 *                 GET  /v1/sessions/:id/stream   SSE of agent.*, span.*, session.*
 *                 GET  /v1/sessions/:id          retrieve status
 *                 POST /v1/sessions/:id/archive  archive
 *
 * CRITICAL STREAM ORDERING:
 *   Docs say "Only events emitted after the stream is opened are delivered,
 *   so open the stream before sending events to avoid a race condition."
 *   runManagedAgent() below opens stream first, then sends input.
 *
 * Vendor-lock hedge — every HTTP call to Anthropic's Managed Agents endpoints
 * flows through this one file. Swap the transport here and the rest of the
 * Sprint E stack (workers, jobs, SSE proxy) keeps working.
 */

const BASE = 'https://api.anthropic.com';
const BETA_HEADER = 'managed-agents-2026-04-01';
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 min — workers can run long

function apiKey() {
  // Match LLM Gateway's fallback pattern — Vite sometimes populates only the
  // VITE_-prefixed variant. Trim trailing CR from Windows .env line endings.
  const raw = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '';
  const k = raw.replace(/[\r\n]+$/, '').trim();
  if (!k) throw new Error('ANTHROPIC_API_KEY not set');
  return k;
}

function headers(extra = {}) {
  return {
    'x-api-key': apiKey(),
    'anthropic-version': '2023-06-01',
    'anthropic-beta': BETA_HEADER,
    'content-type': 'application/json',
    ...extra,
  };
}

async function request(method, path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    const msg = json?.error?.message || text || resp.statusText;
    const err = new Error(`[managed_agents] ${method} ${path} -> ${resp.status} ${msg}`);
    err.status = resp.status;
    err.body = json;
    throw err;
  }
  return json;
}

// ---------------------------------------------------------------------------
// Environments — Plexify uses a single shared environment across all workers.
// Hydrated lazily on first call.
// ---------------------------------------------------------------------------

const DEFAULT_ENV_NAME = 'plexify-workers';
let _envIdCache = null;

export async function ensureEnvironment({ name = DEFAULT_ENV_NAME } = {}) {
  if (_envIdCache) return _envIdCache;

  // Look for existing by name
  const list = await request('GET', '/v1/environments');
  for (const e of list?.data || []) {
    if (e?.name === name && e?.state !== 'archived') {
      _envIdCache = e.id;
      return e.id;
    }
  }

  // Create new — cloud config, unrestricted networking, no extra packages.
  // Sprint F can add MCP-specific packages or lock down networking.
  const created = await request('POST', '/v1/environments', {
    name,
    description: 'Shared sandbox for PlexifySOLO workers (Pipeline Analyst, Research Scanner, War Room Prep).',
  });
  _envIdCache = created.id;
  return created.id;
}

// ---------------------------------------------------------------------------
// Agents — create or update by name. Returns { agentId, version }.
// The caller supplies the full spec; we diff naively by looking at name and
// letting the API do the rest. If a versioned update is needed, we POST to
// /v1/agents/:id with { version: currentVersion, ...fields } and Anthropic
// bumps version on change.
// ---------------------------------------------------------------------------

export async function upsertAgent({ name, model, system, tools, mcp_servers, skills, description }) {
  if (!name) throw new Error('upsertAgent: name required');
  if (!model) throw new Error('upsertAgent: model required');

  // Search existing agents by name.
  const list = await request('GET', '/v1/agents');
  const existing = (list?.data || []).find((a) => a?.name === name && !a?.archived_at);

  const body = { name, model };
  if (system !== undefined) body.system = system;
  if (tools !== undefined) body.tools = tools;
  if (mcp_servers !== undefined) body.mcp_servers = mcp_servers;
  if (skills !== undefined) body.skills = skills;
  if (description !== undefined) body.description = description;

  if (!existing) {
    const created = await request('POST', '/v1/agents', body);
    return { agentId: created.id, version: created.version };
  }

  // Update — include current version so Anthropic can do the immutable bump.
  const updated = await request('POST', `/v1/agents/${existing.id}`, {
    version: existing.version,
    ...body,
  });
  return { agentId: updated.id, version: updated.version };
}

export async function archiveAgent(agentId) {
  try {
    await request('POST', `/v1/agents/${agentId}/archive`);
  } catch (err) {
    console.error('[managed_agents] archiveAgent failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession({ agentId, environmentId, vaultIds, pinVersion }) {
  if (!agentId) throw new Error('createSession: agentId required');
  if (!environmentId) throw new Error('createSession: environmentId required');

  const agent = pinVersion
    ? { type: 'agent', id: agentId, version: pinVersion }
    : agentId;

  const body = { agent, environment_id: environmentId };
  if (Array.isArray(vaultIds) && vaultIds.length) body.vault_ids = vaultIds;

  const session = await request('POST', '/v1/sessions', body);
  return session; // { id, status, environment_id, agent: {...}, ... }
}

export async function retrieveSession(sessionId) {
  return request('GET', `/v1/sessions/${sessionId}`);
}

export async function archiveSession(sessionId) {
  try {
    await request('POST', `/v1/sessions/${sessionId}/archive`);
  } catch (err) {
    console.error('[managed_agents] archiveSession failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Events — send user.message / user.interrupt etc.
// ---------------------------------------------------------------------------

export async function sendUserMessage(sessionId, text) {
  if (!sessionId) throw new Error('sendUserMessage: sessionId required');
  if (!text || typeof text !== 'string') throw new Error('sendUserMessage: text required');
  return request('POST', `/v1/sessions/${sessionId}/events`, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text }],
      },
    ],
  });
}

export async function interruptSession(sessionId) {
  return request('POST', `/v1/sessions/${sessionId}/events`, {
    events: [{ type: 'user.interrupt' }],
  });
}

// ---------------------------------------------------------------------------
// Event stream — native SSE parser over /v1/sessions/:id/stream?beta=true
// Caller supplies event handlers. Returns a controller with .close() and a
// .done promise that resolves on session.status_idle / session.status_terminated.
// ---------------------------------------------------------------------------

export async function streamEvents(sessionId, handlers = {}, options = {}) {
  if (!sessionId) throw new Error('streamEvents: sessionId required');

  const {
    onEvent,           // (event) => void  — raw handler for every event
    onAgentMessage,    // (event) => void  — filtered agent.message
    onToolUse,         // (event) => void  — filtered agent.tool_use + agent.mcp_tool_use
    onStatus,          // (event) => void  — filtered session.status_*
    onError,           // (err) => void
  } = handlers;

  const controller = new AbortController();
  const { signal } = controller;

  const resp = await fetch(`${BASE}/v1/sessions/${sessionId}/stream?beta=true`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': BETA_HEADER,
      'accept': 'text/event-stream',
    },
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`[managed_agents] stream open failed ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }

  let resolveDone, rejectDone;
  const done = new Promise((r, j) => { resolveDone = r; rejectDone = j; });

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    controller.abort();
    const err = new Error(`[managed_agents] stream timed out after ${timeoutMs}ms`);
    if (onError) onError(err);
    rejectDone(err);
  }, timeoutMs);

  (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of resp.body) {
        buffer += decoder.decode(chunk, { stream: true });

        // SSE frames separated by blank line. Parse each.
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const evt = parseSseFrame(frame);
          if (!evt) continue;

          if (onEvent) onEvent(evt);
          const t = evt.type || '';
          if (t === 'agent.message' && onAgentMessage) onAgentMessage(evt);
          else if ((t === 'agent.tool_use' || t === 'agent.mcp_tool_use') && onToolUse) onToolUse(evt);
          else if (t.startsWith('session.status_') && onStatus) onStatus(evt);

          // Terminal conditions — resolve done and stop reading.
          if (t === 'session.status_idle' || t === 'session.status_terminated') {
            clearTimeout(timer);
            controller.abort();
            resolveDone(evt);
            return;
          }
        }
      }
      clearTimeout(timer);
      resolveDone(null); // stream ended without explicit status
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') return; // we aborted intentionally
      if (onError) onError(err);
      rejectDone(err);
    }
  })();

  return {
    close: () => { clearTimeout(timer); controller.abort(); },
    done,
  };
}

function parseSseFrame(frame) {
  // Frames look like:
  //   event: agent.message
  //   data: {"type": "agent.message", "content": [...]}
  // The `data:` line is the canonical payload; we also accept bare `data: {...}`
  // without a preceding event: line.
  const lines = frame.split('\n');
  let data = null;
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') return { type: '_done' };
      try { data = JSON.parse(raw); } catch {}
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// runManagedAgent — high-level entry: open stream, send input, collect messages.
// Returns a structured result the caller can persist.
// ---------------------------------------------------------------------------

export async function runManagedAgent({
  agentId,
  environmentId,
  input,
  vaultIds,
  timeoutMs,
  onProgress,
}) {
  const session = await createSession({ agentId, environmentId, vaultIds });

  // Open stream BEFORE sending input to avoid event race.
  const agentMessages = [];
  const toolUses = [];
  let terminalStatus = null;
  let streamError = null;

  const stream = await streamEvents(
    session.id,
    {
      onAgentMessage: (e) => {
        agentMessages.push(e);
        if (onProgress) onProgress({ kind: 'message', event: e });
      },
      onToolUse: (e) => {
        toolUses.push(e);
        if (onProgress) onProgress({ kind: 'tool_use', event: e });
      },
      onStatus: (e) => {
        terminalStatus = e.type;
        if (onProgress) onProgress({ kind: 'status', event: e });
      },
      onError: (err) => { streamError = err; },
    },
    { timeoutMs }
  );

  await sendUserMessage(session.id, input);

  try {
    await stream.done;
  } catch (err) {
    streamError = streamError || err;
  }

  // Pull final session for usage stats + final status
  let final;
  try {
    final = await retrieveSession(session.id);
  } catch (err) {
    final = null;
  }

  return {
    sessionId: session.id,
    agentMessages,
    toolUses,
    terminalStatus,
    status: final?.status || null,
    usage: final?.usage || null,
    streamError: streamError ? streamError.message : null,
  };
}

// ---------------------------------------------------------------------------
// wakeAndResume — used by the reconciler when a running job's process died.
// Opens a fresh stream to an existing session; does NOT re-send input.
// ---------------------------------------------------------------------------

export async function wakeAndResume(sessionId, handlers = {}, options = {}) {
  const final = await retrieveSession(sessionId);
  if (!final) throw new Error(`wakeAndResume: session ${sessionId} not found`);

  if (final.status === 'idle' || final.status === 'terminated') {
    // Nothing to resume — session already at terminal state.
    return { sessionId, status: final.status, resumed: false, session: final };
  }

  const stream = await streamEvents(sessionId, handlers, options);
  return { sessionId, status: final.status, resumed: true, stream };
}

// ---------------------------------------------------------------------------
// Reset — tests need a way to clear the env cache.
// ---------------------------------------------------------------------------

export function __resetCachesForTests() {
  _envIdCache = null;
}
