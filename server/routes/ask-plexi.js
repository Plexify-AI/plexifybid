/**
 * PlexifySOLO — Ask Plexi chat route
 *
 * POST /api/ask-plexi/chat
 * Accepts: { message: string, conversation_id?: string, history?: Array }
 * Returns: { reply: string, conversation_id: string, tool_results: Array, usage: object }
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { sendMessage } from '../lib/claude.js';
import { toolDefinitions, toolExecutors } from '../tools/index.js';
import {
  createConversation,
  updateConversation,
  logUsageEvent,
} from '../lib/supabase.js';
import { markPowerflowStage } from './powerflow.js';

// ---------------------------------------------------------------------------
// System prompt — AEC BD specialist
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT = `You are Plexi, an AI business development specialist. You help sales professionals find, prioritize, and pursue opportunities.

Be direct, specific, and actionable. When you identify prospects, explain WHY they're good fits, not just that they match criteria. Keep responses concise — executives don't read walls of text.

When presenting prospects, highlight:
- The warmth score and what drives it
- Pain points you can solve
- Warm intro paths through mutual connections
- Relevant case studies with concrete ROI numbers

When drafting outreach, write like a senior BD professional — no generic marketing speak. Reference specific project details, not boilerplate.

When analyzing the pipeline, give a clear executive summary first, then drill into details only if asked.

You have access to the user's real prospect database, contact network, and case study library. Use the tools to query live data — never make up project names or contacts.

Never use these words: leverage, seamless, transformative, delve.`;

/**
 * Build the system prompt for a tenant. If the tenant has a system_prompt_override
 * with a context field, prepend it to the default prompt. The override augments
 * the default — it does NOT replace it.
 */
function buildSystemPrompt(tenant) {
  const override = tenant.system_prompt_override?.context || '';
  return override
    ? `${override}\n\n${DEFAULT_SYSTEM_PROMPT}`
    : DEFAULT_SYSTEM_PROMPT;
}

// ---------------------------------------------------------------------------
// Handler — req.tenant is set by sandboxAuth middleware
// ---------------------------------------------------------------------------

export async function handleChat(req, res, body) {
  const tenant = req.tenant;

  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { message, conversation_id, history = [] } = body;

  if (!message || typeof message !== 'string') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing "message" in request body' }));
  }

  const tenantId = tenant.id;

  try {
    // Build messages array from history + new message
    const messages = [
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    console.log(`[ask-plexi] Processing message for tenant ${tenant.slug}: "${message.substring(0, 80)}..."`);

    // Build tenant-specific system prompt (override augments default)
    const systemPrompt = buildSystemPrompt(tenant);

    // Call Claude with tool support
    const result = await sendMessage({
      messages,
      tools: toolDefinitions,
      systemPrompt,
      toolExecutors,
      tenantId,
    });

    // Persist conversation
    let convId = conversation_id;
    const updatedHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: result.content },
    ];

    try {
      if (convId) {
        await updateConversation(convId, updatedHistory, {
          last_tool_results: result.toolResults,
        });
      } else {
        const conv = await createConversation(tenantId, updatedHistory, {
          last_tool_results: result.toolResults,
        });
        convId = conv.id;
      }
    } catch (err) {
      console.error('[ask-plexi] Failed to persist conversation:', err.message);
      // Non-fatal — still return the response
    }

    // Log usage
    logUsageEvent(tenantId, 'ask_plexi_chat', {
      message_length: message.length,
      tool_calls: result.toolResults.map((t) => t.tool),
      usage: result.usage,
    }).catch(() => {}); // fire and forget

    // Powerflow triggers (non-blocking)
    markPowerflowStage(tenant, 1); // Stage 1: Ask Plexi query
    const toolNames = result.toolResults.map((t) => t.tool);
    if (toolNames.includes('draft_outreach')) markPowerflowStage(tenant, 3); // Stage 3: Outreach draft
    if (toolNames.includes('analyze_pipeline')) markPowerflowStage(tenant, 4); // Stage 4: Pipeline analysis

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        reply: result.content,
        conversation_id: convId,
        tool_results: result.toolResults,
        usage: result.usage,
      })
    );
  } catch (err) {
    console.error('[ask-plexi] Chat error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Failed to process message. Please try again.',
        details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      })
    );
  }
}
