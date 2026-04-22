/**
 * PlexifyAEC — Batch Email Generation
 *
 * POST /api/batch-email/generate — Generate outreach emails for multiple opportunities
 *
 * Reuses the draft_opportunity_outreach tool logic to generate one email per
 * opportunity. Calls Claude sequentially for each prospect with Voice DNA.
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { getSupabase, getOpportunityById, getOpportunitiesForBatch, getCampaignCounts } from '../lib/supabase.js';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { buildUserContext } from '../lib/user-context.js';
import { logUsage } from '../middleware/logUsage.mjs';
import { sendDirect } from '../services/email/tool-executor.mjs';
import { markPowerflowStage } from './powerflow.js';

const BANNED_WORDS = /\b(delve|leverage|seamless|transformative)\b/gi;
const OPENER_CAP_CENTS = 1500;       // $15.00 / tenant / month — L31
const OPENER_EST_COST_CENTS = 1;      // conservative estimate per opener
const OPENER_BATCH_SIZE = 5;          // parallel concurrency
const OPENER_FALLBACK = 'Hope this finds you well.';

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
 * Build outreach context + instructions for a single opportunity.
 * Mirrors logic from server/tools/draft-opportunity-outreach.js
 */
/**
 * Build event context block for Xencelabs TN leads (Animation Y'all 2026).
 * Returns empty string for non-event leads.
 */
function buildEventContext(enrichmentData) {
  const ed = enrichmentData || {};
  if (ed.source !== 'xencelabs_tn_event') return '';

  const isRegistered = !!ed.animation_yall_registered;
  const industry = ed.industry || 'creative technology';

  // Industry-specific hooks for the invitation tone
  const industryHooks = {
    'K-12': 'see how schools are adopting pen displays for digital art curriculum',
    'Higher Edu- Design': 'check out the latest Xencelabs pen displays used in university design programs',
    'Game Development/Simulation': 'try the pen display pipeline our studio customers use for game art',
    'Animation': 'get hands-on with the pen displays animators are switching to',
    'VFX / FILM': 'see the pen tablet workflow VFX artists use in production',
    'Medical/Healthcare': 'explore how medical illustration teams use Xencelabs pen displays',
    'Broadcast /Video Editing': 'see how broadcast graphics teams use Xencelabs pen displays',
    'Photography': 'try the pen display retouching workflow photographers love',
    'Graphic Design': 'get hands-on with the pen displays graphic designers are switching to',
    'Government/Simulation/Other': 'see how simulation teams use Xencelabs pen displays',
  };
  const hook = industryHooks[industry] || 'get hands-on with the latest Xencelabs pen displays';

  if (isRegistered) {
    return (
      '\n\nEVENT OUTREACH CONTEXT (this contact is a REGISTERED ATTENDEE):\n' +
      'Show: Animation Y\'all!\n' +
      'Venue: Lipscomb University / Allen Arena Lobby\n' +
      'Booth: XenceLabs - Booth C\n' +
      'Dates: Saturday April 11th 10am-6pm, Sunday April 12th 10am-5pm\n\n' +
      'This person is already registered for Animation Y\'all. Use a warm, excited tone:\n' +
      '"Since you\'re already registered for Animation Y\'all, stop by Booth C — ' +
      'I\'d love to give you a hands-on demo of the latest Xencelabs pen displays."\n' +
      'Suggest scheduling a specific time at the booth. Casual, inviting. ' +
      'Include booth number (Booth C) and exhibition times.'
    );
  }

  return (
    '\n\nEVENT OUTREACH CONTEXT (this is an INVITATION — they may not know about the event):\n' +
    'Show: Animation Y\'all!\n' +
    'Venue: Lipscomb University / Allen Arena Lobby\n' +
    'Booth: XenceLabs - Booth C\n' +
    'Dates: Saturday April 11th 10am-6pm, Sunday April 12th 10am-5pm\n\n' +
    'This person may not know about Animation Y\'all. Invite them to attend:\n' +
    '"Animation Y\'all is happening this weekend at Lipscomb University — ' +
    'free to attend and we\'ll have Xencelabs pen displays set up at Booth C for hands-on demos."\n' +
    `Position the event as worth their time: "${hook}". ` +
    'Casual, inviting, specific. Include booth number (Booth C) and exhibition times. ' +
    'Do NOT use corporate stiff language.'
  );
}

