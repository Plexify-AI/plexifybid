/**
 * LinkedIn Import Pipeline Orchestrator
 *
 * Spawns existing CLI scripts as child processes, parses stdout for progress,
 * and updates the linkedin_import_jobs row in Supabase after each step.
 *
 * Option A approach: reuses proven CLI scripts with zero refactoring.
 * TODO: Future — parameterize script filenames for multi-tenant. Currently
 * scripts hardcode filenames like ken_SOLO_tier1_FINAL.csv. The orchestrator
 * renames uploaded files to match. See scripts/linkedingraph/*.mjs for details.
 */

import { spawn } from 'child_process';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'fs';
import { getSupabase } from '../lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts', 'linkedingraph');
const DATA_DIR = join(REPO_ROOT, 'data');

// In-memory map of running pipelines for cancellation support
const runningPipelines = new Map();

// Pipeline step definitions
const PIPELINE_STEPS = [
  { step: 1, name: 'Extract & Validate',  script: null },          // inline — data already extracted
  { step: 2, name: 'Vertical Tagging',    script: 'extract-untagged.mjs' },
  { step: 3, name: 'LLM Classification',  script: 'classify-companies-llm.mjs', hasBatches: true },
  { step: 4, name: 'Merge Classifications', script: 'merge-classifications.mjs' },
  { step: 5, name: 'Warmth Extraction',   script: 'extract-warmth-signals.mjs', needsExportDir: true },
  { step: 6, name: 'Priority Scoring',    script: 'generate-review-queue.mjs' },
  { step: 7, name: 'Opportunity Import',  script: null },          // direct Supabase insert
];

/**
 * Run the full LinkedIn import pipeline as a background job.
 * Fire-and-forget — caller should NOT await this.
 */
