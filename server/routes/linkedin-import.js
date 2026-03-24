/**
 * PlexifySOLO — LinkedIn Import routes
 *
 * POST /api/linkedin-import/upload  — Upload LinkedIn Data Export ZIP, validate, return manifest
 * POST /api/linkedin-import/start   — Start pipeline as background job
 * GET  /api/linkedin-import/status/:jobId — Poll pipeline progress
 * POST /api/linkedin-import/cancel/:jobId — Cancel running pipeline
 *
 * Auth: sandboxAuth middleware sets req.tenant before these handlers run.
 */

import AdmZip from 'adm-zip';
import { getSupabase } from '../lib/supabase.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runLinkedInPipeline, cancelPipeline } from '../services/linkedin-pipeline.mjs';

// Files we look for in a LinkedIn Data Export
const REQUIRED_FILES = ['Connections.csv'];
const OPTIONAL_FILES = [
  'messages.csv',
  'Endorsement_Given_Info.csv',
  'Endorsement_Received_Info.csv',
  'Recommendations_Given.csv',
  'Recommendations_Received.csv',
  'Invitations.csv',
  'Company Follows.csv',
];

// Required columns for auto-mapping
const REQUIRED_COLUMNS = {
  first_name: 'First Name',
  last_name: 'Last Name',
  company: 'Company',
  position: 'Position',
};

// Optional columns we also map if present
const OPTIONAL_COLUMNS = {
  email: 'Email Address',
  connected_on: 'Connected On',
  url: 'URL',
};

// ---------------------------------------------------------------------------
// CSV Parser — handles quoted fields, escaped quotes, disclaimer lines
// Ported from scripts/linkedingraph/extract-warmth-signals.mjs
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim());
        if (current.some(c => c !== '')) {
          rows.push(current);
        }
        current = [];
        field = '';
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field
  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.some(c => c !== '')) {
      rows.push(current);
    }
  }

  return rows;
}

/**
 * Find the header row index by scanning for "First Name" cell.
 * LinkedIn exports have 2-line legal disclaimer before the real header.
 */
function findHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    if (rows[r].some(cell => cell.trim() === 'First Name')) {
      return r;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Response helper — works with both Express res and raw Node ServerResponse
// ---------------------------------------------------------------------------

function sendJSON(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Upload handler
// ---------------------------------------------------------------------------

export async function handleUploadLinkedInExport(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    return sendJSON(res, 401, { error: 'Not authenticated' });
  }

  if (!req.file) {
    return sendJSON(res, 400, { error: 'No file uploaded. Please upload a ZIP file.' });
  }

  const file = req.file;

  // Validate it's a ZIP
  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    return sendJSON(res, 400, { error: 'Only ZIP files are accepted. Please upload your LinkedIn Data Export as a .zip file.' });
  }

  try {
    // Extract ZIP from memory buffer
    const zip = new AdmZip(file.buffer);
    const zipEntries = zip.getEntries();

    // Build a map of filename → entry (case-insensitive match, handle nested dirs)
    const fileMap = new Map();
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        // Use just the filename, not the full path (LinkedIn ZIPs may have a wrapper dir)
        const name = entry.entryName.split('/').pop();
        fileMap.set(name, entry);
      }
    }

    // Check for required + optional files
    const filesFound = [];
    const filesMissing = [];

    for (const f of REQUIRED_FILES) {
      if (fileMap.has(f)) {
        filesFound.push(f);
      } else {
        filesMissing.push(f);
      }
    }

    for (const f of OPTIONAL_FILES) {
      if (fileMap.has(f)) {
        filesFound.push(f);
      } else {
        filesMissing.push(f);
      }
    }

    // Connections.csv is required
    if (!fileMap.has('Connections.csv')) {
      return sendJSON(res, 400, {
        error: 'Connections.csv not found in ZIP. This file is required. Make sure you uploaded a LinkedIn Data Export.',
        files_found: filesFound,
      });
    }

    // Parse Connections.csv
    const connectionsBuffer = fileMap.get('Connections.csv').getData();
    const connectionsText = connectionsBuffer.toString('utf-8');
    const rows = parseCSV(connectionsText);

    // Skip disclaimer lines — find header row containing "First Name"
    const headerRowIdx = findHeaderRow(rows);
    if (headerRowIdx < 0) {
      return sendJSON(res, 400, {
        error: 'Could not find header row in Connections.csv. Expected a row containing "First Name".',
      });
    }

    const headers = rows[headerRowIdx];
    const dataRows = rows.slice(headerRowIdx + 1);
    const contactCount = dataRows.length;

    // Auto-map columns
    const columnMapping = {};
    let autoMapped = true;

    for (const [key, expected] of Object.entries(REQUIRED_COLUMNS)) {
      const found = headers.find(h => h.trim() === expected);
      if (found) {
        columnMapping[key] = found.trim();
      } else {
        autoMapped = false;
      }
    }

    for (const [key, expected] of Object.entries(OPTIONAL_COLUMNS)) {
      const found = headers.find(h => h.trim() === expected);
      if (found) {
        columnMapping[key] = found.trim();
      }
    }

    // Count scoring dimensions (optional files that were found)
    const scoringDimensionsMax = OPTIONAL_FILES.length;
    const scoringDimensionsAvailable = OPTIONAL_FILES.filter(f => fileMap.has(f)).length;

    // Save extracted files to temp dir for later processing
    // TODO Phase C: clean up temp files after pipeline completes
    const timestamp = Date.now();
    const tempDir = join(tmpdir(), 'linkedin-import', tenant.id, String(timestamp));
    mkdirSync(tempDir, { recursive: true });

    for (const [name, entry] of fileMap) {
      if (filesFound.includes(name)) {
        writeFileSync(join(tempDir, name), entry.getData());
      }
    }

    // Create linkedin_import_jobs row
    const supabase = getSupabase();
    const { data: job, error: dbError } = await supabase
      .from('linkedin_import_jobs')
      .insert({
        tenant_id: tenant.id,
        status: 'pending',
        contact_count: contactCount,
        files_found: filesFound,
        files_missing: filesMissing,
        column_mapping: {
          ...columnMapping,
          auto_mapped: autoMapped,
          temp_dir: tempDir,
        },
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Failed to create linkedin_import_jobs row:', dbError);
      return sendJSON(res, 500, { error: 'Failed to save import job.' });
    }

    // Return manifest
    return sendJSON(res, 200, {
      jobId: job.id,
      files_found: filesFound,
      files_missing: filesMissing,
      contact_count: contactCount,
      columns_detected: {
        'Connections.csv': headers.map(h => h.trim()),
      },
      column_mapping: columnMapping,
      auto_mapped: autoMapped,
      scoring_dimensions_available: scoringDimensionsAvailable,
      scoring_dimensions_max: scoringDimensionsMax,
    });
  } catch (err) {
    console.error('LinkedIn import upload error:', err);
    return sendJSON(res, 500, {
      error: 'Failed to process ZIP file. Make sure it is a valid LinkedIn Data Export.',
    });
  }
}

// ---------------------------------------------------------------------------
// Pipeline step names (must match server/services/linkedin-pipeline.mjs)
// ---------------------------------------------------------------------------

const STEP_NAMES = [
  'Extract & Validate',
  'Vertical Tagging',
  'LLM Classification',
  'Merge Classifications',
  'Warmth Extraction',
  'Priority Scoring',
  'Opportunity Import',
];

// ---------------------------------------------------------------------------
// Start pipeline
// ---------------------------------------------------------------------------

