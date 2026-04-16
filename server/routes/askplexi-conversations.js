/**
 * PlexifySOLO — AskPlexi Conversation Library API (Sprint B / B3)
 *
 * Library-only routes on top of the existing public.conversations table.
 * The actual write path (create/update with new messages) lives in
 * server/routes/ask-plexi.js — these endpoints only read, patch metadata,
 * and soft-delete.
 *
 *   GET    /api/askplexi/conversations         — list (pinned-first, newest-first)
 *   GET    /api/askplexi/conversations/:id     — full load incl. ui_messages
 *   PUT    /api/askplexi/conversations/:id     — patch { title?, pinned?, is_archived? }
 *   DELETE /api/askplexi/conversations/:id     — soft-delete (is_archived=true)
 *
 * Phase 1: user_id = tenant.id.
 */

import {
  listConversations,
  getConversation,
  patchConversationMeta,
  archiveConversation,
  deriveConversationTitle,
} from '../lib/supabase.js';

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(payload));
}

function requireTenant(req, res) {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    jsonResponse(res, 401, { error: 'Not authenticated' });
    return null;
  }
  return tenantId;
}

/**
 * GET /api/askplexi/conversations
 * Query params: ?limit=30 ?cursor=<ISO timestamp>
 */
export async function handleList(req, res) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const limit = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor');

  try {
    const conversations = await listConversations(tenantId, userId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor || undefined,
    });
    return jsonResponse(res, 200, { conversations });
  } catch (err) {
    console.error('[askplexi-conversations] list error:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to load conversations' });
  }
}

/**
 * GET /api/askplexi/conversations/:id
 * Returns the full row for reload into the chat view.
 */
export async function handleGet(req, res, id) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  if (!id) return jsonResponse(res, 400, { error: 'Missing conversation id' });

  try {
    const row = await getConversation(tenantId, userId, id);
    if (!row) return jsonResponse(res, 404, { error: 'Conversation not found' });

    // Fallback title for rows that predate B3 (no title column value).
    const title = row.title || deriveConversationTitle(row.messages) || 'Untitled conversation';

    return jsonResponse(res, 200, {
      conversation: {
        id: row.id,
        title,
        pinned: !!row.pinned,
        is_archived: !!row.is_archived,
        messages: Array.isArray(row.messages) ? row.messages : [],
        ui_messages: Array.isArray(row.ui_messages) ? row.ui_messages : [],
        context: row.context || {},
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[askplexi-conversations] get error:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to load conversation' });
  }
}

/**
 * PUT /api/askplexi/conversations/:id
 * Body: { title?: string, pinned?: boolean, is_archived?: boolean }
 */
export async function handlePatch(req, res, id, body) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  if (!id) return jsonResponse(res, 400, { error: 'Missing conversation id' });
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(res, 400, { error: 'Request body must be a JSON object' });
  }

  const allowed = ['title', 'pinned', 'is_archived'];
  const patch = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return jsonResponse(res, 400, { error: `Patch must include at least one of: ${allowed.join(', ')}` });
  }

  try {
    const updated = await patchConversationMeta(tenantId, userId, id, patch);
    return jsonResponse(res, 200, {
      conversation: {
        id: updated.id,
        title: updated.title,
        pinned: !!updated.pinned,
        is_archived: !!updated.is_archived,
        updated_at: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('[askplexi-conversations] patch error:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to update conversation' });
  }
}

/**
 * DELETE /api/askplexi/conversations/:id — soft delete.
 */
export async function handleDelete(req, res, id) {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const userId = tenantId;

  if (!id) return jsonResponse(res, 400, { error: 'Missing conversation id' });

  try {
    await archiveConversation(tenantId, userId, id);
    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('[askplexi-conversations] delete error:', err.message);
    return jsonResponse(res, 500, { error: 'Failed to archive conversation' });
  }
}
