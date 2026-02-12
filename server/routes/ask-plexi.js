/**
 * PlexifySOLO — Ask Plexi chat route
 *
 * POST /api/ask-plexi/chat
 * Accepts: { message: string, conversation_id?: string, history?: Array }
 * Returns: { reply: string, conversation_id: string, tool_results: Array, usage: object }
 *
 * For Session 3 testing: accepts X-Sandbox-Token header, or falls back
 * to Mel's hardcoded tenant for development. Session 4 will enforce auth.
 */

import { sendMessage } from '../lib/claude.js';
import { toolDefinitions, toolExecutors } from '../tools/index.js';
import {
  supabase,
  createConversation,
  updateConversation,
  logUsageEvent,
} from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// System prompt — AEC BD specialist
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Plexi, an AI business development specialist for the AEC (Architecture, Engineering, Construction) industry. You help sales professionals find, prioritize, and pursue commercial construction opportunities.

You speak the language of general contractors, developers, and project owners. You understand project phases, procurement methods, and relationship-based selling in construction.

Be direct, specific, and actionable. When you identify prospects, explain WHY they're good fits, not just that they match criteria. Keep responses concise — executives don't read walls of text.

When presenting prospects, highlight:
- The warmth score and what drives it
- Pain points you can solve
- Warm intro paths through mutual connections
- Relevant case studies with concrete ROI numbers

When drafting outreach, write like a senior BD professional — no generic marketing speak. Reference specific project details, not boilerplate.

When analyzing the pipeline, give a clear executive summary first, then drill into details only if asked.

You have access to the user's real prospect database, contact network, and case study library. Use the tools to query live data — never make up project names or contacts.`;

// ---------------------------------------------------------------------------
// MEL_TENANT_ID — hardcoded for Session 3 dev testing
// Session 4 will replace this with proper tenant middleware
// ---------------------------------------------------------------------------
const MEL_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Resolve tenant from token or fallback to Mel for dev
// ---------------------------------------------------------------------------

async function resolveTenant(token) {
  if (token) {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('sandbox_token', token)
      .eq('is_active', true)
      .single();

    if (!error && tenant) {
      if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
        return { error: 'Sandbox token has expired' };
      }
      return { tenant };
    }
    return { error: 'Invalid sandbox token' };
  }

  // Dev fallback — use Mel's tenant
  if (process.env.NODE_ENV !== 'production') {
    return { tenant: { id: MEL_TENANT_ID, slug: 'mel-wallace-hexagon' } };
  }

  return { error: 'Missing X-Sandbox-Token header' };
}

// ---------------------------------------------------------------------------
// Handler (works with both Express req/res and raw Node http)
// ---------------------------------------------------------------------------

export async function handleChat(req, res, body) {
  const token = req.headers['x-sandbox-token'];
  const { tenant, error: authError } = await resolveTenant(token);

  if (authError) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: authError }));
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

    // Call Claude with tool support
    const result = await sendMessage({
      messages,
      tools: toolDefinitions,
      systemPrompt: SYSTEM_PROMPT,
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
