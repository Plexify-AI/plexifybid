/**
 * PlexifySOLO — Ask Plexi chat route
 *
 * POST /api/ask-plexi/chat
 * Accepts: { message: string, conversation_id?: string, history?: Array, powerflow_level?: number }
 * Returns: { reply: string, conversation_id: string, tool_results: Array, usage: object }
 *
 * When powerflow_level (1-6) is provided, the system prompt is stacked 3 layers:
 *   Layer 1: tenant.system_prompt_override.context (industry/persona)
 *   Layer 2: POWERFLOW_SYSTEM_PROMPTS[level] (capsule sales stage)
 *   Layer 3: DEFAULT_SYSTEM_PROMPT (base Plexi behavior)
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { sendMessage } from '../lib/claude.js';
import { toolDefinitions, toolExecutors } from '../tools/index.js';
import {
  createConversation,
  updateConversation,
  logUsageEvent,
  getOpportunities,
} from '../lib/supabase.js';
import { markPowerflowStage } from './powerflow.js';
import { POWERFLOW_SYSTEM_PROMPTS } from '../constants/powerflowPrompts.js';
import { injectVoicePrompt } from '../lib/voice-dna/inject-voice-prompt.js';
import { hasActiveEmailConnection } from '../services/email/index.mjs';
import { emailToolDefinitions } from '../services/email/tool-definitions.mjs';
import { executeEmailTool } from '../services/email/tool-executor.mjs';

// ---------------------------------------------------------------------------
// System prompt — AEC BD specialist (Layer 3 — base behavior)
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
 * Build a brief pipeline summary from the opportunities table.
 * Injected into the system prompt so Claude has context without a tool call.
 */
