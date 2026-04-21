/**
 * PlexifySOLO — Ask Plexi chat route
 *
 * POST /api/ask-plexi/chat
 * Accepts: { message: string, conversation_id?: string, history?: Array, powerflow_level?: number }
 * Returns: { reply: string, conversation_id: string, tool_results: Array, usage: object }
 *
 * System prompt is stacked 5 layers:
 *   Layer 0: PERSPECTIVE GUARDRAIL (non-negotiable — {user_name} at {user_company})
 *   Layer 1: tenant.system_prompt_override.context (industry/persona)
 *   Layer 1.5: Voice DNA (writing style)
 *   Layer 2: POWERFLOW_SYSTEM_PROMPTS[level] (capsule sales stage)
 *   Layer 3: DEFAULT_SYSTEM_PROMPT (base Plexi behavior)
 *   Layer 4: Opportunity pipeline snapshot (live data)
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
  getCampaignCounts,
} from '../lib/supabase.js';
import { markPowerflowStage } from './powerflow.js';
import { POWERFLOW_SYSTEM_PROMPTS } from '../constants/powerflowPrompts.js';
import { buildUserContext } from '../lib/user-context.js';
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

When the user asks about campaigns (e.g., "what campaigns do I have", "break down by campaign", "campaign stats", "campaign comparison", or any question referencing campaigns), use the analyze_opportunity_pipeline tool with group_by='campaign'. Do NOT use group_by='source' for campaign questions — 'source' returns import batch identifiers (like 'sunnax_import'), NOT user-facing campaign names. For individual prospect lookups within a specific campaign, use search_opportunities with filters.source_campaign set to the exact campaign name.

Never use these words: leverage, seamless, transformative, delve.`;

/**
 * Build a brief pipeline summary from the opportunities table.
 * Injected into the system prompt so Claude has context without a tool call.
 */
