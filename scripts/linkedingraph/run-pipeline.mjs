/**
 * Pipeline runner — executes Steps 0a → 0b → 0c → 1 → 2 → 3 sequentially.
 * Usage: node scripts/linkedingraph/run-pipeline.mjs [--skip-llm] [--export-dir <path>] [--owner-url <url>]
 *
 * Options:
 *   --skip-llm         Skip the LLM classification step (use existing results)
 *   --skip-warmth      Skip warmth extraction step (use existing signals)
 *   --export-dir <path> LinkedIn Data Export directory (for warmth extraction)
 *   --owner-url <url>   Owner LinkedIn URL (for warmth extraction)
 *   --from <step>       Start from a specific step (0a, 0b, 0c, 1, 2, 3)
 */

import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const steps = [
  { id: '0a', name: 'Extract Untagged', script: 'extract-untagged.mjs' },
  { id: '0b', name: 'LLM Classification', script: 'classify-companies-llm.mjs' },
  { id: '0c', name: 'Merge Classifications', script: 'merge-classifications.mjs' },
  { id: '1',  name: 'Classification Report', script: 'classification-report.mjs' },
  { id: '2',  name: 'Warmth Extraction', script: 'extract-warmth-signals.mjs', needsArgs: true },
  { id: '3',  name: 'Review Queue', script: 'generate-review-queue.mjs' },
];

const args = process.argv.slice(2);
const skipLLM = args.includes('--skip-llm');
const skipWarmth = args.includes('--skip-warmth');
const exportDirIdx = args.indexOf('--export-dir');
const ownerUrlIdx = args.indexOf('--owner-url');
const exportDir = exportDirIdx >= 0 ? args[exportDirIdx + 1] : null;
const ownerUrl = ownerUrlIdx >= 0 ? args[ownerUrlIdx + 1] : null;
const fromIdx = args.indexOf('--from');
const fromStep = fromIdx >= 0 ? args[fromIdx + 1] : null;

let startIdx = 0;
if (fromStep) {
  startIdx = steps.findIndex(s => s.id === fromStep);
  if (startIdx < 0) {
    console.error(`Unknown step: ${fromStep}. Valid: ${steps.map(s => s.id).join(', ')}`);
    process.exit(1);
  }
}

console.log('╔══════════════════════════════════════╗');
console.log('║  LinkedInGraph Classification Pipeline  ║');
console.log('╚══════════════════════════════════════╝\n');

for (let i = startIdx; i < steps.length; i++) {
  const step = steps[i];

  if (skipLLM && step.id === '0b') {
    const resultsFile = join(__dirname, '..', '..', 'data', 'linkedingraph_llm_results.json');
    if (existsSync(resultsFile)) {
      console.log(`⊘ Step ${step.id}: ${step.name} — SKIPPED (--skip-llm, results file exists)\n`);
      continue;
    } else {
      console.error(`ERROR: --skip-llm specified but ${resultsFile} does not exist`);
      process.exit(1);
    }
  }

  if (step.id === '2') {
    // Warmth extraction step — needs --export-dir and --owner-url
    if (skipWarmth) {
      const warmthFile = join(__dirname, '..', '..', 'data', 'linkedingraph_warmth_signals.json');
      if (existsSync(warmthFile)) {
        console.log(`⊘ Step ${step.id}: ${step.name} — SKIPPED (--skip-warmth, signals file exists)\n`);
        continue;
      } else {
        console.error(`ERROR: --skip-warmth specified but warmth signals file does not exist`);
        process.exit(1);
      }
    }
    if (!exportDir || !ownerUrl) {
      console.log(`⊘ Step ${step.id}: ${step.name} — SKIPPED (no --export-dir / --owner-url provided)\n`);
      continue;
    }
  }

  console.log(`▶ Step ${step.id}: ${step.name}`);
  console.log('─'.repeat(50));

  try {
    const scriptArgs = [join(__dirname, step.script)];
    // Pass through warmth extraction args
    if (step.needsArgs && exportDir && ownerUrl) {
      scriptArgs.push('--export-dir', exportDir, '--owner-url', ownerUrl);
    }
    execFileSync('node', scriptArgs, {
      stdio: 'inherit',
      cwd: join(__dirname, '..', '..'),
    });
    console.log(`✓ Step ${step.id} complete\n`);
  } catch (err) {
    console.error(`✗ Step ${step.id} failed with exit code ${err.status}`);
    process.exit(1);
  }
}

console.log('═'.repeat(50));
console.log('Pipeline complete. Check data/ for output files.');