async function buildOpportunitySummary(tenantId) {
  try {
    const opps = await getOpportunities(tenantId, { limit: 2000 });
    if (!opps || opps.length === 0) return '';

    let withEmail = 0, withLinkedIn = 0, warmCount = 0, coldCount = 0;
    let totalMessages = 0;
    const industries = {};
    const regions = {};
    const stages = {};

    for (const o of opps) {
      const ed = o.enrichment_data || {};
      if (o.contact_email) withEmail++;
      if (ed.linkedin_url) withLinkedIn++;
      if (ed.warm_status === 'Y' || ed.message_count > 0) {
        warmCount++;
        totalMessages += ed.message_count || 0;
      } else {
        coldCount++;
      }
      if (ed.industry) industries[ed.industry] = (industries[ed.industry] || 0) + 1;
      if (ed.region) regions[ed.region] = (regions[ed.region] || 0) + 1;
      stages[o.stage || 'unknown'] = (stages[o.stage || 'unknown'] || 0) + 1;
    }

    // Top 5 industries by count
    const topIndustries = Object.entries(industries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(', ');

    // Top warm contacts
    const topWarm = opps
      .filter(o => (o.enrichment_data?.message_count || 0) > 0)
      .sort((a, b) => (b.enrichment_data?.message_count || 0) - (a.enrichment_data?.message_count || 0))
      .slice(0, 5)
      .map(o => `${o.contact_name} @ ${o.account_name} (${o.enrichment_data.message_count} msgs)`)
      .join('; ');

    const regionList = Object.entries(regions).map(([r, c]) => `${r}: ${c}`).join(', ');
    const stageList = Object.entries(stages).map(([s, c]) => `${s}: ${c}`).join(', ');

    let summary = `\n--- OPPORTUNITY PIPELINE SNAPSHOT ---\n`;
    summary += `Total: ${opps.length} opportunities | Stages: ${stageList}\n`;
    summary += `Data: ${withEmail} have email, ${withLinkedIn} have LinkedIn | ${warmCount} warm, ${coldCount} cold\n`;
    if (regionList) summary += `Regions: ${regionList}\n`;
    if (topIndustries) summary += `Top industries: ${topIndustries}\n`;
    if (topWarm) summary += `Warmest contacts: ${topWarm}\n`;
    if (totalMessages > 0) summary += `Total LinkedIn messages across warm contacts: ${totalMessages}\n`;
    summary += `Use the search_opportunities, analyze_opportunity_pipeline, and draft_opportunity_outreach tools to query live data.`;

    return summary;
  } catch (err) {
    console.error('[ask-plexi] Failed to build opportunity summary:', err.message);
    return '';
  }
}

/**
 * Build the system prompt for a tenant with optional Powerflow capsule layer.
 *
 * 4-layer stack (top to bottom):
 *   Layer 1: tenant.system_prompt_override.context  (industry/persona context)
 *   Layer 2: POWERFLOW_SYSTEM_PROMPTS[level]        (capsule sales stage context)
 *   Layer 3: DEFAULT_SYSTEM_PROMPT                  (base Plexi behavior)
 *   Layer 4: Opportunity pipeline snapshot           (live data context)
 *
 * Layer 2 is only included when powerflowLevel is provided (1-6).
 * Layer 4 is async — fetched from opportunities table.
 */
async function buildSystemPrompt(tenant, powerflowLevel) {
  const layers = [];

  // Layer 1: Tenant override (industry/persona context)
  try {
    const spo = tenant?.system_prompt_override;
    const override = (typeof spo === 'object' && spo !== null) ? (spo.context || '') : '';
    if (override) layers.push(override);
  } catch {
    // If system_prompt_override is malformed, skip it silently
  }

  // Layer 1.5: Voice DNA (writing style injection)
  try {
    const voiceBlock = await injectVoicePrompt(tenant.id, 'general');
    if (voiceBlock) layers.push(voiceBlock);
  } catch {
    // Non-fatal — agents work normally without Voice DNA
  }

  // Layer 2: Capsule system prompt (sales stage context)
  const level = Number.isInteger(powerflowLevel) ? powerflowLevel : parseInt(powerflowLevel, 10);
  if (level && POWERFLOW_SYSTEM_PROMPTS[level]) {
    layers.push(POWERFLOW_SYSTEM_PROMPTS[level]);
  }

  // Layer 3: Base Plexi behavior
  layers.push(DEFAULT_SYSTEM_PROMPT);

  // Layer 4: Opportunity pipeline snapshot (live data)
  const oppSummary = await buildOpportunitySummary(tenant.id);
  if (oppSummary) layers.push(oppSummary);

  return layers.join('\n\n');
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

  const { message, conversation_id, history = [], powerflow_level: rawLevel } = body;
  const powerflow_level = rawLevel ? (Number.isInteger(rawLevel) ? rawLevel : parseInt(rawLevel, 10) || null) : null;

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

    const levelTag = powerflow_level ? ` [Powerflow L${powerflow_level}]` : '';
    console.log(`[ask-plexi] Processing message for tenant ${tenant.slug}${levelTag}: "${message.substring(0, 80)}..."`);

    // Build tenant-specific system prompt (4-layer stack with live opportunity data)
    const systemPrompt = await buildSystemPrompt(tenant, powerflow_level);
    console.log(`[ask-plexi] System prompt: ${systemPrompt.length} chars, powerflow_level: ${powerflow_level || 'none'}`);

    // Check if tenant has email connected — conditionally add email tools
    let allTools = toolDefinitions;
    let allExecutors = toolExecutors;
    try {
      const emailConnected = await hasActiveEmailConnection(tenantId);
      if (emailConnected) {
        allTools = [...toolDefinitions, ...emailToolDefinitions];
        // Build email tool executors map
        const emailExecutors = {};
        for (const tool of emailToolDefinitions) {
          emailExecutors[tool.name] = (input) => executeEmailTool(tool.name, input, tenantId);
        }
        allExecutors = { ...toolExecutors, ...emailExecutors };
      }
    } catch (err) {
      console.error('[ask-plexi] Failed to check email connection:', err.message);
      // Non-fatal — proceed without email tools
    }

    // Call Claude with tool support
    let result;
    try {
      result = await sendMessage({
        messages,
        tools: allTools,
        systemPrompt,
        toolExecutors: allExecutors,
        tenantId,
      });
    } catch (claudeErr) {
      console.error('[ask-plexi] Claude API / tool execution failed:', claudeErr);
      throw new Error(`Claude API error: ${claudeErr.message}`);
    }

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
    markPowerflowStage(tenant, 1); // Stage 1: Ask Plexi query (auto-trigger)
    const toolNames = result.toolResults.map((t) => t.tool);
    if (toolNames.includes('draft_outreach') || toolNames.includes('draft_opportunity_outreach')) markPowerflowStage(tenant, 3);
    if (toolNames.includes('analyze_pipeline') || toolNames.includes('analyze_opportunity_pipeline')) markPowerflowStage(tenant, 4);
    // Explicit stage marking from powerflow capsule (belt-and-suspenders with auto-triggers)
    if (powerflow_level && powerflow_level >= 1 && powerflow_level <= 6) {
      markPowerflowStage(tenant, powerflow_level);
    }

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
        details: err.message,
      })
    );
  }
}
