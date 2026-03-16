/**
 * Pipeline runner — executes Steps 0a → 0b → 0c → 1 → 2 sequentially.
 * Usage: node scripts/linkedingraph/run-pipeline.mjs [--skip-llm]
 *
 * Options:
 *   --skip-llm    Skip the LLM classification step (use existing results)
 *   --from <step> Start from a specific step (0a, 0b, 0c, 1, 2)
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
  { id: '2',  name: 'Review Queue', script: 'generate-review-queue.mjs' },
];

const args = process.argv.slice(2);
const skipLLM = args.includes('--skip-llm');
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

  console.log(`▶ Step ${step.id}: ${step.name}`);
  console.log('─'.repeat(50));

  try {
    execFileSync('node', [join(__dirname, step.script)], {
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
