/**
 * PlexifySOLO — Deal Room routes
 *
 * POST   /api/deal-rooms               — Create deal room
 * GET    /api/deal-rooms               — List deal rooms
 * GET    /api/deal-rooms/:id           — Get deal room with sources + messages
 * POST   /api/deal-rooms/:id/sources   — Upload + process source document
 * DELETE /api/deal-rooms/:id/sources/:sourceId — Delete source
 * POST   /api/deal-rooms/:id/chat      — RAG-grounded chat
 * POST   /api/deal-rooms/:id/artifacts — Generate structured artifact
 * GET    /api/deal-rooms/:id/artifacts — List artifacts
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
  createDealRoomArtifact,
  updateDealRoomArtifact,
  getDealRoomArtifacts,
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
// Artifact Generation Prompts
// ---------------------------------------------------------------------------

const ARTIFACT_PROMPTS = {
  deal_summary: {
    title: 'Deal Summary',
    instruction: `Analyze the source documents and produce a comprehensive deal summary as JSON.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "title": "string — descriptive title for this deal summary",
  "executive_summary": ["string — 3-5 key bullet points"],
  "key_metrics": [{"label": "string", "value": "string"}],
  "key_players": [{"name": "string", "role": "string", "organization": "string or omit"}],
  "timeline": ["string — key dates or milestones"],
  "risks": [{"description": "string", "severity": "high|medium|low", "mitigation": "string or omit"}],
  "next_steps": ["string — recommended actions"]
}

Be specific with real data from the sources. If info is unavailable, use fewer items rather than generic filler.`,
  },
  competitive_analysis: {
    title: 'Competitive Analysis',
    instruction: `Analyze the source documents and produce a competitive analysis as JSON.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "title": "string — descriptive title for this analysis",
  "competitors": [
    {
      "name": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "differentiator": "string — what makes them unique",
      "threat_level": "high|medium|low"
    }
  ],
  "market_position": "string — summary of market positioning and dynamics",
  "strategy_recommendations": ["string — actionable recommendations"]
}

If specific competitors aren't named in the sources, analyze the competitive landscape based on available information (market segments, service offerings, positioning). Be specific with real data.`,
  },
  meeting_prep: {
    title: 'Meeting Prep Brief',
    instruction: `Analyze the source documents and produce a meeting preparation brief as JSON.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "title": "string — descriptive title for this brief",
  "meeting_context": "string — 2-3 sentence overview of the meeting context",
  "agenda": [{"topic": "string", "duration_minutes": number, "owner": "string or omit"}],
  "talking_points": ["string — key points to raise"],
  "objection_handlers": [{"objection": "string — likely pushback", "response": "string — recommended response"}],
  "key_questions": ["string — questions to ask"],
  "background_context": "string — relevant background the attendee should know"
}

Focus on actionable preparation. Anticipate likely objections based on the deal context. Be specific with real data from the sources.`,
  },
};

// ---------------------------------------------------------------------------
// Artifact Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/deal-rooms/:id/artifacts — Generate a structured artifact
 */
export async function handleGenerateArtifact(req, res, dealRoomId, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { artifact_type } = body || {};
  const prompt = ARTIFACT_PROMPTS[artifact_type];
  if (!prompt) {
    return sendError(res, 400, `Invalid artifact_type. Must be one of: ${Object.keys(ARTIFACT_PROMPTS).join(', ')}`);
  }

  try {
    // 1. Verify deal room exists
    await getDealRoom(tenant.id, dealRoomId);

    // 2. Load all source chunks
    const sources = await getAllSourceChunks(tenant.id, dealRoomId);
    if (sources.length === 0) {
      return sendError(res, 400, 'No sources uploaded. Upload documents before generating artifacts.');
    }

    // 3. Build full RAG context (use broad mode — include all chunks)
    const allChunks = [];
    for (const source of sources) {
      if (!source.content_chunks || source.content_chunks.length === 0) continue;
      for (const chunk of source.content_chunks) {
        allChunks.push({ chunk, score: 1.0 });
      }
    }
    const ragContext = buildRAGContext(allChunks.slice(0, 20)); // Cap at 20 chunks

    // 4. Create DB record (status=generating)
    const sourcesUsed = sources.map((s) => ({ id: s.id, file_name: s.file_name }));
    const artifact = await createDealRoomArtifact(tenant.id, dealRoomId, {
      artifact_type,
      title: prompt.title,
      status: 'generating',
      sources_used: sourcesUsed,
    });

    // 5. Call Claude for structured generation
    const response = await getClaude().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are Plexi, a BD intelligence specialist. Generate structured deal intelligence from uploaded source documents. Your output must be ONLY valid JSON — no markdown, no explanation, no code fences. Just the JSON object.`,
      messages: [
        {
          role: 'user',
          content: `${ragContext}\n\n---\n\n${prompt.instruction}`,
        },
      ],
    });

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const rawText = textBlocks.map((b) => b.text).join('\n').trim();

    // 6. Parse JSON from response (strip markdown fences if Claude adds them)
    let parsed;
    try {
      const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[deal-rooms] Artifact JSON parse failed:', parseErr.message);
      console.error('[deal-rooms] Raw response:', rawText.substring(0, 500));

      await updateDealRoomArtifact(artifact.id, {
        status: 'error',
        error_message: 'Failed to parse structured output from Claude',
      });

      return sendError(res, 500, 'Failed to generate artifact — Claude returned invalid JSON');
    }

    // 7. Build full envelope
    const envelope = {
      artifact_type,
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      deal_room_id: dealRoomId,
      sources_used: sourcesUsed,
      output: parsed,
    };

    // 8. Update DB record
    const updated = await updateDealRoomArtifact(artifact.id, {
      status: 'ready',
      title: parsed.title || prompt.title,
      content: envelope,
    });

    logUsageEvent(tenant.id, 'deal_room_artifact_generated', {
      deal_room_id: dealRoomId,
      artifact_id: artifact.id,
      artifact_type,
      sources_count: sources.length,
    }).catch(() => {});

    console.log(`[deal-room] Generated artifact: ${artifact_type} (${artifact.id})`);

    return sendJSON(res, 201, updated);
  } catch (err) {
    console.error('[deal-rooms] Artifact generation error:', err);
    return sendError(res, 500, `Failed to generate ${prompt.title}: ${err.message}`);
  }
}

/**
 * GET /api/deal-rooms/:id/artifacts — List all artifacts for a deal room
 */
export async function handleListArtifacts(req, res, dealRoomId) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const artifacts = await getDealRoomArtifacts(tenant.id, dealRoomId);
    return sendJSON(res, 200, { artifacts });
  } catch (err) {
    console.error('[deal-rooms] List artifacts error:', err);
    return sendError(res, 500, 'Failed to list artifacts');
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
