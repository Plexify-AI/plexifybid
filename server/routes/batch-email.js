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

import { getSupabase, getOpportunityById } from '../lib/supabase.js';
import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { injectVoicePrompt } from '../lib/voice-dna/inject-voice-prompt.js';
import { markPowerflowStage } from './powerflow.js';

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

  const instructions =
    `${channelInstructions} ` +
    `Use the contact's real name (${opportunity.contact_name || opportunity.account_name}). ` +
    'Reference their company and role. ' +
    (ed.industry ? `Their industry is ${ed.industry}. ` : '') +
    'Make it specific and actionable — no boilerplate. ' +
    'NEVER use these words: delve, leverage, seamless, transformative. ' +
    'Format the email with Subject: on the first line, then the body.';

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
    // Load Voice DNA
    let voiceBlock = '';
    try {
      voiceBlock = await injectVoicePrompt(tenant.id, 'outreach') || '';
    } catch {
      // Non-fatal
    }

    const systemPrompt =
      `You are a business development professional drafting outreach emails. ` +
      `You write as ${tenant.name} from ${tenant.company}. ` +
      (voiceBlock ? `\n\n${voiceBlock}` : '') +
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