export async function handleStartPipeline(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  // Parse body — works with both Express (req.body) and raw Node (buffered body)
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(req._body || '{}'); } catch { body = {}; }
  }

  const { jobId } = body;
  if (!jobId) return sendJSON(res, 400, { error: 'jobId is required' });

  const supabase = getSupabase();

  // Verify job exists and belongs to this tenant
  const { data: job, error: fetchErr } = await supabase
    .from('linkedin_import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenant.id)
    .single();

  if (fetchErr || !job) {
    return sendJSON(res, 404, { error: 'Import job not found' });
  }

  if (job.status !== 'pending') {
    return sendJSON(res, 400, { error: `Job is already ${job.status}. Cannot start.` });
  }

  // Concurrent import guard — only 1 processing job per tenant
  const { data: existing } = await supabase
    .from('linkedin_import_jobs')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('status', 'processing')
    .limit(1);

  if (existing && existing.length > 0) {
    return sendJSON(res, 409, {
      error: 'Another import is already processing. Please wait for it to complete or cancel it.',
      active_job_id: existing[0].id,
    });
  }

  // Update job to processing
  await supabase
    .from('linkedin_import_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      current_step: 0,
      step_name: 'Starting...',
    })
    .eq('id', jobId);

  // Extract temp_dir from column_mapping (stored by upload handler)
  const tempDir = job.column_mapping?.temp_dir;
  if (!tempDir) {
    await supabase
      .from('linkedin_import_jobs')
      .update({ status: 'error', error_message: 'Missing temp directory. Please re-upload.' })
      .eq('id', jobId);
    return sendJSON(res, 500, { error: 'Missing temp directory. Please re-upload.' });
  }

  // Fire and forget — do NOT await
  runLinkedInPipeline(jobId, tenant.id, {
    tempDir,
    sandboxToken: tenant.sandbox_token,
  }).catch(err => {
    console.error(`[linkedin-import] Pipeline crashed for job ${jobId}:`, err);
  });

  return sendJSON(res, 200, { jobId, status: 'processing', message: 'Pipeline started' });
}

// ---------------------------------------------------------------------------
// Get pipeline status
// ---------------------------------------------------------------------------

export async function handleGetStatus(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  const jobId = req.params?.jobId || req.url?.split('/').pop();
  if (!jobId) return sendJSON(res, 400, { error: 'jobId is required' });

  const supabase = getSupabase();
  const { data: job, error } = await supabase
    .from('linkedin_import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenant.id)
    .single();

  if (error || !job) {
    return sendJSON(res, 404, { error: 'Import job not found' });
  }

  // Build step details array
  const steps = STEP_NAMES.map((name, i) => {
    const stepNum = i + 1;
    let status = 'pending';
    if (job.current_step > stepNum) {
      status = 'complete';
    } else if (job.current_step === stepNum) {
      status = job.status === 'error' ? 'error' : 'processing';
    }
    // If the whole job is complete, mark all steps complete
    if (job.status === 'complete') status = 'complete';

    return {
      step: stepNum,
      name,
      status,
      batch: stepNum === job.current_step ? (job.current_batch || 0) : undefined,
      total_batches: stepNum === job.current_step ? (job.total_batches || 0) : undefined,
    };
  });

  return sendJSON(res, 200, {
    jobId: job.id,
    status: job.status,
    current_step: job.current_step || 0,
    total_steps: 7,
    step_name: job.step_name,
    current_batch: job.current_batch || 0,
    total_batches: job.total_batches || 0,
    contact_count: job.contact_count,
    steps,
    results: job.results,
    error_message: job.error_message,
    started_at: job.started_at,
    completed_at: job.completed_at,
  });
}

// ---------------------------------------------------------------------------
// Cancel pipeline
// ---------------------------------------------------------------------------

export async function handleCancelPipeline(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  const jobId = req.params?.jobId || req.url?.split('/').pop();
  if (!jobId) return sendJSON(res, 400, { error: 'jobId is required' });

  const supabase = getSupabase();

  // Verify job belongs to tenant
  const { data: job, error } = await supabase
    .from('linkedin_import_jobs')
    .select('id, status')
    .eq('id', jobId)
    .eq('tenant_id', tenant.id)
    .single();

  if (error || !job) {
    return sendJSON(res, 404, { error: 'Import job not found' });
  }

  if (job.status !== 'processing') {
    return sendJSON(res, 400, { error: `Job is ${job.status}, not processing. Cannot cancel.` });
  }

  // Signal the in-memory pipeline to abort
  const cancelled = cancelPipeline(jobId);

  // Update DB regardless (in case the process already finished)
  await supabase
    .from('linkedin_import_jobs')
    .update({
      status: 'cancelled',
      error_message: 'Cancelled by user',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  return sendJSON(res, 200, {
    jobId,
    status: 'cancelled',
    message: cancelled ? 'Pipeline cancelled' : 'Job marked as cancelled (process may have already finished)',
  });
}