function buildOutreachPrompt(opportunity, toneOverride) {
  const ed = opportunity.enrichment_data || {};
  const isWarm = ed.warm_status === 'Y' || (ed.message_count && ed.message_count > 0);
  const hasEmail = !!opportunity.contact_email;

  const tone = toneOverride || (isWarm ? 'warm' : 'professional');
  const channel = hasEmail ? 'email' : 'email';

  let channelInstructions;
  if (isWarm) {
    channelInstructions =
      'Write an email referencing your existing relationship (' +
      `${ed.message_count || 0} prior LinkedIn messages). Include a subject line. ` +
      'Tone: familiar, direct. Suggest a specific next step (call, coffee, meeting). Under 150 words.';
  } else {
    channelInstructions =
      'Write a cold outreach email. Lead with an insight relevant to their ' +
      `${ed.industry || 'industry'}. Include a compelling subject line. ` +
      'No generic marketing speak. Specific value proposition. Under 150 words.';
  }

  // Inject event context for Xencelabs TN event leads
  const eventContext = buildEventContext(ed);

  const instructions =
    `${channelInstructions} ` +
    `Use the contact's real name (${opportunity.contact_name || opportunity.account_name}). ` +
    'Reference their company and role. ' +
    (ed.industry ? `Their industry is ${ed.industry}. ` : '') +
    'Make it specific and actionable — no boilerplate. ' +
    'NEVER use these words: delve, leverage, seamless, transformative. ' +
    'Do NOT include a signature block — it is appended automatically by the system. ' +
    'Format the email with Subject: on the first line, then the body.' +
    eventContext;

  return {
    contact: {
      name: opportunity.contact_name,
      title: opportunity.contact_title,
      email: opportunity.contact_email,
      company: opportunity.account_name,
    },
    relationship: {
      is_warm: isWarm,
      message_count: ed.message_count || 0,
      lead_type: ed.lead_type || (isWarm ? 'warm' : 'cold'),
    },
    context: {
      industry: ed.industry || null,
      deal_hypothesis: opportunity.deal_hypothesis,
      stage: opportunity.stage,
    },
    tone,
    channel,
    instructions,
  };
}

// ---------------------------------------------------------------------------
// GET /api/batch-email/opportunities
// Query params: source_campaign, search, has_email (default true), limit (max 500)
// ---------------------------------------------------------------------------

