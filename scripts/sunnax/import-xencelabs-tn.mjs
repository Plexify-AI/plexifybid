/**
 * Import Xencelabs TN Event leads into Ben's SunnAx tenant.
 * Reads XLSX via xlsx-cli (npx), deduplicates by email, POSTs to /api/opportunities.
 *
 * Usage:
 *   node scripts/sunnax/import-xencelabs-tn.mjs --dry-run
 *   node scripts/sunnax/import-xencelabs-tn.mjs
 *   node scripts/sunnax/import-xencelabs-tn.mjs --base-url https://plexifybid-production.up.railway.app
 *   node scripts/sunnax/import-xencelabs-tn.mjs --limit 5
 *
 * Requires SUNNAX_SANDBOX_TOKEN in .env.local
 * (Ben's token: pxs_f07758ccc00e5b13b41615ec6af7c3e723699c24afb4f2ef)
 *
 * Source file: C:/Users/KensBOXX/Downloads/Xencelabs TN Leads.xlsx
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

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
const BASE_URL = baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:5173';
const fileIdx = args.indexOf('--file');
const XLSX_PATH = fileIdx >= 0
  ? args[fileIdx + 1]
  : 'C:/Users/KensBOXX/Downloads/Xencelabs TN Leads.xlsx';

// ── CSV parser (handles double-quoted fields with commas) ──
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Parse companies field → { primary, eventTags[] } ──
function parseCompanies(raw) {
  if (!raw) return { primary: '', eventTags: [] };

  // The companies field contains inner quoted values: "Foo","Bar","Event - EVENT"
  // After CSV parsing, we get: "Foo","Bar","Event - EVENT"
  // Split on "," boundaries
  const parts = raw
    .replace(/^"|"$/g, '')        // strip outer quotes
    .split(/","/)                  // split on "," boundary
    .map(s => s.replace(/\\'/g, "'").replace(/^"|"$/g, '').trim())
    .filter(Boolean);

  const eventTags = parts.filter(p => /EVENT/i.test(p));
  const companies = parts.filter(p => !/EVENT/i.test(p) && !/Event$/i.test(p));
  const primary = companies[0] || parts[0] || '';

  return { primary, eventTags };
}

// ── Build address string ──
function buildAddress(row) {
  const parts = [
    row.address_1,
    row.city,
    row.state,
    row.postal_code,
  ].filter(Boolean);
  return parts.join(', ') || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Map row to opportunity payload ──
function mapRow(row, importDate) {
  const email = (row.email || '').trim();
  if (!email) return null; // Skip rows without email

  const contactName = (row.name || '').trim();
  if (!contactName) return null;

  const { primary: accountName, eventTags } = parseCompanies(row.companies);
  const industry = (row.industry || '').trim();
  const address = buildAddress(row);
  const state = (row.state || '').trim();
  const openLeads = parseInt(row.numberOfOpenLeads || '0', 10) || 0;
  const wonLeads = parseInt(row.numberOfWonLeads || '0', 10) || 0;
  const hasAnimationYallTag = eventTags.some(t => /Animation Y.all 2026/i.test(t));

  return {
    account_name: accountName || contactName,
    contact_name: contactName,
    contact_email: email,
    contact_title: null,
    deal_hypothesis: `${industry || 'Unknown industry'} prospect, cold lead. Source: Xencelabs TN event list (Animation Y'all 2026).`,
    enrichment_data: {
      source: 'xencelabs_tn_event',
      import_file: 'Xencelabs_TN_Leads.xlsx',
      import_date: importDate,
      email,
      industry: industry || null,
      address,
      state: state || null,
      postal_code: (row.postal_code || '').trim() || null,
      lead_type: 'cold',
      warm_status: 'none',
      region: 'Tennessee',
      event_tags: eventTags.length > 0 ? eventTags : null,
      animation_yall_registered: hasAnimationYallTag,
      open_leads: openLeads,
      won_leads: wonLeads,
    },
  };
}

// ── Main ──
async function main() {
  console.log('=== Xencelabs TN Leads -> Opportunities Import ===\n');
  if (dryRun) console.log('*** DRY RUN — no API calls will be made ***\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
  console.log(`File: ${XLSX_PATH}\n`);

  const importDate = new Date().toISOString().split('T')[0];

  // ── Step 1: Convert XLSX → CSV via xlsx-cli ──
  console.log('Converting XLSX to CSV...');
  let csvText;
  try {
    csvText = execSync(`npx --yes xlsx-cli "${XLSX_PATH}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    console.error('ERROR: Failed to convert XLSX:', err.message);
    process.exit(1);
  }

  const lines = csvText.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\ufeff/, ''));
  console.log(`Headers: ${headers.join(', ')}`);
  console.log(`Data rows: ${lines.length - 1}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = fields[j] || ''; });
    rows.push(row);
  }

  // ── Step 2: Map all rows ──
  const mapped = rows.map(r => mapRow(r, importDate)).filter(Boolean);
  console.log(`\nMapped: ${mapped.length} rows (skipped ${rows.length - mapped.length} with no email/name)`);

  // ── Step 3: Fetch existing opportunities for dedup ──
  let existingEmails = new Set();
  if (!dryRun) {
    try {
      console.log('\nFetching existing opportunities for dedup...');
      const resp = await fetch(`${BASE_URL}/api/opportunities?limit=5000`, {
        headers: { 'Authorization': `Bearer ${SANDBOX_TOKEN}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const opp of (data.opportunities || [])) {
          if (opp.contact_email) {
            existingEmails.add(opp.contact_email.toLowerCase().trim());
          }
        }
        console.log(`Found ${existingEmails.size} existing emails for dedup`);
      } else {
        console.log(`Warning: Could not fetch existing opportunities (${resp.status})`);
      }
    } catch (err) {
      console.log(`Warning: Could not fetch existing opportunities: ${err.message}`);
    }
  }

  // ── Step 4: Dedup and import ──
  let created = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < mapped.length; i++) {
    if (created >= limit) {
      console.log(`\nLimit reached (${limit}), stopping.`);
      break;
    }

    const opp = mapped[i];
    const emailKey = opp.contact_email.toLowerCase().trim();

    // Dedup by email
    if (existingEmails.has(emailKey)) {
      if (dryRun) console.log(`  [SKIP] Duplicate email: ${opp.contact_name} <${opp.contact_email}>`);
      duplicates++;
      continue;
    }

    if (dryRun) {
      console.log(`[${created + 1}] Would create:`);
      console.log(`  account: "${opp.account_name}" | contact: "${opp.contact_name}" <${opp.contact_email}>`);
      console.log(`  industry: ${opp.enrichment_data.industry || '(null)'} | state: ${opp.enrichment_data.state || '(null)'}`);
      if (opp.enrichment_data.event_tags) console.log(`  event_tags: ${opp.enrichment_data.event_tags.join(', ')}`);
      console.log();
      created++;
      // Track email to catch intra-file duplicates
      existingEmails.add(emailKey);
      continue;
    }

    // POST to API with retry
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`${BASE_URL}/api/opportunities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SANDBOX_TOKEN}`,
          },
          body: JSON.stringify(opp),
        });

        if (resp.ok) {
          created++;
          existingEmails.add(emailKey); // prevent intra-batch duplicates

          if (created % 25 === 0) {
            console.log(`  Progress: ${created} created, ${duplicates} duplicates, ${errors} errors`);
          }
          break;
        } else if (resp.status === 429 && attempt < 2) {
          console.log(`  [429] Rate limited — waiting 65s (retry ${attempt + 1}/2)`);
          await sleep(65000);
          continue;
        } else {
          const errBody = await resp.text();
          console.error(`  ERROR: ${opp.contact_name}: ${resp.status} ${errBody}`);
          errors++;
          break;
        }
      } catch (err) {
        if (attempt < 2) {
          console.log(`  [NETWORK] ${err.message} — waiting 5s (retry ${attempt + 1}/2)`);
          await sleep(5000);
          continue;
        }
        console.error(`  NETWORK ERROR: ${opp.contact_name}: ${err.message}`);
        errors++;
      }
    }

    // Delay between requests to stay under 30 req/min rate limit
    await sleep(2200);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Summary ──
  console.log('\n=== Import Summary ===');
  console.log(`Total rows in file: ${rows.length}`);
  console.log(`Skipped (no email): ${rows.length - mapped.length}`);
  console.log(`Skipped (duplicate): ${duplicates}`);
  console.log(`${dryRun ? 'Would create' : 'Created'}: ${created}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${elapsed}s`);

  // ── Industry breakdown of imported ──
  console.log('\n--- Industry Breakdown (imported) ---');
  const indMap = {};
  mapped.forEach(m => {
    const k = m.enrichment_data.industry || '(null)';
    indMap[k] = (indMap[k] || 0) + 1;
  });
  Object.entries(indMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // ── State breakdown ──
  console.log('\n--- State Breakdown (imported) ---');
  const stateMap = {};
  mapped.forEach(m => {
    const k = m.enrichment_data.state || '(null)';
    stateMap[k] = (stateMap[k] || 0) + 1;
  });
  Object.entries(stateMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // ── Event tag summary ──
  const withEventTag = mapped.filter(m => m.enrichment_data.animation_yall_registered);
  console.log(`\nAnimation Y'all registered: ${withEventTag.length}`);
  withEventTag.forEach(m => console.log(`  - ${m.contact_name} <${m.contact_email}>`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
