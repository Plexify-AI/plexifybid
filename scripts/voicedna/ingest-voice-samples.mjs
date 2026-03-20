/**
 * Voice DNA — Ingest Writing Samples
 *
 * Reads a JSON file of writing samples, validates them, creates a draft
 * Voice DNA profile, and stores samples in Supabase.
 *
 * Usage:
 *   node scripts/voicedna/ingest-voice-samples.mjs --input data/voicedna/ben-samples.json
 *
 * Options:
 *   --input <path>    Path to JSON samples file (required)
 *   --dry-run         Validate only, don't write to DB
 *
 * Requires PLEXIFY_SANDBOX_TOKEN in .env.local to resolve tenant.
 */

import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load env before any imports that use process.env
dotenv.config({ path: join(ROOT, '.env.local') });

const { createProfile, saveSamples, resolveTenantFromToken } = await import('../../server/lib/voice-dna/voice-dna-service.js');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : null;

if (!inputPath) {
  console.error('ERROR: --input <path> is required');
  console.error('Usage: node scripts/voicedna/ingest-voice-samples.mjs --input data/voicedna/ben-samples.json');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Voice DNA — Sample Ingestion        ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Read + parse input file
  const absPath = resolve(ROOT, inputPath);
  console.log(`Reading samples from: ${absPath}`);

  let input;
  try {
    input = JSON.parse(readFileSync(absPath, 'utf-8'));
  } catch (err) {
    console.error(`ERROR: Failed to read/parse ${absPath}: ${err.message}`);
    process.exit(1);
  }

  const { profileName, ownerName, samples } = input;
  if (!profileName || !ownerName) {
    console.error('ERROR: JSON must have "profileName" and "ownerName" fields');
    process.exit(1);
  }
  if (!Array.isArray(samples) || samples.length === 0) {
    console.error('ERROR: JSON must have a non-empty "samples" array');
    process.exit(1);
  }

  // 2. Validate samples
  console.log(`\nValidating ${samples.length} samples...`);

  const errors = [];
  const contentTypes = new Set();

  if (samples.length < 5) {
    errors.push(`Minimum 5 samples required, got ${samples.length}`);
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s.sourceType) errors.push(`Sample ${i + 1}: missing sourceType`);
    if (!s.contentType) errors.push(`Sample ${i + 1}: missing contentType`);
    if (!s.text || typeof s.text !== 'string') {
      errors.push(`Sample ${i + 1}: missing or invalid text`);
      continue;
    }

    const wordCount = s.text.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 20) {
      errors.push(`Sample ${i + 1}: too short (${wordCount} words, minimum 20)`);
    }
    if (wordCount > 2000) {
      errors.push(`Sample ${i + 1}: too long (${wordCount} words, maximum 2000)`);
    }

    contentTypes.add(s.contentType);

    console.log(`  Sample ${i + 1}: ${s.sourceType}/${s.contentType} — ${wordCount} words, weight ${s.weight ?? 1.0}`);
  }

  if (contentTypes.size < 2) {
    errors.push(`Need at least 2 content types, got ${contentTypes.size}: ${[...contentTypes].join(', ')}`);
  }

  if (errors.length > 0) {
    console.error('\nValidation failed:');
    errors.forEach(e => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  console.log(`\n✓ Validation passed — ${samples.length} samples, ${contentTypes.size} content types`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would create profile and save samples. Exiting.');
    process.exit(0);
  }

  // 3. Resolve tenant from sandbox token
  const token = process.env.PLEXIFY_SANDBOX_TOKEN;
  if (!token) {
    console.error('ERROR: PLEXIFY_SANDBOX_TOKEN not found in .env.local');
    process.exit(1);
  }

  console.log('\nResolving tenant from sandbox token...');
  const tenant = await resolveTenantFromToken(token);
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // 4. Create draft profile
  console.log(`\nCreating draft profile: "${profileName}"...`);
  const profile = await createProfile(tenant.id, { profileName, ownerName });
  console.log(`  Profile ID: ${profile.id}`);

  // 5. Save samples
  console.log(`\nSaving ${samples.length} samples...`);
  const saved = await saveSamples(tenant.id, profile.id, samples);
  console.log(`  ✓ ${saved.length} samples saved`);

  console.log('\n═'.repeat(50));
  console.log(`Profile ID: ${profile.id}`);
  console.log('Status: draft');
  console.log('Next: run analyze-voice-profile.mjs --profile-id ' + profile.id);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