export async function buildOpportunitySummary(tenantId) {
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

    // Campaign breakdown — non-essential enhancement, failure must not break prompt
    let campaignBlock = '';
    try {
      const topCampaigns = await getCampaignCounts(tenantId, { minLeads: 5, topN: 10 });
      if (topCampaigns.length > 0) {
        const lines = topCampaigns.map(([name, count]) => `- ${name} (${count} leads)`).join('\n');
        campaignBlock = `\nACTIVE CAMPAIGNS (top 10 by lead count, tenant-scoped):\n${lines}\n` +
          `When the user references a campaign by name, pass it to search_opportunities as filters.source_campaign (exact match).\n`;

        // Naming-convention hint — only inject when the tenant actually uses the
        // -pre-show suffix AND a base-name variant exists for at least one campaign.
        // Helps disambiguate "post-X" (base name) vs. "pre-X" (-pre-show variant).
        const names = topCampaigns.map(([n]) => n);
        const preShowNames = names.filter((n) => n.endsWith('-pre-show'));
        const pairs = preShowNames.filter((n) => names.includes(n.slice(0, -'-pre-show'.length)));
        if (pairs.length > 0) {
          campaignBlock +=
            `CAMPAIGN NAMING CONVENTION (this tenant):\n` +
            `- Names ending in "-pre-show" = pre-event lead capture.\n` +
            `- Names without a "-pre-show" suffix (e.g., the base name) = post-event / post-show capture.\n` +
            `- When the user says "post-show" or "post-<event>", match the base name.\n` +
            `- When the user says "pre-show" or "pre-<event>", match the "-pre-show" variant.\n` +
            `- If the user's intent is ambiguous, prefer the base (post-show) name and surface both counts in the reply.\n`;
        }
      }
    } catch (err) {
      console.error('[ask-plexi] campaign summary failed, continuing without:', err.message);
      // campaignBlock stays empty — AskPlexi still functions
    }
    if (campaignBlock) summary += campaignBlock;

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
 * 5-layer stack (top to bottom):
 *   Layer 0: PERSPECTIVE GUARDRAIL (non-negotiable — never overridden)
 *   Layer 1: tenant.system_prompt_override.context  (industry/persona context)
 *   Layer 1.5: Voice DNA                            (writing style injection)
 *   Layer 2: POWERFLOW_SYSTEM_PROMPTS[level]        (capsule sales stage context)
 *   Layer 3: DEFAULT_SYSTEM_PROMPT                  (base Plexi behavior)
 *   Layer 4: Opportunity pipeline snapshot           (live data context)
 *
 * Layer 0 is ALWAYS first — it anchors the BD executive perspective and
 * cannot be overridden by any subsequent layer. This prevents the LLM from
 * adopting the prospect's perspective.
 *
 * Layer 2 is only included when powerflowLevel is provided (1-6).
 * Layer 4 is async — fetched from opportunities table.
 */
export async function buildSystemPrompt(tenant, powerflowLevel) {
  const layers = [];

  // Layer 0: Perspective guardrail (non-negotiable, always first)
  const userName = tenant?.name || 'the user';
  const userCompany = tenant?.company || 'their company';
  layers.push(
    `You are Plexify AI, the Business Development intelligence assistant for ${userName} at ${userCompany}.\n\n` +
    `CRITICAL PERSPECTIVE RULE: You ALWAYS speak from ${userName}'s perspective as a BD executive. When analyzing any company or contact:\n` +
    `- They are a PROSPECT or TARGET ACCOUNT for ${userName}\n` +
    `- You help ${userName} sell TO them, build relationships WITH them, win work FROM them\n` +
    `- NEVER adopt the prospect's perspective or speak as if you work for the prospect company\n` +
    `- NEVER say "our company" or "our team" when referring to the prospect — say "their company" or "their team"\n` +
    `- Always frame insights as intelligence that helps ${userName} pursue the opportunity\n` +
    `- When referencing contacts from the database, use the EXACT name spelling from the data`
  );

  // Layer 1: Tenant override (industry/persona context)
  try {
    const spo = tenant?.system_prompt_override;
    const override = (typeof spo === 'object' && spo !== null) ? (spo.context || '') : '';
    if (override) layers.push(override);
  } catch {
    // If system_prompt_override is malformed, skip it silently
  }

  // Layer 1.5: Unified user context (factual corrections + Voice DNA + voice corrections)
  try {
    const contextBlock = await buildUserContext(tenant.id, { contentType: 'general' });
    if (contextBlock) layers.push(contextBlock);
  } catch {
    // Non-fatal — agents work normally without context
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

  // Layer 5: Email preferences (closing, signature suppression, price list)
  const prefs = tenant?.preferences || {};
  const emailPrefParts = [];
  emailPrefParts.push('EMAIL FORMATTING RULES:');
  emailPrefParts.push('- Do NOT include a signature block in any email you draft. The signature is appended automatically by the system.');

  if (prefs.include_closing !== false && prefs.default_closing) {
    emailPrefParts.push(`- End every email with EXACTLY: "${prefs.default_closing}" followed by "${userName}" on the next line.`);
  }

  if (prefs.price_list && prefs.price_list.length > 0) {
    const col = prefs.default_price_column === 'msrp' ? 'msrp' : 'map';
    const colLabel = col === 'msrp' ? 'MSRP' : 'MAP';
    emailPrefParts.push('');
    emailPrefParts.push(`PRODUCT PRICING — Use ${colLabel} prices unless the user explicitly requests otherwise.`);
    if (prefs.price_note) emailPrefParts.push(prefs.price_note);
    for (const item of prefs.price_list) {
      const price = item[col] || item.map || item.msrp || '';
      emailPrefParts.push(`  ${item.product} (${item.sku}): ${price}`);
    }
    emailPrefParts.push('Never estimate or round prices — use exact values from this list.');
  }

  layers.push(emailPrefParts.join('\n'));

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

  const { message, conversation_id, history = [], ui_messages, powerflow_level: rawLevel } = body;
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

    // Frontend passes the rich PlexiMessage[] it's about to render. We persist
    // these in ui_messages for full-fidelity reload from the library sidebar
    // (Sprint B / B3). Strip the client-side welcome message if present — it's
    // a UI artefact, not part of the conversation.
    const rawUiMessages = Array.isArray(ui_messages) ? ui_messages : [];
    const persistedUiMessages = rawUiMessages.filter((m) => m && m.id !== 'welcome');

    try {
      if (convId) {
        await updateConversation(
          convId,
          updatedHistory,
          { last_tool_results: result.toolResults },
          { uiMessages: persistedUiMessages }
        );
      } else {
        const conv = await createConversation(
          tenantId,
          updatedHistory,
          { last_tool_results: result.toolResults },
          { userId: tenantId, uiMessages: persistedUiMessages }
        );
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
