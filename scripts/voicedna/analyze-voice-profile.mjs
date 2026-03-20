/**
 * Voice DNA — Analyze Writing Samples → Generate Voice Profile
 *
 * Loads samples for a profile, sends corpus to Claude Sonnet via LLM Gateway,
 * receives structured Voice DNA JSON, validates, and stores.
 *
 * Usage:
 *   node scripts/voicedna/analyze-voice-profile.mjs --profile-id <uuid>
 *   node scripts/voicedna/analyze-voice-profile.mjs --profile-id <uuid> --dry-run
 *   node scripts/voicedna/analyze-voice-profile.mjs --profile-id <uuid> --limit 3
 *
 * Options:
 *   --profile-id <uuid>  Profile to analyze (required)
 *   --dry-run            Print profile JSON to stdout, don't save to DB
 *   --limit <n>          Analyze only the first N samples
 *
 * Requires PLEXIFY_SANDBOX_TOKEN in .env.local to resolve tenant.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load env before any imports that use process.env
dotenv.config({ path: join(ROOT, '.env.local') });

const { getSamples, updateProfileData, resolveTenantFromToken, logMetric } = await import('../../server/lib/voice-dna/voice-dna-service.js');
const { validateVoiceDNAProfile } = await import('../../server/lib/voice-dna/voice-dna-schemas.js');
const { sendPrompt } = await import('../../server/llm-gateway/index.js');
const { TASK_TYPES } = await import('../../server/llm-gateway/types.js');
const { extractJSON } = await import('../../server/llm-gateway/response-normalizer.js');

// ---------------------------------------------------------------------------
// Analysis System Prompt
// ---------------------------------------------------------------------------

const ANALYSIS_SYSTEM_PROMPT = `You are a computational stylometrics analyst for PlexifyAI. Your job is to analyze a corpus of writing samples from a single author and produce a structured Voice DNA profile in JSON format.

ANALYSIS METHODOLOGY:
1. Read all samples holistically first. Form an impression of the author as a person.
2. Identify vocabulary patterns: preferred terms, avoided terms, signature phrases, jargon comfort level.
3. Measure sentence structure: average length, fragment usage, clause depth, active vs. passive voice.
4. Score 7 voice dimensions on 1-10 scales with supporting evidence from the samples.
5. Identify content-type-specific tone adaptations (how their voice shifts between email vs. proposal vs. social).
6. Extract 2-3 "on-brand" examples (text that most represents their voice) with explanations.
7. Generate 2-3 "off-brand" examples (text that would NOT sound like them) — generate these, don't quote.
8. Identify anti-patterns: things their voice should NEVER do.

WEIGHTING:
- Direct writing samples (emails, posts): 60-70% influence on profile
- LinkedIn About section: 10-15% influence
- LinkedIn posts: 10-15% influence
- LinkedIn recommendations (about the person): 5% influence (perception data, not direct voice)

GLOBAL VOCABULARY CONSTRAINTS (Plexify platform-wide):
Never include these words in any voice profile's preferred terms: "delve," "leverage," "seamless," "transformative"
Always include these in avoidedTerms for every profile generated.

OUTPUT SCHEMA:
Return ONLY valid JSON matching this exact structure (no commentary, no markdown fencing, no preamble):
{
  "meta": {
    "schemaVersion": "1.0",
    "analyzedAt": "<ISO timestamp>",
    "sampleCount": <number>,
    "confidenceScore": <0.0-1.0>
  },
  "persona": {
    "summary": "<2-3 sentence character summary>",
    "archetype": "<archetype label, e.g. 'Creative Tech Sommelier'>",
    "traits": ["<trait1>", "<trait2>", "<trait3>"]
  },
  "voiceDimensions": {
    "formality": { "score": <1-10>, "notes": "<evidence>" },
    "warmth": { "score": <1-10>, "notes": "<evidence>" },
    "directness": { "score": <1-10>, "notes": "<evidence>" },
    "technicalDepth": { "score": <1-10>, "notes": "<evidence>" },
    "enthusiasm": { "score": <1-10>, "notes": "<evidence>" },
    "confidence": { "score": <1-10>, "notes": "<evidence>" },
    "humor": { "score": <1-10>, "notes": "<evidence>" }
  },
  "voiceContrasts": {
    "weAre": ["<descriptor1>", "<descriptor2>", "<descriptor3>"],
    "weAreNot": ["<descriptor1>", "<descriptor2>", "<descriptor3>"]
  },
  "vocabulary": {
    "preferredTerms": ["<term1>", "<term2>"],
    "avoidedTerms": ["delve", "leverage", "seamless", "transformative", "<others>"],
    "signaturePhrases": ["<phrase1>", "<phrase2>"],
    "jargonPolicy": "<description of jargon comfort level>"
  },
  "sentenceStructure": {
    "averageLength": "<short/medium/long>",
    "voice": "<active/passive/mixed>",
    "useContractions": <boolean>,
    "perspective": "<first/second/third>",
    "useFragments": <boolean>
  },
  "toneAdaptations": {
    "email": "<tone notes for email>",
    "social": "<tone notes for social posts>",
    "proposal": "<tone notes for proposals>",
    "meeting-brief": "<tone notes for meeting briefs>",
    "outreach-cold": "<tone notes for cold outreach>",
    "outreach-warm": "<tone notes for warm outreach>",
    "general": "<default tone notes>"
  },
  "examples": {
    "onBrand": [
      { "text": "<quoted text from samples>", "why": "<explanation>" }
    ],
    "offBrand": [
      { "text": "<generated text that would NOT sound like them>", "why": "<explanation>" }
    ]
  },
  "antiPatterns": ["<thing to never do 1>", "<thing to never do 2>"]
}`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const profileIdx = args.indexOf('--profile-id');
const profileId = profileIdx >= 0 ? args[profileIdx + 1] : null;
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

if (!profileId) {
  console.error('ERROR: --profile-id <uuid> is required');
  console.error('Usage: node scripts/voicedna/analyze-voice-profile.mjs --profile-id <uuid> [--dry-run] [--limit N]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Voice DNA — Profile Analysis        ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Resolve tenant
  const token = process.env.PLEXIFY_SANDBOX_TOKEN;
  if (!token) {
    console.error('ERROR: PLEXIFY_SANDBOX_TOKEN not found in .env.local');
    process.exit(1);
  }

  const tenant = await resolveTenantFromToken(token);
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Profile: ${profileId}`);

  // 2. Load samples
  let samples = await getSamples(tenant.id, profileId);
  if (!samples || samples.length === 0) {
    console.error('ERROR: No samples found for this profile. Run ingest first.');
    process.exit(1);
  }

  if (limit && limit > 0) {
    samples = samples.slice(0, limit);
    console.log(`Limited to first ${limit} samples`);
  }

  console.log(`\nLoaded ${samples.length} samples:`);
  samples.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.source_type}/${s.content_type} — ${s.word_count} words (weight: ${s.weight})`);
  });

  // 3. Build corpus for analysis
  const corpus = samples.map((s, i) => {
    const weightNote = s.weight < 1.0 ? ` [WEIGHT: ${s.weight} — this is perception data, not direct voice]` : '';
    return `--- SAMPLE ${i + 1} (${s.source_type} / ${s.content_type})${weightNote} ---\n${s.text}`;
  }).join('\n\n');

  console.log(`\nCorpus: ${corpus.length} chars`);
  console.log('Sending to Claude Sonnet for analysis...\n');

  // 4. Call LLM Gateway
  const startTime = Date.now();

  const result = await sendPrompt({
    taskType: TASK_TYPES.GENERAL,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze the following ${samples.length} writing samples from a single author and produce a Voice DNA profile.\n\n${corpus}`,
      },
    ],
    maxTokens: 4096,
    temperature: 0.3, // Low temp for consistent structured output
    tenantId: tenant.id,
  });

  const elapsed = Date.now() - startTime;
  console.log(`Analysis complete in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Usage: ${result.usage?.inputTokens || '?'} input, ${result.usage?.outputTokens || '?'} output tokens`);

  // 5. Parse JSON from response
  let profileData;
  try {
    profileData = extractJSON(result.content);
  } catch (parseErr) {
    // Fallback: try to find JSON in the response
    const match = result.content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        profileData = JSON.parse(match[0]);
      } catch {
        console.error('ERROR: Failed to parse Voice DNA JSON from Claude response');
        console.error('Raw response (first 500 chars):', result.content.substring(0, 500));
        process.exit(1);
      }
    } else {
      console.error('ERROR: No JSON object found in Claude response');
      console.error('Raw response (first 500 chars):', result.content.substring(0, 500));
      process.exit(1);
    }
  }

  // 6. Validate
  const validation = validateVoiceDNAProfile(profileData);
  if (!validation.valid) {
    console.warn('\nValidation warnings:');
    validation.errors.forEach(e => console.warn(`  ⚠ ${e}`));
    console.warn('\nProfile may be incomplete but will be stored for review.');
  } else {
    console.log('\n✓ Profile validation passed');
  }

  // 7. Print summary
  console.log('\n' + '═'.repeat(50));
  console.log('VOICE DNA PROFILE SUMMARY');
  console.log('═'.repeat(50));

  if (profileData.persona) {
    console.log(`\nArchetype: ${profileData.persona.archetype}`);
    console.log(`Summary: ${profileData.persona.summary}`);
  }

  if (profileData.voiceDimensions) {
    console.log('\nDimensions:');
    for (const [dim, val] of Object.entries(profileData.voiceDimensions)) {
      console.log(`  ${dim}: ${val.score}/10`);
    }
  }

  if (profileData.vocabulary?.signaturePhrases) {
    console.log(`\nSignature phrases: ${profileData.vocabulary.signaturePhrases.join(', ')}`);
  }

  if (profileData.antiPatterns) {
    console.log(`\nAnti-patterns: ${profileData.antiPatterns.join('; ')}`);
  }

  const confidence = profileData.meta?.confidenceScore ?? 'N/A';
  console.log(`\nConfidence: ${confidence}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Full profile JSON:\n');
    console.log(JSON.stringify(profileData, null, 2));
    console.log('\n[DRY RUN] Profile NOT saved. Remove --dry-run to persist.');
    process.exit(0);
  }

  // 8. Save to DB
  console.log('\nSaving profile data...');
  const confidenceScore = typeof confidence === 'number' ? confidence : null;
  const updated = await updateProfileData(tenant.id, profileId, profileData, 'pending_approval', confidenceScore);
  console.log(`  ✓ Profile saved (status: pending_approval)`);

  // 9. Log metric
  try {
    await logMetric(tenant.id, profileId, 'analysis_run', {
      sample_count: samples.length,
      elapsed_ms: elapsed,
      confidence: confidence,
      validation_errors: validation.errors,
      model: result.model || 'unknown',
      usage: result.usage,
    });
  } catch {
    // Non-fatal
  }

  console.log('\n═'.repeat(50));
  console.log(`Profile ID: ${profileId}`);
  console.log('Status: pending_approval');
  console.log(`Next: approve with PUT /api/voice-dna/profiles/${profileId}/approve`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
