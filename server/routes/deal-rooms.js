/**
 * PlexifySOLO — Deal Room routes
 *
 * POST   /api/deal-rooms               — Create deal room
 * GET    /api/deal-rooms               — List deal rooms
 * GET    /api/deal-rooms/:id           — Get deal room with sources + messages
 * POST   /api/deal-rooms/:id/sources   — Upload + process source document
 * DELETE /api/deal-rooms/:id/sources/:sourceId — Delete source
 * POST   /api/deal-rooms/:id/chat      — RAG-grounded chat
 *
 * Auth: sandboxAuth middleware sets req.tenant before these handlers run.
 */

import Anthropic from '@anthropic-ai/sdk';
// pdf-parse is lazy-imported inside extractText() to avoid its startup bug
// (it tries to load a test PDF at import time which crashes in production)
import mammoth from 'mammoth';
import {
  createDealRoom,
  getDealRooms,
  getDealRoom,
  getDealRoomSources,
  getDealRoomSourceFull,
  getAllSourceChunks,
  createDealRoomSource,
  updateDealRoomSource,
  deleteDealRoomSource,
  getDealRoomMessages,
  createDealRoomMessage,
  uploadFile,
  logUsageEvent,
} from '../lib/supabase.js';
import { chunkText, searchChunks, buildRAGContext } from '../lib/rag.js';

// ---------------------------------------------------------------------------
// Claude client (lazy init — same pattern as claude.js)
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';
let _claude = null;

function getClaude() {
  if (!_claude) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
    _claude = new Anthropic({ apiKey });
  }
  return _claude;
}

// ---------------------------------------------------------------------------
// Deal Room System Prompt
// ---------------------------------------------------------------------------

const DEAL_ROOM_SYSTEM_PROMPT = `You are Plexi, a BD intelligence specialist working inside a Deal Room. You have access to the user's uploaded source documents.

CRITICAL RULES:
- ALWAYS cite your sources using [Source: filename, Chunk N] format when referencing information from documents.
- If you don't have information from the sources to answer a question, say so clearly.
- Be direct and actionable — the user is a senior BD executive preparing to close a deal.
- When summarizing, organize by themes not by document.
- When comparing information across sources, call out agreements and contradictions.
- Keep responses concise. Executives skim.`;

// ---------------------------------------------------------------------------
// Text extraction by file type
// ---------------------------------------------------------------------------

