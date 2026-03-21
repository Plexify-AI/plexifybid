/**
 * Voice DNA JSON schema validation (plain JS — no Zod dependency).
 *
 * Validates the structured Voice DNA profile returned by the analysis LLM.
 */

const REQUIRED_DIMENSIONS = [
  'formality',
  'warmth',
  'directness',
  'technicalDepth',
  'enthusiasm',
  'confidence',
  'humor',
];

/**
 * Validate a Voice DNA profile JSON object.
 * @param {object} data - The raw profile JSON from the analysis LLM
 * @returns {{ valid: boolean, errors: string[], data: object|null }}
 */
export function validateVoiceDNAProfile(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Profile data must be a non-null object'], data: null };
  }

  // meta
  if (!data.meta || typeof data.meta !== 'object') {
    errors.push('Missing or invalid "meta" section');
  }

  // persona
  if (!data.persona || typeof data.persona !== 'object') {
    errors.push('Missing or invalid "persona" section');
  } else {
    if (!data.persona.summary) errors.push('persona.summary is required');
    if (!data.persona.archetype) errors.push('persona.archetype is required');
  }

  // voiceDimensions — must have all 7 with score 1-10
  if (!data.voiceDimensions || typeof data.voiceDimensions !== 'object') {
    errors.push('Missing or invalid "voiceDimensions" section');
  } else {
    for (const dim of REQUIRED_DIMENSIONS) {
      const entry = data.voiceDimensions[dim];
      if (!entry || typeof entry !== 'object') {
        errors.push(`voiceDimensions.${dim} is missing`);
      } else if (typeof entry.score !== 'number' || entry.score < 1 || entry.score > 10) {
        errors.push(`voiceDimensions.${dim}.score must be 1-10, got ${entry.score}`);
      }
    }
  }

  // vocabulary
  if (!data.vocabulary || typeof data.vocabulary !== 'object') {
    errors.push('Missing or invalid "vocabulary" section');
  } else {
    if (!Array.isArray(data.vocabulary.preferredTerms)) {
      errors.push('vocabulary.preferredTerms must be an array');
    }
    if (!Array.isArray(data.vocabulary.avoidedTerms)) {
      errors.push('vocabulary.avoidedTerms must be an array');
    }
    // Check global forbidden words are present
    const avoided = (data.vocabulary.avoidedTerms || []).map(t => t.toLowerCase());
    for (const forbidden of ['delve', 'leverage', 'seamless', 'transformative']) {
      if (!avoided.includes(forbidden)) {
        errors.push(`vocabulary.avoidedTerms must include "${forbidden}"`);
      }
    }
  }

  // sentenceStructure
  if (!data.sentenceStructure || typeof data.sentenceStructure !== 'object') {
    errors.push('Missing or invalid "sentenceStructure" section');
  }

  // toneAdaptations
  if (!data.toneAdaptations || typeof data.toneAdaptations !== 'object') {
    errors.push('Missing or invalid "toneAdaptations" section');
  }

  // examples
  if (!data.examples || typeof data.examples !== 'object') {
    errors.push('Missing or invalid "examples" section');
  } else {
    if (!Array.isArray(data.examples.onBrand) || data.examples.onBrand.length === 0) {
      errors.push('examples.onBrand must be a non-empty array');
    }
    if (!Array.isArray(data.examples.offBrand) || data.examples.offBrand.length === 0) {
      errors.push('examples.offBrand must be a non-empty array');
    }
  }

  // antiPatterns
  if (!Array.isArray(data.antiPatterns) || data.antiPatterns.length === 0) {
    errors.push('antiPatterns must be a non-empty array');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null,
  };
}

export { REQUIRED_DIMENSIONS };
