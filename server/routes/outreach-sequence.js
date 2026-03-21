/**
 * PlexifyAEC — Outreach Sequence Agent
 *
 * POST /api/outreach-sequence
 * Accepts: { opportunity_id: string, touches?: number, duration_days?: number }
 * Returns: { sequence: Array, contact: object, usage: object }
 *
 * Generates a multi-touch outreach cadence adapted to warm vs. cold contacts.
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { extractJSON } from '../llm-gateway/response-normalizer.js';
import { getOpportunityById, logUsageEvent } from '../lib/supabase.js';
import { markPowerflowStage } from './powerflow.js';
import { injectVoicePrompt } from '../lib/voice-dna/inject-voice-prompt.js';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleGenerateSequence(req, res, body) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { opportunity_id, touches = 4, duration_days = 14 } = body || {};

  if (!opportunity_id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing "opportunity_id" field' }));
  }

  try {
    // Fetch opportunity
    let opp;
    try {
      opp = await getOpportunityById(tenant.id, opportunity_id);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Opportunity not found' }));
    }

    const ed = opp.enrichment_data || {};
    const isWarm = ed.warm_status === 'Y' || (ed.message_count && ed.message_count > 0);
    const hasEmail = !!opp.contact_email;
    const hasLinkedIn = !!ed.linkedin_url;

    // Determine primary channel
    let primaryChannel;
    if (hasEmail) primaryChannel = 'Email';
    else if (hasLinkedIn) primaryChannel = 'LinkedIn';
    else primaryChannel = 'Email'; // default

    // Build adaptive system prompt
    let relationshipContext;
    if (isWarm) {
      relationshipContext = `This contact has an existing relationship (${ed.message_count || 0} prior LinkedIn messages, warm status: ${ed.warm_status}).
Touch 1: Reference past interaction, propose catch-up or value share
Touch 2: Share relevant industry insight specific to their ${ed.industry || 'industry'}
Touch 3: Specific meeting ask with proposed time
Touch 4: Gentle follow-up, no pressure — offer alternative resource

Tone: Familiar, direct. You KNOW this person. Reference shared history.`;
    } else {
      relationshipContext = `This is a cold prospect. No prior relationship. Lead type: ${ed.lead_type || 'cold'}.
Touch 1: Insight-led opener — share something relevant to their ${ed.industry || 'industry'}
Touch 2: Social proof or case study relevant to their vertical
Touch 3: Direct value proposition + specific meeting ask
Touch 4: Break-up email — last chance, offer alternative resource

Tone: Professional, value-first. No familiarity. Earn attention with insight.`;
    }

    let systemPrompt = `You are a B2B sales outreach specialist generating a ${touches}-touch outreach cadence over ${duration_days} days.

CONTACT:
- Name: ${opp.contact_name || 'Unknown'}
- Title: ${opp.contact_title || 'Unknown'}
- Company: ${opp.account_name}
- Email: ${opp.contact_email || 'not available'}
- LinkedIn: ${ed.linkedin_url || 'not available'}
- Industry: ${ed.industry || 'Unknown'}
- Region: ${ed.region || 'Unknown'}
- Stage: ${opp.stage}
${opp.deal_hypothesis ? `- Hypothesis: ${opp.deal_hypothesis}` : ''}
${ed.won_leads ? `- Won Leads: ${ed.won_leads}` : ''}
${ed.open_leads ? `- Open Leads: ${ed.open_leads}` : ''}

RELATIONSHIP:
${relationshipContext}

PRIMARY CHANNEL: ${primaryChannel}
${hasEmail && hasLinkedIn ? 'Both email and LinkedIn are available. Mix channels across touches.' : ''}

RULES:
- Use the contact's REAL name and company — no placeholders
- Each touch should be self-contained (they might not see previous touches)
- Include a compelling subject line for emails
- Keep each message under 150 words
- Space touches evenly across ${duration_days} days
- Never use: leverage, seamless, transformative, delve

Return ONLY valid JSON (no markdown, no code fences) matching this schema:
[
  {
    "day": number,
    "channel": "Email" | "LinkedIn",
    "subject": "string (email subject line, omit for LinkedIn)",
    "body": "string (the full message text)",
    "intent": "string (1-line description of this touch's goal)"
  }
]`;

    // Voice DNA injection — prepend voice style block if active profile exists
    try {
      const voiceBlock = await injectVoicePrompt(tenant.id, isWarm ? 'outreach-warm' : 'outreach-cold');
      if (voiceBlock) systemPrompt = voiceBlock + '\n\n' + systemPrompt;
    } catch {
      // Non-fatal — proceed without voice styling
    }

    const result = await sendPrompt({
      taskType: TASK_TYPES.OUTREACH_GENERATION,
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate a ${touches}-touch outreach sequence for ${opp.contact_name || opp.account_name} over ${duration_days} days.`,
        },
      ],
      maxTokens: 4096,
      temperature: 0.8,
      tenantId: tenant.id,
    });

    // Parse JSON from response
    let sequence;
    try {
      sequence = extractJSON(result.content);
      if (!Array.isArray(sequence)) {
        // Try wrapping in array if it's a single object
        if (typeof sequence === 'object' && sequence.day) {
          sequence = [sequence];
        } else {
          throw new Error('Response is not an array');
        }
      }
    } catch (parseErr) {
      // Fallback: try to extract JSON array from text
      const match = result.content.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          sequence = JSON.parse(match[0]);
        } catch {
          console.error('[outreach-sequence] JSON parse fallback failed');
          sequence = [];
        }
      } else {
        console.error('[outreach-sequence] No JSON array found in response');
        sequence = [];
      }
    }

    // Validate structure
    sequence = sequence.map((touch, i) => ({
      day: touch.day || i + 1,
      channel: touch.channel || primaryChannel,
      subject: touch.subject || null,
      body: touch.body || '',
      intent: touch.intent || '',
    }));

    // Log usage
    logUsageEvent(tenant.id, 'outreach_sequence_generated', {
      opportunity_id,
      touches: sequence.length,
      contact: opp.contact_name,
      is_warm: isWarm,
    }).catch(() => {});

    // Powerflow Stage 3: Outreach
    markPowerflowStage(tenant, 3);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      sequence,
      contact: {
        name: opp.contact_name,
        title: opp.contact_title,
        company: opp.account_name,
        email: opp.contact_email,
        is_warm: isWarm,
        channel: primaryChannel,
      },
      usage: result.usage,
    }));
  } catch (err) {
    console.error('[outreach-sequence] Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to generate outreach sequence',
      details: err.message,
    }));
  }
}
