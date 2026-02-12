/**
 * Tool: draft_outreach
 *
 * Generate a personalized outreach email for a specific prospect
 * based on their profile, pain points, and warm intro paths.
 * Saves the draft to the outreach_drafts table.
 */

import {
  getProspectByRef,
  getContactByRef,
  getCaseStudyByRef,
  getConnections,
  createOutreachDraft,
} from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// Claude tool definition
// ---------------------------------------------------------------------------

export const definition = {
  name: 'draft_outreach',
  description:
    'Generate a personalized outreach email for a specific AEC prospect. ' +
    'Uses their project profile, pain points, contact info, and relevant case studies ' +
    'to create a compelling, construction-industry-specific email. ' +
    'Use this when the user asks to draft an email, write outreach, or contact a prospect.',
  input_schema: {
    type: 'object',
    properties: {
      prospect_ref_id: {
        type: 'string',
        description: 'The ref_id of the prospect (e.g. "proj-001")',
      },
      tone: {
        type: 'string',
        description:
          'Email tone: "professional", "warm", "direct", or "executive". Default: "professional"',
        enum: ['professional', 'warm', 'direct', 'executive'],
      },
      focus: {
        type: 'string',
        description:
          'What to emphasize: "pain_points", "roi", "relationship", or "urgency"',
        enum: ['pain_points', 'roi', 'relationship', 'urgency'],
      },
    },
    required: ['prospect_ref_id'],
  },
};

// ---------------------------------------------------------------------------
// Executor — fetches prospect data, builds context for email generation
// ---------------------------------------------------------------------------

export async function execute(input, tenantId) {
  const { prospect_ref_id, tone = 'professional', focus = 'roi' } = input;

  // Fetch prospect
  let prospect;
  try {
    prospect = await getProspectByRef(tenantId, prospect_ref_id);
  } catch (err) {
    return { error: `Prospect not found: ${prospect_ref_id}` };
  }

  // Fetch related contact
  let contact = null;
  if (prospect.primary_contact_ref) {
    try {
      contact = await getContactByRef(tenantId, prospect.primary_contact_ref);
    } catch {
      // Contact not found — not fatal
    }
  }

  // Fetch relevant case study
  let caseStudy = null;
  if (prospect.relevant_case_study_ref) {
    try {
      caseStudy = await getCaseStudyByRef(tenantId, prospect.relevant_case_study_ref);
    } catch {
      // Case study not found — not fatal
    }
  }

  // Fetch connections for warm intro paths
  let connections = [];
  try {
    connections = await getConnections(tenantId);
  } catch {
    // Connections not available — not fatal
  }

  // Find warm intro path if one exists
  const warmIntro = contact?.linkedin_mutual_name
    ? connections.find(
        (c) =>
          c.name.toLowerCase().includes(contact.linkedin_mutual_name.toLowerCase()) ||
          (contact.linkedin_mutual_name &&
            c.can_intro_to &&
            Array.isArray(c.can_intro_to))
      )
    : null;

  // Build the context object that Claude will use to generate the email
  // (This is returned as structured data — Claude's outer conversation
  //  will use this to compose the actual email text in its response)
  const emailContext = {
    prospect: {
      project_name: prospect.project_name,
      gc_name: prospect.gc_name,
      owner: prospect.owner,
      address: prospect.address,
      sector: prospect.sector,
      phase: prospect.phase,
      estimated_value: prospect.estimated_value,
      warmth_score: prospect.warmth_score,
      pain_points: prospect.pain_points,
    },
    contact: contact
      ? {
          name: contact.name,
          title: contact.title,
          company: contact.company,
          email: contact.email,
          decision_maker: contact.decision_maker,
          budget_authority: contact.budget_authority,
          recent_engagements: contact.engagements,
        }
      : null,
    case_study: caseStudy
      ? {
          client_name: caseStudy.client_name,
          project_name: caseStudy.project_name,
          gc: caseStudy.gc,
          service: caseStudy.service,
          roi_display: caseStudy.roi_display,
          roi_type: caseStudy.roi_type,
          roi_explanation: caseStudy.roi_explanation,
        }
      : null,
    warm_intro: warmIntro
      ? {
          name: warmIntro.name,
          title: warmIntro.title,
          company: warmIntro.company,
          relationship_strength: warmIntro.relationship_strength,
        }
      : contact?.linkedin_mutual_name
        ? { name: contact.linkedin_mutual_name, company: contact.linkedin_mutual_company }
        : null,
    requested_tone: tone,
    requested_focus: focus,
  };

  // Save a placeholder draft (Claude's outer loop will fill the actual email)
  try {
    await createOutreachDraft(tenantId, {
      prospectId: prospect.id,
      subject: `Outreach draft for ${prospect.project_name}`,
      body: '(Draft pending — Claude will generate)',
      tone,
    });
  } catch (err) {
    console.error('[draft_outreach] Failed to save draft:', err.message);
  }

  return {
    email_context: emailContext,
    instructions:
      'Use this context to compose a personalized outreach email. ' +
      'Include a compelling subject line. ' +
      'Reference the specific project, pain points, and relevant case study ROI. ' +
      'If a warm intro path exists, suggest mentioning the mutual connection. ' +
      `Tone: ${tone}. Focus: ${focus}. ` +
      'Keep it under 200 words — AEC executives skim.',
  };
}
