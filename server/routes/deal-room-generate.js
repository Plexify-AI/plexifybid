/**
 * PlexifySOLO — Deal Room Skill-Based Generation
 *
 * POST /api/deal-rooms/:id/generate — Generate an artifact via a registered skill
 *
 * This is the canonical generation endpoint. It loads skills from the
 * deal_room_skills table (tenant-specific first, then global fallback),
 * injects Voice DNA, builds RAG context from uploaded sources, calls
 * Claude via the LLM Gateway, and persists the result to deal_room_artifacts.
 *
 * The older /api/deal-rooms/:id/artifacts endpoint (hardcoded ARTIFACT_PROMPTS)
 * remains for backward compatibility.
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { markPowerflowStage } from './powerflow.js';
import { injectVoicePrompt } from '../lib/voice-dna/inject-voice-prompt.js';
import {
  getSupabase,
  getDealRoom,
  getAllSourceChunks,
  createDealRoomArtifact,
  updateDealRoomArtifact,
  logUsageEvent,
  getTenantTabConfig,
} from '../lib/supabase.js';
import { buildRAGContext } from '../lib/rag.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Defensive JSON extraction — strips markdown fences, trims whitespace,
 * finds the first { and last } to extract the JSON object.
 * Returns parsed object or null on failure.
 */
function extractJSONSafe(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  text = text.trim();

  // Find the first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Simple keyword relevance scoring for chunk selection.
 * Counts how many domain keywords from the skill appear in the chunk text.
 */
function scoreChunkRelevance(chunkText, keywords) {
  if (!keywords || keywords.length === 0) return 1;
  const lower = chunkText.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) score++;
  }
  return score;
}

/**
 * Extract domain keywords from a skill's system prompt for chunk ranking.
 * Pulls words from the DOMAIN CONTEXT section if present.
 */
function extractDomainKeywords(systemPrompt) {
  const match = systemPrompt.match(/DOMAIN CONTEXT:([^]*?)(?:\n\n|\nCITATION)/);
  if (!match) return [];

  const contextBlock = match[1];
  // Extract meaningful nouns/terms (3+ chars, not common words)
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'you', 'your', 'that', 'this', 'with',
    'from', 'which', 'work', 'based', 'what', 'may', 'not', 'have',
    'been', 'will', 'can', 'has', 'its', 'their', 'they', 'than',
    'other', 'into', 'more', 'also', 'each', 'such', 'how', 'about',
  ]);

  const words = contextBlock
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toLowerCase());

  // Dedupe and take top 20
  return [...new Set(words)].slice(0, 20);
}

const MAX_CHUNKS = 20;
const TRUNCATION_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Skill Loader
// ---------------------------------------------------------------------------

/**
 * Load a skill by key — tenant-specific first, then global fallback.
 */
async function loadSkill(tenantId, skillKey) {
  const sb = getSupabase();

  // Try tenant-specific first
  const { data: tenantSkill } = await sb
    .from('deal_room_skills')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('skill_key', skillKey)
    .eq('is_active', true)
    .single();

  if (tenantSkill) return tenantSkill;

  // Fall back to global (tenant_id IS NULL)
  const { data: globalSkill } = await sb
    .from('deal_room_skills')
    .select('*')
    .is('tenant_id', null)
    .eq('skill_key', skillKey)
    .eq('is_active', true)
    .single();

  return globalSkill || null;
}

// ---------------------------------------------------------------------------
// POST /api/deal-rooms/:id/generate
// ---------------------------------------------------------------------------

