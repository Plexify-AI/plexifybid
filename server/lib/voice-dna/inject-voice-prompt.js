/**
 * Voice DNA Prompt Injection — pure function that converts an active
 * Voice DNA profile into a system prompt block for agent injection.
 *
 * Returns null when no active profile exists (agents work normally).
 */

import { getActiveProfile } from './voice-dna-service.js';

/**
 * Build a Voice DNA system prompt block for the given tenant and content type.
 *
 * @param {string} tenantId - UUID of the tenant
 * @param {string} contentType - One of: general, email, outreach-cold, outreach-warm,
 *                               proposal, social, meeting-brief
 * @returns {Promise<string|null>} Formatted prompt block, or null if no active profile
 */
export async function injectVoicePrompt(tenantId, contentType = 'general') {
  let profile;
  try {
    profile = await getActiveProfile(tenantId);
  } catch (err) {
    // Non-fatal — if we can't fetch the profile, agents work normally
    console.error('[voice-dna] Failed to fetch active profile:', err.message);
    return null;
  }

  if (!profile || !profile.profile_data) {
    return null;
  }

  return formatVoiceBlock(profile.profile_data, contentType);
}

/**
 * Convert a Voice DNA JSON profile into a formatted system prompt block.
 *
 * @param {object} profileData - The full Voice DNA JSON
 * @param {string} contentType - Content type for tone adaptation lookup
 * @returns {string} Formatted prompt block
 */
function formatVoiceBlock(profileData, contentType) {
  const lines = ['--- VOICE DNA ---'];

  // Persona
  const persona = profileData.persona;
  if (persona) {
    lines.push(`Persona: ${persona.archetype || 'Unknown'} — ${persona.summary || ''}`);
    if (persona.traits && persona.traits.length > 0) {
      lines.push(`Traits: ${persona.traits.join(', ')}`);
    }
  }

  // Voice Dimensions
  const dims = profileData.voiceDimensions;
  if (dims) {
    const dimEntries = Object.entries(dims)
      .map(([key, val]) => `${formatDimName(key)} ${val.score}/10`)
      .join(', ');
    lines.push(`Dimensions: ${dimEntries}`);
  }

  // Voice Contrasts (We Are / We Are Not)
  const contrasts = profileData.voiceContrasts;
  if (contrasts) {
    if (contrasts.weAre && contrasts.weAre.length > 0) {
      lines.push(`We Are: ${contrasts.weAre.join(', ')}`);
    }
    if (contrasts.weAreNot && contrasts.weAreNot.length > 0) {
      lines.push(`We Are Not: ${contrasts.weAreNot.join(', ')}`);
    }
  }

  // Vocabulary
  const vocab = profileData.vocabulary;
  if (vocab) {
    if (vocab.preferredTerms && vocab.preferredTerms.length > 0) {
      lines.push(`Preferred vocabulary: ${vocab.preferredTerms.join(', ')}`);
    }
    if (vocab.avoidedTerms && vocab.avoidedTerms.length > 0) {
      lines.push(`Avoided vocabulary: ${vocab.avoidedTerms.join(', ')}`);
    }
    if (vocab.signaturePhrases && vocab.signaturePhrases.length > 0) {
      lines.push(`Signature phrases (preserve exactly): ${vocab.signaturePhrases.map(p => `"${p}"`).join(', ')}`);
    }
    if (vocab.jargonPolicy) {
      lines.push(`Jargon policy: ${vocab.jargonPolicy}`);
    }
  }

  // Sentence Structure
  const ss = profileData.sentenceStructure;
  if (ss) {
    const parts = [];
    if (ss.averageLength) parts.push(`avg length: ${ss.averageLength}`);
    if (ss.voice) parts.push(`voice: ${ss.voice}`);
    if (ss.useContractions !== undefined) parts.push(`contractions: ${ss.useContractions ? 'yes' : 'no'}`);
    if (ss.perspective) parts.push(`perspective: ${ss.perspective}`);
    if (ss.useFragments !== undefined) parts.push(`fragments: ${ss.useFragments ? 'yes' : 'no'}`);
    if (parts.length > 0) {
      lines.push(`Sentence style: ${parts.join(', ')}`);
    }
  }

  // Tone Adaptation for the specific content type
  const adaptations = profileData.toneAdaptations;
  if (adaptations) {
    const adaptation = adaptations[contentType] || adaptations.general;
    if (adaptation) {
      lines.push(`Tone for ${contentType}: ${typeof adaptation === 'string' ? adaptation : JSON.stringify(adaptation)}`);
    }
  }

  // Anti-patterns
  const anti = profileData.antiPatterns;
  if (anti && anti.length > 0) {
    lines.push(`Anti-patterns (NEVER do): ${anti.join('; ')}`);
  }

  lines.push('--- END VOICE DNA ---');

  return lines.join('\n');
}

/**
 * Convert camelCase dimension name to human-readable.
 */
function formatDimName(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
