/**
 * Phase A: Import SunnAx leads as PlexifyAEC opportunities.
 * Reads 3 CSV files (latin-1 encoded) and POSTs to /api/opportunities.
 *
 * Usage:
 *   node scripts/sunnax/import-sunnax-leads.mjs --dry-run
 *   node scripts/sunnax/import-sunnax-leads.mjs --dry-run --file 1
 *   node scripts/sunnax/import-sunnax-leads.mjs --limit 5
 *   node scripts/sunnax/import-sunnax-leads.mjs --base-url https://plexifybid-production.up.railway.app
 *   node scripts/sunnax/import-sunnax-leads.mjs --file all
 *
 * Requires SUNNAX_SANDBOX_TOKEN in .env.local
 * (Ben's token: pxs_f07758ccc00e5b13b41615ec6af7c3e723699c24afb4f2ef)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'sunnax');

dotenv.config({ path: join(ROOT, '.env.local') });

const SANDBOX_TOKEN = process.env.SUNNAX_SANDBOX_TOKEN;
if (!SANDBOX_TOKEN) {
  console.error('ERROR: SUNNAX_SANDBOX_TOKEN not found in .env.local');
  console.error('Add: SUNNAX_SANDBOX_TOKEN=pxs_f07758ccc00e5b13b41615ec6af7c3e723699c24afb4f2ef');
  process.exit(1);
}

// ── CLI args ──
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const baseIdx = args.indexOf('--base-url');
const BASE_URL = baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:3000';
const fileIdx = args.indexOf('--file');
const fileArg = fileIdx >= 0 ? args[fileIdx + 1] : 'all';

const PROGRESS_FILE = join(ROOT, 'data', 'sunnax_import_progress.json');

const FILES = {
  1: {
    name: 'New_York_Lead_List_3_10_26.csv',
    type: 'people_with_titles',
    region: 'New York',
    description: 'NY people (837 rows)',
  },
  2: {
    name: 'South_Carolina_Companies.csv',
    type: 'companies_only',
    region: 'South Carolina',
    description: 'SC companies (92 rows)',
  },
  3: {
    name: 'South_Carolina_People_Contacts.csv',
    type: 'people_no_titles',
    region: 'South Carolina',
    description: 'SC people (126 rows)',
  },
};

// ── CSV parser (handles double-quoted fields with commas) ──
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      i++;
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      return field;
    }
  }

  while (i < len) {
    const row = [];
    while (true) {
      row.push(parseField());
      if (i < len && text[i] === ',') { i++; continue; }
      break;
    }
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

// ── Helpers ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeDedupeKey(accountName, contactName) {
  return `${(accountName || '').trim().toLowerCase()}||${(contactName || '').trim().toLowerCase()}`;
}

/** Extract first company from potentially comma-separated double-quoted value */
function firstCompany(raw) {
  if (!raw) return '';
  // Strip all stray double quotes (CSV double-quoting artifact)
  let cleaned = raw.replace(/"/g, '').trim();
  // If it contains commas, take the first one
  if (cleaned.includes(',')) {
    return cleaned.split(',')[0].trim();
  }
  return cleaned;
}

/** Build address string from SC company fields */
function buildAddress(row, col) {
  const parts = [
    (row[col['address_1']] || '').trim(),
    (row[col['city']] || '').trim(),
    (row[col['state']] || '').trim(),
    (row[col['postal_code']] || '').trim(),
  ].filter(Boolean);
  return parts.join(', ') || null;
}

// ── Row mappers per file type ──

function mapNYPeople(row, col, importDate) {
  const contactName = (row[col['Name']] || '').trim();
  if (!contactName) return null; // skip empty names

  const company = firstCompany(row[col['Companies']] || '');
  const email = (row[col['email']] || '').trim();
  const jobTitle = (row[col['JobTitle']] || '').trim();
  const industry = (row[col['Industry']] || '').trim();
  const wonLeads = parseInt(row[col['NumberOfWonLeads']] || '0', 10) || 0;
  const openLeads = parseInt(row[col['NumberOfOpenLeads']] || '0', 10) || 0;

  return {
    account_name: company || contactName, // fallback to contact name if no company
    contact_name: contactName,
    contact_email: email || null,
    contact_title: jobTitle || null,
    deal_hypothesis: `${industry || 'Unknown industry'} prospect, cold lead. Source: SunnAx NY lead list.`,
    enrichment_data: {
      source: 'sunnax_import',
      import_file: 'New_York_Lead_List_3_10_26.csv',
      import_date: importDate,
      email: email || null,
      industry: industry || null,
      won_leads: wonLeads,
      open_leads: openLeads,
      lead_type: 'cold',
      warm_status: 'none',
      region: 'New York',
    },
  };
}

function mapSCCompanies(row, col, importDate) {
  const companyName = (row[col['name']] || '').trim();
  if (!companyName) return null;

  const industry = (row[col['industry']] || '').trim();
  const address = buildAddress(row, col);

  return {
    account_name: companyName,
    contact_name: null,
    contact_email: null,
    contact_title: null,
    deal_hypothesis: `${industry || 'Unknown industry'} account, cold lead. Source: SunnAx SC company list.`,
    enrichment_data: {
      source: 'sunnax_import',
      import_file: 'South_Carolina_Companies.csv',
      import_date: importDate,
      industry: industry || null,
      address: address,
      lead_type: 'cold',
      warm_status: 'none',
      region: 'South Carolina',
    },
  };
}

function mapSCPeople(row, col, importDate) {
  const contactName = (row[col['name']] || '').trim();
  if (!contactName) return null;

  const company = firstCompany(row[col['companies']] || '');
  const email = (row[col['email']] || '').trim();
  const industry = (row[col['industry']] || '').trim();

  return {
    account_name: company || contactName,
    contact_name: contactName,
    contact_email: email || null,
    contact_title: null,
    deal_hypothesis: `${industry || 'Unknown industry'} prospect, cold lead. Source: SunnAx SC contact list.`,
    enrichment_data: {
      source: 'sunnax_import',
      import_file: 'South_Carolina_People_Contacts.csv',
      import_date: importDate,
      industry: industry || null,
      lead_type: 'cold',
      warm_status: 'none',
      region: 'South Carolina',
    },
  };
}

const MAPPERS = {
  people_with_titles: mapNYPeople,
  companies_only: mapSCCompanies,
  people_no_titles: mapSCPeople,
};

// ── Main ──
async function main() {
  console.log('=== SunnAx Leads -> Opportunities Import ===\n');
  if (dryRun) console.log('*** DRY RUN — no API calls will be made ***\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
  console.log(`File: ${fileArg}\n`);

  const importDate = new Date().toISOString().split('T')[0];

  // Determine which files to process
  const fileNums = fileArg === 'all' ? [1, 2, 3] : [parseInt(fileArg, 10)];
  if (fileNums.some(n => !FILES[n])) {
    console.error(`ERROR: Invalid --file value "${fileArg}". Use 1, 2, 3, or all.`);
    process.exit(1);
  }

  // Load progress (set of dedupe keys already imported)
  let imported = new Set();
  if (existsSync(PROGRESS_FILE)) {
    try {
      const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
      imported = new Set(progress.imported || []);
      console.log(`Resuming — ${imported.size} already imported\n`);
    } catch {
      console.log('Progress file corrupted, starting fresh\n');
    }
  }

  // Fetch existing opportunities to check for duplicates
  let existingKeys = new Set();
  if (!dryRun) {
    try {
      const resp = await fetch(`${BASE_URL}/api/opportunities?limit=5000`, {
        headers: { 'Authorization': `Bearer ${SANDBOX_TOKEN}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const opp of (data.opportunities || [])) {
          existingKeys.add(makeDedupeKey(opp.account_name, opp.contact_name));
        }
        console.log(`Found ${existingKeys.size} existing opportunities\n`);
      }
    } catch (err) {
      console.log(`Warning: Could not fetch existing opportunities: ${err.message}\n`);
    }
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  for (const fileNum of fileNums) {
    const fileMeta = FILES[fileNum];
    const filePath = join(DATA_DIR, fileMeta.name);

    console.log(`\n--- File ${fileNum}: ${fileMeta.description} ---`);
    console.log(`Path: ${filePath}`);

    if (!existsSync(filePath)) {
      console.error(`ERROR: File not found: ${filePath}`);
      console.error('Copy Ben\'s CSVs to data/sunnax/ first.');
      continue;
    }

    // Read as latin-1
    const rawBuffer = readFileSync(filePath);
    const raw = new TextDecoder('latin1').decode(rawBuffer);

    const parsed = parseCSV(raw);
    if (parsed.length < 2) {
      console.error(`ERROR: File has no data rows: ${fileMeta.name}`);
      continue;
    }

    // Build column index from headers (trim whitespace from header names)
    const headers = parsed[0].map(h => h.trim());
    const dataRows = parsed.slice(1);
    const col = {};
    for (let i = 0; i < headers.length; i++) {
      col[headers[i]] = i;
    }

    console.log(`Headers: ${headers.join(', ')}`);
    console.log(`Data rows: ${dataRows.length}`);

    const mapper = MAPPERS[fileMeta.type];
    const remaining = limit - totalCreated;
    if (remaining <= 0) {
      console.log('Limit reached, skipping remaining files.');
      break;
    }

    const toProcess = dataRows.slice(0, remaining === Infinity ? undefined : remaining + 500); // fetch extra to account for skips
    let fileCreated = 0;
    let fileSkipped = 0;
    let fileDuplicates = 0;
    let fileErrors = 0;

    for (let i = 0; i < toProcess.length; i++) {
      if (totalCreated >= limit) break;

      const row = toProcess[i];
      const mapped = mapper(row, col, importDate);
      if (!mapped) {
        fileSkipped++;
        continue;
      }

      const dedupeKey = makeDedupeKey(mapped.account_name, mapped.contact_name);

      // Skip if already imported (resume-safe)
      if (imported.has(dedupeKey)) {
        fileSkipped++;
        continue;
      }

      // Skip if already exists in DB
      if (existingKeys.has(dedupeKey)) {
        if (dryRun) console.log(`  [SKIP] Duplicate: ${mapped.contact_name || '(no contact)'} @ ${mapped.account_name}`);
        fileDuplicates++;
        continue;
      }

      if (dryRun) {
        console.log(`[${totalProcessed + 1}] Would create:`);
        console.log(`  account_name: "${mapped.account_name}"`);
        console.log(`  contact_name: "${mapped.contact_name || '(null)'}"`);
        console.log(`  contact_email: "${mapped.contact_email || '(null)'}"`);
        console.log(`  contact_title: "${mapped.contact_title || '(null)'}"`);
        console.log(`  deal_hypothesis: "${mapped.deal_hypothesis}"`);
        console.log(`  enrichment_data: ${JSON.stringify(mapped.enrichment_data)}`);
        console.log();
        fileCreated++;
        totalCreated++;
        totalProcessed++;
        continue;
      }

      // POST to API (with 429 retry)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await fetch(`${BASE_URL}/api/opportunities`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SANDBOX_TOKEN}`,
            },
            body: JSON.stringify(mapped),
          });

          if (resp.ok) {
            fileCreated++;
            totalCreated++;
            imported.add(dedupeKey);

            // Save progress every 10 records
            if (totalCreated % 10 === 0) {
              writeFileSync(PROGRESS_FILE, JSON.stringify({ imported: [...imported] }, null, 2));
            }

            if (totalCreated % 25 === 0) {
              console.log(`  Progress: ${totalCreated} created, ${fileDuplicates + totalDuplicates} duplicates, ${fileErrors + totalErrors} errors`);
            }
            break;
          } else if (resp.status === 429 && attempt < 2) {
            console.log(`  [429] Rate limited — waiting 65s (retry ${attempt + 1}/2)`);
            await sleep(65000);
            continue;
          } else {
            const errBody = await resp.text();
            console.error(`  ERROR: ${mapped.contact_name || mapped.account_name}: ${resp.status} ${errBody}`);
            fileErrors++;
            break;
          }
        } catch (err) {
          if (attempt < 2) {
            console.log(`  [NETWORK] ${err.message} — waiting 65s (retry ${attempt + 1}/2)`);
            await sleep(65000);
            continue;
          }
          console.error(`  NETWORK ERROR: ${mapped.contact_name || mapped.account_name}: ${err.message}`);
          fileErrors++;
        }
      }

      totalProcessed++;

      // Delay between requests
      await sleep(1500);
    }

    console.log(`\n  File ${fileNum} summary: ${fileCreated} created, ${fileDuplicates} duplicates, ${fileSkipped} skipped, ${fileErrors} errors`);
    totalDuplicates += fileDuplicates;
    totalSkipped += fileSkipped;
    totalErrors += fileErrors;
  }

  // Save final progress
  if (!dryRun && imported.size > 0) {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ imported: [...imported] }, null, 2));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Import Summary ===');
  console.log(`${dryRun ? 'Would create' : 'Created'}: ${totalCreated}`);
  console.log(`Duplicates (skipped): ${totalDuplicates}`);
  console.log(`Skipped (empty/resumed): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Time: ${elapsed}s`);
  if (!dryRun) console.log(`Progress saved: ${PROGRESS_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