export async function handleSkillGenerate(req, res, dealRoomId, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { skillKey, sourceChunkIds } = body || {};
  if (!skillKey) {
    return sendError(res, 400, 'Missing required field: skillKey');
  }

  const startTime = Date.now();

  try {
    // 1. Verify deal room exists
    const dealRoom = await getDealRoom(tenant.id, dealRoomId);
    if (!dealRoom) return sendError(res, 404, 'Deal room not found');

    // 2. Load skill from registry
    const skill = await loadSkill(tenant.id, skillKey);
    if (!skill) {
      return sendError(res, 400, `No active skill found for key: ${skillKey}`);
    }

    // 3. Load source chunks with selection strategy
    const sources = await getAllSourceChunks(tenant.id, dealRoomId);
    if (sources.length === 0) {
      return sendError(res, 400, 'No sources uploaded. Upload documents before generating.');
    }

    // Flatten all chunks
    let allChunks = [];
    for (const source of sources) {
      if (!source.content_chunks || source.content_chunks.length === 0) continue;
      for (const chunk of source.content_chunks) {
        allChunks.push({
          chunk: {
            ...chunk,
            source_name: chunk.source_name || source.file_name,
          },
          sourceId: source.id,
          score: 1.0,
        });
      }
    }

    // Filter to specific chunk IDs if provided
    if (sourceChunkIds && sourceChunkIds.length > 0) {
      allChunks = allChunks.filter(c =>
        sourceChunkIds.includes(`${c.sourceId}:${c.chunk.index}`)
      );
    }

    // Chunk selection: if over threshold, rank by keyword relevance
    let truncated = false;
    const totalChunkCount = allChunks.length;

    if (allChunks.length > TRUNCATION_THRESHOLD) {
      truncated = true;
      const keywords = extractDomainKeywords(skill.system_prompt);

      // Score each chunk
      for (const item of allChunks) {
        item.score = scoreChunkRelevance(item.chunk.text || '', keywords);
      }

      // Sort by score descending, take top MAX_CHUNKS
      allChunks.sort((a, b) => b.score - a.score);
      allChunks = allChunks.slice(0, MAX_CHUNKS);

      console.warn(
        `[deal-room-generate] Chunk truncation: ${totalChunkCount} chunks → ${MAX_CHUNKS} ` +
        `for skill="${skillKey}" deal_room="${dealRoomId}"`
      );
    } else if (allChunks.length > MAX_CHUNKS) {
      truncated = true;
      allChunks = allChunks.slice(0, MAX_CHUNKS);
      console.warn(
        `[deal-room-generate] Chunk cap: ${totalChunkCount} chunks → ${MAX_CHUNKS} ` +
        `for skill="${skillKey}" deal_room="${dealRoomId}"`
      );
    }

    // Build RAG context string
    const ragContext = buildRAGContext(allChunks);

    // 4. Inject Voice DNA
    let systemPrompt = skill.system_prompt;
    try {
      const voiceBlock = await injectVoicePrompt(tenant.id, 'general');
      if (voiceBlock) {
        systemPrompt = systemPrompt.replace('{voice_dna_block}', voiceBlock);
      } else {
        systemPrompt = systemPrompt.replace('{voice_dna_block}', '');
      }
    } catch (voiceErr) {
      console.error('[deal-room-generate] Voice DNA injection failed:', voiceErr.message);
      systemPrompt = systemPrompt.replace('{voice_dna_block}', '');
    }

    // 5. Create DB record (status=generating)
    const sourcesUsed = sources.map(s => ({ id: s.id, file_name: s.file_name }));
    const artifact = await createDealRoomArtifact(tenant.id, dealRoomId, {
      artifact_type: skillKey,
      title: skill.skill_name,
      status: 'generating',
      sources_used: sourcesUsed, // deprecated — kept for backward compat
      user_id: tenant.id, // tenant as user for sandbox auth
      skill_version: `${skill.skill_key}:${skill.id}`,
    });

    // 6. Call LLM Gateway
    const result = await sendPrompt({
      taskType: TASK_TYPES.DEAL_ROOM_ARTIFACT,
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate ${skill.skill_name} from the following sources:\n\n${ragContext}`,
        },
      ],
      maxTokens: 4096,
      temperature: 0.3,
      tenantId: tenant.id,
    });

    const rawText = (result.content || '').trim();
    const usage = result.usage || {};

    // 7. Defensive JSON parsing
    const parsed = extractJSONSafe(rawText);

    if (!parsed) {
      // Parse failed — save raw response for debugging, mark as failed
      const truncatedRaw = rawText.length > 2000 ? rawText.slice(0, 2000) + '...[truncated]' : rawText;

      console.error(
        `[deal-room-generate] JSON parse failed for skill="${skillKey}" artifact="${artifact.id}". ` +
        `Raw response (first 500 chars): ${rawText.slice(0, 500)}`
      );

      await updateDealRoomArtifact(artifact.id, {
        status: 'failed',
        error_message: `Failed to parse structured JSON from Claude. Raw response: ${truncatedRaw}`,
        model_used: result.model || null,
        token_count_in: usage.inputTokens || 0,
        token_count_out: usage.outputTokens || 0,
      });

      return sendError(res, 422, 'Claude returned content that could not be parsed as JSON. The artifact has been saved with status "failed" for debugging.');
    }

    // 8. Build provenance
    const provenance = {
      chunks_used: allChunks.length,
      chunks_total: totalChunkCount,
      truncated,
      sources: sourcesUsed.map(s => ({ source_file_id: s.id, file_name: s.file_name })),
      generated_at: new Date().toISOString(),
    };

    // 9. Build full envelope
    const envelope = {
      artifact_type: skillKey,
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      deal_room_id: dealRoomId,
      sources_used: sourcesUsed,
      output: parsed,
    };

    // 10. Update DB record with result
    const updated = await updateDealRoomArtifact(artifact.id, {
      status: 'ready',
      title: parsed.title || skill.skill_name,
      content: envelope,
      provenance_json: provenance,
      model_used: result.model || null,
      token_count_in: usage.inputTokens || 0,
      token_count_out: usage.outputTokens || 0,
    });

    // 11. Log usage event (FR-016)
    const durationMs = Date.now() - startTime;
    logUsageEvent(tenant.id, 'deal_room_skill_generated', {
      deal_room_id: dealRoomId,
      artifact_id: artifact.id,
      artifact_type: skillKey,
      skill_id: skill.id,
      model: result.model || null,
      token_count_in: usage.inputTokens || 0,
      token_count_out: usage.outputTokens || 0,
      duration_ms: durationMs,
      version: updated.version || 1,
      chunks_used: allChunks.length,
      chunks_total: totalChunkCount,
      truncated,
    }).catch(() => {});

    console.log(
      `[deal-room-generate] Generated ${skillKey} (${artifact.id}) ` +
      `in ${durationMs}ms, ${allChunks.length}/${totalChunkCount} chunks`
    );

    // 12. Powerflow Stage 5: Artifact generated
    markPowerflowStage(tenant, 5);

    return sendJSON(res, 201, updated);
  } catch (err) {
    console.error('[deal-room-generate] Generation error:', err);
    return sendError(res, 500, `Failed to generate ${skillKey}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tab-config — Tenant tab configuration
// ---------------------------------------------------------------------------

export async function handleGetTabConfig(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const config = await getTenantTabConfig(tenant.id);
    return sendJSON(res, 200, { tabs: config });
  } catch (err) {
    console.error('[deal-room-generate] Tab config error:', err);
    return sendError(res, 500, 'Failed to load tab configuration');
  }
}
