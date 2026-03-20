/**
 * Voice DNA — Pipeline Runner
 *
 * Orchestrates: ingest → analyze in sequence.
 * Single command to go from raw samples JSON to a Voice DNA profile.
 *
 * Usage:
 *   node scripts/voicedna/run-voice-analysis.mjs --input data/voicedna/ben-samples.json --dry-run
 *   node scripts/voicedna/run-voice-analysis.mjs --input data/voicedna/ben-samples.json
 *   node scripts/voicedna/run-voice-analysis.mjs --input data/voicedna/ben-samples.json --limit 3
 *
 * Options:
 *   --input <path>   Path to JSON samples file (required)
 *   --dry-run        Ingest validates only; analysis prints profile but doesn't save
 *   --limit <n>      Analyze only the first N samples
 */

import { execFileSync } from 'child_process';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load env to resolve tenant for profile ID extraction
dotenv.config({ path: join(ROOT, '.env.local') });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : null;
const limitIdx = args.indexOf('--limit');
const limitVal = limitIdx >= 0 ? args[limitIdx + 1] : null;

if (!inputPath) {
  console.error('ERROR: --input <path> is required');
  console.error('Usage: node scripts/voicedna/run-voice-analysis.mjs --input data/voicedna/ben-samples.json [--dry-run] [--limit N]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

console.log('╔══════════════════════════════════════╗');
console.log('║  Voice DNA — Full Analysis Pipeline  ║');
console.log('╚══════════════════════════════════════╝\n');

if (dryRun) {
  console.log('[DRY RUN MODE — no data will be persisted]\n');
}

// Step 1: Ingest
console.log('▶ Step 1: Ingest Samples');
console.log('─'.repeat(50));

const ingestArgs = ['--input', inputPath];
if (dryRun) ingestArgs.push('--dry-run');

try {
  const output = execFileSync('node', [join(__dirname, 'ingest-voice-samples.mjs'), ...ingestArgs], {
    stdio: dryRun ? 'inherit' : 'pipe',
    cwd: ROOT,
    encoding: 'utf-8',
  });

  if (dryRun) {
    console.log('\n✓ Step 1 complete (dry-run — no profile created)\n');
    console.log('═'.repeat(50));
    console.log('Pipeline complete (dry-run). To analyze, run without --dry-run first.');
    process.exit(0);
  }

  // Extract profile ID from ingestion output
  const profileIdMatch = output.match(/Profile ID:\s*([0-9a-f-]+)/i);
  if (!profileIdMatch) {
    console.log(output);
    console.error('ERROR: Could not extract Profile ID from ingestion output');
    process.exit(1);
  }

  const profileId = profileIdMatch[1];
  console.log(output);
  console.log(`✓ Step 1 complete — Profile ID: ${profileId}\n`);

  // Step 2: Analyze
  console.log('▶ Step 2: Analyze Voice Profile');
  console.log('─'.repeat(50));

  const analyzeArgs = ['--profile-id', profileId];
  if (limitVal) analyzeArgs.push('--limit', limitVal);

  execFileSync('node', [join(__dirname, 'analyze-voice-profile.mjs'), ...analyzeArgs], {
    stdio: 'inherit',
    cwd: ROOT,
  });

  console.log('\n✓ Step 2 complete\n');
  console.log('═'.repeat(50));
  console.log('Pipeline complete.');
  console.log(`Profile ID: ${profileId}`);
  console.log('Status: pending_approval');
  console.log(`Approve: PUT /api/voice-dna/profiles/${profileId}/approve`);

} catch (err) {
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  console.error(`\n✗ Pipeline failed with exit code ${err.status}`);
  process.exit(1);
}