async function extractText(buffer, fileType, fileName) {
  switch (fileType) {
    case 'pdf': {
      // Import the inner lib directly — pdf-parse/index.js has a known bug
      // where it runs test code when !module.parent (true under ESM import).
      // Bypassing index.js and requiring lib/pdf-parse.js directly avoids it.
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const result = await pdfParse(buffer);
      return result.text;
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'txt':
    case 'md':
    case 'csv':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Generate a one-line AI summary of source content.
 */
async function generateSummary(text, fileName) {
  try {
    const truncated = text.substring(0, 3000); // First ~3000 chars for summary
    const response = await getClaude().messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Summarize this document in one sentence (max 15 words). Be specific about the content, not generic.\n\nDocument: ${fileName}\n\n${truncated}`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text?.trim() || 'Document processed successfully';
  } catch (err) {
    console.error('[deal-room] Summary generation failed:', err.message);
    return 'Document processed (summary unavailable)';
  }
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/deal-rooms — Create a new deal room
 */
export async function handleCreateDealRoom(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { name, description, prospect_id } = body || {};
  if (!name?.trim()) return sendError(res, 400, 'Missing "name" field');

  try {
    const room = await createDealRoom(tenant.id, {
      name: name.trim(),
      description: description?.trim(),
      prospect_id,
    });

    logUsageEvent(tenant.id, 'deal_room_created', { deal_room_id: room.id, name }).catch(() => {});

    return sendJSON(res, 201, room);
  } catch (err) {
    console.error('[deal-rooms] Create error:', err);
    return sendError(res, 500, 'Failed to create deal room');
  }
}

/**
 * GET /api/deal-rooms — List all deal rooms for tenant
 */
export async function handleListDealRooms(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const rooms = await getDealRooms(tenant.id);
    return sendJSON(res, 200, { deal_rooms: rooms });
  } catch (err) {
    console.error('[deal-rooms] List error:', err);
    return sendError(res, 500, 'Failed to list deal rooms');
  }
}

/**
 * GET /api/deal-rooms/:id — Get full deal room with sources and messages
 */
export async function handleGetDealRoom(req, res, dealRoomId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const [room, sources, messages] = await Promise.all([
      getDealRoom(tenant.id, dealRoomId),
      getDealRoomSources(tenant.id, dealRoomId),
      getDealRoomMessages(tenant.id, dealRoomId),
    ]);

    return sendJSON(res, 200, { deal_room: room, sources, messages });
  } catch (err) {
    console.error('[deal-rooms] Get error:', err);
    return sendError(res, 500, 'Failed to load deal room');
  }
}

/**
 * POST /api/deal-rooms/:id/sources — Upload and process a source document
 * Expects multipart/form-data with a single file field named "file"
 */
export async function handleUploadSource(req, res, dealRoomId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const file = req.file;
  if (!file) return sendError(res, 400, 'No file uploaded');

  // Validate file type
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const allowedTypes = ['pdf', 'docx', 'txt', 'md', 'csv'];
  if (!ext || !allowedTypes.includes(ext)) {
    return sendError(res, 400, `Unsupported file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`);
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return sendError(res, 400, 'File too large. Maximum 10MB.');
  }

  const storagePath = `${tenant.id}/${dealRoomId}/${Date.now()}-${file.originalname}`;

  try {
    // Verify deal room exists and belongs to tenant
    await getDealRoom(tenant.id, dealRoomId);

    // 1. Create DB record (pending)
    const source = await createDealRoomSource(tenant.id, dealRoomId, {
      file_name: file.originalname,
      file_type: ext,
      file_size: file.size,
      storage_path: storagePath,
      processing_status: 'pending',
    });

    // 2. Upload to Supabase Storage
    await uploadFile(storagePath, file.buffer, file.mimetype);

    // 3. Update status to processing
    await updateDealRoomSource(source.id, { processing_status: 'processing' });

    // 4. Extract text
    const contentText = await extractText(file.buffer, ext, file.originalname);

    // 5. Chunk text
    const chunks = chunkText(contentText, source.id, file.originalname);

    // 6. Generate summary
    const summary = await generateSummary(contentText, file.originalname);

    // 7. Update to ready
    const updated = await updateDealRoomSource(source.id, {
      processing_status: 'ready',
      content_text: contentText,
      content_chunks: chunks,
      chunk_count: chunks.length,
      summary,
    });

    logUsageEvent(tenant.id, 'deal_room_source_uploaded', {
      deal_room_id: dealRoomId,
      source_id: source.id,
      file_name: file.originalname,
      file_type: ext,
      chunk_count: chunks.length,
    }).catch(() => {});

    console.log(`[deal-room] Processed ${file.originalname}: ${chunks.length} chunks, status=ready`);

    return sendJSON(res, 201, updated);
  } catch (err) {
    console.error('[deal-rooms] Upload error:', err);

    // Try to mark as error in DB
    try {
      const existingSource = await getDealRoomSourceFull(tenant.id, null).catch(() => null);
      // We don't have the source ID reliably here if creation failed,
      // so just log the error
    } catch {}

    return sendError(res, 500, `Failed to process ${file.originalname}: ${err.message}`);
  }
}

/**
 * DELETE /api/deal-rooms/:id/sources/:sourceId — Delete source
 */
export async function handleDeleteSource(req, res, dealRoomId, sourceId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    await deleteDealRoomSource(tenant.id, sourceId);

    logUsageEvent(tenant.id, 'deal_room_source_deleted', {
      deal_room_id: dealRoomId,
      source_id: sourceId,
    }).catch(() => {});

    return sendJSON(res, 200, { deleted: true });
  } catch (err) {
    console.error('[deal-rooms] Delete source error:', err);
    return sendError(res, 500, 'Failed to delete source');
  }
}

/**
 * POST /api/deal-rooms/:id/chat — RAG-grounded chat
 */
export async function handleDealRoomChat(req, res, dealRoomId, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { message } = body || {};
  if (!message?.trim()) return sendError(res, 400, 'Missing "message" field');

  try {
    // 1. Load all ready source chunks for this deal room
    const sources = await getAllSourceChunks(tenant.id, dealRoomId);

    // 2. Search for relevant chunks
    const rankedChunks = searchChunks(message, sources, 6);

    // 3. Build context
    const ragContext = buildRAGContext(rankedChunks);

    // 4. Load recent chat history (last 10 messages for context)
    const recentMessages = await getDealRoomMessages(tenant.id, dealRoomId, { limit: 10 });
    const history = recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 5. Build messages for Claude
    const claudeMessages = [
      ...history,
      {
        role: 'user',
        content: `${ragContext}\n\n---\n\nUser question: ${message}`,
      },
    ];

    // 6. Call Claude
    const response = await getClaude().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: DEAL_ROOM_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const reply = textBlocks.map((b) => b.text).join('\n');

    // 7. Parse citations from response
    const citations = parseCitations(reply, sources);

    // 8. Persist both messages
    await createDealRoomMessage(tenant.id, dealRoomId, {
      role: 'user',
      content: message,
    });

    await createDealRoomMessage(tenant.id, dealRoomId, {
      role: 'assistant',
      content: reply,
      citations,
    });

    logUsageEvent(tenant.id, 'deal_room_chat', {
      deal_room_id: dealRoomId,
      chunks_retrieved: rankedChunks.length,
      sources_count: sources.length,
    }).catch(() => {});

    return sendJSON(res, 200, {
      reply,
      citations,
      chunks_used: rankedChunks.length,
      usage: response.usage,
    });
  } catch (err) {
    console.error('[deal-rooms] Chat error:', err);
    return sendError(res, 500, 'Failed to process message');
  }
}

// ---------------------------------------------------------------------------
// Citation parser
// ---------------------------------------------------------------------------

/**
 * Extract [Source: filename, Chunk N] references from Claude's response.
 */
function parseCitations(text, sources) {
  const citations = [];
  const regex = /\[Source:\s*([^,\]]+),\s*Chunk\s*(\d+)\]/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fileName = match[1].trim();
    const chunkIndex = parseInt(match[2], 10);

    // Find matching source
    const source = sources.find(
      (s) => s.file_name.toLowerCase() === fileName.toLowerCase()
    );

    if (source) {
      const chunk = source.content_chunks?.[chunkIndex];
      citations.push({
        source_id: source.id,
        source_name: source.file_name,
        chunk_index: chunkIndex,
        text: chunk?.text?.substring(0, 200) || '',
      });
    }
  }

  return citations;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: message }));
}