export async function handleBatchOpportunities(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    const source_campaign = url.searchParams.get('source_campaign') || null;
    const search = url.searchParams.get('search') || null;
    const has_email_param = url.searchParams.get('has_email');
    const has_email = has_email_param === null ? true : has_email_param !== 'false';
    const limit = parseInt(url.searchParams.get('limit') || '500', 10);

    const opportunities = await getOpportunitiesForBatch(tenant.id, {
      has_email,
      source_campaign,
      search,
      limit,
    });

    return sendJSON(res, 200, {
      opportunities,
      count: opportunities.length,
      limit_capped: opportunities.length >= 500,
    });
  } catch (err) {
    console.error('[batch-email] List opportunities error:', err);
    return sendError(res, 500, `Failed to list opportunities: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// GET /api/batch-email/templates
// Returns the tenant's email_templates array from preferences. Empty array
// if none seeded. The Settings > Templates editor (Sprint F) will write here.
// ---------------------------------------------------------------------------

export async function handleBatchTemplates(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const prefs = tenant.preferences || {};
    const templates = Array.isArray(prefs.email_templates) ? prefs.email_templates : [];
    return sendJSON(res, 200, { templates });
  } catch (err) {
    console.error('[batch-email] List templates error:', err);
    return sendError(res, 500, `Failed to list templates: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// GET /api/batch-email/campaigns
// Returns all campaigns for this tenant (minLeads:1, topN:50) for the filter
// dropdown. Distinct from the L2 pipeline summary use which trims to top 10.
// ---------------------------------------------------------------------------

export async function handleBatchCampaigns(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  try {
    const counts = await getCampaignCounts(tenant.id, {
      minLeads: 1,
      topN: 50,
      includeNull: false,
    });

    const campaigns = counts.map(([name, count]) => ({ name, count }));

    return sendJSON(res, 200, { campaigns });
  } catch (err) {
    console.error('[batch-email] List campaigns error:', err);
    return sendError(res, 500, `Failed to list campaigns: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// L31 cost-cap enforcement for opener generation
// ---------------------------------------------------------------------------

async function getMonthlyOpenerSpend(tenantId) {
  const start = monthStartIso();
  const { data, error } = await getSupabase()
    .from('tenant_usage')
    .select('cost_cents')
    .eq('tenant_id', tenantId)
    .in('kind', ['batch_opener_generation', 'batch_opener_regen'])
    .gte('created_at', start);
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (r.cost_cents || 0), 0);
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Refuses if the estimated cost of generating `count` openers would push the
 * tenant past the $15/month cap (L31 pattern).
 */
async function assertOpenerBudget(tenantId, count) {
  const spent = await getMonthlyOpenerSpend(tenantId);
  const estimate = count * OPENER_EST_COST_CENTS;
  if (spent + estimate > OPENER_CAP_CENTS) {
    const err = new Error(
      `Batch opener generation would exceed $${(OPENER_CAP_CENTS / 100).toFixed(2)}/month cap ` +
      `(spent: $${(spent / 100).toFixed(2)}, estimate: $${(estimate / 100).toFixed(2)}). ` +
      `Reduce recipient count or wait until next month.`
    );
    err.status = 429;
    throw err;
  }
  return { spent, remaining: OPENER_CAP_CENTS - spent, estimate };
}

// ---------------------------------------------------------------------------
// Opener generation — single recipient, with regen + fallback
// ---------------------------------------------------------------------------

function buildOpenerSystemPrompt(tenantName, tenantCompany, contextBlock) {
  return (
    `You write ONE-SENTENCE personalized email openers in the voice of ${tenantName} ` +
    `from ${tenantCompany}. ` +
    (contextBlock ? `\n\n${contextBlock}\n\n` : '\n\n') +
    `STRICT RULES:\n` +
    `- Output exactly ONE sentence. No greeting, no signature, no "I hope this finds you well".\n` +
    `- Reference one specific detail about the recipient or their company that justifies the outreach.\n` +
    `- Conversational, warm, never corporate.\n` +
    `- NEVER use these words: delve, leverage, seamless, transformative.\n` +
    `- Output the sentence ONLY — no quotes, no preamble like "Here's the opener:".`
  );
}

function buildOpenerUserPrompt(opportunity, campaignName) {
  const ed = opportunity.enrichment_data || {};
  const lines = [
    `Recipient: ${opportunity.contact_name || 'Unknown'}`,
    `Company: ${opportunity.account_name || 'Unknown'}`,
  ];
  if (opportunity.contact_title) lines.push(`Title: ${opportunity.contact_title}`);
  if (ed.industry) lines.push(`Industry: ${ed.industry}`);
  if (campaignName) lines.push(`Campaign / context: ${campaignName}`);
  if (opportunity.deal_hypothesis) lines.push(`Deal hypothesis: ${opportunity.deal_hypothesis}`);
  // Compact a few enrichment hints if present
  const hints = [];
  if (ed.notes) hints.push(`Notes: ${String(ed.notes).slice(0, 200)}`);
  if (ed.role_summary) hints.push(`Role: ${String(ed.role_summary).slice(0, 200)}`);
  if (hints.length) lines.push(hints.join(' | '));

  return (
    lines.join('\n') +
    `\n\nWrite ONE sentence opener for an outreach email to this recipient. Output the sentence only.`
  );
}

function containsBannedWord(text) {
  return BANNED_WORDS.test(text);
}

function sanitizeOpener(text) {
  if (!text) return '';
  // Strip wrapping quotes and leading bullet/preamble
  let t = text.trim();
  t = t.replace(/^["'`""'']+|["'`""'']+$/g, '').trim();
  t = t.replace(/^(Here(?:'s| is) (?:the|an|a|your) opener:\s*)/i, '').trim();
  // Collapse internal newlines into single space
  t = t.replace(/\s*\n+\s*/g, ' ').trim();
  return t;
}

async function generateOneOpener({
  opportunity,
  systemPrompt,
  userPrompt,
  tenantId,
  attempt = 1,
}) {
  const result = await sendPrompt({
    taskType: TASK_TYPES.ASK_PLEXI,
    systemPrompt: attempt === 2
      ? systemPrompt + `\n\nYour previous attempt contained a forbidden word. Try again. NEVER use: delve, leverage, seamless, transformative.`
      : systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 120,
    temperature: 0.7,
    tenantId,
  });

  const text = sanitizeOpener(result.content || '');
  return { text, raw: result };
}

/**
 * Generate one opener with banned-word retry budget capped at 2 LLM calls.
 * Returns { opportunity_id, opener_text, regenerated, fallback }.
 */
async function generateOpenerWithRetry({ opportunity, campaignName, tenantId, systemPrompt }) {
  const userPrompt = buildOpenerUserPrompt(opportunity, campaignName);
  const oppId = opportunity.id;

  try {
    const first = await generateOneOpener({ opportunity, systemPrompt, userPrompt, tenantId, attempt: 1 });
    logUsage({ tenantId, kind: 'batch_opener_generation', costCents: OPENER_EST_COST_CENTS });

    if (first.text && !containsBannedWord(first.text)) {
      return { opportunity_id: oppId, opener_text: first.text, regenerated: false, fallback: false };
    }

    // Banned word detected (or empty) — one regen attempt
    if (containsBannedWord(first.text)) {
      console.warn(`[batch-email] Banned word in opener for ${oppId}, regenerating`);
    }
    const second = await generateOneOpener({ opportunity, systemPrompt, userPrompt, tenantId, attempt: 2 });
    logUsage({ tenantId, kind: 'batch_opener_regen', costCents: OPENER_EST_COST_CENTS });

    if (second.text && !containsBannedWord(second.text)) {
      return { opportunity_id: oppId, opener_text: second.text, regenerated: true, fallback: false };
    }

    // Second attempt also failed — fall back
    return { opportunity_id: oppId, opener_text: OPENER_FALLBACK, regenerated: true, fallback: true };
  } catch (err) {
    console.error(`[batch-email] Opener generation failed for ${oppId}:`, err.message);
    return {
      opportunity_id: oppId,
      opener_text: OPENER_FALLBACK,
      regenerated: false,
      fallback: true,
      error: err.message,
    };
  }
}

/**
 * Run an array of async functions in parallel batches of N.
 * Each item runs independently; one failure does not abort the others.
 */
async function runInBatches(items, batchSize, fn) {
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(slice.map(fn));
    settled.forEach((r, idx) => {
      out[i + idx] = r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'unknown' };
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// POST /api/batch-email/openers
// Body: { template_id, opportunity_ids[], campaign_name? }
// Returns: { openers: [{ opportunity_id, opener_text, regenerated, fallback }] }
// ---------------------------------------------------------------------------

export async function handleBatchOpeners(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { opportunity_ids, campaign_name } = body || {};
  if (!Array.isArray(opportunity_ids) || opportunity_ids.length === 0) {
    return sendError(res, 400, 'Missing required field: opportunity_ids');
  }
  if (opportunity_ids.length > 50) {
    return sendError(res, 400, 'Maximum 50 openers per batch');
  }

  try {
    // L31 cap pre-check
    await assertOpenerBudget(tenant.id, opportunity_ids.length);

    // Voice DNA + factual + voice corrections context
    let contextBlock = '';
    try {
      contextBlock = (await buildUserContext(tenant.id, { contentType: 'outreach' })) || '';
    } catch {
      // Non-fatal
    }

    const systemPrompt = buildOpenerSystemPrompt(tenant.name, tenant.company, contextBlock);

    // Load opportunities (parallel, all-or-some)
    const oppLoads = await Promise.allSettled(
      opportunity_ids.map(id => getOpportunityById(tenant.id, id))
    );
    const opportunities = [];
    const loadFailures = [];
    oppLoads.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        opportunities.push(r.value);
      } else {
        loadFailures.push(opportunity_ids[i]);
      }
    });

    // Generate openers in parallel batches of 5
    const openers = await runInBatches(opportunities, OPENER_BATCH_SIZE, opp =>
      generateOpenerWithRetry({
        opportunity: opp,
        campaignName: campaign_name || opp.source_campaign || null,
        tenantId: tenant.id,
        systemPrompt,
      })
    );

    // Fold load failures into the response as fallbacks so the client gets
    // a complete map keyed by opportunity_id.
    for (const id of loadFailures) {
      openers.push({
        opportunity_id: id,
        opener_text: OPENER_FALLBACK,
        regenerated: false,
        fallback: true,
        error: 'Opportunity not found',
      });
    }

    return sendJSON(res, 200, {
      openers,
      total: opportunity_ids.length,
      generated: openers.filter(o => !o.fallback).length,
      fallbacks: openers.filter(o => o.fallback).length,
      regenerated: openers.filter(o => o.regenerated).length,
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('[batch-email] Openers error:', err);
    return sendError(res, status, err.message);
  }
}

// ---------------------------------------------------------------------------
// POST /api/batch-email/send-one
// Sends ONE recipient. Frontend orchestrates the loop with 500ms spacing so
// the per-recipient UI updates land in real time (no SSE plumbing needed).
//
// Body: { batch_id, opportunity_id, to, subject, body_html }
// Returns: { status: 'sent'|'failed'|'skipped_duplicate', error_message? }
//
// Idempotency: before calling provider.sendEmail, check batch_email_sends for
// any existing row with (tenant_id, batch_id, opportunity_id, status='sent')
// in the last hour. If found, return 'skipped_duplicate' without re-sending.
// This protects against retries-from-scratch after browser crash mid-batch.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleBatchSendOne(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { batch_id, opportunity_id, to, subject, body_html } = body || {};

  if (!batch_id || !UUID_RE.test(batch_id)) return sendError(res, 400, 'Missing or invalid batch_id');
  if (!opportunity_id || !UUID_RE.test(opportunity_id)) return sendError(res, 400, 'Missing or invalid opportunity_id');
  if (!to || typeof to !== 'string') return sendError(res, 400, 'Missing required field: to');
  if (!subject || typeof subject !== 'string') return sendError(res, 400, 'Missing required field: subject');
  if (!body_html || typeof body_html !== 'string') return sendError(res, 400, 'Missing required field: body_html');

  const supabase = getSupabase();

  try {
    // Idempotency check — same batch + opportunity already sent in last hour?
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing, error: lookupErr } = await supabase
      .from('batch_email_sends')
      .select('id, sent_at')
      .eq('tenant_id', tenant.id)
      .eq('batch_id', batch_id)
      .eq('opportunity_id', opportunity_id)
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo)
      .limit(1);

    if (lookupErr) {
      console.error('[batch-email/send-one] Idempotency lookup failed:', lookupErr.message);
      // Fall through — better to risk a duplicate than to refuse a legitimate send
    } else if (existing && existing.length > 0) {
      // Log the skip for audit visibility
      await supabase.from('batch_email_sends').insert({
        tenant_id: tenant.id,
        batch_id,
        opportunity_id,
        recipient_email: to,
        subject,
        status: 'skipped_duplicate',
        error_message: `Already sent at ${existing[0].sent_at}`,
      });
      return sendJSON(res, 200, { status: 'skipped_duplicate', sent_at: existing[0].sent_at });
    }

    // Send through the connected provider (Outlook OAuth path)
    const result = await sendDirect(tenant.id, { to, subject, bodyHtml: body_html });

    const status = result.success ? 'sent' : 'failed';
    const errorMessage = result.success ? null : result.error || 'Send failed';
    const sentAt = result.success ? new Date().toISOString() : null;

    const { error: insertErr } = await supabase.from('batch_email_sends').insert({
      tenant_id: tenant.id,
      batch_id,
      opportunity_id,
      recipient_email: to,
      subject,
      status,
      error_message: errorMessage,
      sent_at: sentAt,
    });
    if (insertErr) {
      console.error('[batch-email/send-one] Audit insert failed:', insertErr.message);
    }

    if (result.success) {
      // Powerflow Stage 3 — outreach drafted/sent
      markPowerflowStage(tenant, 3);
    }

    return sendJSON(res, 200, {
      status,
      error_message: errorMessage,
      sent_at: sentAt,
    });
  } catch (err) {
    console.error('[batch-email/send-one] Unexpected error:', err);
    // Best-effort audit row for the failure
    try {
      await supabase.from('batch_email_sends').insert({
        tenant_id: tenant.id,
        batch_id,
        opportunity_id,
        recipient_email: to,
        subject,
        status: 'failed',
        error_message: err.message,
      });
    } catch {
      // Ignore secondary failure
    }
    return sendError(res, 500, `Send failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// POST /api/batch-email/generate
// ---------------------------------------------------------------------------

export async function handleBatchGenerate(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const { opportunity_ids, tone } = body || {};
  if (!opportunity_ids || !Array.isArray(opportunity_ids) || opportunity_ids.length === 0) {
    return sendError(res, 400, 'Missing required field: opportunity_ids (array)');
  }

  if (opportunity_ids.length > 15) {
    return sendError(res, 400, 'Maximum 15 prospects per batch');
  }

  try {
    // Load unified user context (factual corrections + Voice DNA + voice corrections)
    let contextBlock = '';
    try {
      contextBlock = (await buildUserContext(tenant.id, { contentType: 'outreach' })) || '';
    } catch {
      // Non-fatal
    }

    const prefs = tenant.preferences || {};
    let closingInstruction = '';
    if (prefs.include_closing !== false && prefs.default_closing) {
      closingInstruction = `\nEnd every email with EXACTLY: "${prefs.default_closing}" followed by "${tenant.name}" on the next line.`;
    }

    let priceInstruction = '';
    if (prefs.price_list && prefs.price_list.length > 0) {
      const col = prefs.default_price_column === 'msrp' ? 'msrp' : 'map';
      const colLabel = col === 'msrp' ? 'MSRP' : 'MAP';
      const items = prefs.price_list.map(p => `  ${p.product} (${p.sku}): ${p[col] || p.map || p.msrp || ''}`).join('\n');
      priceInstruction = `\n\nPRODUCT PRICING — Use ${colLabel} prices unless told otherwise.\n${prefs.price_note || ''}\n${items}\nNever estimate or round prices — use exact values from this list.`;
    }

    const systemPrompt =
      `You are a business development professional drafting outreach emails. ` +
      `You write as ${tenant.name} from ${tenant.company}. ` +
      (contextBlock ? `\n\n${contextBlock}` : '') +
      closingInstruction +
      `\n\nDo NOT include a signature block — it is appended automatically by the system.` +
      priceInstruction +
      `\n\nNEVER use these words: delve, leverage, seamless, transformative.`;

    const emails = [];
    const errors = [];

    // Generate sequentially — one Claude call per prospect
    for (let i = 0; i < opportunity_ids.length; i++) {
      const oppId = opportunity_ids[i];

      try {
        // Load opportunity
        const opp = await getOpportunityById(tenant.id, oppId);
        if (!opp) {
          errors.push({ opportunity_id: oppId, error: 'Opportunity not found' });
          continue;
        }

        // Build prompt
        const outreach = buildOutreachPrompt(opp, tone);

        // Call Claude
        const result = await sendPrompt({
          taskType: TASK_TYPES.ASK_PLEXI,
          systemPrompt,
          messages: [
            {
              role: 'user',
              content:
                `Draft an outreach email for this contact:\n\n` +
                `Name: ${outreach.contact.name}\n` +
                `Title: ${outreach.contact.title || 'N/A'}\n` +
                `Company: ${outreach.contact.company}\n` +
                `Email: ${outreach.contact.email || 'N/A'}\n` +
                `Relationship: ${outreach.relationship.lead_type} (${outreach.relationship.message_count} prior messages)\n` +
                `Industry: ${outreach.context.industry || 'N/A'}\n` +
                `Deal hypothesis: ${outreach.context.deal_hypothesis || 'N/A'}\n\n` +
                outreach.instructions,
            },
          ],
          maxTokens: 1024,
          temperature: 0.7,
          tenantId: tenant.id,
        });

        const content = (result.content || '').trim();

        // Parse subject/body from Claude's response
        const { subject, body: emailBody } = parseEmailContent(content);

        emails.push({
          opportunity_id: oppId,
          contact_name: opp.contact_name || opp.account_name,
          contact_email: opp.contact_email || null,
          account_name: opp.account_name,
          subject,
          body: emailBody,
          raw_content: content,
          warmth_score: opp.warmth_score || 0,
          index: i,
        });
      } catch (err) {
        console.error(`[batch-email] Failed for opportunity ${oppId}:`, err.message);
        errors.push({ opportunity_id: oppId, error: err.message });
      }
    }

    // Powerflow Stage 3: Outreach drafted
    markPowerflowStage(tenant, 3);

    console.log(
      `[batch-email] Generated ${emails.length}/${opportunity_ids.length} emails ` +
      `(${errors.length} errors) for tenant ${tenant.id}`
    );

    return sendJSON(res, 200, {
      emails,
      errors,
      total: opportunity_ids.length,
      generated: emails.length,
      failed: errors.length,
    });
  } catch (err) {
    console.error('[batch-email] Generation error:', err);
    return sendError(res, 500, `Batch generation failed: ${err.message}`);
  }
}

/**
 * Parse subject and body from Claude's email response.
 * Claude formats as "Subject: ...\n\n...body..."
 */
function parseEmailContent(content) {
  const subjectMatch = content.match(/\*{0,2}Subject:?\*{0,2}\s*(.+?)(?:\n|$)/i);
  let subject = '';
  let body = content;

  if (subjectMatch) {
    subject = subjectMatch[1].trim().replace(/^\*{1,2}|\*{1,2}$/g, '');
    const subjectEnd = (subjectMatch.index ?? 0) + subjectMatch[0].length;
    body = content.substring(subjectEnd).trim();
  }

  // Strip leading dividers
  body = body.replace(/^[-*]{3,}\s*\n/, '').trim();

  // Strip trailing commentary (after sign-off)
  const commentaryPatterns = [
    /\n\n(\*{2}(?:Why|Key|How|What|Note|Email|Strategy|Approach)[^\n]*\*{2}[\s\S]*)$/i,
    /\n\n((?:Here'?s?\s+(?:why|how|what))[\s\S]*)$/i,
    /\n\n((?:This (?:email|outreach|approach|draft))[\s\S]*)$/i,
    /\n\n([-*]{3,}\s*\n[\s\S]*)$/,
  ];

  for (const pattern of commentaryPatterns) {
    const match = body.match(pattern);
    if (match) {
      body = body.substring(0, match.index + 1).trim();
      break;
    }
  }

  return { subject, body };
}
