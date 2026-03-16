/**
 * Task 3: Import LinkedIn contacts as PlexifyAEC opportunities.
 * Reads ken_SOLO_review_queue.csv (after Ken's manual review),
 * creates opportunities via POST /api/opportunities.
 *
 * Usage:
 *   node scripts/linkedingraph/import-linkedin-opportunities.mjs --dry-run
 *   node scripts/linkedingraph/import-linkedin-opportunities.mjs --limit 5
 *   node scripts/linkedingraph/import-linkedin-opportunities.mjs --base-url https://plexifybid-production.up.railway.app
 *
 * Requires PLEXIFY_SANDBOX_TOKEN in .env.local
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');

dotenv.config({ path: join(ROOT, '.env.local') });

const SANDBOX_TOKEN = process.env.PLEXIFY_SANDBOX_TOKEN;
if (!SANDBOX_TOKEN) {
  console.error('ERROR: PLEXIFY_SANDBOX_TOKEN not found in .env.local');
  console.error('Add: PLEXIFY_SANDBOX_TOKEN=pxs_... to your .env.local');
  process.exit(1);
}

// ── CLI args ──
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const baseIdx = args.indexOf('--base-url');
const BASE_URL = baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:3000';

const INPUT_FILE = join(DATA_DIR, 'ken_SOLO_review_queue.csv');
const PROGRESS_FILE = join(DATA_DIR, 'linkedingraph_import_progress.json');

// ── CSV parser ──
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

// ── Main ──
async function main() {
  console.log('=== LinkedIn → Opportunities Import ===\n');
  if (dryRun) console.log('*** DRY RUN — no API calls will be made ***\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Limit: ${limit === Infinity ? 'none' : limit}\n`);

  // Read review queue
  const raw = readFileSync(INPUT_FILE, 'utf-8');
  const parsed = parseCSV(raw);
  const headers = parsed[0];
  const dataRows = parsed.slice(1);

  const col = {};
  for (let i = 0; i < headers.length; i++) {
    col[headers[i]] = i;
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

  // Filter rows
  const candidates = dataRows.filter(row => {
    const override = (row[col['Ken_Override']] || '').trim().toUpperCase();
    return override !== 'SKIP' && override !== 'N';
  });

  const toProcess = candidates.slice(0, limit);
  console.log(`Total in queue: ${dataRows.length}`);
  console.log(`After filtering (no Skip/N): ${candidates.length}`);
  console.log(`Processing: ${toProcess.length}\n`);

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const firstName = (row[col['First Name']] || '').trim();
    const lastName = (row[col['Last Name']] || '').trim();
    const company = (row[col['Company']] || '').trim();
    const position = (row[col['Position']] || '').trim();
    const vertical = (row[col['Vertical']] || '').trim();
    const warm = (row[col['Warm']] || '').trim();
    const msgCount = parseInt(row[col['Message Count']] || '0', 10);
    const priority = (row[col['Priority']] || '').trim();
    const url = (row[col['URL']] || '').trim();

    const contactName = `${firstName} ${lastName}`.trim();
    const dedupeKey = makeDedupeKey(company, contactName);

    // Skip if already imported (resume-safe)
    if (imported.has(dedupeKey)) {
      skipped++;
      continue;
    }

    // Skip if already exists in DB
    if (existingKeys.has(dedupeKey)) {
      if (dryRun) console.log(`  [SKIP] Duplicate: ${contactName} @ ${company}`);
      duplicates++;
      continue;
    }

    const dealHypothesis = `${vertical} prospect, ${priority}, Warm: ${warm}, ${msgCount} messages on LinkedIn. Imported from LinkedInGraph Agent.`;

    const enrichmentData = {
      source: 'linkedingraph_agent',
      import_date: new Date().toISOString().split('T')[0],
      linkedin_url: url,
      warm_status: warm,
      message_count: msgCount,
    };

    const body = {
      account_name: company,
      contact_name: contactName || null,
      contact_email: null,
      contact_title: position || null,
      deal_hypothesis: dealHypothesis,
      enrichment_data: enrichmentData,
    };

    if (dryRun) {
      console.log(`[${i + 1}/${toProcess.length}] Would create:`);
      console.log(`  account_name: "${company}"`);
      console.log(`  contact_name: "${contactName}"`);
      console.log(`  contact_title: "${position}"`);
      console.log(`  deal_hypothesis: "${dealHypothesis}"`);
      console.log(`  enrichment_data: ${JSON.stringify(enrichmentData)}`);
      console.log();
      created++;
      continue;
    }

    // POST to API (with 429 retry)
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`${BASE_URL}/api/opportunities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SANDBOX_TOKEN}`,
          },
          body: JSON.stringify(body),
        });

        if (resp.ok) {
          created++;
          imported.add(dedupeKey);

          // Save progress every 10 records
          if (created % 10 === 0) {
            writeFileSync(PROGRESS_FILE, JSON.stringify({ imported: [...imported] }, null, 2));
          }

          if (created % 25 === 0 || i === toProcess.length - 1) {
            console.log(`  Progress: ${created} created, ${duplicates} duplicates, ${errors} errors (${i + 1}/${toProcess.length})`);
          }
          success = true;
          break;
        } else if (resp.status === 429 && attempt < 2) {
          console.log(`  [429] Rate limited on ${contactName} @ ${company} — waiting 65s (retry ${attempt + 1}/2)`);
          await sleep(65000);
          continue;
        } else {
          const errBody = await resp.text();
          console.error(`  ERROR creating ${contactName} @ ${company}: ${resp.status} ${errBody}`);
          errors++;
          success = true; // don't retry non-429 errors
          break;
        }
      } catch (err) {
        if (attempt < 2) {
          console.log(`  [NETWORK] ${err.message} — waiting 65s (retry ${attempt + 1}/2)`);
          await sleep(65000);
          continue;
        }
        console.error(`  NETWORK ERROR for ${contactName} @ ${company}: ${err.message}`);
        errors++;
      }
    }

    // Delay between requests to stay under Railway rate limit
    await sleep(1500);
  }

  // Save final progress
  if (!dryRun) {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ imported: [...imported] }, null, 2));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Import Summary ===');
  console.log(`${dryRun ? 'Would create' : 'Created'}: ${created}`);
  console.log(`Duplicates (skipped): ${duplicates}`);
  console.log(`Already imported (resumed): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${elapsed}s`);
  if (!dryRun) console.log(`Progress saved: ${PROGRESS_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