export async function runLinkedInPipeline(jobId, tenantId, options = {}) {
  const { tempDir, sandboxToken } = options;
  const supabase = getSupabase();
  const abortController = new AbortController();

  runningPipelines.set(jobId, { abortController, childProcess: null });

  const stepTimings = {};

  async function updateJob(updates) {
    const { error } = await supabase
      .from('linkedin_import_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) {
      console.error(`[pipeline:${jobId}] Failed to update job:`, error.message);
    }
  }

  try {
    // Ensure data/ directory exists
    mkdirSync(DATA_DIR, { recursive: true });

    // Step 1: Extract & Validate — copy uploaded files to data/ with expected names
    // TODO: Scripts hardcode ken_SOLO_tier1_FINAL.csv as input. For multi-tenant,
    // scripts should accept --input flags. For now, we rename to match.
    await updateJob({ current_step: 1, step_name: 'Extract & Validate', status: 'processing' });
    stepTimings[1] = Date.now();

    if (abortController.signal.aborted) throw new Error('Pipeline cancelled');

    const connectionsPath = join(tempDir, 'Connections.csv');
    if (!existsSync(connectionsPath)) {
      throw new Error('Connections.csv not found in temp directory');
    }

    // Read Connections.csv and write it as ken_SOLO_tier1_FINAL.csv
    // The scripts expect this specific filename. Add required columns if missing.
    const connectionsData = readFileSync(connectionsPath, 'utf-8');
    const preparedCsv = prepareConnectionsCsv(connectionsData);
    writeFileSync(join(DATA_DIR, 'ken_SOLO_tier1_FINAL.csv'), preparedCsv);

    // Copy optional LinkedIn export files to temp location for warmth extraction
    const exportDir = join(tempDir, 'linkedin_export');
    mkdirSync(exportDir, { recursive: true });
    const optionalFiles = [
      'Connections.csv', 'messages.csv', 'Endorsement_Given_Info.csv',
      'Endorsement_Received_Info.csv', 'Recommendations_Given.csv',
      'Recommendations_Received.csv', 'Invitations.csv', 'Company Follows.csv',
    ];
    for (const f of optionalFiles) {
      const src = join(tempDir, f);
      if (existsSync(src)) {
        copyFileSync(src, join(exportDir, f));
      }
    }

    stepTimings[1] = Date.now() - stepTimings[1];
    await updateJob({ current_step: 1, step_name: 'Extract & Validate' });

    // Steps 2-6: Spawn CLI scripts
    for (let i = 1; i < PIPELINE_STEPS.length; i++) {
      const stepDef = PIPELINE_STEPS[i];

      if (abortController.signal.aborted) throw new Error('Pipeline cancelled');

      stepTimings[stepDef.step] = Date.now();
      await updateJob({
        current_step: stepDef.step,
        step_name: stepDef.name,
        current_batch: 0,
        total_batches: 0,
      });

      if (stepDef.script) {
        // Spawn the CLI script
        const scriptPath = join(SCRIPTS_DIR, stepDef.script);
        const args = [scriptPath];

        // Warmth extraction needs export-dir and owner-url
        if (stepDef.needsExportDir) {
          args.push('--export-dir', exportDir);
          // TODO: owner-url should come from tenant config. Using a placeholder for now.
          args.push('--owner-url', 'https://www.linkedin.com/in/placeholder');
          args.push('--output', join(DATA_DIR, 'linkedingraph_warmth_signals.json'));
        }

        await runScript(jobId, args, stepDef, updateJob, abortController);
      } else if (stepDef.step === 7) {
        // Step 7: Direct Supabase import
        await importOpportunitiesDirect(jobId, tenantId, updateJob, abortController);
      }

      stepTimings[stepDef.step] = Date.now() - stepTimings[stepDef.step];
    }

    // Build results summary
    const results = buildResultsSummary();

    await updateJob({
      status: 'complete',
      completed_at: new Date().toISOString(),
      results,
      step_name: 'Complete',
      current_step: 7,
    });

    // Clean up temp files on success
    cleanupTempFiles(jobId, tempDir);

    console.log(`[pipeline:${jobId}] Complete.`);
  } catch (err) {
    if (err.message === 'Pipeline cancelled') {
      await updateJob({ status: 'cancelled', error_message: 'Pipeline cancelled by user' });
      // Clean up temp files on cancel
      cleanupTempFiles(jobId, tempDir);
      console.log(`[pipeline:${jobId}] Cancelled.`);
    } else {
      // Keep temp files on error for debugging
      // TODO: Add scheduled 24-hour cleanup for error-state temp files
      await updateJob({ status: 'error', error_message: err.message });
      console.error(`[pipeline:${jobId}] Error:`, err.message);
    }
  } finally {
    runningPipelines.delete(jobId);
  }
}

/**
 * Cancel a running pipeline by jobId.
 * Returns true if a pipeline was found and cancelled.
 */
