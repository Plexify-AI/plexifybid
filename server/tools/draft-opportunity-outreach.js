/**
 * Tool: draft_opportunity_outreach
 *
 * Generate a personalized outreach message for an opportunity.
 * Adapts tone and channel based on enrichment_data:
 *   - Warm contacts (LinkedIn history): familiar, relationship-based
 *   - Cold leads with email: professional, insight-led
 *   - Cold leads without email: LinkedIn connection request
 */

import { getOpportunityById, getTenantById } from '../lib/supabase.js';

export const definition = {
  name: 'draft_opportunity_outreach',
  description:
    'Generate a personalized outreach message for a specific opportunity. ' +
    'Adapts tone based on relationship history: warm contacts get familiar outreach ' +
    'referencing past interactions, cold leads get insight-led professional emails. ' +
    'Use when the user asks to draft an email, write a message, or reach out to a specific contact.',
  input_schema: {
    type: 'object',
    properties: {
      opportunity_id: {
        type: 'string',
        description: 'UUID of the opportunity to draft outreach for',
      },
      contact_name: {
        type: 'string',
        description: 'Name of the contact (used to find the opportunity if ID not provided)',
      },
      tone: {
        type: 'string',
        description: 'Override tone: "professional", "warm", "direct", "executive". Auto-detected if omitted.',
        enum: ['professional', 'warm', 'direct', 'executive'],
      },
      channel: {
        type: 'string',
        description: 'Override channel: "email" or "linkedin". Auto-detected based on available data.',
        enum: ['email', 'linkedin'],
      },
    },
  },
};

export async function execute(input, tenantId) {
  const { opportunity_id, contact_name, tone: toneOverride, channel: channelOverride } = input;

  let opportunity;

  // Find by ID or by contact name
  if (opportunity_id) {
    try {
      opportunity = await getOpportunityById(tenantId, opportunity_id);
    } catch {
      return { error: `Opportunity not found: ${opportunity_id}` };
    }
  } else if (contact_name) {
    // Search by name
    const { getOpportunities } = await import('../lib/supabase.js');
    const all = await getOpportunities(tenantId, { limit: 2000 });
    const nameLC = contact_name.toLowerCase();
    opportunity = all.find(o =>
      (o.contact_name && o.contact_name.toLowerCase().includes(nameLC)) ||
      (o.account_name && o.account_name.toLowerCase().includes(nameLC))
    );
    if (!opportunity) {
      return { error: `No opportunity found matching: ${contact_name}` };
    }
  } else {
    return { error: 'Provide either opportunity_id or contact_name' };
  }

  const ed = opportunity.enrichment_data || {};
  const isWarm = ed.warm_status === 'Y' || (ed.message_count && ed.message_count > 0);
  const hasEmail = !!opportunity.contact_email;
  const hasLinkedIn = !!ed.linkedin_url;

  // Auto-detect tone
  const tone = toneOverride || (isWarm ? 'warm' : 'professional');

  // Auto-detect channel
  let channel = channelOverride;
  if (!channel) {
    if (hasEmail) channel = 'email';
    else if (hasLinkedIn) channel = 'linkedin';
    else channel = 'email'; // default
  }

  // Build context for Claude to generate the outreach
  const outreachContext = {
    contact: {
      name: opportunity.contact_name,
      title: opportunity.contact_title,
      email: opportunity.contact_email,
      company: opportunity.account_name,
    },
    relationship: {
      is_warm: isWarm,
      warm_status: ed.warm_status || 'none',
      message_count: ed.message_count || 0,
      linkedin_url: ed.linkedin_url || null,
      lead_type: ed.lead_type || (isWarm ? 'warm' : 'cold'),
    },
    context: {
      industry: ed.industry || null,
      region: ed.region || null,
      deal_hypothesis: opportunity.deal_hypothesis,
      stage: opportunity.stage,
      source: ed.source || 'unknown',
      won_leads: ed.won_leads || 0,
      open_leads: ed.open_leads || 0,
    },
    requested_tone: tone,
    requested_channel: channel,
  };

  // Build channel-specific instructions
  let channelInstructions;
  if (channel === 'linkedin') {
    channelInstructions = isWarm
      ? 'Write a LinkedIn message referencing your existing conversation history (' +
        `${ed.message_count} prior messages). Be familiar but professional. ` +
        'Keep under 300 characters for LinkedIn InMail. Reference a specific past interaction.'
      : 'Write a LinkedIn connection request message. Lead with shared context ' +
        '(industry, mutual interests). Keep under 300 characters. No hard sell.';
  } else {
    channelInstructions = isWarm
      ? 'Write an email referencing your existing relationship (' +
        `${ed.message_count} prior LinkedIn messages). Include a subject line. ` +
        'Tone: familiar, direct. Suggest a specific next step (call, coffee, meeting). Under 150 words.'
      : 'Write a cold outreach email. Lead with an insight relevant to their ' +
        `${ed.industry || 'industry'}. Include a compelling subject line. ` +
        'No generic marketing speak. Specific value proposition. Under 150 words.';
  }

  // Fetch tenant for sender name + email preferences
  let tenant;
  try { tenant = await getTenantById(tenantId); } catch { tenant = null; }
  const prefs = tenant?.preferences || {};
  const senderName = tenant?.name || '';

  let closingInstruction = '';
  if (prefs.include_closing !== false && prefs.default_closing && senderName) {
    closingInstruction = `End the email with EXACTLY: "${prefs.default_closing}" followed by "${senderName}" on the next line. `;
  } else if (senderName) {
    closingInstruction = `Sign the email as ${senderName}. `;
  }

  return {
    outreach_context: outreachContext,
    instructions:
      `${channelInstructions} ` +
      `Use the contact's real name (${opportunity.contact_name || opportunity.account_name}). ` +
      'Reference their company and role. ' +
      (ed.industry ? `Their industry is ${ed.industry}. ` : '') +
      'Make it specific and actionable — no boilerplate. ' +
      closingInstruction +
      'Do NOT include a signature block — it is appended automatically by the system.',
  };
}