export function cancelPipeline(jobId) {
  const pipeline = runningPipelines.get(jobId);
  if (!pipeline) return false;

  pipeline.abortController.abort();
  if (pipeline.childProcess) {
    try {
      pipeline.childProcess.kill('SIGTERM');
    } catch {
      // Process may already be dead
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Temp file cleanup
// ---------------------------------------------------------------------------

/**
 * Remove temp directory used during pipeline execution.
 * Non-fatal — never crashes the pipeline for cleanup failure.
 */
function cleanupTempFiles(jobId, tempDir) {
  if (!tempDir) return;
  try {
    rmSync(tempDir, { recursive: true, force: true });
    console.log(`[pipeline:${jobId}] Cleaned up temp files: ${tempDir}`);
  } catch (err) {
    console.warn(`[pipeline:${jobId}] Temp cleanup failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prepare Connections.csv for the pipeline scripts.
 * Scripts expect columns: First Name, Last Name, Company, Position, URL, Email Address, Connected On
 * plus Vertical and Warm columns (can be empty).
 */
function prepareConnectionsCsv(csvText) {
  const lines = csvText.split('\n');

  // Find the header row (skip LinkedIn disclaimer lines)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('First Name')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    throw new Error('Could not find header row in Connections.csv');
  }

  const header = lines[headerIdx].trim();
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim());

  // Add Vertical and Warm columns if not present (scripts need them)
  const hasVertical = header.includes('Vertical');
  const hasWarm = header.includes('Warm');

  let newHeader = header;
  if (!hasVertical) newHeader += ',Vertical';
  if (!hasWarm) newHeader += ',Warm';

  const outputLines = [newHeader];
  for (const line of dataLines) {
    let newLine = line.trim();
    if (!hasVertical) newLine += ',';
    if (!hasWarm) newLine += ',';
    outputLines.push(newLine);
  }

  return outputLines.join('\n');
}

/**
 * Spawn a CLI script and parse stdout for progress signals.
 */
function runScript(jobId, args, stepDef, updateJob, abortController) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', args, {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Store reference for cancellation
    const pipeline = runningPipelines.get(jobId);
    if (pipeline) pipeline.childProcess = child;

    let stdout = '';
    let stderr = '';
    let lastBatchUpdate = 0;

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // Parse batch progress from LLM classification: "Batch 23/46" or "Processing batch 23 of 46"
      if (stepDef.hasBatches) {
        const batchMatch = text.match(/[Bb]atch\s+(\d+)\s*(?:\/|of)\s*(\d+)/);
        if (batchMatch) {
          const batch = parseInt(batchMatch[1], 10);
          const totalBatches = parseInt(batchMatch[2], 10);

          // Throttle DB updates to every 5 seconds
          const now = Date.now();
          if (now - lastBatchUpdate > 5000) {
            lastBatchUpdate = now;
            updateJob({ current_batch: batch, total_batches: totalBatches }).catch(() => {});
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (pipeline) pipeline.childProcess = null;

      if (abortController.signal.aborted) {
        reject(new Error('Pipeline cancelled'));
      } else if (code !== 0) {
        const errMsg = stderr.trim() || `Script exited with code ${code}`;
        reject(new Error(`${stepDef.name} failed: ${errMsg}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      if (pipeline) pipeline.childProcess = null;
      reject(new Error(`Failed to spawn ${stepDef.name}: ${err.message}`));
    });

    // Handle abort
    const onAbort = () => {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    };
    abortController.signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Step 7: Import opportunities directly to Supabase.
 * Reads the review queue CSV and inserts opportunities.
 */
async function importOpportunitiesDirect(jobId, tenantId, updateJob, abortController) {
  const queuePath = join(DATA_DIR, 'ken_SOLO_review_queue.csv');
  if (!existsSync(queuePath)) {
    throw new Error('Review queue CSV not found. Priority scoring may have failed.');
  }

  const csvText = readFileSync(queuePath, 'utf-8');
  const rows = parseSimpleCsv(csvText);
  if (rows.length === 0) {
    await updateJob({ current_batch: 0, total_batches: 0 });
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h.trim()] = i; });

  const supabase = getSupabase();
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < dataRows.length; i += batchSize) {
    batches.push(dataRows.slice(i, i + batchSize));
  }

  await updateJob({ total_batches: batches.length });
  let totalImported = 0;

  for (let b = 0; b < batches.length; b++) {
    if (abortController.signal.aborted) throw new Error('Pipeline cancelled');

    const batch = batches[b];
    const opportunities = batch.map(row => {
      const get = (col) => (colIdx[col] !== undefined ? (row[colIdx[col]] || '').trim() : '');

      return {
        tenant_id: tenantId,
        name: `${get('First Name')} ${get('Last Name')}`.trim() || get('Company'),
        company: get('Company'),
        contact_name: `${get('First Name')} ${get('Last Name')}`.trim(),
        contact_email: get('Email Address') || null,
        contact_title: get('Position') || null,
        source: 'linkedin_import',
        stage: 'identified',
        warmth_score: parseInt(get('Warmth Score') || get('Warmth_Composite'), 10) || 0,
        enrichment_data: {
          linkedin_url: get('URL') || null,
          priority: get('Priority') || null,
          warmth_label: get('Warmth_Label') || null,
          vertical: get('Vertical') || null,
          connected_on: get('Connected On') || null,
          import_job_id: jobId,
        },
      };
    }).filter(opp => opp.company || opp.contact_name);

    if (opportunities.length > 0) {
      const { error } = await supabase
        .from('opportunities')
        .upsert(opportunities, { onConflict: 'tenant_id,name', ignoreDuplicates: true });

      if (error) {
        console.error(`[pipeline:${jobId}] Batch ${b + 1} import error:`, error.message);
      } else {
        totalImported += opportunities.length;
      }
    }

    await updateJob({ current_batch: b + 1 });
  }

  console.log(`[pipeline:${jobId}] Imported ${totalImported} opportunities.`);
}

/**
 * Build a results summary from output files.
 */
function buildResultsSummary() {
  const results = {
    total_processed: 0,
    total_imported: 0,
    total_skipped: 0,
    warmth_distribution: { hot: 0, strong: 0, warm: 0, cold: 0, no_signal: 0 },
    top_contacts: [],
    priority_breakdown: { P0: 0, P1: 0, P2: 0, P3: 0 },
  };

  // Read warmth signals if available
  const warmthPath = join(DATA_DIR, 'linkedingraph_warmth_signals.json');
  if (existsSync(warmthPath)) {
    try {
      const warmth = JSON.parse(readFileSync(warmthPath, 'utf-8'));
      const entries = Object.values(warmth);
      results.total_processed = entries.length;

      for (const entry of entries) {
        const label = (entry.warmth_label || '').toLowerCase();
        if (label === 'hot') results.warmth_distribution.hot++;
        else if (label === 'strong') results.warmth_distribution.strong++;
        else if (label === 'warm') results.warmth_distribution.warm++;
        else if (label === 'cold') results.warmth_distribution.cold++;
        else results.warmth_distribution.no_signal++;
      }
    } catch { /* ignore parse errors */ }
  }

  // Read review queue for priority breakdown + top contacts
  const queuePath = join(DATA_DIR, 'ken_SOLO_review_queue.csv');
  if (existsSync(queuePath)) {
    try {
      const csvText = readFileSync(queuePath, 'utf-8');
      const rows = parseSimpleCsv(csvText);
      if (rows.length > 1) {
        const headers = rows[0];
        const dataRows = rows.slice(1);
        const colIdx = {};
        headers.forEach((h, i) => { colIdx[h.trim()] = i; });

        const get = (row, col) => (colIdx[col] !== undefined ? (row[colIdx[col]] || '').trim() : '');

        results.total_imported = dataRows.length;

        for (const row of dataRows) {
          const priority = get(row, 'Priority');
          if (results.priority_breakdown[priority] !== undefined) {
            results.priority_breakdown[priority]++;
          }
        }

        // Top 10 contacts by warmth score
        const sorted = dataRows
          .map(row => ({
            name: `${get(row, 'First Name')} ${get(row, 'Last Name')}`.trim(),
            company: get(row, 'Company'),
            warmth_composite: parseInt(get(row, 'Warmth Score') || get(row, 'Warmth_Composite'), 10) || 0,
            warmth_label: get(row, 'Warmth_Label') || '',
            priority: get(row, 'Priority'),
          }))
          .sort((a, b) => b.warmth_composite - a.warmth_composite)
          .slice(0, 10);

        results.top_contacts = sorted;
      }
    } catch { /* ignore parse errors */ }
  }

  return results;
}

/**
 * Simple CSV parser for review queue output (no quoted fields with newlines expected).
 */
function parseSimpleCsv(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      current.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      current.push(field.trim());
      if (current.some(c => c !== '')) rows.push(current);
      current = [];
      field = '';
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
  }

  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.some(c => c !== '')) rows.push(current);
  }

  return rows;
}

/**
 * Mark any zombie 'processing' jobs as errored on server startup.
 * Call this once when the server boots.
 */
export async function cleanupZombieJobs() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('linkedin_import_jobs')
      .update({
        status: 'error',
        error_message: 'Server restarted during processing. Please re-import.',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'processing')
      .select('id');

    if (error) {
      console.error('[linkedin-pipeline] Failed to clean up zombie jobs:', error.message);
    } else if (data && data.length > 0) {
      console.log(`[linkedin-pipeline] Cleaned up ${data.length} zombie job(s): ${data.map(j => j.id).join(', ')}`);
    }
  } catch (err) {
    console.error('[linkedin-pipeline] Zombie cleanup error:', err.message);
  }
}
